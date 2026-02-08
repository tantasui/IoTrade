# SuiSense — IoT Sensor Bridge for Sui

**OpenClaw x Sui Hackathon — Track 2: Local God Mode**

SuiSense bridges physical IoT sensors to the Sui blockchain via OpenClaw skills. An ESP32 with a DHT11 sensor reads real temperature and humidity data, sends it to a local server, which stores it on Walrus decentralized storage and records it on-chain in the IoTrade data marketplace.

## Architecture

```
┌─────────────┐     HTTP POST      ┌──────────────────┐
│  ESP32 +    │ ──────────────────> │  Sensor Server   │
│  DHT11      │   /api/sensor/     │  (Express.js)    │
│  Sensor     │   update           │  Port 3001       │
└─────────────┘                    └────────┬─────────┘
                                            │
                                   ┌────────┴─────────┐
                                   │                    │
                              ┌────▼─────┐     ┌──────▼──────┐
                              │  Walrus  │     │  Sui Chain  │
                              │  Storage │     │  (testnet)  │
                              │  (blobs) │     │  DataFeed   │
                              └──────────┘     └──────┬──────┘
                                                      │
                                              ┌───────▼───────┐
                                              │  Buyer Agent  │
                                              │  (OpenClaw)   │
                                              │  discover/    │
                                              │  subscribe/   │
                                              │  read         │
                                              └───────────────┘
```

## OpenClaw Skills

### Seller Skill (`suisense-skill/`)
The seller agent manages the sensor server and monitors earnings. OpenClaw reads `SKILL.md` and gains the ability to:
- Start/stop the sensor server
- Query live readings and stats
- Check on-chain feed details and revenue
- Register new data feeds

### Buyer Skill (`buyer-agent/`)
The buyer agent discovers and purchases data. OpenClaw reads `SKILL.md` and gains the ability to:
- List available feeds from testnet events
- Subscribe to feeds with SUI payment
- Read latest sensor data from Walrus

## Quick Start

### 1. Environment Setup
```bash
cd suisense
cp .env.example .env
# Edit .env with your SUI_PRIVATE_KEY, SUI_PACKAGE_ID, etc.
```

### 2. Install Dependencies
```bash
cd suisense-skill && npm install
cd ../buyer-agent && npm install
```

### 3. Register a Data Feed (One-Time)
```bash
cd suisense-skill
npx tsx src/cli.ts register-feed
# Copy the returned feed ID to .env as DATA_FEED_ID
```

### 4. Start Sensor Server
```bash
cd suisense-skill
npx tsx src/sensor-server.ts
```

### 5. Test with Mock Data
```bash
curl -X POST http://localhost:3001/api/sensor/update \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test","data":{"temperature":25,"humidity":60}}'

curl http://localhost:3001/api/sensor/latest
```

### 6. Flash ESP32
Open `esp32/suisense_dht11.ino` in Arduino IDE:
1. Update WiFi credentials
2. Set `serverHost` to your machine's IP
3. Upload to ESP32
4. DHT11 on GPIO 4, LED on GPIO 2

### 7. Use with OpenClaw
Copy skill directories to your OpenClaw skills path:
```bash
cp -r suisense-skill ~/.openclaw/skills/suisense
cp -r buyer-agent ~/.openclaw/skills/suisense-buyer
```

## Sui Stack Components

| Component | Usage |
|-----------|-------|
| **Sui Move** | DataFeed objects, subscription contracts, data marketplace |
| **Walrus** | Decentralized storage for sensor data blobs |
| **Sui Client SDK** | `@mysten/sui` for transaction building and querying |

**Package ID (testnet):** `0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9`

## Project Structure

```
suisense/
├── suisense-skill/           # OpenClaw seller agent skill
│   ├── SKILL.md              # Skill definition (injected into agent prompt)
│   ├── src/
│   │   ├── sensor-server.ts  # Express server for ESP32 data
│   │   ├── sui-bridge.ts     # Sui blockchain interactions
│   │   ├── walrus-store.ts   # Walrus storage
│   │   ├── config.ts         # Environment config
│   │   └── cli.ts            # CLI commands for the agent
│   ├── package.json
│   └── tsconfig.json
├── buyer-agent/              # OpenClaw buyer agent skill
│   ├── SKILL.md              # Buyer skill definition
│   ├── src/
│   │   └── data-buyer.ts     # CLI for discovering/buying data
│   ├── package.json
│   └── tsconfig.json
├── esp32/
│   └── suisense_dht11.ino    # ESP32 + DHT11 firmware
├── .env.example
└── README.md
```

## License

Built for the OpenClaw x Sui Hackathon.
