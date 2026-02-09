---
name: suisense
description: IoT sensor data bridge to Sui blockchain. Manages ESP32 sensor data, Walrus storage, and on-chain data marketplace.
metadata: {"openclaw":{"emoji":"🌡️","requires":{"bins":["node","npx"],"env":["SUI_PRIVATE_KEY","SUI_PACKAGE_ID","DATA_FEED_ID"]}}}
---

# SuiSense — IoT Data Bridge for Sui

You can manage IoT sensor data that flows from physical ESP32 sensors through Walrus decentralized storage and onto the Sui blockchain.

## What You Can Do

- **Start the sensor server** to receive live ESP32 data
- **Query sensor readings** (latest, history, stats)
- **Check earnings** from data subscriptions on Sui
- **View on-chain feed details** (subscribers, revenue, blob IDs)
- **Register new data feeds** on the Sui marketplace
- **Check wallet balance** and server health

## Commands

### Start Sensor Server
Starts the Express server that receives ESP32 sensor data, uploads to Walrus, and updates Sui on-chain.
```bash
cd {baseDir} && npx tsx src/sensor-server.ts
```
The server runs on port 3001 (configurable via SENSOR_PORT).

### Get Latest Reading
```bash
npx tsx {baseDir}/src/cli.ts latest
```

### Show Feed Stats
```bash
npx tsx {baseDir}/src/cli.ts stats
```

### Check Earnings
Shows revenue and subscriber count from the on-chain DataFeed.
```bash
npx tsx {baseDir}/src/cli.ts earnings
```

### Server Health Check
```bash
npx tsx {baseDir}/src/cli.ts health
```

### Show On-Chain Feed Info
```bash
npx tsx {baseDir}/src/cli.ts feed-info
```

### Check Wallet Balance
```bash
npx tsx {baseDir}/src/cli.ts balance
```

### Register New Feed (One-Time Setup)
Creates a new DataFeed object on Sui testnet. Run this once, then add the returned feed ID to your .env as DATA_FEED_ID.
```bash
npx tsx {baseDir}/src/cli.ts register-feed
```

### Register Premium Feed (with Seal Encryption)
Creates a premium DataFeed. When combined with SEAL_ENCRYPT=true, sensor data is encrypted with Seal IBE before upload to Walrus. Only subscribers can decrypt.
```bash
npx tsx {baseDir}/src/cli.ts register-feed --premium
```
Then set `SEAL_ENCRYPT=true` and `DATA_FEED_ID=<returned_id>` in your `.env`.

## Setup

1. Copy `.env.example` to `.env` in the `suisense/` directory
2. Set your `SUI_PRIVATE_KEY` (Bech32 suiprivkey1... or hex)
3. Set `SUI_PACKAGE_ID` to `0xea35b8166a92fafa4ffabe287f432487c55be85c125427f9a36d593982508ac9`
4. Run `register-feed` (or `register-feed --premium` for encrypted feeds) to create a feed, then set `DATA_FEED_ID`
5. (Optional) For premium encrypted feeds, set `SEAL_ENCRYPT=true` in `.env`
5. Install dependencies: `cd {baseDir} && npm install`
6. Start the server: `cd {baseDir} && npx tsx src/sensor-server.ts`
7. Flash the ESP32 with the Arduino sketch in `suisense/esp32/suisense_dht11.ino`

## Server Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sensor/update` | ESP32 sends data here |
| GET | `/api/sensor/latest` | Latest reading |
| GET | `/api/sensor/readings` | Last 50 readings |
| GET | `/api/sensor/stats` | Feed stats + uptime |
| GET | `/api/sensor/health` | Health check |

## ESP32 Payload Format
```json
{
  "deviceId": "esp32-dht11-001",
  "data": {
    "temperature": 25.5,
    "humidity": 60.2,
    "heatIndex": 26.1,
    "timestamp": 1234567890
  }
}
```

## Data Flow
1. ESP32 + DHT11 reads temperature/humidity
2. ESP32 POSTs to sensor server `/api/sensor/update`
3. If SEAL_ENCRYPT=true: Server encrypts data with Seal IBE using feed ID as identity
4. Server uploads data (encrypted or plaintext) to Walrus → gets blob ID
5. Server calls `update_feed_data` on Sui with new blob ID
6. Data is stored in-memory for quick queries
7. Buyers can discover and subscribe to the feed on-chain
8. Premium feed buyers must provide subscription ID to decrypt data

## Troubleshooting

- **Server won't start**: Check that SUI_PRIVATE_KEY and SUI_PACKAGE_ID are set in `.env`
- **Walrus upload fails**: Verify WALRUS_PUBLISHER_URL is reachable
- **On-chain update fails**: Ensure DATA_FEED_ID exists and your wallet has SUI for gas
- **No readings**: Check ESP32 is powered and sending to the correct IP/port
- **Seal encryption fails**: Ensure SUI_PACKAGE_ID is set and Seal key servers are reachable on testnet
- **Premium feed data unreadable**: The data is Seal-encrypted. Buyer must have a valid subscription to decrypt
