import { config } from './config.js';
import axios from 'axios';
import {
  getDataFeed,
  getBalance,
  getAddress,
  registerDataFeed,
} from './sui-bridge.js';
import { uploadData } from './walrus-store.js';

const BASE_URL = `http://localhost:${config.sensor.port}`;

const commands: Record<string, () => Promise<void>> = {
  async latest() {
    try {
      const res = await axios.get(`${BASE_URL}/api/sensor/latest`);
      if (res.data.data) {
        console.log('Latest sensor reading:');
        console.log(JSON.stringify(res.data.data, null, 2));
      } else {
        console.log('No readings yet.');
      }
    } catch {
      console.error('Server not reachable. Is the sensor server running?');
    }
  },

  async stats() {
    try {
      const res = await axios.get(`${BASE_URL}/api/sensor/stats`);
      const s = res.data;
      console.log('Sensor Stats:');
      console.log(`  Total readings:  ${s.totalReadings}`);
      console.log(`  Last reading:    ${s.lastReading ? new Date(s.lastReading).toISOString() : 'none'}`);
      console.log(`  Uptime:          ${s.uptime}s`);
      console.log(`  Feed ID:         ${s.feedId || '(not set)'}`);
      console.log(`  Address:         ${s.address}`);
    } catch {
      console.error('Server not reachable. Is the sensor server running?');
    }
  },

  async earnings() {
    const feedId = config.dataFeedId;
    if (!feedId) {
      console.error('DATA_FEED_ID not set in .env');
      return;
    }
    const feed = await getDataFeed(feedId);
    if (!feed) {
      console.error(`Feed ${feedId} not found on-chain.`);
      return;
    }
    const revenueSui = feed.totalRevenue / 1_000_000_000;
    console.log('Feed Earnings:');
    console.log(`  Feed:             ${feed.name}`);
    console.log(`  Subscribers:      ${feed.totalSubscribers}`);
    console.log(`  Total revenue:    ${revenueSui} SUI (${feed.totalRevenue} MIST)`);
    console.log(`  Price/query:      ${feed.pricePerQuery} MIST`);
    console.log(`  Monthly sub:      ${feed.monthlySubscriptionPrice} MIST`);
  },

  async health() {
    try {
      const res = await axios.get(`${BASE_URL}/api/sensor/health`);
      const h = res.data;
      console.log('Health Check:');
      console.log(`  Status:           ${h.status}`);
      console.log(`  Total readings:   ${h.totalReadings}`);
      console.log(`  Last reading age: ${h.lastReadingAgeSec !== null ? h.lastReadingAgeSec + 's ago' : 'no data yet'}`);
      console.log(`  Uptime:           ${h.uptime}s`);
    } catch {
      console.error('Server not reachable. Is the sensor server running?');
    }
  },

  async ['feed-info']() {
    const feedId = config.dataFeedId;
    if (!feedId) {
      console.error('DATA_FEED_ID not set in .env');
      return;
    }
    const feed = await getDataFeed(feedId);
    if (!feed) {
      console.error(`Feed ${feedId} not found on-chain.`);
      return;
    }
    console.log('DataFeed On-Chain Info:');
    console.log(`  ID:               ${feed.id}`);
    console.log(`  Name:             ${feed.name}`);
    console.log(`  Category:         ${feed.category}`);
    console.log(`  Description:      ${feed.description}`);
    console.log(`  Location:         ${feed.location}`);
    console.log(`  Provider:         ${feed.provider}`);
    console.log(`  Active:           ${feed.isActive}`);
    console.log(`  Premium:          ${feed.isPremium}`);
    console.log(`  Walrus blob:      ${feed.walrusBlobId}`);
    console.log(`  Last updated:     ${new Date(feed.lastUpdated).toISOString()}`);
    console.log(`  Update freq:      ${feed.updateFrequency}s`);
    console.log(`  Subscribers:      ${feed.totalSubscribers}`);
    console.log(`  Revenue:          ${feed.totalRevenue} MIST`);
  },

  async balance() {
    const addr = getAddress();
    const bal = await getBalance(addr);
    console.log(`Wallet: ${addr}`);
    console.log(`Balance: ${bal} SUI`);
  },

  async ['register-feed']() {
    const isPremium = process.argv.includes('--premium');
    console.log(`Registering new DataFeed on-chain (premium: ${isPremium})...`);

    // Upload initial placeholder data to Walrus
    const initialData = {
      message: 'SuiSense feed initialized',
      timestamp: Date.now(),
    };
    const blobId = await uploadData(initialData);
    console.log(`Initial blob uploaded: ${blobId}`);

    const feedId = await registerDataFeed(
      {
        name: 'SuiSense DHT11 Sensor',
        category: 'IoT',
        description: 'Temperature and humidity data from ESP32 + DHT11 sensor via SuiSense OpenClaw skill',
        location: 'Local',
        pricePerQuery: 1000000,       // 0.001 SUI
        monthlySubscriptionPrice: 50000000, // 0.05 SUI
        isPremium,
        updateFrequency: 60,          // 60 seconds
      },
      blobId
    );

    console.log(`Feed registered! Feed ID: ${feedId}`);
    console.log(`Add this to your .env: DATA_FEED_ID=${feedId}`);
    if (isPremium) {
      console.log('This is a PREMIUM feed. Set SEAL_ENCRYPT=true in .env to encrypt sensor data.');
    }
  },
};

async function main() {
  const command = process.argv[2];

  if (!command || !commands[command]) {
    console.log('SuiSense CLI');
    console.log('Usage: npx tsx src/cli.ts <command>\n');
    console.log('Commands:');
    console.log('  latest         Fetch latest sensor reading from local server');
    console.log('  stats          Show feed stats (readings count, uptime)');
    console.log('  earnings       Query Sui for feed revenue and subscribers');
    console.log('  health         Check if server is running and ESP32 is sending');
    console.log('  feed-info      Show DataFeed on-chain details');
    console.log('  balance        Show SUI wallet balance');
    console.log('  register-feed [--premium]  Register a new DataFeed on-chain');
    process.exit(1);
  }

  await commands[command]();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
