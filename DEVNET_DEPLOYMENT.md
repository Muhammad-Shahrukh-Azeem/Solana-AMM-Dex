# 🚀 Devnet Deployment Guide

## Overview
This guide will help you deploy the Kedolik CP-Swap program to Solana Devnet and set up test tokens for integration testing.

## Prerequisites
- Solana CLI installed
- Anchor CLI installed
- Sufficient SOL in your devnet wallet

---

## Step 1: Setup Devnet Wallet

```bash
# Check your current wallet
solana address

# Get devnet SOL (you'll need ~5-10 SOL for deployment)
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet

# Verify balance
solana balance --url devnet
```

---

## Step 2: Deploy KEDOLOG Token to Devnet

```bash
# Create KEDOLOG token mint
spl-token create-token --decimals 9 --url devnet

# Save the output address! Example:
# Creating token 4jq3DNMqGT5Ap7EsHPsBw32CvHU9mSXUi7v3SbRTmFCz

# Create token account for yourself
spl-token create-account <KEDOLOG_MINT_ADDRESS> --url devnet

# Mint initial supply (1 billion KEDOLOG)
spl-token mint <KEDOLOG_MINT_ADDRESS> 1000000000 --url devnet
```

**📝 Save this address - you'll need it for the protocol token config!**

---

## Step 3: Update Anchor.toml for Devnet

Edit `Anchor.toml`:

```toml
[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[programs.devnet]
kedolik_cp_swap = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
```

---

## Step 4: Build and Deploy CP-Swap Program

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# If you get "Insufficient funds", airdrop more SOL:
solana airdrop 2 --url devnet
```

**📝 Save the program ID from the deployment output!**

---

## Step 5: Create Test Tokens on Devnet

Create tokens that simulate real assets for testing:

```bash
# Create USDC (simulated)
spl-token create-token --decimals 6 --url devnet
# Save as: TEST_USDC_MINT

# Create SOL wrapper (simulated)
spl-token create-token --decimals 9 --url devnet
# Save as: TEST_SOL_MINT

# Create ETH (simulated)
spl-token create-token --decimals 18 --url devnet
# Save as: TEST_ETH_MINT

# Create BTC (simulated)
spl-token create-token --decimals 8 --url devnet
# Save as: TEST_BTC_MINT
```

---

## Step 6: Create Token Accounts and Mint Supply

For each token you created:

```bash
# Create account
spl-token create-account <TOKEN_MINT> --url devnet

# Mint supply for testing
spl-token mint <TEST_USDC_MINT> 1000000 --url devnet  # 1M USDC
spl-token mint <TEST_SOL_MINT> 10000 --url devnet     # 10K SOL
spl-token mint <TEST_ETH_MINT> 1000 --url devnet      # 1K ETH
spl-token mint <TEST_BTC_MINT> 100 --url devnet       # 100 BTC
```

---

## Step 7: Initialize AMM Config

Run this script to create the AMM configuration:

```typescript
// scripts/init-devnet-config.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  // Create AMM Config
  const [ammConfigAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), Buffer.from([0])],
    program.programId
  );

  try {
    await program.methods
      .createAmmConfig(
        0, // index
        new anchor.BN(100), // 1% trade fee (100/10000)
        new anchor.BN(10000), // 100% protocol fee
        new anchor.BN(0), // 0% fund fee
        new anchor.BN(0), // 0% create pool fee
        new anchor.BN(0) // 0% creator fee
      )
      .accounts({
        owner: wallet.publicKey,
        ammConfig: ammConfigAddress,
      })
      .rpc();

    console.log("✅ AMM Config Created:", ammConfigAddress.toString());
  } catch (e) {
    console.log("AMM Config might already exist:", ammConfigAddress.toString());
  }
}

main();
```

Run it:
```bash
ts-node scripts/init-devnet-config.ts
```

---

## Step 8: Create Protocol Token Config (Optional - for future discount feature)

```typescript
// scripts/init-protocol-token.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  // REPLACE WITH YOUR KEDOLOG MINT ADDRESS
  const KEDOLOG_MINT = new PublicKey("YOUR_KEDOLOG_MINT_ADDRESS");
  const TREASURY = wallet.publicKey; // or separate treasury wallet

  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );

  try {
    await program.methods
      .createProtocolTokenConfig(
        new anchor.BN(2000), // 20% discount
        TREASURY,
        new anchor.BN(10_000_000) // 10 KEDOLOG per USD
      )
      .accounts({
        admin: wallet.publicKey,
        protocolTokenMint: KEDOLOG_MINT,
        protocolTokenConfig,
      })
      .rpc();

    console.log("✅ Protocol Token Config Created:", protocolTokenConfig.toString());
  } catch (e) {
    console.log("Error:", e);
  }
}

main();
```

---

## Step 9: Deployment Addresses Reference

Create a file to save all your devnet addresses:

```json
// devnet-addresses.json
{
  "network": "devnet",
  "programId": "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  "kedologMint": "PASTE_YOUR_KEDOLOG_MINT",
  "ammConfig": "PASTE_YOUR_AMM_CONFIG",
  "protocolTokenConfig": "PASTE_YOUR_PROTOCOL_TOKEN_CONFIG",
  "testTokens": {
    "usdc": "PASTE_TEST_USDC_MINT",
    "sol": "PASTE_TEST_SOL_MINT",
    "eth": "PASTE_TEST_ETH_MINT",
    "btc": "PASTE_TEST_BTC_MINT"
  }
}
```

---

## Step 10: Website Integration

Your website will need to:

### A. Connect to Devnet
```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
```

### B. Load the Program
```typescript
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "./idl/kedolik_cp_swap";
import idl from "./idl/kedolik_cp_swap.json";

const programId = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
const program = new Program(idl, programId, provider);
```

### C. Create Pool Function
```typescript
async function createPool(
  tokenA: PublicKey,
  tokenB: PublicKey,
  amountA: number,
  amountB: number
) {
  const ammConfig = new PublicKey("YOUR_AMM_CONFIG_ADDRESS");
  
  // Derive pool address
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      ammConfig.toBuffer(),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
    ],
    program.programId
  );

  // Call initialize instruction
  await program.methods
    .initialize(
      new BN(amountA),
      new BN(amountB),
      new BN(Date.now())
    )
    .accounts({
      creator: wallet.publicKey,
      ammConfig,
      poolState: poolAddress,
      token0Mint: tokenA,
      token1Mint: tokenB,
      // ... other accounts
    })
    .rpc();

  return poolAddress;
}
```

### D. Swap Function
```typescript
async function swap(
  poolAddress: PublicKey,
  inputToken: PublicKey,
  outputToken: PublicKey,
  amountIn: number,
  minimumAmountOut: number
) {
  await program.methods
    .swapBaseInput(new BN(amountIn), new BN(minimumAmountOut))
    .accounts({
      payer: wallet.publicKey,
      poolState: poolAddress,
      inputTokenAccount: userInputTokenAccount,
      outputTokenAccount: userOutputTokenAccount,
      inputVault: poolInputVault,
      outputVault: poolOutputVault,
      // ... other accounts
    })
    .rpc();
}
```

---

## Step 11: Testing on Devnet

```bash
# Run tests against devnet
anchor test --provider.cluster devnet --skip-deploy

# Or test specific functionality
ts-node scripts/test-create-pool.ts
ts-node scripts/test-swap.ts
```

---

## 🎯 Quick Start Commands

```bash
# 1. Get devnet SOL
solana airdrop 5 --url devnet

# 2. Deploy KEDOLOG
spl-token create-token --decimals 9 --url devnet

# 3. Build and deploy program
anchor build
anchor deploy --provider.cluster devnet

# 4. Initialize configs
ts-node scripts/init-devnet-config.ts

# 5. Create test tokens
spl-token create-token --decimals 6 --url devnet  # USDC
spl-token create-token --decimals 9 --url devnet  # SOL
```

---

## 📚 Important Notes

1. **Devnet resets periodically** - Save your deployment scripts!
2. **Airdrop limits** - Max 5 SOL per request, wait between requests
3. **Program upgrades** - Use `anchor upgrade` to update deployed program
4. **IDL updates** - Copy `target/idl/kedolik_cp_swap.json` to your website
5. **Explorer** - View transactions at https://explorer.solana.com/?cluster=devnet

---

## 🔧 Troubleshooting

### "Insufficient funds"
```bash
solana airdrop 2 --url devnet
```

### "Program already deployed"
```bash
anchor upgrade target/deploy/kedolik_cp_swap.so --provider.cluster devnet --program-id <YOUR_PROGRAM_ID>
```

### "Account not found"
- Make sure you're connected to devnet
- Verify addresses in devnet-addresses.json
- Check AMM config was created

---

## Next Steps

1. ✅ Deploy everything to devnet
2. ✅ Save all addresses to `devnet-addresses.json`
3. ✅ Copy IDL to your website project
4. ✅ Implement create pool UI
5. ✅ Implement swap UI
6. ✅ Test with real users
7. ✅ When ready, deploy to mainnet!

---

Good luck with your deployment! 🚀


