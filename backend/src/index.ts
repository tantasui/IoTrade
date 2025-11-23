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
import { disconnectPrisma } from './services/prisma.service';

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
  consumerAddress?: string;
  sessionKey?: any; // ExportedSessionKey for Seal decryption
  signedTxBytes?: string; // Signed transaction bytes for seal_approve (base64)
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
        const { feedId, subscriptionId, consumer, apiKey, sessionKey, signedTxBytes } = data;

        let hasAccess = false;
        let apiKeyId: string | undefined;
        let consumerAddress: string | undefined;
        let resolvedSubscriptionId: string | undefined; // Store the actual subscription object ID

        // Try API key authentication first
        if (apiKey) {
          try {
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
                  consumerAddress = validation.apiKey.consumerAddress || undefined;
                  resolvedSubscriptionId = validation.apiKey.subscriptionId; // Store actual subscription ID
                }
              }
            }
          } catch (dbError: any) {
            // Handle database connection errors gracefully
            console.error('Database error during API key validation:', dbError.message);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Database connection error. Please try again later or contact support.'
            }));
            return;
          }
        }

        // Fallback to legacy authentication
        if (!hasAccess && subscriptionId && consumer) {
          hasAccess = await suiService.checkAccess(subscriptionId, consumer);
          consumerAddress = consumer;
          resolvedSubscriptionId = subscriptionId;
        }

        if (!hasAccess) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Access denied. Provide valid API key or subscription credentials.'
          }));
          return;
        }

        // Store connection info for seamless decryption
        client.feedId = feedId;
        client.subscriptionId = resolvedSubscriptionId; // Use resolved subscription ID (from API key or direct)
        client.apiKeyId = apiKeyId;
        client.consumerAddress = consumerAddress;
        
        // OPTION 1: Pre-authorized session keys - Auto-retrieve from database
        // If API key has stored session key, use it automatically (no wallet needed!)
        let finalSessionKey = sessionKey; // Use provided session key if available
        
        if (!finalSessionKey && apiKeyId) {
          try {
            const apiKeyService = (await import('./services/api-key.service')).default;
            const storedSessionKey = await apiKeyService.getStoredSessionKey(apiKeyId);
            
            if (storedSessionKey) {
              finalSessionKey = storedSessionKey;
              console.log('[WebSocket] ✅ Retrieved pre-authorized session key from database (Option 1)', {
                feedId,
                subscriptionId: resolvedSubscriptionId,
                apiKeyId: apiKeyId.slice(0, 8) + '...'
              });
            }
          } catch (error: any) {
            console.warn('[WebSocket] Failed to retrieve stored session key:', error.message);
          }
        }
        
        // Store session key for automatic backend decryption
        // Session key allows backend to decrypt seamlessly without frontend doing it
        if (finalSessionKey && consumerAddress && resolvedSubscriptionId) {
          client.sessionKey = finalSessionKey;
          
          // OPTION 1: Automatically store session key if provided and not already stored
          // This makes it seamless - user provides session key once, backend stores it
          if (sessionKey && apiKeyId) {
            // Check if we already have a stored session key
            const apiKeyService = (await import('./services/api-key.service')).default;
            const existingStored = await apiKeyService.getStoredSessionKey(apiKeyId);
            
            if (!existingStored) {
              // No stored session key - store the provided one automatically
              try {
                const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
                await apiKeyService.storeSessionKey(apiKeyId, sessionKey, expiresAt);
                console.log('[WebSocket] ✅ Auto-stored session key for future use (Option 1)', {
                  apiKeyId: apiKeyId.slice(0, 8) + '...',
                  expiresAt: expiresAt.toISOString(),
                  note: 'Subscriber-viewer can now use this API key without wallet!'
                });
              } catch (storeError: any) {
                console.warn('[WebSocket] Failed to auto-store session key:', storeError.message);
                // Continue anyway - session key is still used for this connection
              }
            } else {
              console.log('[WebSocket] ℹ️  Session key already stored, using stored version');
            }
          }
          
          console.log('[WebSocket] ✅ Session key ready for seamless automatic decryption', {
            feedId,
            subscriptionId: resolvedSubscriptionId,
            source: sessionKey ? 'provided' : 'stored',
            consumerAddress: consumerAddress.slice(0, 8) + '...'
          });
        } else if (!finalSessionKey && consumerAddress) {
          console.log('[WebSocket] ⚠️  No session key available - backend will send encrypted data', {
            feedId,
            subscriptionId: resolvedSubscriptionId,
            consumerAddress: consumerAddress.slice(0, 8) + '...',
            note: 'Connect via React frontend with wallet to create and auto-store session key'
          });
        }

        ws.send(JSON.stringify({
          type: 'subscribed',
          feedId
        }));

        // Send initial data
        const feed = await suiService.getDataFeed(feedId);
        if (feed) {
          if (feed.isPremium) {
            // For premium feeds, send encrypted bytes as base64
            const encryptedData = await walrusService.retrieveData(feed.walrusBlobId, undefined, feedId);
            if (encryptedData instanceof Uint8Array) {
              ws.send(JSON.stringify({
                type: 'data',
                feedId,
                encrypted: true,
                encryptionType: 'seal',
                data: Buffer.from(encryptedData).toString('base64'),
                timestamp: Date.now()
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'data',
                feedId,
                data: encryptedData,
                timestamp: Date.now()
              }));
            }
          } else {
            // For non-premium feeds, send plaintext data
            const feedData = await walrusService.retrieveData(feed.walrusBlobId);
            ws.send(JSON.stringify({
              type: 'data',
              feedId,
              data: feedData,
              timestamp: Date.now()
            }));
          }
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
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Check for database connection errors
      if (error.message && error.message.includes('Can\'t reach database server')) {
        errorMessage = 'Database connection error. The service is temporarily unavailable. Please try again later.';
      } else if (error.name === 'PrismaClientInitializationError') {
        errorMessage = 'Database connection error. Please try again later or contact support.';
      }
      
      ws.send(JSON.stringify({
        type: 'error',
        error: errorMessage
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
export async function broadcastDataUpdate(feedId: string, data: any, isPremium: boolean = false) {
  // If premium feed, we need to get encrypted bytes from Walrus
  // The data passed here is plaintext enrichedData, but for premium feeds
  // we need to broadcast the encrypted version
  if (isPremium) {
    try {
      // Get the latest blob ID from the feed
      const feed = await suiService.getDataFeed(feedId);
      if (!feed) {
        console.warn(`[broadcastDataUpdate] Premium feed ${feedId} not found, falling back to plaintext`);
      } else if (!feed.walrusBlobId) {
        console.warn(`[broadcastDataUpdate] Premium feed ${feedId} has no walrusBlobId, falling back to plaintext`);
      } else {
        const encryptedData = await walrusService.retrieveData(feed.walrusBlobId, undefined, feedId);
        if (encryptedData instanceof Uint8Array) {
          // Try to decrypt automatically for clients with session keys
          const sealService = (await import('./services/seal.service')).default;
          const base64Data = Buffer.from(encryptedData).toString('base64');
          
          // Decrypt for each connected client with session key
          await Promise.all(
            Array.from(clients).map(async (client: WSClient) => {
              if (client.feedId === feedId && client.ws.readyState === WebSocket.OPEN) {
                try {
                  // SEAMLESS DECRYPTION: If client has session key, decrypt automatically
                  if (client.sessionKey && client.subscriptionId && client.consumerAddress && sealService.isConfigured()) {
                    try {
                      console.log(`[broadcastDataUpdate] 🔓 Decrypting for client with session key`, {
                        feedId,
                        subscriptionId: client.subscriptionId?.slice(0, 8) + '...'
                      });
                      
                      const decryptedData = await sealService.decryptData(
                        base64Data,
                        feedId,
                        client.subscriptionId,
                        client.sessionKey,
                        client.consumerAddress
                      );
                      
                      // Send decrypted plaintext data - SEAMLESS for subscriber!
                      client.ws.send(JSON.stringify({
                        type: 'data',
                        feedId,
                        data: decryptedData, // Plaintext - no decryption needed on frontend
                        timestamp: Date.now()
                      }));
                      
                      console.log(`[broadcastDataUpdate] ✅ Sent decrypted plaintext to client`);
                      return;
                    } catch (decryptError: any) {
                      // Handle expired session key - clear it from client and database
                      if (decryptError.message === 'SESSION_KEY_EXPIRED' || decryptError.message?.includes('expired')) {
                        console.warn(`[broadcastDataUpdate] ⚠️  Session key expired, clearing from client and database`, {
                          feedId,
                          apiKeyId: client.apiKeyId?.slice(0, 8) + '...'
                        });
                        
                        // Clear session key from client
                        client.sessionKey = undefined;
                        
                        // Clear expired session key from database
                        if (client.apiKeyId) {
                          try {
                            const apiKeyService = (await import('./services/api-key.service')).default;
                            await apiKeyService.clearSessionKey(client.apiKeyId);
                            console.log(`[broadcastDataUpdate] ✅ Cleared expired session key from database`);
                          } catch (clearError: any) {
                            console.warn(`[broadcastDataUpdate] Failed to clear expired session key:`, clearError.message);
                          }
                        }
                      } else {
                        console.warn(`[broadcastDataUpdate] ❌ Auto-decryption failed:`, decryptError.message);
                      }
                      // Fall through to send encrypted
                    }
                  }
                  
                  // No session key or decryption failed - send encrypted bytes
                  // Frontend will need to decrypt manually
                  client.ws.send(JSON.stringify({
                    type: 'data',
                    feedId,
                    encrypted: true,
                    encryptionType: 'seal',
                    data: base64Data,
                    timestamp: Date.now()
                  }));
                } catch (sendError: any) {
                  console.warn(`[broadcastDataUpdate] Failed to send to client:`, sendError.message);
                }
              }
            })
          );
          return;
        } else {
          // Data was retrieved but is not Seal-encrypted bytes (Uint8Array)
          // This should not happen if data was uploaded with Seal encryption
          console.error(`[broadcastDataUpdate] Premium feed ${feedId} data is not Seal-encrypted bytes (type: ${typeof encryptedData}). Expected Uint8Array. Data may need to be re-uploaded with Seal encryption.`);
          // Fall through to plaintext broadcast as fallback
        }
      }
    } catch (error: any) {
      console.warn(`[broadcastDataUpdate] Failed to get encrypted data for premium feed ${feedId}:`, error.message);
      // Fall through to plaintext broadcast as fallback (shouldn't happen in production)
    }
  }
  
  // For non-premium feeds or fallback, broadcast plaintext data
  clients.forEach((client) => {
    if (client.feedId === feedId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify({
          type: 'data',
          feedId,
          data,
          timestamp: Date.now()
        }));
      } catch (sendError: any) {
        console.warn(`[broadcastDataUpdate] Failed to send to client:`, sendError.message);
      }
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

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  
  // Stop accepting new connections
  clearInterval(heartbeatInterval);
  
  // Close WebSocket connections
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.close();
    }
  });
  clients.clear();
  
  // Close HTTP server
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Disconnect Prisma to release database connections
    await disconnectPrisma();
    
    console.log('Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
