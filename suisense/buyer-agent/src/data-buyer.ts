import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromHEX } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import axios from 'axios';
import { decryptFeedData, isEncryptedData } from './seal-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PACKAGE_ID = process.env.SUI_PACKAGE_ID || '0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9';
const NETWORK = (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';
const REGISTRY_ID = process.env.SUI_REGISTRY_ID || '';
const TREASURY_ID = process.env.SUI_TREASURY_ID || '';
const WALRUS_AGG = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';
const SUBSCRIPTION_ID = process.env.SUBSCRIPTION_ID || '';

const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });

function getKeypair(): Ed25519Keypair {
  const key = (process.env.BUYER_PRIVATE_KEY || '').trim();
  if (!key) throw new Error('BUYER_PRIVATE_KEY not set in .env');
  if (key.startsWith('suiprivkey1')) {
    const decoded = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }
  return Ed25519Keypair.fromSecretKey(fromHEX(key));
}

// ===== Commands =====

async function discover() {
  console.log('Discovering data feeds on Sui testnet...\n');

  const response = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::data_marketplace::FeedRegistered` },
    limit: 50,
    order: 'descending',
  });

  if (response.data.length === 0) {
    console.log('No feeds found.');
    return;
  }

  const seen = new Set<string>();
  for (const event of response.data) {
    const feedId = (event.parsedJson as any)?.feed_id;
    if (!feedId || seen.has(feedId)) continue;
    seen.add(feedId);

    try {
      const obj = await client.getObject({ id: feedId, options: { showContent: true } });
      if (obj.data?.content && 'fields' in obj.data.content) {
        const f = obj.data.content.fields as any;
        console.log(`Feed: ${f.name}`);
        console.log(`  ID:          ${feedId}`);
        console.log(`  Category:    ${f.category}`);
        console.log(`  Description: ${f.description}`);
        console.log(`  Location:    ${f.location}`);
        console.log(`  Price/query: ${f.price_per_query} MIST`);
        console.log(`  Monthly sub: ${f.monthly_subscription_price} MIST`);
        console.log(`  Premium:     ${f.is_premium}`);
        console.log(`  Active:      ${f.is_active}`);
        console.log(`  Subscribers: ${f.total_subscribers}`);
        console.log('');
      }
    } catch (err: any) {
      console.warn(`  Could not fetch feed ${feedId}: ${err.message}`);
    }
  }
}

async function subscribeFeed(feedId: string, tier: string, amount: string) {
  if (!REGISTRY_ID || !TREASURY_ID) {
    console.error('SUI_REGISTRY_ID and SUI_TREASURY_ID must be set in .env');
    return;
  }

  const keypair = getKeypair();
  const tierNum = parseInt(tier);
  const amountNum = parseInt(amount);

  console.log(`Subscribing to feed ${feedId}...`);
  console.log(`  Tier: ${tierNum}, Amount: ${amountNum} MIST`);

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountNum)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::subscription::subscribe_to_feed`,
    arguments: [
      tx.object(feedId),
      tx.object(REGISTRY_ID),
      tx.object(TREASURY_ID),
      coin,
      tx.pure.u8(tierNum),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showObjectChanges: true },
  });

  const created = result.objectChanges?.filter((c: any) => c.type === 'created');
  const sub = created?.find((c: any) => c.objectType?.includes('Subscription'));

  if (sub && 'objectId' in sub) {
    console.log(`Subscribed! Subscription ID: ${sub.objectId}`);
  } else {
    console.log('Transaction submitted. Check explorer for subscription details.');
    console.log('Status:', result.effects?.status.status);
  }
}

async function readFeed(feedId: string, subscriptionArg?: string) {
  console.log(`Reading data from feed ${feedId}...\n`);

  const obj = await client.getObject({ id: feedId, options: { showContent: true } });
  if (!obj.data?.content || !('fields' in obj.data.content)) {
    console.error('Feed not found.');
    return;
  }

  const fields = obj.data.content.fields as any;
  const blobId = fields.walrus_blob_id;

  console.log(`Feed: ${fields.name}`);
  console.log(`Premium: ${fields.is_premium}`);
  console.log(`Walrus blob: ${blobId}`);
  console.log(`Last updated: ${new Date(parseInt(fields.last_updated)).toISOString()}`);
  console.log('');

  if (!blobId) {
    console.log('No data blob stored yet.');
    return;
  }

  try {
    const url = `${WALRUS_AGG}/v1/blobs/${blobId}`;
    // Fetch as arraybuffer to handle both plaintext and encrypted data
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    const rawBytes = new Uint8Array(res.data);

    if (isEncryptedData(rawBytes)) {
      console.log('Data is Seal-encrypted (premium feed).\n');

      const subId = subscriptionArg || SUBSCRIPTION_ID;
      if (!subId) {
        console.error(
          'This is a premium feed with encrypted data.\n' +
          'To decrypt, provide your subscription ID:\n' +
          '  data-buyer.ts read <feedId> <subscriptionId>\n' +
          'Or set SUBSCRIPTION_ID in .env'
        );
        return;
      }

      try {
        const data = await decryptFeedData(rawBytes, feedId, subId);
        console.log('Decrypted Data:');
        console.log(JSON.stringify(data, null, 2));
      } catch (err: any) {
        console.error(`Decryption failed: ${err.message}`);
        if (err.message.includes('No access')) {
          console.error('Your subscription may be expired or for a different feed.');
        }
      }
    } else {
      // Plaintext data
      let data: any;
      try {
        const text = new TextDecoder().decode(rawBytes);
        data = JSON.parse(text);
      } catch {
        data = new TextDecoder().decode(rawBytes);
      }
      console.log('Data:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error(`Failed to fetch from Walrus: ${err.message}`);
  }
}

async function showBalance() {
  const keypair = getKeypair();
  const addr = keypair.getPublicKey().toSuiAddress();
  const balance = await client.getBalance({ owner: addr });
  const sui = parseInt(balance.totalBalance) / 1_000_000_000;
  console.log(`Buyer wallet: ${addr}`);
  console.log(`Balance: ${sui} SUI`);
}

// ===== Main =====

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'discover':
      await discover();
      break;
    case 'subscribe':
      if (args.length < 3) {
        console.error('Usage: data-buyer.ts subscribe <feedId> <tier> <amount>');
        process.exit(1);
      }
      await subscribeFeed(args[0], args[1], args[2]);
      break;
    case 'read':
      if (args.length < 1) {
        console.error('Usage: data-buyer.ts read <feedId> [subscriptionId]');
        process.exit(1);
      }
      await readFeed(args[0], args[1]);
      break;
    case 'balance':
      await showBalance();
      break;
    default:
      console.log('SuiSense Buyer Agent');
      console.log('Usage: npx tsx src/data-buyer.ts <command>\n');
      console.log('Commands:');
      console.log('  discover                             List available data feeds');
      console.log('  subscribe <feedId> <tier> <amount>   Subscribe to a feed');
      console.log('  read <feedId> [subscriptionId]       Read latest data (decrypts premium feeds)');
      console.log('  balance                              Show buyer wallet balance');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
