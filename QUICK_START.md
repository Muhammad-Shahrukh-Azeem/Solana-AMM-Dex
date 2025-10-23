# ⚡ Quick Start - Devnet Deployment

## 🎯 Current Status

✅ **Program Deployed**
```
Program ID: F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc
Network:    Devnet
Balance:    0.95 SOL (need 3+ SOL)
```

---

## 🚀 Next 4 Commands

### 1️⃣ Get SOL (Manual)
Go to: **https://faucet.solana.com/**
Request **3 SOL** to: `JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa`

### 2️⃣ Create KEDOLOG
```bash
./scripts/create-kedolog.sh
```
**Save the mint address!**

### 3️⃣ Create Test Tokens
```bash
./scripts/create-test-tokens.sh
```
**Save all mint addresses!**

### 4️⃣ Initialize AMM
```bash
npx ts-node scripts/init-devnet-config.ts
```
**Save the config address!**

---

## 📋 Save These Addresses

Create `devnet-addresses.json`:
```json
{
  "programId": "F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc",
  "ammConfig": "<from step 4>",
  "kedologMint": "<from step 2>",
  "testTokens": {
    "usdc": "<from step 3>",
    "sol": "<from step 3>",
    "eth": "<from step 3>",
    "btc": "<from step 3>"
  }
}
```

---

## 🌐 Website Integration (3 Steps)

### 1. Copy IDL
```bash
cp target/idl/kedolik_cp_swap.json <your-website>/src/idl/
```

### 2. Install Dependencies
```bash
cd <your-website>
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

### 3. Configure Program
```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from './idl/kedolik_cp_swap.json';

const PROGRAM_ID = new PublicKey('F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc');
const KEDOLOG_MINT = new PublicKey('<from step 2>');
const AMM_CONFIG = new PublicKey('<from step 4>');

const connection = new Connection('https://api.devnet.solana.com');
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(idl, PROGRAM_ID, provider);
```

---

## 🧪 Test Commands

```bash
# Check balance
solana balance --url devnet

# View program
solana program show F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc --url devnet

# View tokens
spl-token accounts --url devnet

# Watch logs
solana logs F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc --url devnet
```

---

## 📚 Full Docs

- `DEVNET_SETUP_COMPLETE.md` - Complete guide
- `DEVNET_DEPLOYMENT.md` - Detailed deployment
- `WEBSITE_INTEGRATION.md` - Website integration

---

**Ready?** Get SOL from the faucet and run step 2! 🚀

