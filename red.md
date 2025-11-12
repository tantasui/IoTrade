# IoT Data Exchange Protocol

**A decentralized marketplace transforming how IoT data is bought, sold, and accessed.**

Providers monetize sensor streams. Consumers access real-time data feeds. All transactions are transparent, automated, and trustless—powered by Sui blockchain and Walrus storage.

---

## 🎯 The Problem

The $1+ trillion IoT data economy is fundamentally broken:

- **Wasted Value**: Millions of IoT devices generate valuable data that never gets monetized
- **Fragmented Access**: Consumers can't easily discover or purchase diverse, real-time data streams
- **Broken Trust**: Centralized platforms lack transparency in pricing, quality, and payments
- **High Friction**: Complex subscriptions, payment processing, and access control create barriers
- **Data Lock-in**: Providers lose control and visibility once data enters traditional marketplaces

**The Result**: Billions in untapped economic value, with both providers and consumers losing out.

---

## 💡 Our Solution

We've built a decentralized protocol that enables a thriving IoT data economy:

### For Data Providers
- **Easy Monetization**: List your data feeds with transparent, self-determined pricing
- **Fair Revenue**: Earn 95% of all subscription revenue—smart contracts auto-distribute instantly
- **Full Control**: Maintain ownership, update frequency, and access policies
- **Build Trust**: Grow reputation through on-chain ratings visible to all buyers

### For Data Consumers
- **One-Stop Discovery**: Browse all available data feeds in a unified marketplace
- **Transparent Pricing**: See exact costs upfront—no hidden fees or surprise charges
- **Instant Access**: Subscribe once, access via REST API or real-time WebSocket streams
- **Quality Assurance**: Trust the data through our on-chain reputation system

### Technical Foundation
- **Sui Blockchain**: Fast finality, low transaction costs, parallel execution for scale
- **Walrus Storage**: Efficient, decentralized blob storage purpose-built for large IoT datasets
- **Smart Contracts**: Automated payments, cryptographic access control, immutable reputation tracking

---

## 🏗️ Architecture

Our system connects IoT devices to consumers through a decentralized pipeline:

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   IoT       │────────▶│   Backend    │────────▶│     Sui     │
│  Devices    │  POST   │     API      │  Move   │  Blockchain │
│  (Sensors)  │   data  │  (Node.js)   │  calls  │  (Testnet)  │
└─────────────┘         └──────────────┘         └─────────────┘
                              │                         │
                           Stores                   Records
                            data                   metadata,
                              │                   payments,
                              ▼                   subscriptions
                        ┌──────────────┐              │
                        │   Walrus     │◀─────────────┘
                        │   Storage    │  References
                        │  (Blobs)     │  blob IDs
                        └──────────────┘
                              │
                              │ Fetches
                              ▼
                        ┌──────────────┐
                        │   Frontend   │
                        │  (Next.js)   │
                        │ + WebSocket  │
                        └──────────────┘
```

### Data Flow

1. **Provider Registration**
   - Provider connects Sui wallet to dApp
   - Creates data feed (name, category, price, update frequency)
   - Feed metadata recorded on-chain via Move contract
   - Initial data uploaded to Walrus, blob ID stored on-chain

2. **Consumer Subscription**
   - Consumer browses marketplace, finds relevant feeds
   - Initiates subscription (monthly or pay-per-query)
   - Smart contract processes payment: 95% to provider, 5% to platform treasury
   - Subscription NFT minted to consumer's wallet as access credential
   - Consumer receives API key for programmatic access

3. **Real-Time Data Access**
   - Provider pushes updates via REST API (authenticated with provider API key)
   - Data stored on Walrus, new blob ID recorded on-chain
   - Consumer queries data via REST or WebSocket (authenticated with subscription NFT)
   - Backend verifies on-chain subscription status before serving data
   - Real-time streams delivered via WebSocket for live monitoring

4. **Trust & Reputation**
   - Consumers rate data quality after usage
   - Ratings recorded on-chain, immutably tied to provider
   - Marketplace surfaces top-rated feeds
   - Poor performers lose visibility and subscribers

---

## 🌟 Key Features

### Decentralized Marketplace
- **No Intermediaries**: Direct provider-to-consumer transactions
- **Global Access**: Anyone with a Sui wallet can participate
- **Category Browse**: Weather, traffic, air quality, parking, and more
- **Search & Filter**: Find exactly the data you need

### Smart Payment Distribution
- **Automated**: Smart contracts split revenue instantly (95/5)
- **Transparent**: All transactions visible on-chain
- **No Chargebacks**: Cryptographic finality prevents payment disputes
- **Real-Time Tracking**: Providers see earnings as they happen

### Flexible Data Access
- **REST API**: Standard HTTP endpoints for polling data
- **WebSocket Streaming**: Real-time push for live sensor feeds
- **Pay-Per-Query**: Pay only for what you use
- **Monthly Subscriptions**: Unlimited access for heavy users

### Quality Assurance
- **On-Chain Ratings**: Immutable reputation tied to wallet addresses
- **Data Previews**: Sample data before subscribing
- **Update Verification**: Timestamp tracking ensures data freshness
- **Provider Analytics**: Track reliability and uptime

### Developer-Friendly
- **API Keys**: Secure authentication for both providers and subscribers
- **Simple Integration**: RESTful design with clear documentation
- **IoT Optimized**: Lightweight endpoints for resource-constrained devices
- **WebSocket Support**: Efficient for real-time applications

---

## 🛠️ Technology Stack

### Blockchain Layer
- **Sui Move**: Smart contracts for marketplace, subscriptions, and reputation
- **Sui TypeScript SDK**: Backend blockchain interactions
- **Sui dApp Kit**: Frontend wallet integration

### Storage Layer
- **Walrus**: Decentralized blob storage for IoT data payloads
- **Walrus CLI**: Data upload and retrieval operations
- **On-Chain References**: Blob IDs stored in Move objects for verification

### Backend
- **Node.js + TypeScript**: Type-safe API server
- **Express**: RESTful routing and middleware
- **WebSocket (ws)**: Real-time data streaming
- **Prisma** (optional): Database for caching and analytics

### Frontend
- **Next.js 14**: React framework with App Router
- **TailwindCSS**: Responsive, modern UI
- **@mysten/dapp-kit**: Sui wallet connection
- **SWR**: Client-side data fetching and caching

### DevOps
- **Vercel**: Backend API deployment
- **Vercel**: Frontend hosting
- **GitHub Actions**: CI/CD pipeline (optional)

---

## 📊 What We've Built (Hackathon Deliverables)

### ✅ Smart Contracts (Sui Move)
- **`data_marketplace.move`**: Feed registration, updates, and metadata management
- **`subscription.move`**: Payment processing, subscription NFT minting, access control
- **`reputation.move`**: Rating system for provider quality tracking
- **`seal_access.move`**: Infrastructure ready for Seal encryption (future enhancement)

**Deployed Package ID**: `0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9`

### ✅ Backend API (Node.js)
- **Feed Management**: Create, update, list, and delete data feeds
- **Subscription Handling**: Process subscriptions, verify access, manage renewals
- **Data Access**: Serve data with authentication and rate limiting
- **IoT Integration**: Lightweight endpoint for device data uploads
- **API Key Management**: Generate and validate provider/subscriber keys
- **Walrus Integration**: Upload/retrieve data from Walrus storage
- **WebSocket Server**: Real-time streaming for live data feeds

**Live API**: `https://io-trade.vercel.app`

### ✅ Frontend (Next.js)
- **Landing Page**: Product overview and value proposition
- **Provider Dashboard**: Feed creation, data updates, earnings tracking
- **Consumer Marketplace**: Browse feeds, preview data, subscribe
- **Subscriber Dashboard**: Manage subscriptions, access API keys, view data
- **Wallet Integration**: Connect with Sui Wallet, Suiet, and Ethos

**Live Demo**: [Coming soon - deploying to Vercel]

### ✅ Examples & Documentation
- **IoT Device Examples**: Arduino/ESP32 code for sensor integration
- **API Documentation**: Complete endpoint reference
- **Integration Guide**: Step-by-step for providers and consumers
- **Smart Contract Tests**: Move test coverage for critical functions

---

## 🚀 Quick Start

### Prerequisites
```bash
# Required tools
- Node.js 18+
- Sui CLI (installed and configured)
- Git
- Sui Testnet wallet with test SUI
```

### 1. Clone & Setup

```bash
git clone <repository-url>
cd data-marketplace-
```

### 2. Deploy Smart Contracts

```bash
cd iot_marketplace
sui client publish --gas-budget 100000000

# Save these from the output:
# - Package ID
# - DataFeedRegistry object ID
# - PlatformTreasury object ID
```

### 3. Configure Backend

```bash
cd ../backend
npm install
cp .env.example .env

# Edit .env with your deployment values:
# SUI_PRIVATE_KEY=<your-wallet-private-key>
# SUI_PACKAGE_ID=<package-id-from-step-2>
# SUI_REGISTRY_ID=<registry-object-id>
# SUI_TREASURY_ID=<treasury-object-id>
# SUI_NETWORK=testnet
# PORT=3001
```

### 4. Run Backend

```bash
npm run dev
# API available at http://localhost:3001
```

### 5. Configure Frontend

```bash
cd ../frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
echo "NEXT_PUBLIC_SUI_PACKAGE_ID=<your-package-id>" >> .env.local
echo "NEXT_PUBLIC_SUI_REGISTRY_ID=<your-registry-id>" >> .env.local
echo "NEXT_PUBLIC_SUI_TREASURY_ID=<your-treasury-id>" >> .env.local
```

### 6. Run Frontend

```bash
npm run dev
# dApp available at http://localhost:3000
```

---

## 📖 Usage Examples

### For Data Providers

**Create Your First Feed**
```bash
1. Connect your Sui wallet to the dApp
2. Navigate to "Provider Dashboard"
3. Click "+ Create New Feed"
4. Fill in details:
   - Name: "Downtown LA Air Quality"
   - Category: "Air Quality"
   - Location: "Los Angeles, CA"
   - Price: 5 SUI/month
   - Update Frequency: 300 seconds
   - Initial Data: {"pm25": 12, "aqi": 45, "temp": 72}
5. Submit transaction and approve in wallet
6. Your feed is now live in the marketplace!
```

**Update Data from IoT Device**
```bash
# Generate provider API key from dashboard
# Then from your IoT device (ESP32, Arduino, etc.):

curl -X POST https://io-trade.vercel.app/api/iot/feeds/{feedId}/update \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-provider-api-key" \
  -d '{"pm25": 15, "aqi": 52, "temp": 75, "timestamp": "2024-11-12T10:30:00Z"}'
```

### For Data Consumers

**Subscribe to a Feed**
```bash
1. Connect your Sui wallet
2. Browse marketplace and find "Downtown LA Air Quality"
3. Click "Preview Data" to see sample readings
4. Click "Subscribe" (5 SUI/month)
5. Approve transaction in wallet
6. Subscription NFT minted to your wallet
7. Generate subscriber API key from dashboard
```

**Access Data Programmatically**
```javascript
// REST API (polling)
const response = await fetch(
  'https://io-trade.vercel.app/api/data/feeds/{feedId}/latest',
  {
    headers: {
      'X-API-Key': 'your-subscriber-api-key'
    }
  }
);
const data = await response.json();
console.log(data); // {"pm25": 15, "aqi": 52, "temp": 75, ...}

// WebSocket (real-time streaming)
const ws = new WebSocket('wss://io-trade.vercel.app/ws');
ws.on('open', () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    feedId: '{feedId}',
    apiKey: 'your-subscriber-api-key'
  }));
});
ws.on('message', (data) => {
  console.log('Real-time update:', JSON.parse(data));
});
```

---

## 💰 Economic Model

### Revenue Distribution
- **Provider Share**: 95% of all subscription revenue
- **Platform Fee**: 5% to sustain infrastructure and development
- **Payment Flow**: Smart contract automatically splits payment on subscription
- **Zero Delays**: Providers receive earnings instantly on-chain

### Pricing Models

**Monthly Subscription**
- Consumer pays fixed SUI amount per month
- Unlimited API calls during subscription period
- Best for heavy users and real-time monitoring

**Pay-Per-Query** (Roadmap)
- Consumer pays per API call
- Ideal for occasional data needs
- Micropayments via Sui's low gas fees

### Sample Economics

**Provider Scenario**: Weather station in San Francisco
- Subscription price: 10 SUI/month
- Active subscribers: 20
- Monthly revenue: 200 SUI (95% = 190 SUI to provider)
- Annual revenue: 2,280 SUI (~$2,000+ at current prices)

**Consumer Scenario**: Smart city dashboard
- Subscribes to 5 feeds: Weather, Traffic, Air Quality, Parking, Transit
- Total cost: 30 SUI/month (~$30)
- Traditional API costs: $200-500/month
- **Savings**: 85-90% compared to centralized alternatives

---

## 🔐 Security & Trust

### Smart Contract Security
- **Immutable Logic**: Published contracts cannot be modified
- **Auditable**: All code open-source and verifiable
- **Type Safety**: Sui Move's strong type system prevents common vulnerabilities
- **Access Control**: Only subscription NFT holders can access paid data

### Data Integrity
- **Walrus Storage**: Cryptographically verifiable blob storage
- **On-Chain References**: Blob IDs stored on-chain prevent tampering
- **Timestamp Verification**: All updates timestamped for freshness guarantees
- **Provider Accountability**: Wallet addresses tie reputation to identity

### Privacy Considerations
- **Public Metadata**: Feed descriptions and prices are public
- **Private Data**: Actual sensor data only accessible to subscribers
- **Future Enhancement**: Seal encryption for sensitive data categories
- **No Personal Data**: System doesn't store user PII beyond wallet addresses

---

## 🔮 Roadmap & Future Enhancements

### Phase 1: Foundation (✅ Completed - Hackathon)
- Smart contracts on Sui Testnet
- Backend API with Walrus integration
- Frontend marketplace and dashboards
- Basic reputation system
- API key authentication

### Phase 2: Enhanced Privacy (Q1 2025)
- **Seal Encryption**: Identity-based encryption for premium feeds
- **Policy Enforcement**: On-chain access control for encrypted data
- **Private Categories**: Health data, location tracking, sensitive sensors
- **Audit Logs**: Immutable record of data access

### Phase 3: AI Agent Integration (Q2 2025)
- **Structured Schemas**: Standardized JSON formats for AI consumption
- **Semantic Search**: AI-powered feed discovery based on requirements
- **Agent APIs**: Optimized endpoints for autonomous agent subscriptions
- **Batch Operations**: Multi-feed subscriptions in single transaction
- **Data Transformation**: Auto-convert to formats preferred by LLMs

### Phase 4: Scale & Performance (Q3 2025)
- **Mainnet Launch**: Deploy to Sui Mainnet
- **Off-Chain Indexing**: Faster queries with The Graph or similar
- **Caching Layer**: Redis for frequently accessed data
- **CDN Integration**: Global content delivery for low-latency access
- **Mobile Apps**: Native iOS and Android applications

### Phase 5: Ecosystem Growth (Q4 2025)
- **SDKs**: Python, JavaScript, Rust libraries for easy integration
- **CLI Tool**: Command-line interface for power users
- **Data Aggregation**: Combine multiple feeds into derived products
- **Analytics Dashboard**: Advanced insights for providers
- **Governance Token**: Community-driven platform evolution

---

## 🏆 Why This Matters for Walrus Haulout

### Novel Use of Walrus
We're not just storing files—we're building a **real-time data economy** on Walrus:

1. **High-Frequency Updates**: IoT devices generate data every few seconds/minutes
2. **Scalable Storage**: Walrus handles thousands of concurrent uploads efficiently
3. **Cost Efficiency**: Decentralized storage at fraction of centralized cloud costs
4. **Cryptographic Verification**: Blob IDs provide tamper-proof data integrity
5. **Global Availability**: Anyone, anywhere can access data without geo-restrictions

### Real-World Impact
- **Environmental Monitoring**: Democratize access to air quality, water quality data
- **Smart Cities**: Enable data-driven urban planning and resource optimization
- **Agriculture**: Soil sensors, weather stations help farmers make better decisions
- **Transportation**: Real-time traffic, parking data improves commute efficiency
- **Research**: Scientists access diverse IoT datasets for climate and urban studies

### Technical Innovation
- **Seamless Integration**: Walrus + Sui work beautifully together for storage + logic
- **Developer Experience**: Our API abstracts complexity—upload to Walrus is one function call
- **Economic Viability**: Low storage costs make micropayments for data sustainable
- **Future-Proof**: Architecture ready for Seal encryption and advanced privacy features

---

## 📁 Project Structure

```
iot-data-exchange/
├── iot_marketplace/              # Sui Move smart contracts
│   ├── sources/
│   │   ├── data_marketplace.move    # Core marketplace logic
│   │   ├── subscription.move        # Payment & access control
│   │   ├── reputation.move          # Rating system
│   │   └── seal_access.move         # Future: Seal integration
│   ├── tests/                       # Move unit tests
│   └── Move.toml                    # Package manifest
│
├── backend/                      # Node.js API server
│   ├── src/
│   │   ├── services/
│   │   │   ├── sui.service.ts       # Blockchain interactions
│   │   │   ├── walrus.service.ts    # Storage operations
│   │   │   └── websocket.service.ts # Real-time streaming
│   │   ├── routes/
│   │   │   ├── feeds.ts             # Feed CRUD operations
│   │   │   ├── subscriptions.ts     # Subscription management
│   │   │   ├── data.ts              # Data access endpoints
│   │   │   ├── iot.ts               # IoT device endpoints
│   │   │   └── api-keys.ts          # Key generation
│   │   ├── middleware/
│   │   │   ├── auth.ts              # API key validation
│   │   │   └── ratelimit.ts         # Rate limiting
│   │   └── index.ts                 # Express app entry
│   ├── .env.example                 # Environment template
│   └── package.json
│
├── frontend/                     # Next.js dApp
│   ├── src/
│   │   ├── app/                     # Next.js 14 App Router
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── provider/            # Provider dashboard
│   │   │   ├── marketplace/         # Consumer marketplace
│   │   │   └── subscriber/          # Subscriber dashboard
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx    # Sui wallet integration
│   │   │   ├── FeedCard.tsx         # Feed display component
│   │   │   └── SubscriptionModal.tsx # Subscribe flow
│   │   ├── hooks/
│   │   │   ├── useSuiWallet.ts      # Wallet state
│   │   │   └── useWebSocket.ts      # Real-time data
│   │   ├── lib/
│   │   │   └── api.ts               # API client
│   │   └── styles/                  # Tailwind styles
│   └── package.json
│
├── examples/                     # Integration examples
│   ├── iot-devices/                 # Arduino, ESP32 code
│   ├── consumer-apps/               # Sample consumer apps
│   └── README.md                    # Usage examples
│
└── README.md                     # This file
```

---

## 🎥 Demo & Resources

### Live Deployments
- **Smart Contracts**: [Sui Explorer - Package `0xea35b8...`](https://suiscan.xyz/testnet/object/0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9)
- **Backend API**: https://io-trade.vercel.app
- **Frontend dApp**: [Deploying - Link TBD]

### Documentation
- **API Reference**: `/docs/API.md`
- **Smart Contract Docs**: `/iot_marketplace/README.md`
- **IoT Integration Guide**: `/examples/README.md`

### Demo Video
[Link to demo video - TBD]

### Test It Yourself
1. Get testnet SUI from [Sui Faucet](https://discord.com/channels/916379725201563759/971488439931392130)
2. Visit our dApp (link above)
3. Connect wallet and create a test feed
4. Subscribe to your own feed
5. Access data via API using provided keys

---

## 🤝 Team

**Built by**: Jah / Rinku Technology  
**Role**: Full-stack blockchain developer  
**Contact**: [Your preferred contact method]

---

## 📄 License

MIT License - Open source and free to use

---

## 🙏 Acknowledgments

- **Sui Foundation**: For building an incredible blockchain platform
- **Walrus Team**: For pioneering decentralized storage solutions
- **Hackathon Organizers**: For creating this opportunity to innovate

---

**Built with ❤️ for the Walrus Haulout Hackathon**

**Empowering the decentralized IoT data economy—one sensor at a time.**
3