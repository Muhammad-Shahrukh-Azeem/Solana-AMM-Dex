# 📜 Scripts Documentation

Complete guide to all deployment, configuration, and administration scripts.

---

## 📁 Directory Structure

```
scripts/
├── README.md                          # This file
│
├── 🚀 Deployment/
│   ├── deploy.sh                      # Universal deployment (devnet/mainnet)
│   ├── deploy-program-only.sh         # Deploy program only (devnet)
│   └── deploy-and-test-devnet.sh      # Full devnet setup with tokens
│
├── ⚙️  Configuration (config/)/
│   ├── init-config.ts                 # Initialize AMM config
│   ├── update-fees.ts                 # Update fee rates
│   ├── setup-kedol.ts               # Setup KEDOL discount
│   └── update-kedol-price.ts        # Update KEDOL price
│
├── 🔐 Administration (admin/)/
│   ├── transfer-program-authority.ts  # Transfer program upgrade authority
│   ├── transfer-config-owner.ts       # Transfer AMM config ownership
│   ├── collect-fees.ts                # Collect protocol fees
│   └── emergency-pause.ts             # Emergency controls
│
└── 🛠️  Utilities/
    ├── quick-setup-kedol.sh         # Quick KEDOL setup
    ├── create-pool.ts                 # Create liquidity pool
    └── test-swap.ts                   # Test swap functionality
```

---

## 🚀 Deployment Scripts

### **deploy.sh** - Universal Deployment

Deploy to devnet or mainnet with one command.

**Usage:**
```bash
# Deploy to devnet
./scripts/deploy.sh devnet

# Deploy to mainnet
./scripts/deploy.sh mainnet
```

**What it does:**
- ✅ Builds the program
- ✅ Deploys to specified network
- ✅ Saves deployment info
- ✅ Shows next steps

**Requirements:**
- Devnet: 2+ SOL
- Mainnet: 10+ SOL

---

### **deploy-program-only.sh** - Devnet Quick Deploy

Deploy program to devnet without creating tokens.

**Usage:**
```bash
./scripts/deploy-program-only.sh
```

**Use when:**
- You already have tokens
- Quick redeployment needed
- Testing program changes

---

## ⚙️ Configuration Scripts

### **init-config.ts** - Initialize AMM Config

Create the AMM configuration with fee settings.

**Usage:**
```bash
# Devnet
npx ts-node scripts/config/init-config.ts

# Mainnet
NETWORK=mainnet npx ts-node scripts/config/init-config.ts
```

**Default Settings:**
- Trade Fee: 0.25%
- Protocol Fee: 0.05%
- LP Fee: 0.20%
- Creator Fee: 0%
- Pool Creation Fee: 0 SOL

---

### **update-fees.ts** - Update Fee Configuration

Modify fee rates after deployment.

**Usage:**
```bash
# Update trade fee to 0.30%
NETWORK=devnet TRADE_FEE=3000 npx ts-node scripts/config/update-fees.ts

# Update protocol fee to 0.10%
NETWORK=mainnet PROTOCOL_FEE=1000 npx ts-node scripts/config/update-fees.ts

# Enable pool creation fee (0.15 SOL)
NETWORK=mainnet POOL_CREATION_FEE=150000000 npx ts-node scripts/config/update-fees.ts

# Update multiple fees at once
NETWORK=mainnet TRADE_FEE=2500 PROTOCOL_FEE=500 npx ts-node scripts/config/update-fees.ts
```

**Parameters:**
- `TRADE_FEE`: Total trade fee (basis points out of 1,000,000)
- `PROTOCOL_FEE`: Protocol fee (basis points out of 1,000,000)
- `FUND_FEE`: Fund fee (not used)
- `CREATOR_FEE`: Creator fee (not used)
- `POOL_CREATION_FEE`: Pool creation fee (lamports)

**Examples:**
```bash
# 0.25% = 2500
# 0.05% = 500
# 0.15 SOL = 150000000 lamports
```

---

## 🔐 Administration Scripts

### **transfer-program-authority.ts** - Transfer Program Authority

Transfer program upgrade authority to a new address.

**⚠️ CRITICAL:** Only the current authority can upgrade the program after this!

**Usage:**
```bash
# Devnet
NETWORK=devnet NEW_AUTHORITY=<address> npx ts-node scripts/admin/transfer-program-authority.ts

# Mainnet
NETWORK=mainnet NEW_AUTHORITY=<address> npx ts-node scripts/admin/transfer-program-authority.ts
```

**Confirmation Required:** Type `TRANSFER` to confirm

**Use cases:**
- Transfer to multisig for security
- Transfer to DAO governance
- Transfer to new team member

---

### **transfer-config-owner.ts** - Transfer Config Ownership

Transfer AMM config ownership (fee management) to a new address.

**⚠️ IMPORTANT:** Only the new owner can manage fees after this!

**Usage:**
```bash
# Devnet
NETWORK=devnet NEW_OWNER=<address> npx ts-node scripts/admin/transfer-config-owner.ts

# Mainnet
NETWORK=mainnet NEW_OWNER=<address> npx ts-node scripts/admin/transfer-config-owner.ts
```

**Confirmation Required:** Type `TRANSFER` to confirm

**New owner can:**
- Update fee rates
- Collect protocol fees
- Transfer ownership again

---

## 📊 Complete Workflows

### 🎯 **First-Time Devnet Deployment**

```bash
# 1. Deploy program
./scripts/deploy.sh devnet

# 2. Initialize config
npx ts-node scripts/config/init-config.ts

# 3. Setup KEDOL (if using)
./scripts/quick-setup-kedol.sh YOUR_KEDOLOG_MINT
npx ts-node scripts/config/setup-kedol.ts

# 4. Create pools and test
npx ts-node scripts/create-pool.ts
npx ts-node scripts/test-swap.ts
```

---

### 🚀 **Mainnet Deployment**

```bash
# 1. Test thoroughly on devnet first!

# 2. Deploy to mainnet
./scripts/deploy.sh mainnet

# 3. Initialize config
NETWORK=mainnet npx ts-node scripts/config/init-config.ts

# 4. Setup KEDOL
NETWORK=mainnet npx ts-node scripts/config/setup-kedol.ts

# 5. Enable pool creation fee (optional)
NETWORK=mainnet POOL_CREATION_FEE=150000000 npx ts-node scripts/config/update-fees.ts

# 6. Transfer to multisig (recommended)
NETWORK=mainnet NEW_AUTHORITY=<multisig> npx ts-node scripts/admin/transfer-program-authority.ts
NETWORK=mainnet NEW_OWNER=<multisig> npx ts-node scripts/admin/transfer-config-owner.ts
```

---

### 🔧 **Update Fees**

```bash
# Update trade fee to 0.30%
NETWORK=mainnet TRADE_FEE=3000 npx ts-node scripts/config/update-fees.ts

# Update protocol fee to 0.10%
NETWORK=mainnet PROTOCOL_FEE=1000 npx ts-node scripts/config/update-fees.ts

# Enable pool creation fee
NETWORK=mainnet POOL_CREATION_FEE=150000000 npx ts-node scripts/config/update-fees.ts
```

---

### 🔐 **Transfer Authority**

```bash
# Transfer program authority
NETWORK=mainnet NEW_AUTHORITY=<address> npx ts-node scripts/admin/transfer-program-authority.ts

# Transfer config ownership
NETWORK=mainnet NEW_OWNER=<address> npx ts-node scripts/admin/transfer-config-owner.ts
```

---

## 🌐 Network Configuration

### **Environment Variables**

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `NETWORK` | `devnet`, `mainnet` | `devnet` | Target network |
| `ANCHOR_WALLET` | Path to keypair | `~/.config/solana/id.json` | Wallet to use |
| `ANCHOR_PROVIDER_URL` | RPC URL | Auto-detected | Custom RPC endpoint |

### **Network Settings**

**Devnet:**
- RPC: `https://api.devnet.solana.com`
- Cluster: `devnet`
- Min Balance: 2 SOL
- Airdrop: Available

**Mainnet:**
- RPC: `https://api.mainnet-beta.solana.com`
- Cluster: `mainnet-beta`
- Min Balance: 10 SOL
- Airdrop: Not available

---

## 🔒 Security Best Practices

### **For Mainnet:**

1. **Use Multisig**
   - Transfer program authority to multisig
   - Transfer config ownership to multisig
   - Require multiple signatures for changes

2. **Test Everything on Devnet First**
   - Full deployment workflow
   - Fee updates
   - Authority transfers
   - Emergency procedures

3. **Keep Private Keys Secure**
   - Use hardware wallets
   - Never commit private keys
   - Use environment variables

4. **Monitor Deployments**
   - Save all deployment records
   - Keep transaction logs
   - Document all changes

5. **Have Emergency Plan**
   - Know how to pause if needed
   - Have backup authorities
   - Document recovery procedures

---

## 📋 Script Reference

### **Deployment**

| Script | Network | Purpose |
|--------|---------|---------|
| `deploy.sh` | Both | Universal deployment |
| `deploy-program-only.sh` | Devnet | Quick program deploy |
| `deploy-and-test-devnet.sh` | Devnet | Full setup with tokens |

### **Configuration**

| Script | Purpose | Owner Required |
|--------|---------|----------------|
| `init-config.ts` | Initialize AMM config | No (first time) |
| `update-fees.ts` | Update fee rates | Yes |
| `setup-kedol.ts` | Setup KEDOL discount | Yes |
| `update-kedol-price.ts` | Update KEDOL price | Yes |

### **Administration**

| Script | Purpose | Authority Required |
|--------|---------|-------------------|
| `transfer-program-authority.ts` | Transfer program control | Program authority |
| `transfer-config-owner.ts` | Transfer config control | Config owner |
| `collect-fees.ts` | Collect protocol fees | Config owner |

---

## 🆘 Troubleshooting

### **"Insufficient funds"**
```bash
# Devnet
solana airdrop 2 --url devnet

# Mainnet
# You need to add SOL to your wallet
```

### **"ANCHOR_WALLET not set"**
```bash
export ANCHOR_WALLET=~/.config/solana/id.json
```

### **"Not the owner"**
- Check you're using the correct wallet
- Verify ownership: `solana address`
- Check config owner in program

### **"Config already exists"**
- Use update scripts instead of init
- Or use different config index

---

## 📚 Additional Resources

- **Main Documentation**: `docs/README.md`
- **Deployment Guide**: `docs/DEPLOYMENT_AND_TESTING_GUIDE.md`
- **Fee Configuration**: `docs/FINAL_FEE_STRUCTURE.md`
- **Security**: `docs/SECURITY.md`

---

## ✅ Quick Command Reference

```bash
# Deploy to devnet
./scripts/deploy.sh devnet

# Deploy to mainnet
./scripts/deploy.sh mainnet

# Initialize config
NETWORK=mainnet npx ts-node scripts/config/init-config.ts

# Update fees
NETWORK=mainnet TRADE_FEE=2500 npx ts-node scripts/config/update-fees.ts

# Transfer authority
NETWORK=mainnet NEW_AUTHORITY=<addr> npx ts-node scripts/admin/transfer-program-authority.ts

# Transfer ownership
NETWORK=mainnet NEW_OWNER=<addr> npx ts-node scripts/admin/transfer-config-owner.ts
```

---

**All scripts are production-ready and support both devnet and mainnet!** 🚀

