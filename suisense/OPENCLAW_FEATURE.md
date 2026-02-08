# SuiSense — OpenClaw Feature Documentation

> A complete technical reference for SuiSense: how it was built, how every piece works,
> how to run it, and how it integrates with OpenClaw. Written so that another LLM or
> developer can fully understand and reproduce the system.

---

## Table of Contents

1. [What Is SuiSense](#what-is-suisense)
2. [What Is OpenClaw and How Skills Work](#what-is-openclaw-and-how-skills-work)
3. [Architecture — Full Data Flow](#architecture--full-data-flow)
4. [Deployed On-Chain Objects](#deployed-on-chain-objects)
5. [Move Smart Contracts (Already Deployed)](#move-smart-contracts-already-deployed)
6. [Project Structure — Every File Explained](#project-structure--every-file-explained)
7. [How Each File Was Built](#how-each-file-was-built)
8. [Environment Variables](#environment-variables)
9. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
10. [Running the Full Demo](#running-the-full-demo)
11. [ESP32 Hardware Setup](#esp32-hardware-setup)
12. [OpenClaw Integration — How the Agent Uses SuiSense](#openclaw-integration--how-the-agent-uses-suisense)
13. [API Reference](#api-reference)
14. [CLI Reference](#cli-reference)
15. [Verified Test Results](#verified-test-results)
16. [Dependencies](#dependencies)
17. [Troubleshooting](#troubleshooting)

---

## What Is SuiSense

SuiSense is a pair of OpenClaw skills that bridge **physical IoT sensors** to the **Sui blockchain**, creating an autonomous agent-to-agent data economy.

**The seller agent** (SuiSense Skill):
- Runs a local HTTP server that receives real sensor data from an ESP32 + DHT11
- Uploads every reading to Walrus decentralized storage as a JSON blob
- Updates an on-chain DataFeed object on Sui testnet with the new Walrus blob ID
- Provides CLI commands for the OpenClaw agent to query readings, stats, and earnings

**The buyer agent** (SuiSense Buyer Skill):
- Discovers available data feeds on the Sui marketplace by querying on-chain events
- Subscribes to feeds by paying SUI tokens (95% goes to provider, 5% platform fee)
- Reads live sensor data by fetching the Walrus blob ID from the on-chain DataFeed

**Why it matters for the hackathon:**
- Real physical hardware component (ESP32 + DHT11 temperature/humidity sensor)
- Demonstrates agent-to-agent commerce: one agent sells data, another buys it
- Uses three Sui stack components: Move contracts, Walrus storage, SUI token payments
- Everything is deployed and verified working on Sui testnet

---

## What Is OpenClaw and How Skills Work

**OpenClaw** (formerly Moltbot/Clawdbot) is an open-source AI agent that runs locally on your machine. It can execute shell commands, control Chrome browsers, manage files, and interact via messaging apps.

**Skills** are how OpenClaw gains new capabilities. A skill is a directory containing:

- **`SKILL.md`** — A markdown file with YAML frontmatter that gets **injected directly into the agent's system prompt**. This is the key file. It tells the agent what the skill can do, what commands to run, and how to interpret results.
- **Supporting code** — Scripts, config files, etc. that the agent runs via its built-in bash/exec tools.

### How skill loading works at runtime:

1. Skill directories are placed in `~/.openclaw/skills/` (or workspace `skills/`)
2. At startup, OpenClaw scans for `SKILL.md` files
3. Each `SKILL.md` is parsed — YAML frontmatter extracts metadata (name, requirements, emoji)
4. The markdown body is concatenated into the `TOOLS.md` section of the agent's system prompt
5. The `{baseDir}` variable in the SKILL.md is replaced with the skill's actual directory path
6. If the skill declares requirements (`bins`, `env` vars), OpenClaw checks they're available — if not, the skill is skipped

### How the agent uses a skill:

The agent does NOT call any special skill API. It simply:
1. Reads the injected SKILL.md text in its system prompt
2. Understands what commands are available (e.g., `npx tsx {baseDir}/src/cli.ts latest`)
3. When the user asks something relevant, the agent uses its built-in `exec`/`bash` tool to run the command
4. The agent reads the command output and interprets it for the user

**Skills are essentially "smart documentation" — they teach the agent how to use existing tools effectively.**

### SKILL.md frontmatter format:

```yaml
---
name: suisense
description: IoT sensor data bridge to Sui blockchain.
metadata:
  openclaw:
    emoji: "🌡️"
    requires:
      bins:
        - node
        - npx
      env:
        - SUI_PRIVATE_KEY
        - SUI_PACKAGE_ID
---
```

---

## Architecture — Full Data Flow

```
                          PHYSICAL WORLD
    ┌─────────────────────────────────────────────────┐
    │                                                 │
    │   ESP32 + DHT11 Sensor                          │
    │   Reads temperature & humidity every 60 seconds │
    │   Validates readings (32-122F, 20-100% RH)      │
    │   LED indicators: blue=sending, green=ok,       │
    │                   red=error                     │
    │                                                 │
    └────────────────────┬────────────────────────────┘
                         │
                         │ HTTP POST /api/sensor/update
                         │ Content-Type: application/json
                         │
                         │ {
                         │   "deviceId": "esp32-dht11-001",
                         │   "data": {
                         │     "temperature": 28.5,
                         │     "humidity": 65.2,
                         │     "heatIndex": 29.1,
                         │     "timestamp": 1707300000
                         │   }
                         │ }
                         │
                         ▼
    ┌─────────────────────────────────────────────────┐
    │                                                 │
    │   OPENCLAW AGENT + SuiSense Skill               │
    │   (sensor-server.ts — Express on port 3001)     │
    │                                                 │
    │   Step 1: Validate payload (data field required) │
    │   Step 2: Enrich with metadata:                 │
    │           { receivedAt, source: "iot_device" }  │
    │   Step 3: Upload JSON to Walrus                 │
    │           PUT {publisherUrl}/v1/blobs?epochs=1  │
    │           → returns blobId                      │
    │   Step 4: Update on-chain DataFeed              │
    │           call update_feed_data(feedId, blobId) │
    │           → DataFeed.walrus_blob_id = new blob  │
    │   Step 5: Store reading in memory (last 100)    │
    │   Step 6: Return { success, blobId, feedId }    │
    │                                                 │
    └──────────┬──────────────────┬───────────────────┘
               │                  │
               ▼                  ▼
    ┌──────────────────┐  ┌──────────────────────────┐
    │                  │  │                            │
    │  Walrus Storage  │  │  Sui Blockchain (testnet)  │
    │  (decentralized) │  │                            │
    │                  │  │  Package:                   │
    │  JSON blobs:     │  │  0xea35b816...              │
    │  {               │  │                            │
    │    temperature,  │  │  DataFeed (shared object):  │
    │    humidity,     │  │  ├─ name: "SuiSense DHT11" │
    │    heatIndex,    │  │  ├─ category: "IoT"        │
    │    deviceId,     │  │  ├─ walrus_blob_id: "8sj.."│
    │    receivedAt,   │  │  ├─ price_per_query: 0.001 │
    │    source        │  │  ├─ total_subscribers: N   │
    │  }               │  │  └─ total_revenue: N MIST  │
    │                  │  │                            │
    │  Accessible via: │  │  Registry (shared):        │
    │  GET /v1/blobs/  │  │  ├─ feed_count             │
    │    {blobId}      │  │  └─ platform_fee_pct       │
    │                  │  │                            │
    └──────────────────┘  │  Treasury (shared):        │
               ▲          │  └─ collects 5% fees       │
               │          │                            │
               │          └────────────┬───────────────┘
               │                       │
               │          ┌────────────▼───────────────┐
               │          │                            │
               │          │  OPENCLAW AGENT +           │
               │          │  SuiSense Buyer Skill       │
               │          │  (data-buyer.ts CLI)        │
               │          │                            │
               │          │  discover:                  │
               │          │    Query FeedRegistered     │
               │          │    events → list all feeds  │
               │          │                            │
               │          │  subscribe:                 │
               │          │    Call subscribe_to_feed   │
               │          │    Pay SUI → get Subscription│
               │          │    object (owned by buyer)  │
               │          │                            │
               │          │  read:                      │
               │          │    Get DataFeed object      │
               │          │    → extract walrus_blob_id │
               └──────────│    → GET blob from Walrus   │
                          │    → display sensor data    │
                          │                            │
                          └────────────────────────────┘
```

---

## Deployed On-Chain Objects

All smart contracts are **already deployed** on Sui testnet. No redeployment needed.

| Object | Type | ID |
|--------|------|-----|
| **Package** | Move Package | `0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9` |
| **Registry** | `data_marketplace::DataFeedRegistry` (shared) | `0x61f6a2c059928f75219616196c7454e48599825a8503a6d8b2595708bde167c3` |
| **Treasury** | `subscription::PlatformTreasury` (shared) | `0x0ec0eb4ed00c9c9f93854bee86675ab97baf87f58bc2a88c27d493be383a9d5c` |
| **SuiSense Feed** | `data_marketplace::DataFeed` (shared) | `0x4871a398372229edb5f18776cbb0dc333f9368d6f615a36e17c489f6842c850c` |
| **Seller Address** | Ed25519 | `0xe7b5873257c12797d22f21fe8a4f81270d21c2678b94d89432df05e3c2f97ed8` |

---

## Move Smart Contracts (Already Deployed)

The contracts live in `/home/tanta/IoTrade/iot_marketplace/sources/` and are deployed at the package ID above.

### `data_marketplace` module
- **`register_data_feed(registry, name, category, desc, location, price_per_query, monthly_price, is_premium, walrus_blob_id, update_frequency)`** — Creates a shared `DataFeed` object. Emits `FeedRegistered` event.
- **`update_feed_data(feed, new_walrus_blob_id)`** — Updates the feed's `walrus_blob_id` field. Only the provider can call this. Emits `DataUpdated` event.
- **DataFeed struct fields:** `provider`, `name`, `category`, `description`, `location`, `price_per_query`, `monthly_subscription_price`, `is_premium`, `walrus_blob_id`, `created_at`, `last_updated`, `is_active`, `update_frequency`, `total_subscribers`, `total_revenue`

### `subscription` module
- **`subscribe_to_feed(feed, registry, treasury, payment_coin, tier)`** — Creates a `Subscription` object owned by the caller. Payment is split: 95% to provider, 5% to treasury. Emits `SubscriptionCreated` event.
- **Tiers:** 0 = pay-per-query, 1 = monthly, 2 = premium
- **Subscription struct fields:** `consumer`, `feed_id`, `tier`, `start_epoch`, `expiry_epoch`, `payment_amount`, `queries_used`, `is_active`

### `reputation` module
- **`submit_rating(feed_id, stars, comment)`** — Creates a `Rating` object (1-5 stars).

### `seal_access` module
- Access control for Seal-encrypted premium feeds (not used by SuiSense — feeds are non-premium).

---

## Project Structure — Every File Explained

```
suisense/
│
├── .env                           # Actual secrets (gitignored)
├── .env.example                   # Template showing required variables
├── README.md                      # Quick-start guide
├── OPENCLAW_FEATURE.md            # This file — detailed technical reference
│
├── suisense-skill/                # OPENCLAW SELLER AGENT SKILL
│   │
│   ├── SKILL.md                   # THE KEY FILE — injected into OpenClaw's prompt
│   │                              # Contains YAML frontmatter (name, emoji, requirements)
│   │                              # + markdown body (commands, setup, endpoints, flow)
│   │                              # Every command uses {baseDir} which OpenClaw resolves
│   │
│   ├── package.json               # type: "module", deps: @mysten/sui, express, axios, dotenv
│   ├── tsconfig.json              # ES2022, ESNext modules, bundler resolution
│   │
│   └── src/
│       ├── config.ts              # Loads ../.env via dotenv
│       │                          # Exports config object with sui/walrus/sensor sections
│       │                          # Non-throwing — server starts even without all vars
│       │
│       ├── walrus-store.ts        # uploadData(data) → PUT to Walrus → parse blobId
│       │                          #   Handles 6 different Walrus response shapes
│       │                          # retrieveData(blobId) → GET from Walrus → parse JSON
│       │
│       ├── sui-bridge.ts          # Sui SDK wrapper with lazy keypair initialization
│       │                          # getAddress() — wallet address from private key
│       │                          # updateFeedData(feedId, blobId) — on-chain update
│       │                          # getDataFeed(feedId) — fetch + parse DataFeed object
│       │                          # getBalance(addr) — SUI balance in SUI (not MIST)
│       │                          # registerDataFeed(metadata, blobId) — create new feed
│       │                          # getAllDataFeeds() — query FeedRegistered events
│       │                          # subscribe(feedId, tier, amount) — subscribe + pay
│       │
│       ├── sensor-server.ts       # Express server on SENSOR_PORT (default 3001)
│       │                          # POST /api/sensor/update — main endpoint for ESP32
│       │                          #   validate → enrich → Walrus upload → Sui update
│       │                          # GET /api/sensor/latest — most recent reading
│       │                          # GET /api/sensor/readings — last 50 readings
│       │                          # GET /api/sensor/stats — totals, uptime, feed ID
│       │                          # GET /api/sensor/health — server health + last age
│       │                          # In-memory storage (array of last 100 readings)
│       │
│       └── cli.ts                 # CLI entry point for non-server commands
│                                  # Usage: npx tsx src/cli.ts <command>
│                                  # Commands: latest, stats, earnings, health,
│                                  #           feed-info, balance, register-feed
│                                  # Each command either queries the local server
│                                  # (via HTTP) or queries Sui directly (via sui-bridge)
│
├── buyer-agent/                   # OPENCLAW BUYER AGENT SKILL
│   │
│   ├── SKILL.md                   # Buyer skill — injected into a second OpenClaw agent
│   │                              # Commands: discover, subscribe, read, balance
│   │
│   ├── package.json               # Lighter deps: @mysten/sui, axios, dotenv (no express)
│   ├── tsconfig.json
│   │
│   └── src/
│       └── data-buyer.ts          # Standalone CLI — uses BUYER_PRIVATE_KEY (separate wallet)
│                                  # discover — queryEvents for FeedRegistered, fetch each
│                                  # subscribe — splitCoins + subscribe_to_feed Move call
│                                  # read — getObject → walrus_blob_id → GET from Walrus
│                                  # balance — getBalance for buyer address
│
└── esp32/
    └── suisense_dht11.ino         # Arduino firmware for ESP32 + DHT11
                                   # Reads real temp/humidity every 60 seconds
                                   # HTTP POST to sensor server (no API key — local)
                                   # WiFi auto-reconnect, LED status indicators
                                   # Validates readings against DHT11 spec ranges
                                   # Libraries: WiFi, HTTPClient, ArduinoJson, DHT
```

---

## How Each File Was Built

Every TypeScript module was adapted from the existing **IoTrade** codebase at `/home/tanta/IoTrade/backend/src/`. The IoTrade backend is a full-featured Node.js/Express server with Prisma/PostgreSQL, API key auth, Seal encryption, and WebSocket streaming. SuiSense strips all that down to the essential pipeline.

| SuiSense File | IoTrade Source | What Changed |
|---------------|---------------|-------------|
| `config.ts` | New | Loads `.env` from parent dir. Non-throwing — allows server to start without blockchain keys |
| `walrus-store.ts` | `services/walrus.service.ts` (lines 33-140) | Removed Seal encryption, removed class wrapper, kept the multi-shape blob ID parser (6 different Walrus response formats), pure functions |
| `sui-bridge.ts` | `services/sui.service.ts` (580 lines) | Extracted to standalone functions (not a class). Lazy keypair initialization (deferred until first use). Kept all Move call patterns: `update_feed_data`, `register_data_feed`, `subscribe_to_feed`, `queryEvents`. Kept retry logic removed for simplicity |
| `sensor-server.ts` | `routes/iot.ts` + `index.ts` | Removed: Prisma database, API key authentication, WebSocket broadcasting, Seal encryption. Added: in-memory readings array (last 100), enrichment metadata, graceful handling of missing Sui keys |
| `cli.ts` | New | CLI wrapper that queries local server (via axios HTTP) or Sui (via sui-bridge) depending on command |
| `data-buyer.ts` | `services/sui.service.ts` | Standalone buyer with own keypair from `BUYER_PRIVATE_KEY`. Discover via `queryEvents`, subscribe via `splitCoins` + `subscribe_to_feed`, read via `getObject` + Walrus fetch |
| `suisense_dht11.ino` | `example/provider-iot-device.ino` | Changed from mock data to real DHT11 sensor. Added DHT library, sensor validation, heat index calculation. Removed API key header. Changed to 60s interval. Added LED blink patterns |

---

## Environment Variables

File: `suisense/.env` (loaded by `config.ts` and `data-buyer.ts`)

```env
# === Sui Blockchain ===
SUI_NETWORK=testnet
SUI_PACKAGE_ID=0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9
SUI_REGISTRY_ID=0x61f6a2c059928f75219616196c7454e48599825a8503a6d8b2595708bde167c3
SUI_TREASURY_ID=0x0ec0eb4ed00c9c9f93854bee86675ab97baf87f58bc2a88c27d493be383a9d5c
SUI_PRIVATE_KEY=suiprivkey1...    # Seller wallet (Bech32 or hex)

# === Data Feed ===
DATA_FEED_ID=0x4871a398372229edb5f18776cbb0dc333f9368d6f615a36e17c489f6842c850c

# === Walrus Storage ===
WALRUS_PUBLISHER_URL=https://walrus.testnet.publisher.stakepool.dev.br
WALRUS_AGGREGATOR_URL=https://walrus.testnet.aggregator.stakepool.dev.br
WALRUS_EPOCHS=1

# === Server ===
SENSOR_PORT=3001

# === Buyer Agent ===
BUYER_PRIVATE_KEY=suiprivkey1...  # Separate buyer wallet
```

**Key points:**
- `SUI_PRIVATE_KEY` supports both Bech32 (`suiprivkey1...`) and raw hex formats
- `DATA_FEED_ID` is set after running `register-feed` CLI command
- `BUYER_PRIVATE_KEY` MUST be a different wallet than the seller
- `WALRUS_EPOCHS=1` means blobs are stored for 1 epoch (sufficient for demo)

---

## Step-by-Step Setup Guide

### Prerequisites
- Node.js 18+ and npm
- A Sui testnet wallet with SUI tokens
- (Optional) ESP32 board with DHT11 sensor

### Step 1: Install dependencies
```bash
cd suisense/suisense-skill && npm install
cd ../buyer-agent && npm install
```

### Step 2: Create .env
```bash
cd suisense
cp .env.example .env
# Edit .env with your SUI_PRIVATE_KEY
```

### Step 3: Register a DataFeed on-chain (one-time)
```bash
cd suisense-skill
npx tsx src/cli.ts register-feed
```
This does two things:
1. Uploads a placeholder JSON blob to Walrus
2. Calls `register_data_feed` on Sui — creates a shared DataFeed object

Output:
```
Registering new DataFeed on-chain...
Initial blob uploaded: 38yWyI0OBZVYIBGm1kjCzMsaRLjsMZMkad8btlSdUB0
Feed registered! Feed ID: 0x4871a398372229edb5f18776cbb0dc333f9368d6f615a36e17c489f6842c850c
Add this to your .env: DATA_FEED_ID=0x4871a398...
```

Copy the feed ID to your `.env`.

### Step 4: Start the sensor server
```bash
cd suisense-skill
npx tsx src/sensor-server.ts
```

### Step 5: Send test data (no ESP32 needed)
```bash
curl -X POST http://localhost:3001/api/sensor/update \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"esp32-dht11-001","data":{"temperature":28.5,"humidity":65.2,"heatIndex":29.1}}'
```

### Step 6: Verify the full pipeline
```bash
# Check local reading
curl http://localhost:3001/api/sensor/latest

# Check on-chain feed (should show new walrus_blob_id)
npx tsx src/cli.ts feed-info

# Buyer agent reads the data
cd ../buyer-agent
npx tsx src/data-buyer.ts read 0x4871a398372229edb5f18776cbb0dc333f9368d6f615a36e17c489f6842c850c
```

---

## Running the Full Demo

This is the demo flow that shows the complete end-to-end pipeline:

### Terminal 1: Start seller agent server
```bash
cd suisense/suisense-skill
npx tsx src/sensor-server.ts
```

### Terminal 2: Simulate ESP32 (or use real hardware)
```bash
# Send sensor reading
curl -X POST http://localhost:3001/api/sensor/update \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"esp32-dht11-001","data":{"temperature":28.5,"humidity":65.2,"heatIndex":29.1}}'

# Response:
# {"success":true,"blobId":"8sjmUCvf...","feedId":"0x4871a398...","timestamp":1770544831693}
```

### Terminal 3: Buyer agent discovers and reads data
```bash
cd suisense/buyer-agent

# Discover all feeds on the marketplace
npx tsx src/data-buyer.ts discover

# Read the SuiSense feed specifically
npx tsx src/data-buyer.ts read 0x4871a398372229edb5f18776cbb0dc333f9368d6f615a36e17c489f6842c850c

# Output:
# Feed: SuiSense DHT11 Sensor
# Walrus blob: 8sjmUCvfqdtaw0E4oWROAf_TPVBsxVh-WkwAMOKz3OQ
# Data:
# {
#   "temperature": 28.5,
#   "humidity": 65.2,
#   "heatIndex": 29.1,
#   "deviceId": "esp32-dht11-001",
#   "receivedAt": 1770544816958,
#   "source": "iot_device"
# }
```

### What just happened:
1. ESP32 data was POSTed to the local sensor server
2. Server uploaded the JSON to Walrus (decentralized storage) → got blob ID
3. Server called `update_feed_data` on Sui → stored blob ID on-chain
4. Buyer agent queried the on-chain DataFeed → got the blob ID → fetched data from Walrus
5. Buyer sees real temperature/humidity data that came from a physical sensor

---

## ESP32 Hardware Setup

### Wiring

```
ESP32 Board          DHT11 Sensor
─────────────        ────────────
3.3V  ──────────────  VCC (Pin 1)
GPIO 4 ─────────────  DATA (Pin 2)
                      NC  (Pin 3) — not connected
GND   ──────────────  GND (Pin 4)

Optional LEDs (for status):
GPIO 2  → Built-in blue LED (WiFi/sending status)
GPIO 15 → Green LED (success)
GPIO 13 → Red LED (error)
```

### Arduino IDE Setup

1. Install board: ESP32 by Espressif Systems
2. Install libraries via Library Manager:
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor`
   - `ArduinoJson` by Benoit Blanchon
3. Open `esp32/suisense_dht11.ino`
4. Update configuration at the top:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* serverHost = "192.168.1.100";  // IP of machine running sensor server
   ```
5. Select board: ESP32 Dev Module
6. Upload

### LED Blink Patterns
- 2 blinks (green) = successful upload
- 3 blinks (red) = sensor read error
- 4 blinks (red) = HTTP connection error
- 5 blinks (red) = sensor validation failure

---

## OpenClaw Integration — How the Agent Uses SuiSense

### Installing the skills

```bash
# Copy seller skill
cp -r suisense/suisense-skill ~/.openclaw/skills/suisense

# Copy buyer skill
cp -r suisense/buyer-agent ~/.openclaw/skills/suisense-buyer
```

### What happens at OpenClaw startup

1. OpenClaw scans `~/.openclaw/skills/` for directories containing `SKILL.md`
2. Finds `suisense/SKILL.md` and `suisense-buyer/SKILL.md`
3. Checks requirements:
   - `bins: [node, npx]` — are these installed? Yes → proceed
   - `env: [SUI_PRIVATE_KEY, SUI_PACKAGE_ID]` — are these set? If not → skill skipped
4. Injects the SKILL.md markdown body into the agent's system prompt
5. The agent now "knows" it can manage IoT sensor data

### Example conversations with OpenClaw

**User:** "Start the sensor server"
**Agent runs:** `cd ~/.openclaw/skills/suisense && npx tsx src/sensor-server.ts`
**Agent says:** "Sensor server started on port 3001. Ready to receive ESP32 data."

**User:** "What's the latest temperature reading?"
**Agent runs:** `npx tsx ~/.openclaw/skills/suisense/src/cli.ts latest`
**Agent says:** "Latest reading: 28.5C, 65.2% humidity from esp32-dht11-001, received 30 seconds ago."

**User:** "How much have I earned?"
**Agent runs:** `npx tsx ~/.openclaw/skills/suisense/src/cli.ts earnings`
**Agent says:** "Your SuiSense DHT11 Sensor feed has 2 subscribers and earned 0.1 SUI total."

**User:** "Find me some data feeds to buy"
**Agent runs:** `npx tsx ~/.openclaw/skills/suisense-buyer/src/data-buyer.ts discover`
**Agent says:** "Found 30 feeds on the marketplace. Here are the top ones: ..."

**User:** "Subscribe to the SuiSense feed"
**Agent runs:** `npx tsx ~/.openclaw/skills/suisense-buyer/src/data-buyer.ts subscribe 0x4871a398... 0 1000000`
**Agent says:** "Subscribed! Paid 0.001 SUI. Subscription ID: 0xabc123..."

---

## API Reference

### POST `/api/sensor/update`

Receives sensor data from ESP32 and processes it through the full pipeline.

**Request:**
```json
{
  "deviceId": "esp32-dht11-001",
  "data": {
    "temperature": 28.5,
    "humidity": 65.2,
    "heatIndex": 29.1,
    "timestamp": 1707300000
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "blobId": "8sjmUCvfqdtaw0E4oWROAf_TPVBsxVh-WkwAMOKz3OQ",
  "feedId": "0x4871a398372229edb5f18776cbb0dc333f9368d6f615a36e17c489f6842c850c",
  "timestamp": 1770544831693
}
```

**What happens internally:**
1. Validates `data` field exists
2. Enriches with `{ receivedAt, source: "iot_device", deviceId }`
3. `uploadData(enrichedData)` → PUT to Walrus → parse blobId from response
4. `updateFeedData(feedId, blobId)` → Sui transaction → updates DataFeed object
5. Stores in memory array (unshift, cap at 100)
6. Returns blobId and feedId

### GET `/api/sensor/latest`

Returns the most recent reading from memory.

```json
{
  "success": true,
  "data": {
    "deviceId": "esp32-dht11-001",
    "data": { "temperature": 28.5, "humidity": 65.2, ... },
    "blobId": "8sjmUCvf...",
    "receivedAt": 1770544831693
  }
}
```

### GET `/api/sensor/readings`

Returns the last 50 readings from memory.

### GET `/api/sensor/stats`

```json
{
  "success": true,
  "totalReadings": 42,
  "lastReading": 1770544831693,
  "uptime": 3600,
  "feedId": "0x4871a398...",
  "address": "0xe7b587..."
}
```

### GET `/api/sensor/health`

```json
{
  "success": true,
  "status": "running",
  "lastReadingAgeSec": 45,
  "totalReadings": 42,
  "uptime": 3600
}
```

---

## CLI Reference

### Seller CLI (`suisense-skill/src/cli.ts`)

Run from `suisense-skill/` directory:

| Command | What It Does | Requires Server? |
|---------|-------------|-----------------|
| `npx tsx src/cli.ts latest` | Fetches latest reading from local server | Yes |
| `npx tsx src/cli.ts stats` | Shows readings count, uptime, feed ID | Yes |
| `npx tsx src/cli.ts health` | Server health + last reading age | Yes |
| `npx tsx src/cli.ts earnings` | Queries Sui for feed revenue & subscribers | No |
| `npx tsx src/cli.ts feed-info` | Shows full DataFeed on-chain details | No |
| `npx tsx src/cli.ts balance` | Shows SUI wallet balance | No |
| `npx tsx src/cli.ts register-feed` | Creates new DataFeed on Sui (one-time) | No |

### Buyer CLI (`buyer-agent/src/data-buyer.ts`)

Run from `buyer-agent/` directory:

| Command | What It Does |
|---------|-------------|
| `npx tsx src/data-buyer.ts discover` | Lists all feeds from FeedRegistered events |
| `npx tsx src/data-buyer.ts subscribe <feedId> <tier> <amountMIST>` | Subscribes + pays SUI |
| `npx tsx src/data-buyer.ts read <feedId>` | Reads data from Walrus via on-chain blobId |
| `npx tsx src/data-buyer.ts balance` | Shows buyer wallet balance |

**Tier values:** 0 = pay-per-query, 1 = monthly, 2 = premium
**Amount in MIST:** 1 SUI = 1,000,000,000 MIST

---

## Verified Test Results

All tests performed on **February 8, 2026** against Sui testnet:

| Test | Result | Details |
|------|--------|---------|
| Server startup (no env) | PASS | Starts gracefully, shows "(no key set)" |
| Server startup (with env) | PASS | Shows address and feed ID |
| POST sensor data | PASS | Returns `blobId` and `feedId` |
| Walrus upload | PASS | Blob ID: `8sjmUCvfqdtaw0E4oWROAf_TPVBsxVh-WkwAMOKz3OQ` |
| Walrus retrieval | PASS | Returns original JSON: `{"temperature":28.5,"humidity":65.2,...}` |
| On-chain feed update | PASS | `walrus_blob_id` field updated (confirmed via `getObject`) |
| GET /api/sensor/latest | PASS | Returns most recent reading |
| GET /api/sensor/stats | PASS | Returns count, uptime, feed ID |
| GET /api/sensor/health | PASS | Returns status and last reading age |
| CLI feed-info | PASS | Shows full on-chain DataFeed details |
| CLI balance | PASS | Shows `2.744 SUI` |
| CLI register-feed | PASS | Created feed `0x4871a398...` |
| Buyer discover | PASS | Found 30+ live feeds on marketplace |
| Buyer read | PASS | Read SuiSense feed data from Walrus |
| TypeScript compile (seller) | PASS | `tsc --noEmit` — zero errors |
| TypeScript compile (buyer) | PASS | `tsc --noEmit` — zero errors |

---

## Dependencies

### suisense-skill

| Package | Version | Purpose |
|---------|---------|---------|
| `@mysten/sui` | ^1.44.0 | Sui TypeScript SDK — Transaction building, Ed25519Keypair, SuiClient |
| `express` | ^4.18.2 | HTTP server for receiving ESP32 sensor data |
| `axios` | ^1.6.2 | HTTP client for Walrus blob upload/retrieval |
| `dotenv` | ^16.3.1 | Load `.env` file |
| `tsx` | ^4.7.0 | Run TypeScript directly (dev) |
| `typescript` | ^5.3.2 | Type checking (dev) |
| `@types/express` | ^4.17.21 | Express type definitions (dev) |
| `@types/node` | ^20.10.0 | Node type definitions (dev) |

### buyer-agent

Same as above minus `express` and `@types/express` (buyer doesn't run a server).

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Server won't start: "Missing required environment variable" | Old config.ts version | Pull latest — config.ts no longer throws at startup |
| Server starts but shows "(no key set)" | `SUI_PRIVATE_KEY` not in `.env` | Add your Bech32 or hex private key to `suisense/.env` |
| Walrus upload fails: "Walrus upload failed" | Publisher URL unreachable | Try alternate endpoint: `https://publisher.walrus-testnet.walrus.space` |
| On-chain update fails but server returns success | `DATA_FEED_ID` not set | Register a feed first: `npx tsx src/cli.ts register-feed` |
| On-chain update fails: "Keypair not initialized" | Missing `SUI_PRIVATE_KEY` | Add key to `.env` |
| `register-feed` fails: "SUI_REGISTRY_ID not configured" | Missing registry ID | Set `SUI_REGISTRY_ID=0x61f6a2c0...` in `.env` |
| Buyer `discover` shows "Invalid params" | Empty `SUI_PACKAGE_ID` | Set package ID in `.env` or use default |
| Buyer `subscribe` fails: "SUI_REGISTRY_ID and SUI_TREASURY_ID must be configured" | Missing IDs | Set both in `.env` |
| ESP32 shows "NaN" for readings | DHT11 wiring issue | Check DATA pin → GPIO 4, VCC → 3.3V, GND → GND |
| ESP32 shows "OUT OF RANGE" values | Wrong sensor type or damaged sensor | Verify DHT11 (not DHT22), check 3.3V power |
| ESP32 HTTP error -5 (connection lost) | Server timeout or network issue | Check server is running, move ESP32 closer to WiFi |
| ESP32 HTTP 308 redirect | Wrong server URL | Update `serverHost` to correct IP |
