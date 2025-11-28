# IoT Data Exchange Protocol

A decentralized marketplace where IoT device owners can monetize their data streams and consumers can purchase verified, real-time data feeds. Built on Sui blockchain with Walrus storage and Seal encryption.

## 🌟 Features

- **Decentralized Data Marketplace**: Buy and sell IoT data streams with complete transparency
- **Secure Storage**: Data stored on Walrus with optional Seal encryption for premium feeds
- **Smart Payments**: Automated revenue distribution via Sui smart contracts (95% to provider, 5% platform fee)
- **Real-time Streaming**: WebSocket support for live data feeds
- **Multiple Subscription Models**: Pay-per-query and monthly subscription options
- **Provider Dashboard**: Easy feed management and analytics
- **Consumer Marketplace**: Browse, preview, and subscribe to data feeds
- **Reputation System**: Rate providers and track data quality metrics

## 🏗️ Architecture

### Smart Contracts (Sui Move)
- **data_marketplace.move**: Feed registration, updates, and management
- **subscription.move**: Subscription handling and payment distribution
- **reputation.move**: Rating system and quality metrics

### Backend (Node.js/TypeScript)
- Express API server with WebSocket support
- Walrus integration for decentralized storage
- Sui blockchain integration
- Seal encryption for premium content

### Frontend (Next.js/React)
- Landing page with marketplace overview
- Provider dashboard for feed management
- Consumer marketplace for browsing and subscribing
- Real-time data viewer with WebSocket streaming

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Sui CLI installed and configured
- Sui testnet wallet with SUI tokens
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd data-marketplace-
```

### 2. Deploy Smart Contracts

```bash
cd iot_marketplace
sui client publish --gas-budget 100000000
```

Save the Package ID from the output and note the object IDs for:
- DataFeedRegistry
- PlatformTreasury

### 3. Set Up Backend

```bash
cd ../backend
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your values:
# - SUI_PRIVATE_KEY: Your wallet private key
# - SUI_PACKAGE_ID: From step 2
# - SUI_REGISTRY_ID: DataFeedRegistry object ID
# - SUI_TREASURY_ID: PlatformTreasury object ID
```

### 4. Initialize Demo Data (Optional)

```bash
npm run build
npm run init-demo
```

This creates 5 sample data feeds for testing.

### 5. Start Backend

```bash
npm run dev
```

Backend will be available at `http://localhost:3001`

### 6. Set Up Frontend

```bash
cd ../frontend
npm install
```

### 7. Start Frontend

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

## 📋 Deployed Contracts

- **Package ID**: `0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9`

> **Note**: If you're deploying your own contracts, follow the Quick Start guide above. Otherwise, you can use the deployed package ID above for testing with the live applications.

## 📖 Usage Guide

### For Data Providers

1. **Connect Wallet**: Click "Connect Wallet" and select your Sui wallet
2. **Navigate to Provider Dashboard**: Click "Provider Dashboard" in the navigation
3. **Create New Feed**: Click "+ Create New Feed"
4. **Fill Form**:
   - Feed Name: Descriptive name for your data source
   - Category: Weather, Traffic, Air Quality, etc.
   - Location: Geographic location
   - Description: What data you're providing
   - Pricing: Set monthly subscription price
   - Initial Data: Upload your first data point (JSON format)
   - Premium: Check if you want Seal encryption
5. **Submit**: Your feed will be registered on-chain and data uploaded to Walrus
6. **Update Data**: Click "Update Data" on any feed to upload new readings

### For Data Consumers

1. **Connect Wallet**: Click "Connect Wallet" and select your Sui wallet
2. **Navigate to Marketplace**: Click "Marketplace" in the navigation
3. **Browse Feeds**: Use filters to find feeds by category, type, or location
4. **Preview Data**: Click "Preview Data" to see sample data
5. **Subscribe**: Click "Subscribe" and approve the transaction in your wallet
6. **Access Data**: Your subscription ID will be displayed - use it to access data via API

## 🔌 API Structure

The IoT Data Marketplace provides a REST API and WebSocket API for programmatic access to data feeds.

### Base URL
- **Development**: `http://localhost:3001`
- **Production**: `https://io-trade.vercel.app`

### REST API Endpoints

#### Health & Info
- `GET /health` - Health check endpoint
- `GET /` - API information and available endpoints

#### Feeds
- `GET /api/feeds` - List all feeds (with optional filters: category, isPremium, minPrice, maxPrice, location)
- `GET /api/feeds/:feedId` - Get specific feed details
- `POST /api/feeds` - Create a new feed (requires wallet)
- `PUT /api/feeds/:feedId/data` - Update feed data
- `POST /api/feeds/:feedId/rating` - Submit a rating for a feed

#### Subscriptions
- `POST /api/subscribe/:feedId` - Subscribe to a feed
- `GET /api/subscriptions/:subscriptionId` - Get subscription details
- `POST /api/subscriptions/:subscriptionId/verify` - Verify access to a feed

#### Data Access
- `GET /api/data/:feedId` - Get feed data (requires subscription or preview mode)
- `GET /api/data/:feedId/history` - Get historical data points
- `POST /api/data/upload` - Upload data to Walrus storage

### WebSocket API

Real-time data streaming via WebSocket:

- **Endpoint**: `ws://localhost:3001/ws` (development) or `wss://io-trade.vercel.app/ws` (production)

**Message Types:**
- `subscribe` - Subscribe to a feed
- `unsubscribe` - Unsubscribe from current feed
- `data` - Receive data updates
- `error` - Error messages

**Example:**
```json
{
  "type": "subscribe",
  "feedId": "0x...",
  "subscriptionId": "0x...",
  "consumer": "0x..."
}
```

### Authentication

Most endpoints require:
- **Wallet Address**: Sui wallet address for on-chain operations
- **Subscription ID**: Valid subscription ID for data access
- **API Key** (optional): For programmatic access without wallet

### Response Format

All API responses follow this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

### Full API Documentation

For complete API documentation with detailed request/response examples, see [API.md](./API.md).

## 🛠️ Technology Stack

- **Blockchain**: Sui
- **Storage**: Walrus
- **Encryption**: Seal
- **Smart Contracts**: Sui Move
- **Backend**: Node.js, TypeScript, Express
- **Frontend**: Next.js, React, TailwindCSS
- **Wallet Integration**: Sui dApp Kit
- **Real-time**: WebSockets

## 📁 Project Structure

```
data-marketplace-/
├── iot_marketplace/       # Sui Move smart contracts
│   ├── sources/
│   │   ├── iot_marketplace.move    # Main marketplace contract
│   │   ├── subscription.move       # Subscription handling
│   │   ├── reputation.move         # Rating and reputation system
│   │   └── seal_access.move        # Seal encryption access control
│   ├── tests/            # Move contract tests
│   ├── build/            # Compiled contracts
│   └── Move.toml
├── backend/               # Node.js API server
│   ├── src/
│   │   ├── services/     # Walrus, Sui services
│   │   ├── routes/       # API routes
│   │   ├── types/        # TypeScript types
│   │   ├── utils/        # Utilities
│   │   └── index.ts      # Server entry point
│   ├── prisma/           # Database schema and migrations
│   ├── setup-koyeb-db.sh # Database setup script
│   └── package.json
├── frontend/              # Next.js web app
│   ├── src/
│   │   ├── pages/        # Next.js pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks (useSuiWallet, etc.)
│   │   ├── lib/          # API client and utilities
│   │   └── styles/       # CSS
│   └── package.json
├── subscriber-viewer/     # Standalone WebSocket data viewer
│   ├── index.html         # UI for viewing data
│   ├── websocket-client.js # WebSocket connection handler
│   ├── data-renderer.js   # Data visualization and rendering
│   └── README.md
├── example/               # IoT device and provider examples
│   ├── provider-iot-device.ino    # Arduino example
│   ├── provider-monitor.ts        # TypeScript provider example
│   ├── subscriber-example.ts      # TypeScript subscriber example
│   ├── subscriber-example.js      # JavaScript subscriber example
│   ├── subscriber-example.py     # Python subscriber example
│   └── README.md

├── wokwi/                 # Wokwi simulator integration
│   ├── sketch.ino         # Arduino sketch for Wokwi
│   ├── sketch_http.ino    # HTTP version
│   ├── diagram.json       # Circuit diagram
│   └── README.md
├── API.md                 # API documentation
├── SEAL_INTEGRATION_PLAN.md  # Seal encryption integration docs
└── README.md              # This file
```

## 🏆 Built for Walrus halout Hackathon 

### Key Innovations

- **True Data Ownership**: Providers maintain full control of their IoT data
- **Automated Payments**: Smart contracts ensure instant, fair revenue distribution
- **Privacy-Preserving**: Seal encryption protects sensitive data
- **Scalable Storage**: Walrus enables efficient decentralized data storage
- **Real-time Access**: WebSocket streaming for live data feeds
- **Quality Assurance**: On-chain reputation system incentivizes good data

## 🚀 Future Improvements

### Reputation System Integration
- **Reputation Module**: The `reputation.move` module is already implemented but not yet fully integrated into the frontend and backend
- **Features to Add**:
  - Display provider ratings and reviews in the marketplace
  - Show data quality metrics (uptime, response time) on feed cards
  - Implement helpfulness voting for reviews
  - Provider response system for addressing feedback
  - Verified provider badges based on reputation scores

### Seal Encryption Enhancements
- **Streamlining for AI Agents**: Simplify Seal encryption/decryption flow for automated agents
- **Batch Decryption**: Support for decrypting multiple premium feeds in a single transaction
- **Key Caching**: Improved session key management for better performance
- **Access Policy Extensions**: More granular access control policies (time-based, usage-based)

### Enhanced Features
- **Data Analytics Dashboard**: Advanced analytics for providers (revenue trends, subscriber growth)
- **Automated Billing**: Recurring subscription payments with automatic renewals
- **Multi-chain Support**: Extend to other blockchain networks
- **Mobile App**: Native mobile applications for iOS and Android
- **Data Visualization**: Built-in charts and graphs for data feeds
- **Webhook Support**: Real-time notifications for feed updates and subscriptions

### Developer Experience
- **SDK Development**: Official SDKs for popular programming languages (Python, JavaScript, Go)
- **API Documentation**: Comprehensive API documentation with interactive examples
- **Testing Tools**: Developer tools for testing feed creation and subscription flows
- **Monitoring & Alerts**: Built-in monitoring for feed uptime and performance

### Scalability
- **Layer 2 Integration**: Support for Sui Layer 2 solutions for lower transaction costs
- **Data Compression**: Automatic data compression for large payloads
- **CDN Integration**: Content delivery network for faster data access globally
- **Load Balancing**: Distributed backend infrastructure for high availability

## 🔗 Live Demo & Resources

### Presentation
- [Project Presentation Slides](https://docs.google.com/presentation/d/1vvGmz0bMcDphmjvYBbQLjcUka5LUnJ47LJ9p8qgWUCQ/edit?usp=sharing)

### Live Applications
- **Backend API**: [https://io-trade.vercel.app/](https://io-trade.vercel.app/)
- **Frontend**: [https://io-trade-h8tj.vercel.app/](https://io-trade-h8tj.vercel.app/)
- **Subscriber Viewer**: [https://io-trade-28o6.vercel.app/](https://io-trade-28o6.vercel.app/)



---

**Built with ❤️ for the decentralized data economy**