import { Router, Request, Response } from 'express';
import apiKeyService from '../services/api-key.service';
import { ApiKeyType } from '@prisma/client';

const router = Router();

/**
 * POST /api/api-keys/provider
 * Create a new provider API key for a feed
 */
router.post('/provider', async (req: Request, res: Response) => {
  try {
    const { feedId, providerAddress, name, description, expiresAt, rateLimit } = req.body;

    if (!feedId || !providerAddress) {
      return res.status(400).json({
        success: false,
        error: 'feedId and providerAddress are required',
      });
    }

    const result = await apiKeyService.createApiKey({
      type: ApiKeyType.PROVIDER,
      feedId,
      providerAddress,
      name,
      description,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      rateLimit,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error creating provider API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/api-keys/subscriber
 * Create a new subscriber API key for a subscription
 */
router.post('/subscriber', async (req: Request, res: Response) => {
  try {
    console.log('[ApiKeysRoute] Creating subscriber API key, body:', JSON.stringify(req.body, null, 2));
    const { subscriptionId, consumerAddress, name, description, expiresAt } = req.body;

    if (!subscriptionId || !consumerAddress) {
      console.error('[ApiKeysRoute] Missing required fields:', { subscriptionId: !!subscriptionId, consumerAddress: !!consumerAddress });
      return res.status(400).json({
        success: false,
        error: 'subscriptionId and consumerAddress are required',
      });
    }

    console.log('[ApiKeysRoute] Calling apiKeyService.createApiKey...');
    const result = await apiKeyService.createApiKey({
      type: ApiKeyType.SUBSCRIBER,
      subscriptionId,
      consumerAddress,
      name,
      description,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    console.log('[ApiKeysRoute] API key created successfully:', { id: result.id, keyPrefix: result.keyPrefix });
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[ApiKeysRoute] Error creating subscriber API key:', error);
    console.error('[ApiKeysRoute] Error stack:', error.stack);
    console.error('[ApiKeysRoute] Error code:', error.code);
    console.error('[ApiKeysRoute] Error meta:', error.meta);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create API key',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/api-keys/provider/:address
 * Get all provider API keys
 */
router.get('/provider/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const keys = await apiKeyService.getProviderKeys(address);

    res.json({
      success: true,
      data: keys,
    });
  } catch (error: any) {
    console.error('Error fetching provider keys:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/api-keys/subscriber/:address
 * Get all subscriber API keys
 */
router.get('/subscriber/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const keys = await apiKeyService.getSubscriberKeys(address);

    res.json({
      success: true,
      data: keys,
    });
  } catch (error: any) {
    console.error('Error fetching subscriber keys:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/api-keys/feed/:feedId
 * Get all API keys for a feed
 */
router.get('/feed/:feedId', async (req: Request, res: Response) => {
  try {
    const { feedId } = req.params;
    const keys = await apiKeyService.getFeedKeys(feedId);

    res.json({
      success: true,
      data: keys,
    });
  } catch (error: any) {
    console.error('Error fetching feed keys:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/api-keys/:keyId
 * Get API key details (without the actual key)
 */
router.get('/:keyId', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const key = await apiKeyService.getApiKeyDetails(keyId);

    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    res.json({
      success: true,
      data: key,
    });
  } catch (error: any) {
    console.error('Error fetching API key details:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/api-keys/:keyId
 * Revoke an API key
 */
router.delete('/:keyId', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    await apiKeyService.revokeApiKey(keyId);

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error: any) {
    console.error('Error revoking API key:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

