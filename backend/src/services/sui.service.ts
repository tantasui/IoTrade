import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromHEX } from '@mysten/sui/utils';
import { DataFeedMetadata, DataFeed, Subscription } from '../types';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import dotenv from 'dotenv';

// Ensure environment variables are loaded before using process.env
dotenv.config();

export class SuiService {
  private client: SuiClient;
  private keypair: Ed25519Keypair | null = null;
  private packageId: string;

  constructor() {
    const network = process.env.SUI_NETWORK || 'testnet';
    const fullnodeUrl = process.env.SUI_FULLNODE_URL || getFullnodeUrl(network as any);
    this.client = new SuiClient({ url: fullnodeUrl });
    this.packageId = process.env.SUI_PACKAGE_ID || '';

    // Initialize keypair if private key is provided
    if (process.env.SUI_PRIVATE_KEY) {
      try {
        // Support Bech32 encoded keys (suiprivkey1...) and raw hex
        const maybeKey = process.env.SUI_PRIVATE_KEY.trim();
        if (maybeKey.startsWith('suiprivkey1')) {
          const decoded = decodeSuiPrivateKey(maybeKey);
          this.keypair = Ed25519Keypair.fromSecretKey(decoded.secretKey);
          console.log('[SuiService] Loaded private key from Bech32 suiprivkey string');
        } else {
          const privateKeyBytes = fromHEX(maybeKey);
          this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
        }
      } catch (error) {
        console.warn('Invalid SUI_PRIVATE_KEY provided');
      }
    }

    console.log('[SuiService] Config', {
      network,
      fullnodeUrl,
      packageIdSet: !!this.packageId,
      registrySet: !!process.env.SUI_REGISTRY_ID,
      treasurySet: !!process.env.SUI_TREASURY_ID,
      keypairLoaded: !!this.keypair,
    });
  }

  /**
   * Get the current address
   */
  getAddress(): string {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }
    return this.keypair.getPublicKey().toSuiAddress();
  }

  /**
   * Register a new data feed
   */
  async registerDataFeed(
    provider: string,
    metadata: DataFeedMetadata,
    walrusBlobId: string
  ): Promise<string> {
    try {
      if (!this.keypair) {
        throw new Error('Keypair not initialized. Ensure SUI_PRIVATE_KEY is set.');
      }
      if (!this.packageId) {
        throw new Error('SUI_PACKAGE_ID not configured. Set it in environment.');
      }

      const tx = new TransactionBlock();

      // Get the registry object (you'll need to get this from on-chain)
      const registryId = await this.getRegistryId();

      tx.moveCall({
        target: `${this.packageId}::data_marketplace::register_data_feed`,
        arguments: [
          tx.object(registryId),
          tx.pure.string(metadata.name),
          tx.pure.string(metadata.category),
          tx.pure.string(metadata.description),
          tx.pure.string(metadata.location),
          tx.pure.u64(metadata.pricePerQuery),
          tx.pure.u64(metadata.monthlySubscriptionPrice),
          tx.pure.bool(metadata.isPremium),
          tx.pure.string(walrusBlobId),
          tx.pure.u64(metadata.updateFrequency),
        ],
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      // Extract the created feed ID from object changes
      const createdObjects = result.objectChanges?.filter(
        (change) => change.type === 'created'
      );

      if (createdObjects && createdObjects.length > 0) {
        const feedObject = createdObjects.find((obj: any) =>
          obj.objectType.includes('DataFeed')
        );
        if (feedObject && 'objectId' in feedObject) {
          console.log(`Data feed registered with ID: ${feedObject.objectId}`);
          return feedObject.objectId;
        }
      }

      throw new Error('Failed to extract feed ID from transaction result');
    } catch (error: any) {
      console.error('Error registering data feed:', error.message);
      throw new Error(`Failed to register data feed: ${error.message}`);
    }
  }

  /**
   * Update data feed with new Walrus blob ID
   */
  async updateFeedData(
    feedId: string,
    newWalrusBlobId: string
  ): Promise<boolean> {
    try {
      if (!this.keypair) {
        throw new Error('Keypair not initialized');
      }

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::data_marketplace::update_feed_data`,
        arguments: [
          tx.object(feedId),
          tx.pure.string(newWalrusBlobId),
        ],
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
      });

      console.log(`Data feed updated: ${feedId}`);
      return result.effects?.status.status === 'success';
    } catch (error: any) {
      console.error('Error updating feed data:', error.message);
      throw new Error(`Failed to update feed data: ${error.message}`);
    }
  }

  /**
   * Subscribe to a data feed
   */
  async subscribe(
    consumer: string,
    feedId: string,
    tier: number,
    paymentAmount: number
  ): Promise<string> {
    try {
      if (!this.keypair) {
        throw new Error('Keypair not initialized');
      }

      const tx = new TransactionBlock();

      // Get necessary objects
      const registryId = await this.getRegistryId();
      const treasuryId = await this.getTreasuryId();

      // Split coin for payment
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(paymentAmount)]);

      tx.moveCall({
        target: `${this.packageId}::subscription::subscribe_to_feed`,
        arguments: [
          tx.object(feedId),
          tx.object(registryId),
          tx.object(treasuryId),
          coin,
          tx.pure.u8(tier),
        ],
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });

      // Extract subscription ID
      const createdObjects = result.objectChanges?.filter(
        (change) => change.type === 'created'
      );

      if (createdObjects && createdObjects.length > 0) {
        const subscriptionObject = createdObjects.find((obj: any) =>
          obj.objectType.includes('Subscription')
        );
        if (subscriptionObject && 'objectId' in subscriptionObject) {
          console.log(`Subscription created: ${subscriptionObject.objectId}`);
          return subscriptionObject.objectId;
        }
      }

      // Fallback: try to extract from emitted events
      const events = (result as any).events || [];
      for (const ev of events) {
        const evType: string | undefined = ev?.type;
        const parsed = ev?.parsedJson;
        if (evType && evType.includes('SubscriptionCreated') && parsed && 'subscription_id' in parsed) {
          const subId = (parsed as any).subscription_id;
          if (typeof subId === 'string' && subId.length > 0) {
            console.log(`Subscription created via event: ${subId}`);
            return subId;
          }
        }
      }

      throw new Error('Failed to extract subscription ID');
    } catch (error: any) {
      console.error('Error subscribing:', error.message);
      throw new Error(`Failed to subscribe: ${error.message}`);
    }
  }

  /**
   * Check if user has access to a feed
   */
  async checkAccess(
    subscriptionId: string,
    consumer: string
  ): Promise<boolean> {
    try {
      // Get subscription object
      const subscription = await this.getSubscription(subscriptionId);

      if (!subscription) {
        return false;
      }

      // Check if consumer matches and subscription is active
      if (subscription.consumer !== consumer || !subscription.isActive) {
        return false;
      }

      // Get current Sui epoch and compare with expiry epoch
      // Epochs are Sui epochs, not Unix timestamps
      const latestSuiSystemState = await this.client.getLatestSuiSystemState();
      const currentEpoch = parseInt(latestSuiSystemState.epoch);

      return currentEpoch <= subscription.expiryEpoch;
    } catch (error: any) {
      console.error('Error checking access:', error.message);
      return false;
    }
  }

  /**
   * Get data feed details
   */
  async getDataFeed(feedId: string): Promise<DataFeed | null> {
    const maxRetries = parseInt(process.env.SUI_OBJECT_RETRY || '2');
    const delayMs = parseInt(process.env.SUI_OBJECT_RETRY_DELAY_MS || '600');

    for (let attempt = 1; attempt <= (maxRetries + 1); attempt++) {
      try {
        const object = await this.client.getObject({
          id: feedId,
          options: {
            showContent: true,
          },
        });

        if (object.data && object.data.content && 'fields' in object.data.content) {
          const fields = object.data.content.fields as any;

          return {
            id: feedId,
            provider: fields.provider,
            name: fields.name,
            category: fields.category,
            description: fields.description,
            location: fields.location,
            pricePerQuery: parseInt(fields.price_per_query),
            monthlySubscriptionPrice: parseInt(fields.monthly_subscription_price),
            isPremium: fields.is_premium,
            walrusBlobId: fields.walrus_blob_id,
            createdAt: parseInt(fields.created_at),
            lastUpdated: parseInt(fields.last_updated),
            isActive: fields.is_active,
            updateFrequency: parseInt(fields.update_frequency),
            totalSubscribers: parseInt(fields.total_subscribers),
            totalRevenue: parseInt(fields.total_revenue),
          };
        }

        // Not found / unexpected shape
        return null;
      } catch (error: any) {
        const msg = error?.message || String(error);
        console.error(`[SuiService] getDataFeed(${feedId}) attempt ${attempt} failed:`, msg);
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        return null;
      }
    }

    // Fallback to satisfy return type
    return null;
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    const maxRetries = parseInt(process.env.SUI_OBJECT_RETRY || '2');
    const delayMs = parseInt(process.env.SUI_OBJECT_RETRY_DELAY_MS || '600');

    for (let attempt = 1; attempt <= (maxRetries + 1); attempt++) {
      try {
        const object = await this.client.getObject({
          id: subscriptionId,
          options: {
            showContent: true,
          },
        });

        if (object.data && object.data.content && 'fields' in object.data.content) {
          const fields = object.data.content.fields as any;

          return {
            id: subscriptionId,
            consumer: fields.consumer,
            feedId: fields.feed_id,
            tier: parseInt(fields.tier),
            startEpoch: parseInt(fields.start_epoch),
            expiryEpoch: parseInt(fields.expiry_epoch),
            paymentAmount: parseInt(fields.payment_amount),
            queriesUsed: parseInt(fields.queries_used),
            isActive: fields.is_active,
          };
        }

        return null;
      } catch (error: any) {
        const msg = error?.message || String(error);
        console.error(`[SuiService] getSubscription(${subscriptionId}) attempt ${attempt} failed:`, msg);
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        return null;
      }
    }

    return null;
  }

  /**
   * Get all subscriptions for a consumer address
   * Queries owned Subscription objects directly
   */
  async getSubscriptionsByConsumer(consumerAddress: string): Promise<Subscription[]> {
    try {
      console.log(`[SuiService] Fetching subscriptions for consumer: ${consumerAddress}`);
      console.log(`[SuiService] Package ID: ${this.packageId}`);
      
      const subscriptions: Subscription[] = [];
      
      // Query owned Subscription objects
      const structType = `${this.packageId}::subscription::Subscription`;
      console.log(`[SuiService] Querying owned objects with struct type: ${structType}`);
      
      const objects = await this.client.getOwnedObjects({
        owner: consumerAddress,
        filter: {
          StructType: structType,
        },
        options: {
          showContent: true,
        },
      });

      console.log(`[SuiService] Found ${objects.data.length} owned Subscription objects`);

      for (const obj of objects.data) {
        if (obj.data && obj.data.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as any;
          
          if (fields.consumer === consumerAddress && obj.data.objectId) {
            subscriptions.push({
              id: obj.data.objectId,
              consumer: fields.consumer,
              feedId: fields.feed_id,
              tier: parseInt(fields.tier),
              startEpoch: parseInt(fields.start_epoch),
              expiryEpoch: parseInt(fields.expiry_epoch),
              paymentAmount: parseInt(fields.payment_amount),
              queriesUsed: parseInt(fields.queries_used),
              isActive: fields.is_active,
            });
          }
        }
      }

      console.log(`[SuiService] Returning ${subscriptions.length} subscriptions`);
      return subscriptions;
    } catch (error: any) {
      console.error(`[SuiService] Error getting subscriptions for ${consumerAddress}:`, error.message);
      console.error(`[SuiService] Error stack:`, error.stack);
      return [];
    }
  }

  /**
   * Get all data feeds (paginated)
   * Queries FeedRegistered events to find all feeds
   */
  async getAllDataFeeds(limit: number = 100): Promise<DataFeed[]> {
    const maxRetries = parseInt(process.env.SUI_EVENTS_RETRY || '2');
    const delayMs = parseInt(process.env.SUI_EVENTS_RETRY_DELAY_MS || '600');
    const feedIds = new Set<string>();
    const feeds: DataFeed[] = [];

    // Query events (primary method)
    for (let attempt = 1; attempt <= (maxRetries + 1); attempt++) {
      try {
        console.log(`[SuiService] getAllDataFeeds: Querying events (attempt ${attempt})`);
        const response = await this.client.queryEvents({
          query: { MoveEventType: `${this.packageId}::data_marketplace::FeedRegistered` },
          limit: limit * 2, // Get more events to account for filtering
          order: 'descending', // Get newest first
        });

        console.log(`[SuiService] Found ${response.data.length} FeedRegistered events`);

        for (const event of response.data) {
          if (event.parsedJson) {
            const feedId = (event.parsedJson as any).feed_id;
            if (feedId && !feedIds.has(feedId)) {
              feedIds.add(feedId);
              try {
                const feed = await this.getDataFeed(feedId);
                if (feed) {
                  feeds.push(feed);
                }
              } catch (err) {
                console.warn(`[SuiService] Failed to fetch feed ${feedId}:`, err);
              }
            }
          }
        }

        console.log(`[SuiService] Found ${feeds.length} feeds from events`);
        break; // Success, exit retry loop
      } catch (error: any) {
        const msg = error?.message || String(error);
        console.error(`[SuiService] getAllDataFeeds events query attempt ${attempt} failed:`, msg);
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
    }

    console.log(`[SuiService] getAllDataFeeds: Returning ${feeds.length} feeds total`);
    return feeds;
  }

  /**
   * Submit a rating
   */
  async submitRating(
    feedId: string,
    stars: number,
    comment: string
  ): Promise<string> {
    try {
      if (!this.keypair) {
        throw new Error('Keypair not initialized');
      }

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::reputation::submit_rating`,
        arguments: [
          tx.pure.id(feedId),
          tx.pure.u8(stars),
          tx.pure.string(comment),
        ],
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      const createdObjects = result.objectChanges?.filter(
        (change) => change.type === 'created'
      );

      if (createdObjects && createdObjects.length > 0) {
        const ratingObject = createdObjects[0];
        if ('objectId' in ratingObject) {
          return ratingObject.objectId;
        }
      }

      throw new Error('Failed to extract rating ID');
    } catch (error: any) {
      console.error('Error submitting rating:', error.message);
      throw new Error(`Failed to submit rating: ${error.message}`);
    }
  }

  // =================== Helper Methods ===================

  private async getRegistryId(): Promise<string> {
    // In production, this should query for the DataFeedRegistry object
    // For now, we'll expect it to be configured
    const registryId = process.env.SUI_REGISTRY_ID;
    if (!registryId) {
      throw new Error('SUI_REGISTRY_ID not configured');
    }
    return registryId;
  }

  private async getTreasuryId(): Promise<string> {
    // In production, this should query for the PlatformTreasury object
    const treasuryId = process.env.SUI_TREASURY_ID;
    if (!treasuryId) {
      throw new Error('SUI_TREASURY_ID not configured');
    }
    return treasuryId;
  }

  /**
   * Get SUI balance for an address
   */
  async getBalance(address: string): Promise<number> {
    try {
      const balance = await this.client.getBalance({
        owner: address,
      });
      return parseInt(balance.totalBalance) / 1_000_000_000; // Convert MIST to SUI
    } catch (error: any) {
      console.error('Error getting balance:', error.message);
      return 0;
    }
  }
}

export default new SuiService();

