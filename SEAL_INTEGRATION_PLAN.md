# Seal Encryption Integration Plan - Detailed

## 📋 Current State Analysis

### ✅ What's Working
- Premium feeds marked with `isPremium: true` flag
- Basic AES encryption exists (simplified crypto-js implementation)
- Data stored on Walrus storage
- Subscription system fully functional
- Access control via API keys and subscriptions

### ❌ What Needs Seal Integration
- **No real Seal encryption** - Currently using simplified AES (crypto-js)
- **No Seal access policy** - Missing `seal_approve` function in Move contracts
- **No key distribution** - Decryption keys not properly shared with subscribers
- **No Seal SDK** - `@mysten/seal` package not installed
- **No SessionKey** - Users can't decrypt premium feeds automatically

## 🎯 Integration Architecture

### Overview
```
Provider Flow:
  Upload Data → Seal Encrypt → Store on Walrus → Register Feed on-chain

Consumer Flow:
  Subscribe → Get Subscription → Request Data → Seal Decrypt (if premium)
```

## 📝 Implementation Plan

### Phase 1: Smart Contract - Seal Access Policy Module

**File**: `iot_marketplace/sources/seal_access.move` (NEW)

**Purpose**: Define on-chain access control policy for Seal encryption

**Key Features**:
- `seal_approve` function that checks subscription validity
- Verifies subscription is for the correct feed
- Checks subscription expiry and active status
- Ensures feed is premium and active

**Identity Format**: `[package_id][feed_id]` - Each premium feed gets its own Seal identity

### Phase 2: Backend - Seal SDK Integration

**New Files**:
- `backend/src/services/seal.service.ts` - Seal encryption/decryption service

**Updated Files**:
- `backend/src/services/walrus.service.ts` - Replace AES with Seal
- `backend/src/routes/data.ts` - Return encrypted bytes for premium feeds
- `backend/src/routes/feeds.ts` - Use Seal for premium feed uploads

**Key Changes**:
- Install `@mysten/seal` package
- Initialize SealClient with key servers
- Encrypt premium feed data using Seal
- Store encrypted bytes (not JSON) on Walrus
- Return encrypted bytes to frontend (frontend handles decryption)

### Phase 3: Frontend - Seal Decryption

**New Files**:
- `frontend/src/hooks/useSeal.ts` - Seal client hook

**Updated Files**:
- `frontend/src/pages/consumer.tsx` - Decrypt premium feeds
- `frontend/src/pages/subscriber.tsx` - Show decrypted premium data
- `frontend/src/lib/api.ts` - Handle encrypted data responses

**Key Changes**:
- Install `@mysten/seal` package
- Create SessionKey for users
- Build transaction calling `seal_approve`
- Decrypt premium feed data client-side
- Show decrypted data in UI

### Phase 4: Data Flow Updates

**Provider Upload**:
1. Provider uploads data via frontend
2. Backend encrypts with Seal (if premium)
3. Stores encrypted bytes on Walrus
4. Returns `walrusBlobId`
5. Frontend registers feed on-chain

**Consumer Access**:
1. Consumer subscribes → Gets subscription object
2. Consumer requests data → Backend returns encrypted bytes
3. Frontend builds `seal_approve` transaction
4. Seal checks subscription on-chain
5. Seal key servers provide decryption keys
6. Frontend decrypts and displays data

## 🔧 Technical Details

### Seal Identity Format
- **Format**: `[package_id][feed_id]`
- **Example**: For feed `0x09dbf585fb7e20423ccd11cd7faa10e08b5f6c29fec85b7a37648af8589d5f99`
- **Identity**: `[0x97a2820851fa97f57000b7320502f07020ee6f6e752dc510445fcf86a3da52fb][0x09dbf585fb7e20423ccd11cd7faa10e08b5f6c29fec85b7a37648af8589d5f99]`
- Seal automatically prefixes with package ID, so we only pass `feed_id`

### Key Servers
- Use verified Seal key servers for Testnet
- Threshold: 2 (requires 2 key servers to decrypt)
- Weight: 1 per server (equal weight)

### SessionKey Management
- TTL: 60 minutes (configurable)
- Stored in localStorage/IndexedDB
- User signs once per session
- Reusable for multiple decryptions

## 📦 Dependencies to Add

### Backend (`backend/package.json`)
```json
{
  "dependencies": {
    "@mysten/seal": "^latest"
  }
}
```

### Frontend (`frontend/package.json`)
```json
{
  "dependencies": {
    "@mysten/seal": "^latest"
  }
}
```

## 🚀 Step-by-Step Implementation

### Step 1: Install Dependencies
```bash
# Backend
cd backend && npm install @mysten/seal

# Frontend
cd frontend && npm install @mysten/seal
```

### Step 2: Create Seal Access Policy (Move Contract)
- Create `iot_marketplace/sources/seal_access.move`
- Implement `seal_approve` function
- Build and publish updated contracts

### Step 3: Backend Seal Service
- Create `backend/src/services/seal.service.ts`
- Initialize SealClient
- Implement encryption method
- Update `walrus.service.ts` to use Seal

### Step 4: Update Data Routes
- Modify `backend/src/routes/data.ts` to return encrypted bytes
- Update `backend/src/routes/feeds.ts` to use Seal encryption

### Step 5: Frontend Seal Hook
- Create `frontend/src/hooks/useSeal.ts`
- Implement SessionKey creation
- Implement decryption method

### Step 6: Update Frontend Pages
- Update `consumer.tsx` to decrypt premium feeds
- Update `subscriber.tsx` to show decrypted data
- Add UI for decryption status

### Step 7: Testing
- Test encryption/decryption flow
- Test subscription-based access
- Test expired subscriptions
- Test free vs premium feeds

## ✅ Benefits

1. **Proper Encryption**: Real Seal IBE encryption (not simplified AES)
2. **On-chain Access Control**: Policy enforced by Move contracts
3. **Automatic Key Distribution**: Seal key servers handle keys
4. **No Key Management**: No need to manually distribute keys
5. **Subscription-Based**: Only active subscribers can decrypt
6. **Decentralized**: Multiple key servers, threshold encryption
7. **Privacy**: Key servers can't see data, only verify access

## 🔍 Key Differences from Current Implementation

| Current (Simplified) | With Seal |
|---------------------|-----------|
| AES encryption (crypto-js) | Seal IBE encryption |
| Manual key distribution | Automatic via key servers |
| Backend decrypts | Frontend decrypts |
| No on-chain policy | On-chain `seal_approve` policy |
| Single encryption key | Threshold encryption (multiple servers) |

## 📋 Files to Create/Modify

### New Files:
1. `iot_marketplace/sources/seal_access.move`
2. `backend/src/services/seal.service.ts`
3. `frontend/src/hooks/useSeal.ts`

### Modified Files:
1. `backend/package.json` - Add @mysten/seal
2. `frontend/package.json` - Add @mysten/seal
3. `backend/src/services/walrus.service.ts` - Use Seal
4. `backend/src/routes/data.ts` - Return encrypted bytes
5. `backend/src/routes/feeds.ts` - Use Seal encryption
6. `frontend/src/pages/consumer.tsx` - Add decryption
7. `frontend/src/pages/subscriber.tsx` - Show decrypted data

## 🎯 Next Steps

1. **Review this plan** - Confirm approach
2. **Install dependencies** - Add @mysten/seal to both projects
3. **Create Move module** - Implement seal_access.move
4. **Backend integration** - Create Seal service
5. **Frontend integration** - Add decryption hook
6. **Test end-to-end** - Verify full flow

Ready to start implementation?
