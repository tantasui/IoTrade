---
name: suisense-buyer
description: Discover and purchase IoT sensor data feeds on Sui blockchain.
metadata: {"openclaw":{"emoji":"🛒","requires":{"bins":["node","npx"],"env":["BUYER_PRIVATE_KEY","SUI_PACKAGE_ID"]}}}
---

# SuiSense Buyer — IoT Data Marketplace Client

You can discover, subscribe to, and read IoT sensor data feeds from the Sui blockchain marketplace.

## What You Can Do

- **Discover available feeds** on the Sui testnet marketplace
- **Subscribe to data feeds** with SUI payments
- **Read live sensor data** from Walrus storage via on-chain blob IDs
- **Check buyer wallet balance**

## Commands

### Discover Available Feeds
Lists all registered data feeds on the Sui marketplace.
```bash
npx tsx {baseDir}/src/data-buyer.ts discover
```

### Subscribe to a Feed
Subscribe to a specific feed by paying with SUI.
```bash
npx tsx {baseDir}/src/data-buyer.ts subscribe <feedId> <tier> <amountInMIST>
```
- `tier`: 0 = per-query, 1 = monthly
- `amount`: payment in MIST (1 SUI = 1,000,000,000 MIST)

Example:
```bash
npx tsx {baseDir}/src/data-buyer.ts subscribe 0xabc123... 1 50000000
```

### Read Feed Data
Fetches the latest data from a feed's Walrus blob.
```bash
npx tsx {baseDir}/src/data-buyer.ts read <feedId>
```

### Check Balance
```bash
npx tsx {baseDir}/src/data-buyer.ts balance
```

## Setup

1. Ensure `.env` exists in the `suisense/` directory with `BUYER_PRIVATE_KEY` set
2. The buyer wallet must be a **different** key from the seller
3. Fund the buyer wallet with testnet SUI: `sui client faucet`
4. Install dependencies: `cd {baseDir} && npm install`

## Example Workflow

1. Run `discover` to find available feeds
2. Pick a feed ID and `subscribe` with the appropriate tier/amount
3. Use `read` to fetch the latest sensor data from Walrus
