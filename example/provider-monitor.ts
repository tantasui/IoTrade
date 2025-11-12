/**
 * Provider Monitor Example - Listening to Your Data Feeds (TypeScript)
 * 
 * This example demonstrates how providers can:
 * 1. Monitor their data feeds via WebSocket
 * 2. Receive real-time updates when IoT devices send data
 * 3. Track data updates and feed activity
 * 
 * Prerequisites:
 * - Node.js installed
 * - TypeScript installed: npm install -g typescript ts-node
 * - Install dependencies: npm install axios ws @types/node @types/ws
 * - Provider API key (pk_xxx...)
 * - Feed ID
 */

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';
const PROVIDER_API_KEY = process.env.PROVIDER_API_KEY || 'pk_your_provider_api_key_here';
const FEED_ID = process.env.FEED_ID || '0x_your_feed_id_here';

// Create axios instance with API key header
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'X-API-Key': PROVIDER_API_KEY,
    'Content-Type': 'application/json',
  },
});

interface FeedResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface WebSocketMessage {
  type: 'subscribed' | 'data' | 'error' | 'unsubscribed';
  feedId?: string;
  data?: any;
  timestamp?: number;
  error?: string;
}

/**
 * Get feed data via REST API (polling)
 */
async function getFeedData(feedId: string): Promise<any> {
  try {
    console.log(`Fetching data for feed ${feedId}...`);
    
    const response = await axios.get<FeedResponse>(`${API_BASE_URL}/api/data/${feedId}?preview=true`);
    
    if (response.data.success) {
      console.log('✅ Data retrieved successfully!');
      console.log('Data:', JSON.stringify(response.data.data, null, 2));
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Failed to retrieve data');
    }
  } catch (error: any) {
    console.error('❌ Error fetching data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get feed details
 */
async function getFeedDetails(feedId: string): Promise<any> {
  try {
    const response = await apiClient.get<FeedResponse>(`/api/feeds/${feedId}`);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Failed to get feed details');
    }
  } catch (error: any) {
    console.error('❌ Error getting feed details:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Monitor feed via REST API polling
 */
function monitorFeedPolling(feedId: string, intervalSeconds: number = 60): void {
  console.log(`\n📊 Starting feed monitoring (polling every ${intervalSeconds}s)...`);
  console.log('Press Ctrl+C to stop...\n');
  
  let lastBlobId: string | null = null;
  
  const pollInterval = setInterval(async () => {
    try {
      const feed = await getFeedDetails(feedId);
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 Feed: ${feed.name}`);
      console.log(`   Last Updated: ${new Date(feed.lastUpdated).toLocaleString()}`);
      console.log(`   Subscribers: ${feed.totalSubscribers}`);
      console.log(`   Status: ${feed.isActive ? '✅ Active' : '❌ Inactive'}`);
      
      if (feed.walrusBlobId && feed.walrusBlobId !== lastBlobId) {
        console.log(`   🆕 New data blob: ${feed.walrusBlobId}`);
        lastBlobId = feed.walrusBlobId;
        
        // Fetch the actual data
        await getFeedData(feedId);
      } else if (feed.walrusBlobId) {
        console.log(`   📦 Current blob: ${feed.walrusBlobId}`);
      }
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    } catch (error: any) {
      console.error('Failed to poll feed:', error.message);
    }
  }, intervalSeconds * 1000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping feed monitoring...');
    clearInterval(pollInterval);
    process.exit(0);
  });
}

/**
 * Monitor feed via WebSocket (requires subscriber API key)
 */
function monitorFeedWebSocket(feedId: string, subscriberApiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n🔌 Connecting to WebSocket: ${WS_URL}/ws`);
    
    const ws = new WebSocket(`${WS_URL}/ws`);

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      const subscribeMessage = {
        type: 'subscribe',
        feedId: feedId,
        apiKey: subscriberApiKey,
      };
      
      console.log('📤 Sending subscribe message...');
      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'subscribed':
            console.log('✅ Successfully subscribed to feed:', message.feedId);
            break;
            
          case 'data':
            console.log('\n📊 Received data update:');
            console.log('Feed ID:', message.feedId);
            if (message.timestamp) {
              console.log('Timestamp:', new Date(message.timestamp).toISOString());
            }
            console.log('Data:', JSON.stringify(message.data, null, 2));
            break;
            
          case 'error':
            console.error('❌ WebSocket error:', message.error);
            reject(new Error(message.error || 'Unknown error'));
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

    ws.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason.toString()}`);
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
async function main(): Promise<void> {
  console.log('🚀 Provider Monitor Example - Monitoring Your Data Feeds (TypeScript)\n');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Feed ID:', FEED_ID);
  console.log('');

  try {
    // Get feed details
    console.log('--- Fetching feed details ---');
    const feed = await getFeedDetails(FEED_ID);
    console.log('Feed Name:', feed.name);
    console.log('Category:', feed.category);
    console.log('Status:', feed.isActive ? 'Active' : 'Inactive');
    console.log('Subscribers:', feed.totalSubscribers);
    console.log('');

    // Option 1: Monitor via REST API polling (uses provider API key)
    console.log('--- Starting REST API Polling Monitor ---');
    monitorFeedPolling(FEED_ID, 60); // Poll every 60 seconds

    // Option 2: Monitor via WebSocket (requires subscriber API key)
    // Uncomment and provide SUBSCRIBER_API_KEY to use WebSocket:
    // const SUBSCRIBER_API_KEY = process.env.SUBSCRIBER_API_KEY;
    // if (SUBSCRIBER_API_KEY && SUBSCRIBER_API_KEY !== 'sk_your_subscriber_api_key_here') {
    //   console.log('--- Starting WebSocket Monitor ---');
    //   await monitorFeedWebSocket(FEED_ID, SUBSCRIBER_API_KEY);
    // } else {
    //   console.log('⚠️  WebSocket monitoring requires a subscriber API key');
    //   console.log('   Set SUBSCRIBER_API_KEY environment variable to enable WebSocket monitoring');
    // }

  } catch (error: any) {
    console.error('Example failed:', error.message);
    process.exit(1);
  }
}

// Run example if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  getFeedData,
  getFeedDetails,
  monitorFeedPolling,
  monitorFeedWebSocket,
};

