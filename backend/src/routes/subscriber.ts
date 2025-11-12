/**
 * Subscriber Dashboard Routes
 * Routes for subscribers to manage subscriptions, API keys, and view usage
 */

import { Router, Request, Response } from 'express';
import suiService from '../services/sui.service';
import apiKeyService from '../services/api-key.service';
import prisma from '../services/prisma.service';
import type { ApiKey } from '@prisma/client';

const router = Router();

/**
 * GET /api/subscriber/:address/subscriptions
 * Get all subscriptions for a subscriber address
 * Fetches from blockchain directly, then enriches with API key info if available
 */
router.get('/:address/subscriptions', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Get subscriptions directly from blockchain
    const blockchainSubscriptions = await suiService.getSubscriptionsByConsumer(address);

    // Try to get API keys for this subscriber to enrich subscription data
    // If Prisma fails, we'll just skip enrichment and return subscriptions without API key info
    let apiKeysBySubscriptionId = new Map();
    try {
      const apiKeys = await apiKeyService.getApiKeysBySubscriber(address);
      apiKeysBySubscriptionId = new Map(
        apiKeys
          .filter((key: ApiKey) => key.subscriptionId)
          .map((key: ApiKey) => [key.subscriptionId!, key])
      );
    } catch (prismaError: any) {
      console.warn('[SubscriberRoute] Failed to fetch API keys (Prisma error), continuing without enrichment:', prismaError.message);
      // Continue without API key enrichment
    }

    // Enrich subscriptions with API key info if available
    const enrichedSubscriptions = blockchainSubscriptions.map((subscription) => {
      const apiKey = apiKeysBySubscriptionId.get(subscription.id);
      return {
        ...subscription,
        apiKeyId: apiKey?.id,
        apiKeyPrefix: apiKey?.keyPrefix,
      };
    });

    res.json({
      success: true,
      data: enrichedSubscriptions,
      count: enrichedSubscriptions.length,
    });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/subscriber/:address/api-keys
 * Get all API keys for a subscriber
 */
router.get('/:address/api-keys', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const apiKeys = await apiKeyService.getApiKeysBySubscriber(address);

    res.json({
      success: true,
      data: apiKeys,
      count: apiKeys.length,
    });
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/subscriber/:address/usage
 * Get usage statistics for a subscriber
 */
router.get('/:address/usage', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { startDate, endDate, feedId } = req.query;

    // Try to get API keys for this subscriber
    // If Prisma fails, return empty usage stats
    let apiKeyIds: string[] = [];
    try {
      const apiKeys = await apiKeyService.getApiKeysBySubscriber(address);
      apiKeyIds = apiKeys.map((key: ApiKey) => key.id);
    } catch (prismaError: any) {
      console.warn('[SubscriberRoute] Failed to fetch API keys for usage stats:', prismaError.message);
      // Return empty usage stats if we can't fetch API keys
      return res.json({
        success: true,
        data: {
          totalRequests: 0,
          totalQueries: 0,
          totalDataSize: 0,
          byFeed: [],
          byDate: [],
        },
      });
    }

    if (apiKeyIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalRequests: 0,
          totalQueries: 0,
          totalDataSize: 0,
          byFeed: [],
          byDate: [],
        },
      });
    }

    // Build where clause
    const where: any = {
      apiKeyId: { in: apiKeyIds },
    };

    if (feedId) {
      where.feedId = feedId as string;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    // Get usage logs
    const usageLogs = await prisma.usageLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000, // Limit for performance
    });

    // Aggregate statistics
    const totalRequests = usageLogs.length;
    const totalQueries = usageLogs.reduce((sum, log) => sum + (log.queriesUsed || 0), 0);
    const totalDataSize = usageLogs.reduce((sum, log) => sum + (log.dataSize || 0), 0);

    // Group by feed
    const byFeed: Record<string, any> = {};
    usageLogs.forEach(log => {
      if (log.feedId) {
        if (!byFeed[log.feedId]) {
          byFeed[log.feedId] = {
            feedId: log.feedId,
            requests: 0,
            queries: 0,
            dataSize: 0,
          };
        }
        byFeed[log.feedId].requests++;
        byFeed[log.feedId].queries += log.queriesUsed || 0;
        byFeed[log.feedId].dataSize += log.dataSize || 0;
      }
    });

    // Group by date
    const byDate: Record<string, any> = {};
    usageLogs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = {
          date,
          requests: 0,
          queries: 0,
          dataSize: 0,
        };
      }
      byDate[date].requests++;
      byDate[date].queries += log.queriesUsed || 0;
      byDate[date].dataSize += log.dataSize || 0;
    });

    res.json({
      success: true,
      data: {
        totalRequests,
        totalQueries,
        totalDataSize,
        byFeed: Object.values(byFeed),
        byDate: Object.values(byDate).sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
      },
    });
  } catch (error: any) {
    console.error('Error fetching usage:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/subscriber/:address/feeds
 * Get all feeds the subscriber has access to
 */
router.get('/:address/feeds', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Get API keys for this subscriber
    const apiKeys = await apiKeyService.getApiKeysBySubscriber(address);

    // Get unique feed IDs from subscriptions
    const feedIds = new Set<string>();
    for (const key of apiKeys) {
      if (key.subscriptionId) {
        const subscription = await suiService.getSubscription(key.subscriptionId);
        if (subscription && subscription.feedId) {
          feedIds.add(subscription.feedId);
        }
      }
    }

    // Get feed details
    const feeds = await Promise.all(
      Array.from(feedIds).map(async (feedId) => {
        const feed = await suiService.getDataFeed(feedId);
        return feed;
      })
    );

    const validFeeds = feeds.filter(f => f !== null);

    res.json({
      success: true,
      data: validFeeds,
      count: validFeeds.length,
    });
  } catch (error: any) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

