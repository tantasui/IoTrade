import { Router, Request, Response } from 'express';
import walrusService from '../services/walrus.service';
import suiService from '../services/sui.service';
import { DataFeedMetadata } from '../types';

const router = Router();

/**
 * GET /api/feeds
 * Get all available data feeds with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, isPremium, minPrice, maxPrice, location, limit } = req.query;

    // Get all feeds from blockchain
    const queryLimit = limit ? parseInt(limit as string) : 200; // Increased default limit
    let feeds = await suiService.getAllDataFeeds(queryLimit);

    // Apply filters
    if (category) {
      feeds = feeds.filter(feed => feed.category === category);
    }

    if (isPremium !== undefined) {
      feeds = feeds.filter(feed => feed.isPremium === (isPremium === 'true'));
    }

    if (minPrice) {
      feeds = feeds.filter(feed =>
        feed.monthlySubscriptionPrice >= parseInt(minPrice as string)
      );
    }

    if (maxPrice) {
      feeds = feeds.filter(feed =>
        feed.monthlySubscriptionPrice <= parseInt(maxPrice as string)
      );
    }

    if (location) {
      feeds = feeds.filter(feed =>
        feed.location.toLowerCase().includes((location as string).toLowerCase())
      );
    }

    res.json({
      success: true,
      data: feeds,
      count: feeds.length
    });
  } catch (error: any) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/feeds/:id
 * Get details of a specific data feed
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const feed = await suiService.getDataFeed(id);

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'Feed not found'
      });
    }

    res.json({
      success: true,
      data: feed
    });
  } catch (error: any) {
    console.error('Error fetching feed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/feeds
 * DEPRECATED: Feed creation is now handled by frontend with wallet signing
 * This endpoint is kept for backward compatibility but returns an error
 * Use the frontend to create feeds - it will handle wallet signing
 */
router.post('/', async (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated. Please use the frontend to create feeds with wallet signing.',
    message: 'Feed creation now requires wallet signing. Use the provider dashboard in the frontend.'
  });
});

/**
 * PUT /api/feeds/:id/data
 * DEPRECATED: Data updates are now handled by frontend with wallet signing
 * This endpoint only handles Walrus upload - blockchain update must be done via frontend
 */
router.put('/:id/data', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, provider } = req.body;

    // Get feed details
    const feed = await suiService.getDataFeed(id);

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'Feed not found'
      });
    }

    // Verify provider (in production, use proper authentication)
    if (provider && feed.provider !== provider) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Not the feed provider'
      });
    }

    // Upload new data to Walrus (still needed)
    // Pass feedId for Seal encryption if premium
    const encrypt = feed.isPremium;
    const newWalrusBlobId = await walrusService.uploadData(data, encrypt, id);

    // Return Walrus blob ID - frontend will update blockchain
    res.json({
      success: true,
      data: {
        feedId: id,
        walrusBlobId: newWalrusBlobId,
        message: 'Data uploaded to Walrus. Use frontend to update blockchain with this blobId.'
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

/**
 * POST /api/feeds/:id/rating
 * Submit a rating for a feed
 */
router.post('/:id/rating', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stars, comment } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({
        success: false,
        error: 'Invalid rating (must be 1-5)'
      });
    }

    const ratingId = await suiService.submitRating(id, stars, comment || '');

    res.json({
      success: true,
      data: {
        ratingId
      }
    });
  } catch (error: any) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
