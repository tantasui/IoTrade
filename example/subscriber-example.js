/**
 * Subscriber Example - Listening to Data Feeds via WebSocket
 * 
 * This example demonstrates how to:
 * 1. Create a subscriber API key for a subscription
 * 2. Connect to WebSocket and listen to data feed updates
 * 3. Handle real-time data updates
 * 
 * Prerequisites:
 * - Node.js installed
 * - A subscription ID (obtained after subscribing to a feed via frontend/wallet)
 * - Consumer address (your wallet address)
 * - Feed ID you want to listen to
 */

const WebSocket = require('ws');
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';
const SUBSCRIBER_API_KEY = process.env.SUBSCRIBER_API_KEY || 'sk_your_subscriber_api_key_here';
const FEED_ID = process.env.FEED_ID || '0x_your_feed_id_here';
const SUBSCRIPTION_ID = process.env.SUBSCRIPTION_ID || '0x_your_subscription_id_here';
const CONSUMER_ADDRESS = process.env.CONSUMER_ADDRESS || '0x_your_consumer_address_here';

/**
 * Create a subscriber API key for a subscription
 * Note: You need to have already subscribed to the feed via the frontend/wallet first
 */
async function createSubscriberApiKey(subscriptionId, consumerAddress) {
  try {
    console.log(`Creating subscriber API key for subscription ${subscriptionId}...`);
    
    const response = await axios.post(
      `${API_BASE_URL}/api/api-keys/subscriber`,
      {
        subscriptionId,
        consumerAddress,
        name: 'My Subscriber Key',
        description: 'API key for accessing subscribed data feed',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      console.log('✅ Subscriber API key created!');
      console.log('API Key:', response.data.data.apiKey);
      console.log('⚠️  Save this key securely - it will not be shown again!');
      return response.data.data.apiKey;
    } else {
      throw new Error(response.data.error || 'Failed to create API key');
    }
  } catch (error) {
    console.error('❌ Error creating API key:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get feed data via REST API (one-time fetch)
 */
async function getFeedData(feedId, apiKey) {
  try {
    console.log(`Fetching data for feed ${feedId}...`);
    
    const response = await axios.get(`${API_BASE_URL}/api/data/${feedId}`, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (response.data.success) {
      console.log('✅ Data retrieved successfully!');
      console.log('Data:', JSON.stringify(response.data.data, null, 2));
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Failed to retrieve data');
    }
  } catch (error) {
    console.error('❌ Error fetching data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Connect to WebSocket and listen to data feed updates
 */
function listenToFeed(feedId, apiKey) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔌 Connecting to WebSocket: ${WS_URL}/ws`);
    
    const ws = new WebSocket(`${WS_URL}/ws`);

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Subscribe to the feed using API key
      const subscribeMessage = {
        type: 'subscribe',
        feedId: feedId,
        apiKey: apiKey,
      };
      
      console.log('📤 Sending subscribe message:', JSON.stringify(subscribeMessage, null, 2));
      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'subscribed':
            console.log('✅ Successfully subscribed to feed:', message.feedId);
            break;
            
          case 'data':
            console.log('\n📊 Received data update:');
            console.log('Feed ID:', message.feedId);
            console.log('Timestamp:', new Date(message.timestamp).toISOString());
            console.log('Data:', JSON.stringify(message.data, null, 2));
            break;
            
          case 'error':
            console.error('❌ WebSocket error:', message.error);
            reject(new Error(message.error));
            break;
            
          case 'unsubscribed':
            console.log('✅ Unsubscribed from feed');
            break;
            
          default:
            console.log('📨 Received message:', message);
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
      resolve();
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Unsubscribing and closing connection...');
      ws.send(JSON.stringify({ type: 'unsubscribe' }));
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 1000);
    });
  });
}

/**
 * Main example function
 */
async function main() {
  console.log('🚀 Subscriber Example - Listening to Data Feeds\n');
  console.log('API Base URL:', API_BASE_URL);
  console.log('WebSocket URL:', `${WS_URL}/ws`);
  console.log('Feed ID:', FEED_ID);
  console.log('Subscription ID:', SUBSCRIPTION_ID);
  console.log('Consumer Address:', CONSUMER_ADDRESS);
  console.log('');

  try {
    // Step 1: Create a subscriber API key (if you don't have one)
    // Uncomment if you need to create a new API key:
    // const apiKey = await createSubscriberApiKey(SUBSCRIPTION_ID, CONSUMER_ADDRESS);
    // console.log('');
    
    // Use existing API key or the one you just created
    const apiKey = SUBSCRIBER_API_KEY;
    
    if (!apiKey || apiKey === 'sk_your_subscriber_api_key_here') {
      console.error('❌ Please set SUBSCRIBER_API_KEY environment variable or create one using createSubscriberApiKey()');
      console.error('   You can create an API key by uncommenting the createSubscriberApiKey() call above');
      process.exit(1);
    }

    // Step 2: Optionally fetch data once via REST API
    console.log('--- Fetching data via REST API ---');
    await getFeedData(FEED_ID, apiKey);
    console.log('');

    // Step 3: Connect to WebSocket and listen for real-time updates
    console.log('--- Connecting to WebSocket for real-time updates ---');
    console.log('Press Ctrl+C to stop listening...\n');
    
    await listenToFeed(FEED_ID, apiKey);

  } catch (error) {
    console.error('Example failed:', error.message);
    process.exit(1);
  }
}

// Run example if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  createSubscriberApiKey,
  getFeedData,
  listenToFeed,
};

