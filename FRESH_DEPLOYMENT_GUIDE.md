# 🚀 Fresh Deployment Guide

This guide explains how to deploy a **completely new program** with fresh configs.

## 📋 What Gets Created

Every deployment creates:
- ✅ **New Program ID** (completely fresh keypair)
- ✅ **New AMM Config** (index 0, 1 SOL pool creation fee)
- ✅ **New KEDOLOG Config** (25% discount, price pool not set yet)

## 🔧 One-Command Deployment

```bash
./scripts/deploy-new-program-fresh.sh
```

This script will:
1. Generate a new program keypair
2. Update program ID in `lib.rs` and `Anchor.toml`
3. Build the program
4. Deploy to current network (devnet/mainnet)
5. Create AMM config with 1 SOL pool fee
6. Create KEDOLOG config with 25% discount
7. Save deployment info to timestamped JSON file

## 📝 Step-by-Step Process

### Step 1: Deploy Everything Fresh

```bash
./scripts/deploy-new-program-fresh.sh
```

**Output:**
```
📋 New Program ID: <NEW_ID>
📋 AMM Config: <CONFIG_ADDRESS>
📋 KEDOLOG Config: <KEDOLOG_CONFIG_ADDRESS>
```

**Save these addresses!**

### Step 2: Create KEDOLOG/USDC Pool

From your frontend, create a pool using the **new AMM config address**.

**Get Pool Address from Transaction:**

```typescript
// Method 1: From transaction
const tx = await program.methods
  .initialize(initAmount0, initAmount1, openTime)
  .accounts({
    ammConfig: "<YOUR_NEW_AMM_CONFIG>",
    // ... other accounts
  })
  .rpc();

console.log("Transaction:", tx);
// Check explorer for pool address

// Method 2: Derive pool address
const [poolAddress] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("pool"),
    ammConfig.toBuffer(),
    token0Mint.toBuffer(), // KEDOLOG mint
    token1Mint.toBuffer(), // USDC mint
  ],
  programId
);

console.log("Pool address:", poolAddress.toString());
```

### Step 3: Set Price Pool

After creating the pool, set it as the price source:

```bash
npx ts-node scripts/set-kedolog-price-pool.ts
```

**Enter your pool address** when prompted.

This will:
- ✅ Verify the pool contains KEDOLOG
- ✅ Update KEDOLOG config with pool address
- ✅ Display vault addresses for frontend

### Step 4: Update Frontend

Add pool vaults as remaining accounts when users swap with KEDOLOG:

```typescript
const kedologConfig = await program.account.protocolTokenConfig.fetch(
  protocolTokenConfigAddress
);

const poolAddress = kedologConfig.pricePool;

// Fetch pool to get vault addresses
const pool = await program.account.poolState.fetch(poolAddress);

// When swapping with KEDOLOG discount:
await program.methods
  .swapBaseInputWithProtocolToken(...)
  .accounts({
    // ... regular accounts
  })
  .remainingAccounts([
    { 
      pubkey: pool.token0Vault, // KEDOLOG vault
      isSigner: false, 
      isWritable: false 
    },
    { 
      pubkey: pool.token1Vault, // USDC vault
      isSigner: false, 
      isWritable: false 
    },
  ])
  .rpc();
```

## 🎯 How Pool-Based Pricing Works

1. **User initiates swap** with KEDOLOG discount
2. **Frontend passes** pool vault accounts as `remainingAccounts`
3. **Contract reads** KEDOLOG and USDC reserves from vaults
4. **Contract calculates** real-time price:
   ```
   KEDOLOG_price_USD = USDC_reserve / KEDOLOG_reserve
   ```
5. **Contract determines** fee amount in KEDOLOG based on current price
6. **User pays** protocol fee in KEDOLOG at market rate

## 📊 Fee Structure

### Without KEDOLOG Discount:
- **Trade Fee**: 0.25%
  - LP Fee: 0.20%
  - Protocol Fee: 0.05%

### With KEDOLOG Discount (25% off):
- **Trade Fee**: 0.25%
  - LP Fee: 0.20%
  - Protocol Fee: 0.0375% (25% discount applied)
  - User pays in KEDOLOG tokens

## 🔍 Verify Deployment

Check your deployment file:
```bash
cat deployed-<network>-<timestamp>.json
```

Verify on Solana Explorer:
- Program: `https://explorer.solana.com/address/<PROGRAM_ID>?cluster=<network>`
- AMM Config: `https://explorer.solana.com/address/<AMM_CONFIG>?cluster=<network>`
- KEDOLOG Config: `https://explorer.solana.com/address/<KEDOLOG_CONFIG>?cluster=<network>`

## 🛠️ Configuration

To change deployment parameters, edit `scripts/deploy-configs-only.ts`:

```typescript
const CONFIG_INDEX = 0;              // AMM config index
const KEDOLOG_MINT = new PublicKey('...'); // Your KEDOLOG token
const TREASURY = new PublicKey('...'); // Treasury address

const TRADE_FEE_RATE = 2500;        // 0.25%
const PROTOCOL_FEE_RATE = 500;      // 0.05%
const CREATE_POOL_FEE = 1000000000; // 1 SOL
const KEDOLOG_DISCOUNT_RATE = 2500; // 25%
```

## 🚨 Important Notes

1. **Backup**: Old program keypairs are automatically backed up to `target/deploy/kedolik_cp_swap-keypair-backup-<timestamp>.json`

2. **Network**: The script uses your current Solana CLI network configuration. Switch networks with:
   ```bash
   solana config set --url devnet
   solana config set --url mainnet-beta
   ```

3. **Balance**: Ensure you have enough SOL:
   - Devnet: 5+ SOL
   - Mainnet: 15+ SOL (for program deployment + buffer)

4. **Price Pool**: Must be set AFTER pool creation. The contract won't apply discounts until a valid pool is configured.

## 📁 Generated Files

Each deployment creates:
- `deployed-<network>-<timestamp>.json` - Deployment info
- `target/deploy/kedolik_cp_swap-keypair-backup-<timestamp>.json` - Old keypair backup

## 🐛 Troubleshooting

### "Insufficient balance"
- Check balance: `solana balance`
- Airdrop on devnet: `solana airdrop 5`

### "Program already deployed"
- This is normal if you're redeploying
- The script will upgrade the existing program

### "Account already exists"
- This means configs already exist for this program
- Deploy a fresh program to get new configs

### "Price pool not set"
- This is expected before Step 3
- Create your pool first, then run `set-kedolog-price-pool.ts`

## 🎉 Success Checklist

- ✅ New program deployed
- ✅ AMM config created (1 SOL pool fee)
- ✅ KEDOLOG config created (25% discount)
- ✅ KEDOLOG/USDC pool created
- ✅ Price pool set in config
- ✅ Frontend updated with vault accounts
- ✅ Users can swap with KEDOLOG discount

## 📞 Support

For issues or questions, check:
- `DEPLOYMENT_WORKFLOW.md` - Detailed workflow
- `POOL_PRICING_IMPLEMENTATION.md` - Technical details
- Solana Explorer for transaction logs

