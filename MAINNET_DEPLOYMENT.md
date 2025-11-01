# 🚀 Mainnet Deployment Quick Reference

## 🧪 Step 1: Test on Devnet

```bash
# Automated test (recommended)
./scripts/mainnet/0-test-devnet.sh
```

## 🚀 Step 2: Deploy to Mainnet

### Option 1: Run Each Step Separately (Recommended)

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Check balance (need 15+ SOL)
solana balance

# Set KEDOLOG mint (optional, will prompt if not set)
export KEDOLOG_MINT=<your-kedolog-mint-address>

# Deploy step by step
./scripts/mainnet/1-deploy-program.sh
./scripts/mainnet/2-create-config.sh
./scripts/mainnet/3-setup-kedolog.sh
```

### Option 2: Run All Steps at Once

```bash
# Deploy everything in one command
./scripts/mainnet/deploy-all.sh
```

## 📋 Step 3: After Deployment

```bash
# Copy files to frontend
cp deployed-mainnet.json /path/to/frontend/
cp target/idl/kedolik_cp_swap.json /path/to/frontend/
```

## ⚙️ Configuration

- **Pool Creation Fee**: 1 SOL
- **Trade Fee**: 0.25%
  - LP Fee: 0.20%
  - Protocol Fee: 0.05%
- **KEDOLOG Discount**: 25%
  - Reduced Protocol Fee: 0.0375%

## 🔐 Safety Checklist

- [ ] Tested on devnet
- [ ] Wallet has 15+ SOL
- [ ] Backed up wallet keypair
- [ ] KEDOLOG mint address ready
- [ ] Read all prompts carefully

## 📖 Full Documentation

See `scripts/mainnet/README.md` for detailed instructions.

## ⚠️ Important

- Mainnet deployments are **permanent**
- All transactions cost **real SOL**
- **Always test on devnet first**
- Take your time, no rush!

