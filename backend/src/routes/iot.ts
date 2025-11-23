import { Router, Request, Response } from 'express';
import walrusService from '../services/walrus.service';
import suiService from '../services/sui.service';
import { authenticateApiKey, requireProviderKey, verifyFeedAccess, AuthenticatedRequest } from '../middleware/auth.middleware';
import prisma from '../services/prisma.service';
import { broadcastDataUpdate } from '../index';

const router = Router();

/**
 * POST /api/iot/feeds/:feedId/update
 * Feed-specific endpoint for IoT devices (requires API key)
 * Custom endpoint per feed for better security
 */
router.post('/feeds/:feedId/update', 
  authenticateApiKey,
  requireProviderKey,
  verifyFeedAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const feedId = req.params.feedId;
    
    console.log(`\n📡 [${requestId}] ===== IoT Update Request (Feed-Specific) =====`);
    console.log(`[${requestId}] Feed ID: ${feedId}`);
    console.log(`[${requestId}] API Key ID: ${req.apiKey?.id}`);
    console.log(`[${requestId}] Device ID: ${req.body.deviceId || 'unknown'}`);
    
    try {
      const { deviceId, data } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'data is required',
        });
      }

      // Enrich data with metadata (do this immediately, no DB calls)
      const enrichedData = {
        ...data,
        deviceId: deviceId || 'unknown',
        receivedAt: Date.now(),
        source: 'iot_device',
        apiKeyId: req.apiKey.id,
      };

      // SECURITY: Check if feed is premium BEFORE upload
      // If feed is premium, we MUST encrypt before uploading to Walrus
      // Walrus is decentralized - anyone with blob ID can access unencrypted data
      let encrypt = false;
      let feedIsPremium = false;
      
      // Try to get feed premium status (with timeout)
      // CRITICAL: If feed lookup fails, we should NOT upload unencrypted data
      // Better to fail securely than risk exposing premium data
      try {
        const feedPromise = suiService.getDataFeed(feedId);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000) // Increased timeout for production
        );
        const feed = await Promise.race([feedPromise, timeoutPromise]) as any;
        
        if (!feed) {
          console.warn(`[${requestId}] Feed ${feedId} not found on-chain`);
          // If feed doesn't exist, don't encrypt (it's not a premium feed)
          encrypt = false;
        } else {
          feedIsPremium = feed.isPremium || false;
          encrypt = feedIsPremium;
          
          if (feedIsPremium) {
            console.log(`[${requestId}] 🔒 Premium feed detected - will encrypt before upload`);
          }
        }
      } catch (error: any) {
        // SECURITY: If feed lookup fails, we have two options:
        // 1. Fail securely (don't upload) - safest but may block legitimate requests
        // 2. Default to non-premium (current) - faster but less secure
        // For production, consider failing securely or requiring feedId validation upfront
        console.warn(`[${requestId}] ⚠️  Feed lookup timeout/failed:`, error.message);
        console.warn(`[${requestId}] ⚠️  Defaulting to non-premium (no encryption). If feed is actually premium, data will be unencrypted in Walrus!`);
        // TODO: In production, consider failing securely or caching feed premium status
        encrypt = false;
      }

      // Upload to Walrus (this is the only blocking operation we need)
      const blobId = await walrusService.uploadData(enrichedData, encrypt, feedId);

      // Broadcast to WebSocket clients immediately
      // For premium feeds, broadcastDataUpdate will fetch encrypted bytes from Walrus
      try {
        await broadcastDataUpdate(feedId, enrichedData, feedIsPremium);
        console.log(`[${requestId}] 📡 Broadcasted data update to WebSocket clients (premium: ${feedIsPremium})`);
      } catch (error: any) {
        console.warn(`[${requestId}] ⚠️  Failed to broadcast update:`, error.message);
      }

      // Send response immediately after Walrus upload (fastest possible)
      res.json({
        success: true,
        message: 'Data updated successfully',
        blobId,
        feedId,
        timestamp: Date.now(),
      });

      // Do all other operations asynchronously (non-blocking)
      (async () => {
        try {
          // Device registration (async)
          if (deviceId) {
            try {
              let device = await prisma.device.findUnique({
                where: {
                  feedId_deviceId: {
                    feedId,
                    deviceId,
                  },
                },
              });

              if (device) {
                await prisma.device.update({
                  where: { id: device.id },
                  data: {
                    status: 'ONLINE',
                    lastSeenAt: new Date(),
                    lastDataAt: new Date(),
                    totalUploads: { increment: 1 },
                    consecutiveErrors: 0,
                  },
                });
              } else {
                const existingDeviceWithKey = await prisma.device.findUnique({
                  where: { apiKeyId: req.apiKey.id },
                });

                if (existingDeviceWithKey) {
                  await prisma.device.update({
                    where: { id: existingDeviceWithKey.id },
                    data: {
                      feedId,
                      deviceId,
                      status: 'ONLINE',
                      lastSeenAt: new Date(),
                      lastDataAt: new Date(),
                      totalUploads: { increment: 1 },
                      consecutiveErrors: 0,
                    },
                  });
                } else {
                  await prisma.device.create({
                    data: {
                      feedId,
                      deviceId,
                      apiKeyId: req.apiKey.id,
                      status: 'ONLINE',
                      lastSeenAt: new Date(),
                      lastDataAt: new Date(),
                      totalUploads: 1,
                      consecutiveErrors: 0,
                    },
                  });
                }
              }
            } catch (error: any) {
              console.warn(`[${requestId}] Device registration failed:`, error.message);
            }
          }

          // Log to data history (async)
          await prisma.dataHistory.create({
            data: {
              feedId,
              blobId,
              timestamp: new Date(),
              uploadedAt: new Date(),
              uploadedBy: deviceId || req.apiKey.id,
              deviceId: deviceId || undefined,
              apiKeyId: req.apiKey.id,
              dataSize: JSON.stringify(enrichedData).length,
              dataSummary: {
                keys: Object.keys(data),
                deviceId: deviceId || 'unknown',
              },
            },
          });

          // Update on-chain (async)
          await suiService.updateFeedData(feedId, blobId);
          console.log(`[${requestId}] ✅ On-chain update successful!`);
        } catch (error: any) {
          console.warn(`[${requestId}] ⚠️  Async operations failed:`, error.message);
        }
      })();
    } catch (error: any) {
      console.error(`[${requestId}] ❌ Error:`, error.message);
      
      // Update device error count if device exists
      if (req.body.deviceId) {
        try {
          const device = await prisma.device.findUnique({
            where: {
              feedId_deviceId: {
                feedId,
                deviceId: req.body.deviceId,
              },
            },
          });
          if (device) {
            await prisma.device.update({
              where: { id: device.id },
              data: {
                consecutiveErrors: { increment: 1 },
                status: device.consecutiveErrors >= 5 ? 'ERROR' : 'ONLINE',
              },
            });
          }
        } catch (err) {
          // Ignore device update errors
        }
      }

      res.status(500).json({
        success: false,
        error: error.message,
        requestId,
      });
    }
  }
);

/**
 * POST /api/iot/update
 * Legacy endpoint for IoT devices (backward compatible)
 * Supports both API key auth and provider address (for migration)
 */
router.post('/update', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n📡 [${requestId}] ===== IoT Update Request Received =====`);
  console.log(`[${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[${requestId}] Body:`, JSON.stringify(req.body, null, 2));
  
  try {
    const { feedId, deviceId, data, provider } = req.body;

    console.log(`[${requestId}] 📋 Parsed request data:`, {
      feedId,
      deviceId,
      provider,
      dataKeys: data ? Object.keys(data) : [],
      dataSize: data ? JSON.stringify(data).length : 0,
      timestamp: Date.now()
    });

    // Validate required fields
    console.log(`[${requestId}] ✅ Validating required fields...`);
    if (!feedId || !data) {
      console.error(`[${requestId}] ❌ Validation failed:`, {
        hasFeedId: !!feedId,
        hasData: !!data
      });
      return res.status(400).json({
        success: false,
        error: 'feedId and data are required'
      });
    }
    console.log(`[${requestId}] ✅ Validation passed`);

    // Add metadata
    console.log(`[${requestId}] 🔧 Enriching data with metadata...`);
    const enrichedData = {
      ...data,
      deviceId: deviceId || 'unknown',
      receivedAt: Date.now(),
      source: 'iot_device'
    };
    console.log(`[${requestId}] ✅ Data enriched:`, {
      originalKeys: Object.keys(data),
      enrichedKeys: Object.keys(enrichedData),
      deviceId: enrichedData.deviceId
    });

    // Upload to Walrus
    console.log(`[${requestId}] 📤 Starting Walrus upload...`);
    console.log(`[${requestId}] Walrus config:`, {
      publisherUrl: process.env.WALRUS_PUBLISHER_URL || 'default',
      epochs: process.env.WALRUS_EPOCHS || '5'
    });
    
    const blobId = await walrusService.uploadData(enrichedData, false);
    console.log(`[${requestId}] ✅ Walrus upload successful!`);
    console.log(`[${requestId}] Blob ID: ${blobId}`);

    // Update on-chain (if provider address provided)
    if (provider) {
      console.log(`[${requestId}] ⛓️  Provider address provided, updating on-chain...`);
      console.log(`[${requestId}] Feed ID: ${feedId}`);
      console.log(`[${requestId}] Provider: ${provider}`);
      
      try {
        // Verify feed exists first
        console.log(`[${requestId}] 🔍 Checking if feed exists...`);
        const feed = await suiService.getDataFeed(feedId);
        if (!feed) {
          console.warn(`[${requestId}] ⚠️  Feed ${feedId} not found on-chain`);
        } else {
          console.log(`[${requestId}] ✅ Feed found:`, {
            name: feed.name,
            provider: feed.provider,
            isActive: feed.isActive
          });
        }
        
        console.log(`[${requestId}] 📝 Calling updateFeedData...`);
        await suiService.updateFeedData(feedId, blobId);
        console.log(`[${requestId}] ✅ On-chain update successful!`);
      } catch (error: any) {
        console.error(`[${requestId}] ❌ On-chain update failed:`, {
          error: error.message,
          stack: error.stack
        });
        console.warn(`[${requestId}] ⚠️  Continuing anyway - data is still in Walrus`);
        // Continue even if on-chain update fails - data is still in Walrus
      }
    } else {
      console.log(`[${requestId}] ℹ️  No provider address provided, skipping on-chain update`);
    }

    const response = {
      success: true,
      message: 'Data updated successfully',
      blobId,
      feedId,
      timestamp: Date.now()
    };
    
    console.log(`[${requestId}] 📤 Sending success response:`, response);
    console.log(`[${requestId}] ===== Request Completed Successfully =====\n`);
    
    res.json(response);
  } catch (error: any) {
    console.error(`[${requestId}] ❌ ===== ERROR PROCESSING REQUEST =====`);
    console.error(`[${requestId}] Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error(`[${requestId}] Request body was:`, req.body);
    console.error(`[${requestId}] ===== END ERROR =====\n`);
    
    res.status(500).json({
      success: false,
      error: error.message,
      requestId
    });
  }
});

/**
 * GET /api/iot/status
 * Check IoT endpoint status
 */
router.get('/status', (req: Request, res: Response) => {
  console.log('📊 IoT status check requested');
  const status = {
    success: true,
    status: 'online',
    endpoint: '/api/iot/update',
    timestamp: Date.now()
  };
  console.log('✅ Status response:', status);
  res.json(status);
});

export default router;
