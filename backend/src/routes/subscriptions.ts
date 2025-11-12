import { Router, Request, Response } from 'express';
import suiService from '../services/sui.service';
import { SubscriptionTier } from '../types';

const router = Router();

/**
 * POST /api/subscribe/:feedId
 * DEPRECATED: Subscriptions are now handled by frontend with wallet signing
 * This endpoint is kept for backward compatibility but returns an error
 * Use the frontend to subscribe - it will handle wallet signing
 */
router.post('/:feedId', async (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated. Please use the frontend to subscribe with wallet signing.',
    message: 'Subscriptions now require wallet signing. Use the marketplace in the frontend.'
  });
});

/**
 * GET /api/subscriptions/:id
 * Get subscription details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const subscription = await suiService.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/subscriptions/:id/verify
 * Verify subscription access
 */
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { consumer } = req.body;

    if (!consumer) {
      return res.status(400).json({
        success: false,
        error: 'Consumer address required'
      });
    }

    const hasAccess = await suiService.checkAccess(id, consumer);

    res.json({
      success: true,
      data: {
        hasAccess,
        subscriptionId: id
      }
    });
  } catch (error: any) {
    console.error('Error verifying access:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
