import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import feedsRouter from './routes/feeds';
import subscriptionsRouter from './routes/subscriptions';
import dataRouter from './routes/data';
import iotRouter from './routes/iot';
import apiKeysRouter from './routes/api-keys';
import subscriberRouter from './routes/subscriber';
import suiService from './services/sui.service';
import walrusService from './services/walrus.service';
import { optionalAuthenticateApiKey, AuthenticatedRequest } from './middleware/auth.middleware';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = parseInt(process.env.PORT || '3001', 10);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for IoT devices and ngrok
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle ngrok browser warning header
app.use((req, res, next) => {
  // Allow ngrok requests without browser warning
  if (req.headers['ngrok-skip-browser-warning']) {
    res.setHeader('ngrok-skip-browser-warning', 'true');
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/feeds', feedsRouter);
app.use('/api/subscribe', subscriptionsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/data', dataRouter);
app.use('/api/iot', iotRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/subscriber', subscriberRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'IoT Data Marketplace API',
    version: '1.0.0',
    endpoints: {
      feeds: '/api/feeds',
      subscriptions: '/api/subscriptions',
      data: '/api/data',
      websocket: '/ws'
    }
  });
});

// WebSocket handling for real-time data streaming
interface WSClient {
  ws: WebSocket;
  feedId?: string;
  subscriptionId?: string;
  apiKeyId?: string;
  isAlive: boolean;
}

const clients = new Set<WSClient>();

wss.on('connection', (ws: WebSocket, req: any) => {
  console.log('New WebSocket connection');

  const client: WSClient = {
    ws,
    isAlive: true
  };

  clients.add(client);

  // Heartbeat
  ws.on('pong', () => {
    client.isAlive = true;
  });

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'subscribe') {
        // Subscribe to a feed
        const { feedId, subscriptionId, consumer, apiKey } = data;

        let hasAccess = false;
        let apiKeyId: string | undefined;

        // Try API key authentication first
        if (apiKey) {
          const apiKeyService = (await import('./services/api-key.service')).default;
          const validation = await apiKeyService.validateApiKey(apiKey);
          
          if (validation.valid && validation.apiKey && validation.apiKey.type === 'SUBSCRIBER') {
            if (validation.apiKey.subscriptionId) {
              const subscription = await suiService.getSubscription(validation.apiKey.subscriptionId);
              if (subscription && subscription.feedId === feedId) {
                hasAccess = await suiService.checkAccess(
                  validation.apiKey.subscriptionId,
                  validation.apiKey.consumerAddress || ''
                );
                apiKeyId = validation.apiKey.id;
              }
            }
          }
        }

        // Fallback to legacy authentication
        if (!hasAccess && subscriptionId && consumer) {
          hasAccess = await suiService.checkAccess(subscriptionId, consumer);
        }

        if (!hasAccess) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Access denied. Provide valid API key or subscription credentials.'
          }));
          return;
        }

        client.feedId = feedId;
        client.subscriptionId = subscriptionId;
        client.apiKeyId = apiKeyId;

        ws.send(JSON.stringify({
          type: 'subscribed',
          feedId
        }));

        // Send initial data
        const feed = await suiService.getDataFeed(feedId);
        if (feed) {
          const feedData = await walrusService.retrieveData(feed.walrusBlobId);
          ws.send(JSON.stringify({
            type: 'data',
            feedId,
            data: feedData,
            timestamp: Date.now()
          }));
        }
      } else if (data.type === 'unsubscribe') {
        client.feedId = undefined;
        client.subscriptionId = undefined;
        client.apiKeyId = undefined;

        ws.send(JSON.stringify({
          type: 'unsubscribed'
        }));
      }
    } catch (error: any) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clients.delete(client);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(client);
  });
});

// Heartbeat interval to check connection health
const heartbeatInterval = setInterval(() => {
  clients.forEach((client) => {
    if (!client.isAlive) {
      client.ws.terminate();
      clients.delete(client);
      return;
    }

    client.isAlive = false;
    client.ws.ping();
  });
}, 30000); // 30 seconds

// Broadcast data updates to subscribed clients
export function broadcastDataUpdate(feedId: string, data: any) {
  clients.forEach((client) => {
    if (client.feedId === feedId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'data',
        feedId,
        data,
        timestamp: Date.now()
      }));
    }
  });
}

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
// Listen on all interfaces (0.0.0.0) for WSL port forwarding to Wokwi
server.listen(port, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  IoT Data Marketplace API Server                          ║
║  Version: 1.0.0                                           ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://0.0.0.0:${port} (all interfaces) ║
║  Local access: http://localhost:${port}                     ║
║  Wokwi access: http://host.wokwi.internal:${port}           ║
║  WebSocket endpoint: ws://localhost:${port}/ws               ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log('API Endpoints:');
  console.log(`  GET    /health`);
  console.log(`  GET    /api/feeds`);
  console.log(`  POST   /api/feeds`);
  console.log(`  GET    /api/feeds/:id`);
  console.log(`  PUT    /api/feeds/:id/data`);
  console.log(`  POST   /api/subscribe/:feedId`);
  console.log(`  GET    /api/subscriptions/:id`);
  console.log(`  GET    /api/data/:feedId`);
  console.log(`  WS     /ws`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  clearInterval(heartbeatInterval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
