# IoT Data Exchange Protocol

A decentralized marketplace where IoT device owners can monetize their data streams and consumers can purchase verified, real-time data feeds. Built on Sui blockchain with Walrus storage.

## 🎯 Problem Statement

The IoT data economy faces several critical challenges:

1. **Data Silos**: IoT device owners struggle to monetize their data streams, while consumers face difficulty accessing diverse, real-time data sources
2. **Trust & Transparency**: Traditional data marketplaces lack transparency in pricing, data quality, and payment distribution
3. **High Transaction Costs**: Centralized intermediaries take significant cuts, reducing profitability for providers
4. **Access Control**: Complex subscription management and access verification systems create friction
5. **Data Ownership**: Providers lose control over their data once it's sold, with limited ability to track usage

## 💡 Solution

The IoT Data Exchange Protocol solves these problems by:

- **Decentralized Marketplace**: Direct peer-to-peer data exchange on Sui blockchain, eliminating intermediaries
- **Transparent Pricing**: All transactions and pricing are on-chain, visible to all participants
- **Automated Payments**: Smart contracts ensure instant, fair revenue distribution (95% to provider, 5% platform fee)
- **Decentralized Storage**: Data stored on Walrus, ensuring availability and reducing storage costs
- **Real-time Access**: WebSocket support for live data streaming
- **Reputation System**: On-chain ratings incentivize data quality and provider reliability
- **API-First Design**: Simple REST and WebSocket APIs for easy integration

## 🏗️ How It Works

### Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   IoT       │───────▶│   Backend    │────────▶│   Sui       │
│  Devices    │         │   API        │         │ Blockchain  │
└─────────────┘         └──────────────┘         └─────────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
                        ┌──────────────┐         ┌─────────────┐
                        │   Walrus     │         │   Frontend  │
                        │   Storage    │         │   (Next.js) │
                        └──────────────┘         └─────────────┘
```

### Workflow

1. **Provider Registration**:
   - Provider connects wallet and creates a data feed
   - Feed metadata (name, category, price) is registered on-chain
   - Initial data is uploaded to Walrus storage
   - Feed becomes available in the marketplace

2. **Consumer Subscription**:
   - Consumer browses available feeds
   - Selects a feed and subscribes (pay-per-query or monthly)
   - Payment is processed via smart contract
   - Subscription NFT is minted to consumer's wallet
   - Consumer receives API keys for data access

3. **Data Access**:
   - Provider updates data via API (with API key authentication)
   - Data is stored on Walrus
   - Consumer queries data via REST API or WebSocket
   - Access is verified on-chain using subscription NFT

4. **Revenue Distribution**:
   - Payments are automatically split: 95% to provider, 5% to platform treasury
   - All transactions are recorded on-chain
   - Providers can track earnings in real-time

### Smart Contracts

- **`iot_marketplace::data_marketplace`**: Manages feed registration, updates, and metadata
- **`iot_marketplace::subscription`**: Handles subscriptions, payments, and access control
- **`iot_marketplace::reputation`**: Tracks ratings and quality metrics

## 💰 Incentives

### For Data Providers

1. **Direct Monetization**: Earn SUI tokens directly from data sales (95% revenue share)
2. **Low Barriers**: No upfront costs, pay only for on-chain transactions
3. **Full Control**: Set your own pricing and update frequency
4. **Reputation Building**: Build trust through on-chain ratings
5. **Automated Payments**: Instant revenue distribution via smart contracts
6. **Multiple Revenue Streams**: Support both pay-per-query and subscription models

### For Data Consumers

1. **Access to Diverse Data**: Browse feeds from multiple providers in one marketplace
2. **Transparent Pricing**: See all costs upfront, no hidden fees
3. **Quality Assurance**: Reputation system helps identify reliable data sources
4. **Flexible Subscriptions**: Choose between pay-per-query or monthly subscriptions
5. **Real-time Access**: WebSocket support for live data streaming
6. **API Integration**: Simple REST API for easy integration into applications
7. **Cost Efficiency**: No intermediaries means lower prices

## 📁 Project Structure

```
data-marketplace-/
├── iot_marketplace/          # Sui Move smart contracts
│   ├── sources/
│   │   ├── iot_marketplace.move    # Main marketplace contract
│   │   ├── subscription.move       # Subscription management
│   │   ├── reputation.move         # Rating system
│   │   └── seal_access.move        # Access control (future)
│   ├── tests/                      # Move contract tests
│   └── Move.toml                   # Move package config
│
├── backend/                   # Node.js/Express API server
│   ├── src/
│   │   ├── services/
│   │   │   ├── sui.service.ts      # Sui blockchain integration
│   │   │   ├── walrus.service.ts  # Walrus storage integration
│   │   │   └── seal.service.ts     # Seal encryption (future)
│   │   ├── routes/
│   │   │   ├── feeds.ts           # Feed management endpoints
│   │   │   ├── subscriptions.ts   # Subscription endpoints
│   │   │   ├── data.ts            # Data access endpoints
│   │   │   ├── iot.ts             # IoT device endpoints
│   │   │   └── api-keys.ts        # API key management
│   │   ├── types/                  # TypeScript type definitions
│   │   ├── utils/                  # Utility functions
│   │   └── index.ts                # Server entry point
│   ├── prisma/                     # Database schema (if using)
│   └── package.json
│
├── frontend/                  # Next.js web application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx           # Landing page
│   │   │   ├── provider.tsx        # Provider dashboard
│   │   │   ├── consumer.tsx         # Consumer marketplace
│   │   │   └── subscriber.tsx      # Subscriber dashboard
│   │   ├── components/
│   │   │   ├── common/             # Shared components
│   │   │   ├── provider/          # Provider-specific components
│   │   │   └── subscriber/         # Subscriber components
│   │   ├── hooks/
│   │   │   ├── useSuiWallet.ts     # Wallet integration
│   │   │   └── useSeal.ts          # Seal integration (future)
│   │   ├── lib/
│   │   │   └── api.ts              # API client
│   │   ├── types/                  # TypeScript types
│   │   └── styles/                 # CSS/Tailwind styles
│   └── package.json
│
├── examples/                  # Example code for providers/consumers
│   ├── frontend/              # Frontend examples
│   ├── move/                  # Move contract examples
│   └── README.md              # Examples documentation
│
├── wokwi/                     # IoT device examples (Arduino/C++)
│   └── README.md              # IoT integration guide
│
└── README.md                  # This file
```

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
# - SUI_NETWORK: testnet (or mainnet)
```

### 4. Start Backend

```bash
npm run dev
```

Backend will be available at `http://localhost:3001` (or your configured port)

### 5. Set Up Frontend

```bash
cd ../frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
echo "NEXT_PUBLIC_SUI_PACKAGE_ID=<your-package-id>" >> .env.local
echo "NEXT_PUBLIC_SUI_REGISTRY_ID=<your-registry-id>" >> .env.local
echo "NEXT_PUBLIC_SUI_TREASURY_ID=<your-treasury-id>" >> .env.local
```

### 6. Start Frontend

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

## 📖 Usage Guide

### For Data Providers

1. **Connect Wallet**: Click "Connect Wallet" and select your Sui wallet
2. **Navigate to Provider Dashboard**: Click "Provider Dashboard" in the navigation
3. **Create New Feed**: Click "+ Create New Feed"
4. **Fill Form**:
   - Feed Name: Descriptive name for your data source
   - Category: Weather, Traffic, Air Quality, Parking, etc.
   - Location: Geographic location
   - Description: What data you're providing
   - Pricing: Set monthly subscription price (in SUI)
   - Update Frequency: How often data updates (in seconds)
   - Initial Data: Upload your first data point (JSON format)
5. **Submit**: Your feed will be registered on-chain and data uploaded to Walrus
6. **Update Data**: Click "Update Data" on any feed to upload new readings
7. **Generate API Keys**: Create provider API keys for your IoT devices to use

### For Data Consumers

1. **Connect Wallet**: Click "Connect Wallet" and select your Sui wallet
2. **Navigate to Marketplace**: Click "Marketplace" in the navigation
3. **Browse Feeds**: Use filters to find feeds by category or location
4. **Preview Data**: Click "Preview Data" to see sample data
5. **Subscribe**: Click "Subscribe" and approve the transaction in your wallet
6. **Access Data**: 
   - Your subscription ID will be displayed
   - Generate subscriber API keys for programmatic access
   - Use REST API or WebSocket to access data

### For IoT Devices

1. **Get Provider API Key**: From your provider dashboard, generate an API key
2. **Use IoT Endpoint**: Send data updates to `/api/iot/feeds/{feedId}/update`
3. **Include API Key**: Add `X-API-Key` header with your provider key
4. **Send JSON Data**: POST request with your sensor data in JSON format

See `wokwi/README.md` for Arduino/C++ examples.

## 🛠️ Technology Stack

- **Blockchain**: Sui (testnet/mainnet)
- **Storage**: Walrus (decentralized blob storage)
- **Smart Contracts**: Sui Move
- **Backend**: Node.js, TypeScript, Express
- **Frontend**: Next.js, React, TailwindCSS
- **Wallet Integration**: Sui dApp Kit
- **Real-time**: WebSockets
- **API**: RESTful API with WebSocket support

## 🌟 Features

- **Decentralized Data Marketplace**: Buy and sell IoT data streams with complete transparency
- **Smart Payments**: Automated revenue distribution via Sui smart contracts (95% to provider, 5% platform fee)
- **Real-time Streaming**: WebSocket support for live data feeds
- **Multiple Subscription Models**: Pay-per-query and monthly subscription options
- **Provider Dashboard**: Easy feed management and analytics
- **Consumer Marketplace**: Browse, preview, and subscribe to data feeds
- **Reputation System**: Rate providers and track data quality metrics
- **API Key Management**: Secure API keys for providers and subscribers
- **IoT Integration**: Simple REST API for IoT devices

## 🔮 Future Improvements

### 1. Seal Encryption Integration
- **Identity-Based Encryption**: Implement Seal encryption for premium data feeds
- **Access Control**: On-chain policy verification for encrypted data
- **Privacy**: Enhanced privacy for sensitive IoT data (health, location, etc.)
- **Status**: Infrastructure ready, awaiting full integration

### 2. AI Agent Streamlining
- **Structured Data Schemas**: Standardized data formats for AI consumption
- **Agent-Friendly APIs**: Optimized endpoints for AI agent interactions
- **Semantic Search**: AI-powered feed discovery based on data requirements
- **Automated Subscriptions**: AI agents can automatically subscribe to relevant feeds
- **Data Formatting**: Automatic conversion to formats preferred by AI models

### 3. Enhanced Features
- **Data Analytics Dashboard**: Advanced analytics for providers (usage patterns, revenue trends)
- **Batch Subscriptions**: Subscribe to multiple feeds in one transaction
- **Data Aggregation**: Combine multiple feeds into aggregated data streams
- **Mobile App**: Native mobile applications for iOS and Android
- **Off-chain Indexing**: Improved query performance with off-chain indexing
- **Multi-chain Support**: Extend to other blockchains beyond Sui

### 4. Developer Experience
- **SDKs**: JavaScript/TypeScript, Python, and Rust SDKs
- **CLI Tool**: Command-line interface for feed management
- **Documentation**: Comprehensive API documentation with examples
- **Testing Tools**: Test suite for contract and API testing

### 5. Scalability
- **Layer 2 Solutions**: Integration with Sui's scaling solutions
- **Caching Layer**: Redis caching for frequently accessed data
- **CDN Integration**: Content delivery network for global data access
- **Load Balancing**: Horizontal scaling for backend services

## 📊 Deployment Information

### Smart Contract Package ID
```
0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9
```

### Backend API URL
```
https://io-trade.vercel.app
```

### Network
- **Testnet**: Currently deployed on Sui Testnet
- **Mainnet**: Ready for mainnet deployment

### API Endpoints
- **Feeds**: `/api/feeds`
- **Subscriptions**: `/api/subscriptions`
- **Data**: `/api/data`
- **WebSocket**: `/ws`
- **Health**: `/health`

## 🏆 Built for Sui Hackathon 2024

### Key Innovations

- **True Data Ownership**: Providers maintain full control of their IoT data
- **Automated Payments**: Smart contracts ensure instant, fair revenue distribution
- **Decentralized Storage**: Walrus enables efficient decentralized data storage
- **Real-time Access**: WebSocket streaming for live data feeds
- **Quality Assurance**: On-chain reputation system incentivizes good data
- **API-First Design**: Simple integration for developers and IoT devices


---

**Built with ❤️ for the decentralized data economy**
**Built with foe walrus Halout**
