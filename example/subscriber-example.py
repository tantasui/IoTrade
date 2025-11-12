"""
Subscriber Example - Listening to Data Feeds via WebSocket (Python)

This example demonstrates how to:
1. Create a subscriber API key for a subscription
2. Connect to WebSocket and listen to data feed updates
3. Handle real-time data updates

Prerequisites:
- Python 3.7+
- Install dependencies: pip install websocket-client requests
- A subscription ID (obtained after subscribing to a feed via frontend/wallet)
- Consumer address (your wallet address)
- Feed ID you want to listen to
"""

import os
import json
import time
import signal
import sys
import requests
import websocket
from typing import Optional

# Configuration
API_BASE_URL = os.getenv('API_URL', 'http://localhost:3001')
WS_URL = os.getenv('WS_URL', 'ws://localhost:3001')
SUBSCRIBER_API_KEY = os.getenv('SUBSCRIBER_API_KEY', 'sk_your_subscriber_api_key_here')
FEED_ID = os.getenv('FEED_ID', '0x_your_feed_id_here')
SUBSCRIPTION_ID = os.getenv('SUBSCRIPTION_ID', '0x_your_subscription_id_here')
CONSUMER_ADDRESS = os.getenv('CONSUMER_ADDRESS', '0x_your_consumer_address_here')

# Global WebSocket connection
ws_connection: Optional[websocket.WebSocketApp] = None


def create_subscriber_api_key(subscription_id: str, consumer_address: str) -> str:
    """Create a subscriber API key for a subscription."""
    try:
        print(f'Creating subscriber API key for subscription {subscription_id}...')
        
        response = requests.post(
            f'{API_BASE_URL}/api/api-keys/subscriber',
            json={
                'subscriptionId': subscription_id,
                'consumerAddress': consumer_address,
                'name': 'My Subscriber Key',
                'description': 'API key for accessing subscribed data feed',
            },
            headers={
                'Content-Type': 'application/json',
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        if data.get('success'):
            api_key = data['data']['apiKey']
            print('✅ Subscriber API key created!')
            print(f'API Key: {api_key}')
            print('⚠️  Save this key securely - it will not be shown again!')
            return api_key
        else:
            raise Exception(data.get('error', 'Failed to create API key'))
    except Exception as e:
        print(f'❌ Error creating API key: {e}')
        raise


def get_feed_data(feed_id: str, api_key: str) -> dict:
    """Get feed data via REST API (one-time fetch)."""
    try:
        print(f'Fetching data for feed {feed_id}...')
        
        response = requests.get(
            f'{API_BASE_URL}/api/data/{feed_id}',
            headers={
                'X-API-Key': api_key,
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        if data.get('success'):
            print('✅ Data retrieved successfully!')
            print('Data:', json.dumps(data['data'], indent=2))
            return data['data']
        else:
            raise Exception(data.get('error', 'Failed to retrieve data'))
    except Exception as e:
        print(f'❌ Error fetching data: {e}')
        raise


def on_message(ws, message):
    """Handle WebSocket messages."""
    try:
        data = json.loads(message)
        msg_type = data.get('type')
        
        if msg_type == 'subscribed':
            print(f"✅ Successfully subscribed to feed: {data.get('feedId')}")
        elif msg_type == 'data':
            print('\n📊 Received data update:')
            print(f"Feed ID: {data.get('feedId')}")
            print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(data.get('timestamp') / 1000))}")
            print('Data:', json.dumps(data.get('data'), indent=2))
        elif msg_type == 'error':
            print(f"❌ WebSocket error: {data.get('error')}")
        elif msg_type == 'unsubscribed':
            print('✅ Unsubscribed from feed')
        else:
            print(f'📨 Received message: {data}')
    except Exception as e:
        print(f'❌ Error parsing message: {e}')


def on_error(ws, error):
    """Handle WebSocket errors."""
    print(f'❌ WebSocket error: {error}')


def on_close(ws, close_status_code, close_msg):
    """Handle WebSocket close."""
    print(f'🔌 WebSocket closed: {close_status_code} - {close_msg}')


def on_open(ws):
    """Handle WebSocket open."""
    print('✅ WebSocket connected')
    
    # Subscribe to the feed using API key
    subscribe_message = {
        'type': 'subscribe',
        'feedId': FEED_ID,
        'apiKey': SUBSCRIBER_API_KEY,
    }
    
    print('📤 Sending subscribe message:', json.dumps(subscribe_message, indent=2))
    ws.send(json.dumps(subscribe_message))


def listen_to_feed(feed_id: str, api_key: str):
    """Connect to WebSocket and listen to data feed updates."""
    global ws_connection
    
    print(f'\n🔌 Connecting to WebSocket: {WS_URL}/ws')
    
    ws_connection = websocket.WebSocketApp(
        f'{WS_URL}/ws',
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )
    
    # Run forever (until interrupted)
    ws_connection.run_forever()


def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully."""
    global ws_connection
    print('\n🛑 Unsubscribing and closing connection...')
    
    if ws_connection:
        try:
            unsubscribe_msg = json.dumps({'type': 'unsubscribe'})
            ws_connection.send(unsubscribe_msg)
            time.sleep(1)
            ws_connection.close()
        except:
            pass
    
    sys.exit(0)


def main():
    """Main example function."""
    print('🚀 Subscriber Example - Listening to Data Feeds (Python)\n')
    print(f'API Base URL: {API_BASE_URL}')
    print(f'WebSocket URL: {WS_URL}/ws')
    print(f'Feed ID: {FEED_ID}')
    print(f'Subscription ID: {SUBSCRIPTION_ID}')
    print(f'Consumer Address: {CONSUMER_ADDRESS}')
    print('')
    
    # Register signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Step 1: Create a subscriber API key (if you don't have one)
        # Uncomment if you need to create a new API key:
        # api_key = create_subscriber_api_key(SUBSCRIPTION_ID, CONSUMER_ADDRESS)
        # print('')
        
        # Use existing API key or the one you just created
        api_key = SUBSCRIBER_API_KEY
        
        if not api_key or api_key == 'sk_your_subscriber_api_key_here':
            print('❌ Please set SUBSCRIBER_API_KEY environment variable or create one using create_subscriber_api_key()')
            print('   You can create an API key by uncommenting the create_subscriber_api_key() call above')
            sys.exit(1)
        
        # Step 2: Optionally fetch data once via REST API
        print('--- Fetching data via REST API ---')
        get_feed_data(FEED_ID, api_key)
        print('')
        
        # Step 3: Connect to WebSocket and listen for real-time updates
        print('--- Connecting to WebSocket for real-time updates ---')
        print('Press Ctrl+C to stop listening...\n')
        
        listen_to_feed(FEED_ID, api_key)
        
    except Exception as e:
        print(f'Example failed: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()

