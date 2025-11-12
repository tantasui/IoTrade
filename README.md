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
cd contracts
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

## 🎯 Sample Data Feeds

The demo includes 5 pre-configured feeds:

1. **SF Weather Station** (Free)
   - Temperature, humidity, pressure, wind
   - Updates every 5 minutes

2. **Downtown Traffic Camera** (Premium - 1 SUI/month)
   - Vehicle counts, speeds, congestion
   - Updates every minute
   - Seal encrypted

3. **Air Quality Monitor** (Premium - 0.5 SUI/month)
   - PM2.5, PM10, CO2, AQI
   - Updates every 10 minutes
   - Seal encrypted

4. **Shopping District Parking** (0.2 SUI/month)
   - 250 spots availability
   - Real-time occupancy rates
   - Updates every 5 minutes

5. **Oakland Weather Station** (0.1 SUI/month)
   - Weather data for Oakland
   - Updates every 5 minutes

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
├── contracts/              # Sui Move smart contracts
│   ├── sources/
│   │   ├── data_marketplace.move
│   │   ├── subscription.move
│   │   └── reputation.move
│   └── Move.toml
├── backend/               # Node.js API server
│   ├── src/
│   │   ├── services/     # Walrus, Sui services
│   │   ├── routes/       # API routes
│   │   ├── types/        # TypeScript types
│   │   ├── utils/        # Utilities
│   │   └── index.ts      # Server entry point
│   └── package.json
└── frontend/              # Next.js web app
    ├── src/
    │   ├── pages/        # Next.js pages
    │   ├── components/   # React components
    │   ├── hooks/        # Custom hooks
    │   ├── lib/          # API client
    │   └── styles/       # CSS
    └── package.json
```

## 🏆 Built for Sui Hackathon 2024

### Key Innovations

- **True Data Ownership**: Providers maintain full control of their IoT data
- **Automated Payments**: Smart contracts ensure instant, fair revenue distribution
- **Privacy-Preserving**: Seal encryption protects sensitive data
- **Scalable Storage**: Walrus enables efficient decentralized data storage
- **Real-time Access**: WebSocket streaming for live data feeds
- **Quality Assurance**: On-chain reputation system incentivizes good data

## 📄 License

MIT

---

**Built with ❤️ for the decentralized data economy**