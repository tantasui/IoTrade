# Data Marketplace Examples

This folder contains example code for providers and subscribers to interact with the Data Marketplace API.

## Examples

### Provider Examples

#### `provider-iot-device.ino` (C++/Arduino)
Arduino/ESP32 example for IoT devices to send data to Walrus:
- Read sensor data
- Send data to Data Marketplace API
- Upload data to Walrus storage
- Use provider API keys for authentication

**Prerequisites:**
- ESP32 or compatible board
- Arduino IDE or PlatformIO
- Install libraries: WiFi, HTTPClient, ArduinoJson

**Configuration:**
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* apiBaseUrl = "http://localhost:3001";
const char* feedId = "0x_your_feed_id_here";
const char* providerApiKey = "pk_your_provider_api_key_here";
```

**Usage:**
1. Update WiFi credentials and API configuration in the sketch
2. Upload to your ESP32 device
3. Open Serial Monitor to see data transmission

#### `provider-monitor.js` (JavaScript)
JavaScript example for providers to monitor their data feeds:
- Monitor feed updates via REST API polling
- Track feed activity and subscribers
- Receive notifications when new data arrives

**Usage:**
```bash
# Set environment variables
export API_URL=http://localhost:3001
export PROVIDER_API_KEY=pk_your_provider_api_key_here
export FEED_ID=0x_your_feed_id_here

# Run the example
node provider-monitor.js
```

#### `provider-monitor.ts` (TypeScript)
TypeScript version with type safety. Same functionality as JavaScript version.

**Usage:**
```bash
# Install dependencies
npm install axios ws typescript ts-node @types/node @types/ws

# Set environment variables (same as JavaScript version)
export API_URL=http://localhost:3001
export PROVIDER_API_KEY=pk_your_provider_api_key_here
export FEED_ID=0x_your_feed_id_here

# Run the example
npx ts-node provider-monitor.ts
```

**Note:** The old `provider-example.js` and `provider-example.ts` files have been replaced with:
- `provider-iot-device.ino` - For IoT devices (C++/Arduino)
- `provider-monitor.js/ts` - For providers to monitor feeds (JavaScript/TypeScript)

### Subscriber Examples

#### `subscriber-example.js` (JavaScript)
JavaScript/Node.js example for subscribers to:
- Create subscriber API keys
- Fetch data via REST API
- Listen to data feeds via WebSocket

**Usage:**
```bash
# Set environment variables
export API_URL=http://localhost:3001
export WS_URL=ws://localhost:3001
export SUBSCRIBER_API_KEY=sk_your_subscriber_api_key_here
export FEED_ID=0x_your_feed_id_here
export SUBSCRIPTION_ID=0x_your_subscription_id_here
export CONSUMER_ADDRESS=0x_your_consumer_address_here

# Run the example
node subscriber-example.js
```

#### `subscriber-example.ts` (TypeScript)
TypeScript version with type safety. Same functionality as JavaScript version.

**Usage:**
```bash
# Install dependencies
npm install axios ws typescript ts-node @types/node @types/ws

# Set environment variables (same as JavaScript version)
export API_URL=http://localhost:3001
export WS_URL=ws://localhost:3001
export SUBSCRIBER_API_KEY=sk_your_subscriber_api_key_here
export FEED_ID=0x_your_feed_id_here
export SUBSCRIPTION_ID=0x_your_subscription_id_here
export CONSUMER_ADDRESS=0x_your_consumer_address_here

# Run the example
npx ts-node subscriber-example.ts
```

#### `subscriber-example.py` (Python)
Python example for subscribers with the same functionality as the JavaScript version.

**Prerequisites:**
```bash
pip install websocket-client requests
```

**Usage:**
```bash
# Set environment variables (same as JavaScript version)
export API_URL=http://localhost:3001
export WS_URL=ws://localhost:3001
export SUBSCRIBER_API_KEY=sk_your_subscriber_api_key_here
export FEED_ID=0x_your_feed_id_here
export SUBSCRIPTION_ID=0x_your_subscription_id_here
export CONSUMER_ADDRESS=0x_your_consumer_address_here

# Run the example
python subscriber-example.py
```

## Installation

### JavaScript/Node.js Examples

For JavaScript examples (`provider-example.js`, `subscriber-example.js`):

```bash
npm install axios ws
```

For TypeScript examples (`provider-example.ts`, `subscriber-example.ts`):

```bash
npm install axios ws typescript ts-node @types/node @types/ws
```

### Python Example

For Python example (`subscriber-example.py`):

```bash
pip install websocket-client requests
```

## Getting Started

### For Providers

1. **Create a Data Feed**
   - Use the Provider Dashboard in the frontend to create a feed
   - This will give you a `feedId`

2. **Get a Provider API Key**
   - Create a provider API key via the API:
   ```bash
   curl -X POST http://localhost:3001/api/api-keys/provider \
     -H "Content-Type: application/json" \
     -d '{
       "feedId": "0x_your_feed_id",
       "providerAddress": "0x_your_address",
       "name": "IoT Device Key",
       "description": "API key for IoT device to send data"
     }'
   ```

3. **Configure Your IoT Device**
   - Update `provider-iot-device.ino` with your WiFi credentials, API URL, feed ID, and API key
   - Upload to your ESP32 device
   - The device will automatically send sensor data to Walrus

4. **Monitor Your Feed**
   ```bash
   export PROVIDER_API_KEY=pk_your_key_here
   export FEED_ID=0x_your_feed_id_here
   node provider-monitor.js
   ```

### For Subscribers

1. **Subscribe to a Feed**
   - First, subscribe to a feed via the frontend (requires wallet connection)
   - This will give you a `subscriptionId`

2. **Create a Subscriber API Key**
   ```bash
   curl -X POST http://localhost:3001/api/api-keys/subscriber \
     -H "Content-Type: application/json" \
     -d '{
       "subscriptionId": "0x_your_subscription_id",
       "consumerAddress": "0x_your_address",
       "name": "My Subscriber Key",
       "description": "API key for accessing subscribed data"
     }'
   ```

3. **Listen to Data Feed**
   ```bash
   export SUBSCRIBER_API_KEY=sk_your_key_here
   export FEED_ID=0x_feed_id_here
   export SUBSCRIPTION_ID=0x_subscription_id_here
   export CONSUMER_ADDRESS=0x_your_address_here
   node subscriber-example.js
   ```

## API Endpoints

### Provider Endpoints

- `POST /api/iot/feeds/:feedId/update` - IoT devices send data (requires provider API key)
- `GET /api/feeds/:feedId` - Get feed details (requires provider API key)
- `POST /api/api-keys/provider` - Create a provider API key

### Subscriber Endpoints

- `GET /api/data/:feedId` - Get feed data (requires subscriber API key)
- `POST /api/api-keys/subscriber` - Create a subscriber API key
- `GET /api/subscriber/:address/subscriptions` - Get all subscriptions for an address

### WebSocket

- `ws://localhost:3001/ws` - WebSocket endpoint for real-time data streaming

**Subscribe Message:**
```json
{
  "type": "subscribe",
  "feedId": "0x...",
  "apiKey": "sk_..."
}
```

**Data Update Message:**
```json
{
  "type": "data",
  "feedId": "0x...",
  "data": { ... },
  "timestamp": 1234567890
}
```

## Environment Variables

### Provider
- `API_URL` - API base URL (default: `http://localhost:3001`)
- `PROVIDER_API_KEY` - Provider API key (starts with `pk_`)
- `PROVIDER_ADDRESS` - Provider wallet address

### Subscriber
- `API_URL` - API base URL (default: `http://localhost:3001`)
- `WS_URL` - WebSocket URL (default: `ws://localhost:3001`)
- `SUBSCRIBER_API_KEY` - Subscriber API key (starts with `sk_`)
- `FEED_ID` - Feed ID to listen to
- `SUBSCRIPTION_ID` - Subscription ID (obtained after subscribing)
- `CONSUMER_ADDRESS` - Consumer wallet address

## Notes

- API keys are only shown once when created. Save them securely!
- Provider API keys (`pk_xxx`) are used for creating/updating feeds
- Subscriber API keys (`sk_xxx`) are used for accessing subscribed data
- WebSocket connections require a valid subscriber API key
- Subscriptions must be created via the frontend (wallet signing required)

## Troubleshooting

### "Access denied" error
- Make sure your API key is valid and not revoked
- For subscribers, ensure you have an active subscription to the feed
- Check that the API key matches the feed/subscription

### WebSocket connection fails
- Verify the WebSocket URL is correct
- Ensure the API key is valid and has access to the feed
- Check that the feed ID matches your subscription

### "Feed not found" error
- Verify the feed ID is correct
- Ensure the feed is active
