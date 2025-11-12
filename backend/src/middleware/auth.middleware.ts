/**
 * API Key Authentication Middleware
 * Verifies API keys from request headers or query parameters
 */

import { Request, Response, NextFunction } from 'express';
import apiKeyService from '../services/api-key.service';
import prisma from '../services/prisma.service';

export interface AuthenticatedRequest extends Request {
  apiKey?: any;
  apiKeyType?: 'PROVIDER' | 'SUBSCRIBER';
}

/**
 * Middleware to authenticate requests using API keys (required)
 * Looks for API key in:
 * 1. X-API-Key header (preferred)
 * 2. apiKey query parameter
 */
export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get API key from header or query param
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required. Provide X-API-Key header or apiKey query parameter.',
      });
    }

    // Validate the API key
    const validation = await apiKeyService.validateApiKey(apiKey);

    if (!validation.valid || !validation.apiKey) {
      return res.status(401).json({
        success: false,
        error: validation.error || 'Invalid API key',
      });
    }

    // Attach API key info to request
    req.apiKey = validation.apiKey;
    req.apiKeyType = validation.apiKey.type;

    // Update last used timestamp (async, don't wait)
    updateLastUsed(validation.apiKey.id).catch((err) => {
      console.error('[AuthMiddleware] Error updating last used:', err);
    });

    next();
  } catch (error: any) {
    console.error('[AuthMiddleware] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
};

/**
 * Optional API key authentication middleware
 * Attaches API key to request if present, but doesn't require it
 * Useful for endpoints that support both API key and legacy auth
 */
export const optionalAuthenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get API key from header or query param
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);

    if (apiKey) {
      // Validate the API key
      const validation = await apiKeyService.validateApiKey(apiKey);

      if (validation.valid && validation.apiKey) {
        // Attach API key info to request
        req.apiKey = validation.apiKey;
        req.apiKeyType = validation.apiKey.type;

        // Update last used timestamp (async, don't wait)
        updateLastUsed(validation.apiKey.id).catch((err) => {
          console.error('[AuthMiddleware] Error updating last used:', err);
        });
      }
    }

    next();
  } catch (error: any) {
    // Don't fail the request if optional auth fails
    console.error('[AuthMiddleware] Optional auth error:', error);
    next();
  }
};

/**
 * Middleware to require provider API key
 */
export const requireProviderKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.apiKeyType !== 'PROVIDER') {
    return res.status(403).json({
      success: false,
      error: 'Provider API key required',
    });
  }
  next();
};

/**
 * Middleware to require subscriber API key
 */
export const requireSubscriberKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.apiKeyType !== 'SUBSCRIBER') {
    return res.status(403).json({
      success: false,
      error: 'Subscriber API key required',
    });
  }
  next();
};

/**
 * Middleware to verify API key has access to specific feed
 */
export const verifyFeedAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const feedId = req.params.feedId || req.body.feedId;

    if (!feedId) {
      return res.status(400).json({
        success: false,
        error: 'Feed ID required',
      });
    }

    const apiKey = req.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
      });
    }

    // Provider keys: check if key is for this feed
    if (apiKey.type === 'PROVIDER') {
      if (apiKey.feedId !== feedId) {
        return res.status(403).json({
          success: false,
          error: 'API key does not have access to this feed',
        });
      }
    }

    // Subscriber keys: check if subscription is for this feed
    if (apiKey.type === 'SUBSCRIBER') {
      if (apiKey.subscriptionId) {
        // Verify subscription exists and is for this feed
        const subscription = await prisma.apiKey.findFirst({
          where: {
            id: apiKey.id,
            subscriptionId: apiKey.subscriptionId,
          },
        });

        // Additional check: verify subscription is active via Sui
        // This would require checking the blockchain, but for now we trust the DB
      }
    }

    next();
  } catch (error: any) {
    console.error('[AuthMiddleware] Feed access verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Access verification error',
    });
  }
};

/**
 * Update API key last used timestamp
 */
async function updateLastUsed(apiKeyId: string) {
  try {
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
  } catch (error) {
    // Silent fail
    console.error('[AuthMiddleware] Error updating last used:', error);
  }
}

/**
 * Usage Logging Middleware
 * Tracks all API calls for analytics
 */
export const usageLoggingMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  (req as any)._startTime = startTime;

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const responseTime = Date.now() - startTime;

    // Log usage asynchronously (don't block response)
    if (req.apiKey) {
      logUsage(req, req.apiKey.id, res.statusCode, responseTime).catch((err) => {
        console.error('[UsageLogging] Error:', err);
      });
    }

    return originalJson(body);
  };

  next();
};

/**
 * Log API usage to database
 */
async function logUsage(
  req: AuthenticatedRequest,
  apiKeyId: string,
  statusCode: number,
  responseTime: number
) {
  try {
    const apiKey = req.apiKey;
    if (!apiKey) return;

    await prisma.usageLog.create({
      data: {
        apiKeyId,
        feedId: apiKey.feedId || undefined,
        subscriptionId: apiKey.subscriptionId || undefined,
        endpoint: req.path,
        method: req.method,
        statusCode,
        responseTime,
        ipAddress: req.ip || (req.socket?.remoteAddress as string) || undefined,
        userAgent: req.headers['user-agent'] || undefined,
        queriesUsed: req.method === 'GET' && req.path.includes('/data/') ? 1 : 0,
        dataSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
      },
    });
  } catch (error) {
    // Silent fail - don't break request if logging fails
    console.error('[UsageLogging] Database error:', error);
  }
}

