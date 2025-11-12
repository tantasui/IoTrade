# API Documentation

REST API and WebSocket documentation for the IoT Data Exchange Protocol.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://api.your-domain.com`

## Authentication

Most endpoints require a valid Sui wallet address and subscription ID for data access. Wallet authentication is handled through the frontend using Sui dApp Kit.

## REST API Endpoints

### Health Check

Check if the API server is running.

```
GET /health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

---

### Feeds

#### Get All Feeds

Retrieve all available data feeds with optional filtering.

```
GET /api/feeds
```

**Query Parameters:**
- `category` (string, optional): Filter by category (weather, traffic, air_quality, parking, etc.)
- `isPremium` (boolean, optional): Filter by premium status
- `minPrice` (number, optional): Minimum price in MIST
- `maxPrice` (number, optional): Maximum price in MIST
- `location` (string, optional): Filter by location (partial match)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "0x...",
      "provider": "0x...",
      "name": "SF Weather Station",
      "category": "weather",
      "description": "Real-time weather data from downtown San Francisco",
      "location": "San Francisco, CA",
      "pricePerQuery": 0,
      "monthlySubscriptionPrice": 100000000,
      "isPremium": false,
      "walrusBlobId": "blob_id_here",
      "createdAt": 1234567890,
      "lastUpdated": 1234567890,
      "isActive": true,
      "updateFrequency": 300,
      "totalSubscribers": 10,
      "totalRevenue": 1000000000
    }
  ],
  "count": 1
}
```

#### Get Feed Details

Get details of a specific data feed.

```
GET /api/feeds/:feedId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "0x...",
    "provider": "0x...",
    "name": "SF Weather Station",
    ...
  }
}
```

#### Create New Feed

Register a new data feed (requires wallet).

```
POST /api/feeds
```

**Request Body:**
```json
{
  "provider": "0x...",
  "name": "My IoT Sensor",
  "category": "weather",
  "description": "Temperature and humidity sensor",
  "location": "New York, NY",
  "pricePerQuery": 0,
  "monthlySubscriptionPrice": 100000000,
  "isPremium": false,
  "updateFrequency": 300,
  "initialData": {
    "temperature": 72,
    "humidity": 45
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedId": "0x...",
    "walrusBlobId": "blob_id_here"
  }
}
```

#### Update Feed Data

Upload new data to an existing feed.

```
PUT /api/feeds/:feedId/data
```

**Request Body:**
```json
{
  "provider": "0x...",
  "data": {
    "timestamp": 1234567890,
    "temperature": 73,
    "humidity": 47
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedId": "0x...",
    "newWalrusBlobId": "new_blob_id_here"
  }
}
```

#### Submit Rating

Rate a data feed (1-5 stars).

```
POST /api/feeds/:feedId/rating
```

**Request Body:**
```json
{
  "stars": 5,
  "comment": "Excellent data quality!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ratingId": "0x..."
  }
}
```

---

### Subscriptions

#### Subscribe to Feed

Create a new subscription to a data feed.

```
POST /api/subscribe/:feedId
```

**Request Body:**
```json
{
  "consumer": "0x...",
  "tier": 1,
  "paymentAmount": 100000000
}
```

**Tier Values:**
- `0`: Pay-per-query
- `1`: Monthly subscription
- `2`: Premium subscription

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "0x...",
    "feedId": "0x...",
    "tier": 1,
    "paymentAmount": 100000000
  }
}
```

#### Get Subscription Details

Retrieve details of a specific subscription.

```
GET /api/subscriptions/:subscriptionId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "0x...",
    "consumer": "0x...",
    "feedId": "0x...",
    "tier": 1,
    "startEpoch": 1234567890,
    "expiryEpoch": 1234567890,
    "paymentAmount": 100000000,
    "queriesUsed": 0,
    "isActive": true
  }
}
```

#### Verify Access

Check if a user has access to a specific feed.

```
POST /api/subscriptions/:subscriptionId/verify
```

**Request Body:**
```json
{
  "consumer": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "subscriptionId": "0x..."
  }
}
```

---

### Data Access

#### Get Feed Data

Retrieve data from a feed (requires valid subscription).

```
GET /api/data/:feedId
```

**Query Parameters:**
- `subscriptionId` (string, required): Your subscription ID
- `consumer` (string, required): Your wallet address
- `preview` (boolean, optional): Get preview without subscription

**Response (with subscription):**
```json
{
  "success": true,
  "data": {
    "timestamp": 1234567890,
    "temperature": 72,
    "humidity": 45,
    ...
  },
  "feed": {
    "id": "0x...",
    "name": "SF Weather Station",
    "category": "weather",
    "lastUpdated": 1234567890
  }
}
```

**Response (preview mode):**
```json
{
  "success": true,
  "preview": true,
  "data": {
    "sample": "Preview data available after subscription"
  },
  "feed": {
    "name": "SF Weather Station",
    "category": "weather",
    "description": "...",
    "location": "San Francisco, CA"
  }
}
```

#### Get Historical Data

Retrieve historical data points from a feed.

```
GET /api/data/:feedId/history
```

**Query Parameters:**
- `subscriptionId` (string, required): Your subscription ID
- `consumer` (string, required): Your wallet address
- `limit` (number, optional): Number of data points to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": 1234567890,
      "data": {...}
    },
    {
      "timestamp": 1234567900,
      "data": {...}
    }
  ],
  "count": 2
}
```

#### Upload Data to Walrus

Utility endpoint to upload data directly to Walrus.

```
POST /api/data/upload
```

**Request Body:**
```json
{
  "data": {
    "any": "data structure"
  },
  "encrypt": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "blobId": "walrus_blob_id_here"
  }
}
```

---

## WebSocket API

### Connection

Connect to the WebSocket server for real-time data streaming.

```
ws://localhost:3001/ws
```

### Subscribe to Feed

Send this message after connecting:

```json
{
  "type": "subscribe",
  "feedId": "0x...",
  "subscriptionId": "0x...",
  "consumer": "0x..."
}
```

**Success Response:**
```json
{
  "type": "subscribed",
  "feedId": "0x..."
}
```

**Initial Data:**
```json
{
  "type": "data",
  "feedId": "0x...",
  "data": {
    "timestamp": 1234567890,
    "temperature": 72,
    "humidity": 45
  },
  "timestamp": 1234567890
}
```

### Receive Data Updates

Whenever the feed updates, you'll receive:

```json
{
  "type": "data",
  "feedId": "0x...",
  "data": {
    ...updated data...
  },
  "timestamp": 1234567890
}
```

### Unsubscribe from Feed

```json
{
  "type": "unsubscribe"
}
```

**Response:**
```json
{
  "type": "unsubscribed"
}
```

### Error Messages

```json
{
  "type": "error",
  "error": "Error message here"
}
```

---

## Error Responses

All API endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Rate Limits

- **REST API**: 100 requests per minute per IP
- **WebSocket**: 10 concurrent connections per IP
- **Data Upload**: 10 MB per request

---

## Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:3001';

// Get all feeds
async function getAllFeeds() {
  const response = await axios.get(`${API_URL}/api/feeds`);
  return response.data;
}

// Subscribe to feed
async function subscribe(feedId: string, consumer: string) {
  const response = await axios.post(`${API_URL}/api/subscribe/${feedId}`, {
    consumer,
    tier: 1,
    paymentAmount: 100000000
  });
  return response.data;
}

// Get data
async function getData(feedId: string, subscriptionId: string, consumer: string) {
  const response = await axios.get(`${API_URL}/api/data/${feedId}`, {
    params: { subscriptionId, consumer }
  });
  return response.data;
}

// WebSocket streaming
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    feedId: '0x...',
    subscriptionId: '0x...',
    consumer: '0x...'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Python

```python
import requests
import websocket
import json

API_URL = 'http://localhost:3001'

# Get all feeds
def get_all_feeds():
    response = requests.get(f'{API_URL}/api/feeds')
    return response.json()

# Subscribe to feed
def subscribe(feed_id, consumer):
    response = requests.post(
        f'{API_URL}/api/subscribe/{feed_id}',
        json={
            'consumer': consumer,
            'tier': 1,
            'paymentAmount': 100000000
        }
    )
    return response.json()

# WebSocket
def on_message(ws, message):
    data = json.loads(message)
    print('Received:', data)

def on_open(ws):
    ws.send(json.dumps({
        'type': 'subscribe',
        'feedId': '0x...',
        'subscriptionId': '0x...',
        'consumer': '0x...'
    }))

ws = websocket.WebSocketApp(
    'ws://localhost:3001/ws',
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()
```

### cURL

```bash
# Get all feeds
curl http://localhost:3001/api/feeds

# Get specific feed
curl http://localhost:3001/api/feeds/0x...

# Preview data
curl "http://localhost:3001/api/data/0x...?preview=true"

# Get data (with subscription)
curl "http://localhost:3001/api/data/0x...?subscriptionId=0x...&consumer=0x..."
```

---

## Support

For API support:
- GitHub Issues: [repository-url]
- Email: support@your-domain.com
- Documentation: [docs-url]

---

**Happy Building! 🚀**
