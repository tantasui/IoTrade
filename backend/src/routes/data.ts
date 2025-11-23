import { Router, Request, Response } from 'express';
import walrusService from '../services/walrus.service';
import suiService from '../services/sui.service';
import { optionalAuthenticateApiKey, AuthenticatedRequest } from '../middleware/auth.middleware';
import { usageLoggingMiddleware } from '../middleware/auth.middleware';
import prisma from '../services/prisma.service';
import NodeCache from 'node-cache';

const router = Router();
const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL || '300') });

// Apply optional API key auth and usage logging to all data routes
router.use(optionalAuthenticateApiKey);
router.use(usageLoggingMiddleware);

/**
 * GET /api/data/:feedId
 * Retrieve data from a feed
 * Supports:
 * 1. API key authentication (preferred)
 * 2. Legacy subscriptionId + consumer (backward compatible)
 * 3. Preview mode (no auth required)
 */
router.get('/:feedId', async (req: Request | AuthenticatedRequest, res: Response) => {
  try {
    const { feedId } = req.params;
    const { subscriptionId, consumer, preview } = req.query;
    const authReq = req as AuthenticatedRequest;

    // Get feed details
    const feed = await suiService.getDataFeed(feedId);

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'Feed not found'
      });
    }

    if (!feed.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Feed is not active'
      });
    }

    // If preview mode, return limited data (no auth required)
    if (preview === 'true') {
      const cacheKey = `preview_${feedId}`;
      let previewData = cache.get(cacheKey);

      if (!previewData) {
        let fullData: any = null;
        try {
          fullData = await walrusService.retrieveData(feed.walrusBlobId);
        } catch (e: any) {
          const msg = e?.message || String(e);
          console.warn('[DataRoute] Walrus preview retrieval failed, returning placeholder sample:', msg);
          previewData = {
            sample: 'Preview temporarily unavailable. Subscribe to access live data.',
          };
          cache.set(cacheKey, previewData);
          return res.json({
            success: true,
            preview: true,
            data: previewData,
            feed: {
              name: feed.name,
              category: feed.category,
              description: feed.description,
              location: feed.location,
            },
          });
        }

        // Return only a sample of the data for preview
        if (Array.isArray(fullData)) {
          previewData = fullData.slice(0, 3);
        } else if (typeof fullData === 'object') {
          previewData = { sample: 'Preview data available after subscription' };
        } else {
          previewData = 'Preview: Subscribe to access full data';
        }

        cache.set(cacheKey, previewData);
      }

      return res.json({
        success: true,
        preview: true,
        data: previewData,
        feed: {
          name: feed.name,
          category: feed.category,
          description: feed.description,
          location: feed.location
        }
      });
    }

    // Check authentication: API key (preferred) or legacy subscription
    let hasAccess = false;
    let apiKeyId: string | undefined;

    // Try API key authentication first
    if (authReq.apiKey && authReq.apiKeyType === 'SUBSCRIBER') {
      // Verify API key has access to this feed
      if (authReq.apiKey.subscriptionId) {
        // Verify subscription is for this feed
        const subscription = await suiService.getSubscription(authReq.apiKey.subscriptionId);
        if (subscription && subscription.feedId === feedId) {
          hasAccess = await suiService.checkAccess(
            authReq.apiKey.subscriptionId,
            authReq.apiKey.consumerAddress || ''
          );
          apiKeyId = authReq.apiKey.id;
        }
      }
    }

    // Fallback to legacy authentication
    if (!hasAccess && subscriptionId && consumer) {
      hasAccess = await suiService.checkAccess(
        subscriptionId as string,
        consumer as string
      );
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Provide valid API key or subscription credentials.'
      });
    }

    // Check cache first
    const cacheKey = `data_${feedId}`;
    let data = cache.get(cacheKey);

    if (!data) {
      // Retrieve data from Walrus
      if (feed.isPremium) {
        // For premium feeds, return Seal-encrypted bytes (frontend will decrypt with Seal)
        // Don't cache encrypted data - it needs to be decrypted per request
        data = await walrusService.retrieveData(feed.walrusBlobId, undefined, feedId);
        
        // Return encrypted bytes as base64 for JSON transport
        if (data instanceof Uint8Array) {
          return res.json({
            success: true,
            encrypted: true,
            encryptionType: 'seal',
            data: Buffer.from(data).toString('base64'),
            feed: {
              id: feed.id,
              name: feed.name,
              category: feed.category,
              lastUpdated: feed.lastUpdated
            }
          });
        } else {
          // Premium feed data must be Seal-encrypted bytes
          throw new Error('Premium feed data must be Seal-encrypted bytes. Received invalid format.');
        }
      } else {
        data = await walrusService.retrieveData(feed.walrusBlobId);
        // Cache non-premium data
        cache.set(cacheKey, data);
      }
    }

    res.json({
      success: true,
      data,
      feed: {
        id: feed.id,
        name: feed.name,
        category: feed.category,
        lastUpdated: feed.lastUpdated
      }
    });
  } catch (error: any) {
    console.error('Error retrieving data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/data/:feedId/stream
 * WebSocket endpoint for real-time data streaming (handled in index.ts)
 */

/**
 * GET /api/data/:feedId/history
 * Get historical data for a feed (from DataHistory index)
 * Supports API key auth or legacy subscription auth
 */
router.get('/:feedId/history', async (req: Request | AuthenticatedRequest, res: Response) => {
  try {
    const { feedId } = req.params;
    const { subscriptionId, consumer, limit = '100', startDate, endDate } = req.query;
    const authReq = req as AuthenticatedRequest;

    // Verify access (same logic as main data endpoint)
    let hasAccess = false;
    if (authReq.apiKey && authReq.apiKeyType === 'SUBSCRIBER') {
      if (authReq.apiKey.subscriptionId) {
        const subscription = await suiService.getSubscription(authReq.apiKey.subscriptionId);
        if (subscription && subscription.feedId === feedId) {
          hasAccess = await suiService.checkAccess(
            authReq.apiKey.subscriptionId,
            authReq.apiKey.consumerAddress || ''
          );
        }
      }
    }

    if (!hasAccess && subscriptionId && consumer) {
      hasAccess = await suiService.checkAccess(
        subscriptionId as string,
        consumer as string
      );
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Provide valid API key or subscription credentials.'
      });
    }

    // Query DataHistory for this feed
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000); // Max 1000 records
    
    const where: any = { feedId };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const historyRecords = await prisma.dataHistory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limitNum,
      select: {
        id: true,
        blobId: true,
        timestamp: true,
        uploadedAt: true,
        dataSummary: true,
        dataSize: true,
        deviceId: true,
      },
    });

    // Fetch actual data from Walrus for each blob
    const historyData = await Promise.all(
      historyRecords.map(async (record) => {
        try {
          const data = await walrusService.retrieveData(record.blobId);
          return {
            timestamp: record.timestamp,
            uploadedAt: record.uploadedAt,
            data,
            summary: record.dataSummary,
            size: record.dataSize,
            deviceId: record.deviceId,
          };
        } catch (error) {
          // If blob retrieval fails, return summary only
          return {
            timestamp: record.timestamp,
            uploadedAt: record.uploadedAt,
            data: null,
            summary: record.dataSummary,
            size: record.dataSize,
            deviceId: record.deviceId,
            error: 'Failed to retrieve blob data',
          };
        }
      })
    );

    res.json({
      success: true,
      data: historyData,
      count: historyData.length,
      feedId,
    });
  } catch (error: any) {
    console.error('Error retrieving history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/data/upload
 * Upload data to Walrus (utility endpoint)
 * For premium feeds, feedId is required for Seal encryption
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { data, encrypt, feedId } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required'
      });
    }

    // For premium feeds, feedId is required for Seal encryption
    if (encrypt && !feedId) {
      return res.status(400).json({
        success: false,
        error: 'feedId is required for premium feed encryption'
      });
    }

    const blobId = await walrusService.uploadData(data, encrypt || false, feedId);

    res.json({
      success: true,
      data: {
        blobId
      }
    });
  } catch (error: any) {
    console.error('Error uploading data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
