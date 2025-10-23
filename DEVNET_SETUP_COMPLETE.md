# 🚀 Devnet Deployment Complete!

## ✅ What's Been Deployed

### **Program Deployed**
```
Program ID: F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc
Network:    Devnet
Authority:  JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa
```

**View on Explorer:**
https://explorer.solana.com/address/F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc?cluster=devnet

---

## 📝 Next Steps

### **Step 1: Get More SOL** ⏳
You currently have **0.95 SOL**. You need **3+ SOL** for token creation.

**Get SOL from:**
- https://faucet.solana.com/ (Recommended)
- https://solfaucet.com/ (Alternative)

**Your wallet:** `JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa`

---

### **Step 2: Create KEDOLOG Token** 🪙

Once you have 3+ SOL, run:

```bash
./scripts/create-kedolog.sh
```

This will:
- Create KEDOLOG token with 9 decimals
- Mint 1 Billion KEDOLOG
- Give you the mint address

**Save the KEDOLOG mint address!** You'll need it for:
- Hardcoding in your program (if needed)
- Website integration
- Pool creation

---

### **Step 3: Create Test Tokens** 🎯

```bash
./scripts/create-test-tokens.sh
```

This creates:
- **USDC** (6 decimals) - 1M tokens
- **SOL** (9 decimals) - 10K tokens
- **ETH** (18 decimals) - 1K tokens
- **BTC** (8 decimals) - 100 tokens
- **KEDOLOG** (9 decimals) - 1B tokens

**Save all mint addresses!**

---

### **Step 4: Initialize AMM Configuration** ⚙️

```bash
npx ts-node scripts/init-devnet-config.ts
```

This will:
- Create AMM Config with 1% trade fee
- Set 100% protocol fee
- Give you the config address

**Save the AMM Config address!**

---

### **Step 5: Save All Addresses** 💾

Create `devnet-addresses.json`:

```json
{
  "network": "devnet",
  "programId": "F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc",
  "authority": "JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa",
  "ammConfig": "<FROM_STEP_4>",
  "kedologMint": "<FROM_STEP_2>",
  "testTokens": {
    "usdc": "<FROM_STEP_3>",
    "sol": "<FROM_STEP_3>",
    "eth": "<FROM_STEP_3>",
    "btc": "<FROM_STEP_3>"
  }
}
```

---

## 🌐 Website Integration

### **1. Install Dependencies**

```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

### **2. Copy IDL**

```bash
cp target/idl/kedolik_cp_swap.json <your-website>/src/idl/
```

### **3. Configure Program**

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from './idl/kedolik_cp_swap.json';

const PROGRAM_ID = new PublicKey('F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Initialize program
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(idl, PROGRAM_ID, provider);
```

### **4. Create Pool Function**

```typescript
async function createPool(
  token0Mint: PublicKey,
  token1Mint: PublicKey,
  initialPrice: number
) {
  const ammConfigAddress = new PublicKey('<YOUR_AMM_CONFIG>');
  
  // Derive pool address
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      ammConfigAddress.toBuffer(),
      token0Mint.toBuffer(),
      token1Mint.toBuffer()
    ],
    program.programId
  );
  
  // Create pool transaction
  const tx = await program.methods
    .initialize(new BN(initialPrice))
    .accounts({
      creator: wallet.publicKey,
      ammConfig: ammConfigAddress,
      poolState: poolAddress,
      token0Mint,
      token1Mint,
      // ... other accounts
    })
    .rpc();
    
  return { poolAddress, signature: tx };
}
```

---

## 🔧 Hardcoding KEDOLOG Address

### **Option 1: In Program Code** (Requires Redeployment)

Edit `programs/cp-swap/src/lib.rs`:

```rust
use anchor_lang::prelude::*;

// Add at top of file
pub const KEDOLOG_MINT: Pubkey = pubkey!("YOUR_KEDOLOG_MINT_HERE");

// Use in validation
pub fn validate_protocol_token(token_mint: &Pubkey) -> bool {
    token_mint == &KEDOLOG_MINT
}
```

Then redeploy:
```bash
anchor build
anchor deploy --provider.cluster devnet
```

### **Option 2: In Website** (No Redeployment)

```typescript
// config.ts
export const KEDOLOG_MINT = new PublicKey('YOUR_KEDOLOG_MINT_HERE');

// Use in swap
import { KEDOLOG_MINT } from './config';

async function swapWithProtocolToken() {
  // ... swap logic using KEDOLOG_MINT
}
```

**Recommendation:** Use Option 2 for now (website-side). This is more flexible and doesn't require redeployment.

---

## 🧪 Testing on Devnet

### **Test Swap**

```typescript
import { BN } from '@coral-xyz/anchor';

async function testSwap() {
  const amountIn = new BN(1_000_000); // 1 token (6 decimals)
  const minimumAmountOut = new BN(900_000); // 0.9 token minimum
  
  const tx = await program.methods
    .swapBaseInput(amountIn, minimumAmountOut)
    .accounts({
      payer: wallet.publicKey,
      poolState: poolAddress,
      // ... other accounts
    })
    .rpc();
    
  console.log('Swap successful:', tx);
}
```

---

## 📊 Monitoring

### **View Program Logs**

```bash
solana logs F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc --url devnet
```

### **Check Token Balances**

```bash
spl-token accounts --url devnet
```

### **View Pool State**

```typescript
const poolState = await program.account.poolState.fetch(poolAddress);
console.log('Pool State:', {
  token0Reserve: poolState.token0Vault.toString(),
  token1Reserve: poolState.token1Vault.toString(),
  lpSupply: poolState.lpSupply.toString()
});
```

---

## 🚨 Important Notes

1. **Devnet Resets:** Devnet can reset occasionally. Keep your scripts handy to redeploy.

2. **Rate Limits:** The public devnet RPC has rate limits. For production testing, consider:
   - Helius (https://helius.dev/)
   - QuickNode (https://quicknode.com/)
   - Alchemy (https://alchemy.com/)

3. **SOL Management:** Keep at least 1 SOL in your wallet for transactions.

4. **Token Accounts:** Users need token accounts for each token they trade. Your website should handle this automatically.

---

## 📚 Additional Resources

- **Anchor Docs:** https://www.anchor-lang.com/
- **Solana Cookbook:** https://solanacookbook.com/
- **SPL Token:** https://spl.solana.com/token

---

## ✅ Checklist

- [x] Program deployed to devnet
- [ ] Get 3+ SOL from faucet
- [ ] Create KEDOLOG token
- [ ] Create test tokens
- [ ] Initialize AMM config
- [ ] Save all addresses to JSON
- [ ] Copy IDL to website
- [ ] Configure website with program ID
- [ ] Test pool creation
- [ ] Test swaps
- [ ] Deploy website

---

**Need Help?** Check `DEVNET_DEPLOYMENT.md` for detailed instructions!

