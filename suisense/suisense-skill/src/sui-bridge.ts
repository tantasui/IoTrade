import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromHEX } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { config } from './config.js';

const client = new SuiClient({ url: getFullnodeUrl(config.sui.network) });

function getKeypair(privateKey?: string): Ed25519Keypair {
  const key = (privateKey || config.sui.privateKey).trim();
  if (!key) throw new Error('SUI_PRIVATE_KEY not set in .env');
  if (key.startsWith('suiprivkey1')) {
    const decoded = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }
  return Ed25519Keypair.fromSecretKey(fromHEX(key));
}

let _keypair: Ed25519Keypair | null = null;
function keypair(): Ed25519Keypair {
  if (!_keypair) _keypair = getKeypair();
  return _keypair;
}

export function getAddress(): string {
  return keypair().getPublicKey().toSuiAddress();
}

export async function updateFeedData(feedId: string, blobId: string): Promise<boolean> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.sui.packageId}::data_marketplace::update_feed_data`,
    arguments: [
      tx.object(feedId),
      tx.pure.string(blobId),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair(),
  });

  console.log(`[SuiBridge] Feed updated: ${feedId}`);
  return result.effects?.status.status === 'success';
}

export interface DataFeed {
  id: string;
  provider: string;
  name: string;
  category: string;
  description: string;
  location: string;
  pricePerQuery: number;
  monthlySubscriptionPrice: number;
  isPremium: boolean;
  walrusBlobId: string;
  createdAt: number;
  lastUpdated: number;
  isActive: boolean;
  updateFrequency: number;
  totalSubscribers: number;
  totalRevenue: number;
}

export async function getDataFeed(feedId: string): Promise<DataFeed | null> {
  try {
    const object = await client.getObject({
      id: feedId,
      options: { showContent: true },
    });

    if (object.data?.content && 'fields' in object.data.content) {
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
    return null;
  } catch (error: any) {
    console.error(`[SuiBridge] getDataFeed failed:`, error.message);
    return null;
  }
}

export async function getBalance(address?: string): Promise<number> {
  const addr = address || getAddress();
  try {
    const balance = await client.getBalance({ owner: addr });
    return parseInt(balance.totalBalance) / 1_000_000_000;
  } catch (error: any) {
    console.error('[SuiBridge] getBalance failed:', error.message);
    return 0;
  }
}

export async function registerDataFeed(metadata: {
  name: string;
  category: string;
  description: string;
  location: string;
  pricePerQuery: number;
  monthlySubscriptionPrice: number;
  isPremium: boolean;
  updateFrequency: number;
}, blobId: string): Promise<string> {
  if (!config.sui.registryId) {
    throw new Error('SUI_REGISTRY_ID not configured');
  }

  const tx = new Transaction();
  tx.moveCall({
    target: `${config.sui.packageId}::data_marketplace::register_data_feed`,
    arguments: [
      tx.object(config.sui.registryId),
      tx.pure.string(metadata.name),
      tx.pure.string(metadata.category),
      tx.pure.string(metadata.description),
      tx.pure.string(metadata.location),
      tx.pure.u64(metadata.pricePerQuery),
      tx.pure.u64(metadata.monthlySubscriptionPrice),
      tx.pure.bool(metadata.isPremium),
      tx.pure.string(blobId),
      tx.pure.u64(metadata.updateFrequency),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair(),
    options: { showEffects: true, showObjectChanges: true },
  });

  const createdObjects = result.objectChanges?.filter(
    (change: any) => change.type === 'created'
  );

  if (createdObjects && createdObjects.length > 0) {
    const feedObject = createdObjects.find((obj: any) =>
      obj.objectType.includes('DataFeed')
    );
    if (feedObject && 'objectId' in feedObject) {
      console.log(`[SuiBridge] Feed registered: ${feedObject.objectId}`);
      return feedObject.objectId;
    }
  }

  throw new Error('Failed to extract feed ID from transaction result');
}

export async function getAllDataFeeds(limit: number = 100): Promise<DataFeed[]> {
  const feeds: DataFeed[] = [];
  const feedIds = new Set<string>();

  try {
    const response = await client.queryEvents({
      query: { MoveEventType: `${config.sui.packageId}::data_marketplace::FeedRegistered` },
      limit: limit * 2,
      order: 'descending',
    });

    for (const event of response.data) {
      if (event.parsedJson) {
        const feedId = (event.parsedJson as any).feed_id;
        if (feedId && !feedIds.has(feedId)) {
          feedIds.add(feedId);
          const feed = await getDataFeed(feedId);
          if (feed) feeds.push(feed);
        }
      }
    }
  } catch (error: any) {
    console.error('[SuiBridge] getAllDataFeeds failed:', error.message);
  }

  return feeds;
}

export async function subscribe(feedId: string, tier: number, paymentAmount: number): Promise<string> {
  if (!config.sui.registryId || !config.sui.treasuryId) {
    throw new Error('SUI_REGISTRY_ID and SUI_TREASURY_ID must be configured');
  }

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(paymentAmount)]);

  tx.moveCall({
    target: `${config.sui.packageId}::subscription::subscribe_to_feed`,
    arguments: [
      tx.object(feedId),
      tx.object(config.sui.registryId),
      tx.object(config.sui.treasuryId),
      coin,
      tx.pure.u8(tier),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair(),
    options: { showEffects: true, showObjectChanges: true, showEvents: true },
  });

  const createdObjects = result.objectChanges?.filter(
    (change: any) => change.type === 'created'
  );

  if (createdObjects && createdObjects.length > 0) {
    const subObj = createdObjects.find((obj: any) =>
      obj.objectType.includes('Subscription')
    );
    if (subObj && 'objectId' in subObj) {
      return subObj.objectId;
    }
  }

  // Fallback: try events
  const events = (result as any).events || [];
  for (const ev of events) {
    if (ev?.type?.includes('SubscriptionCreated') && ev?.parsedJson?.subscription_id) {
      return ev.parsedJson.subscription_id;
    }
  }

  throw new Error('Failed to extract subscription ID');
}

export { client };
