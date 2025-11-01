# 🚀 Mainnet Deployment Guide

Complete guide for deploying the Kedolik CP Swap program to Solana mainnet.

## ⚠️ Prerequisites

1. **Wallet Setup**
   - Ensure your wallet has at least **15 SOL** for deployment
   - Backup your wallet keypair: `~/.config/solana/id.json`

2. **KEDOLOG Token**
   - Have your KEDOLOG token mint address ready
   - Verify it exists on mainnet

3. **RPC Endpoint** (Optional but recommended)
   - For better reliability, use a premium RPC
   - Set via: `export RPC_URL=https://your-rpc-url.com`

## 📋 Deployment Steps

### Test on Devnet First!

Before mainnet, **always test on devnet**:

```bash
# Switch to devnet
solana config set --url devnet

# Run deployment
./scripts/mainnet/1-deploy-program.sh
npx ts-node scripts/mainnet/2-create-config.ts
npx ts-node scripts/mainnet/3-setup-kedolog.ts
```

### Deploy to Mainnet

Once tested on devnet, deploy to mainnet:

#### Option 1: Run Each Step Separately (Recommended)

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Step 1: Deploy Program (~5-10 SOL)
./scripts/mainnet/1-deploy-program.sh

# Step 2: Create AMM Config (~0.05 SOL)
./scripts/mainnet/2-create-config.sh

# Step 3: Setup KEDOLOG Discount (~0.05 SOL)
./scripts/mainnet/3-setup-kedolog.sh
```

#### Option 2: Run All Steps at Once

```bash
# Deploy everything in one command
./scripts/mainnet/deploy-all.sh
```

This will automatically:
- Check network and switch to mainnet if needed
- Verify balance
- Run all 3 deployment steps
- Save all deployment info

## 🔧 Configuration

### Pool Creation Fee
- **Mainnet**: 1 SOL (set in `2-create-config.ts`)
- This fee is paid when creating a new pool
- Fee goes to the address specified in the config

### KEDOLOG Discount
- **Discount Rate**: 25% (set in `3-setup-kedolog.ts`)
- **Token Per USD**: 10 KEDOLOG per $1 USD
- Users holding KEDOLOG get 25% off protocol fees

### Fee Structure
- **Trade Fee**: 0.25%
  - **LP Fee**: 0.20% (stays in pool)
  - **Protocol Fee**: 0.05% (claimable by admin)
- **With KEDOLOG**: Protocol fee reduced to 0.0375%

## 📝 Deployment Output

After successful deployment, you'll have:

1. **deployed-mainnet.json**
   - Contains all deployment addresses
   - Copy this to your frontend

2. **Program Addresses**
   - Program ID
   - AMM Config address
   - KEDOLOG Config address

## 🔐 Security Checklist

- [ ] Tested on devnet first
- [ ] Verified wallet has sufficient SOL
- [ ] Backed up wallet keypair
- [ ] Verified KEDOLOG token mint address
- [ ] Reviewed all configuration values
- [ ] Confirmed network is mainnet before deployment

## 🎯 After Deployment

1. **Update Frontend**
   ```bash
   # Copy deployment info
   cp deployed-mainnet.json /path/to/frontend/
   
   # Copy IDL
   cp target/idl/kedolik_cp_swap.json /path/to/frontend/
   ```

2. **Create First Pool**
   - Use your frontend to create the first pool
   - Pool creation will cost 1 SOL

3. **Test Everything**
   - Create a small test pool
   - Test swaps with and without KEDOLOG
   - Verify fee distribution

## 🆘 Troubleshooting

### "Insufficient funds"
- Ensure wallet has 15+ SOL
- Check balance: `solana balance`

### "Program already exists"
- Script will ask if you want to upgrade
- Only upgrade if you're sure!

### "KEDOLOG token not found"
- Verify the mint address is correct
- Check it exists on mainnet: `solana account <mint-address>`

### "Transaction failed"
- Check RPC endpoint is working
- Try with a premium RPC endpoint
- Increase commitment level

## 📞 Support

If you encounter issues:
1. Check the error logs
2. Verify all prerequisites
3. Test on devnet first
4. Check Solana status: https://status.solana.com

## 🔄 Upgrading

To upgrade the program later:

```bash
# Build new version
anchor build

# Upgrade (will prompt for confirmation)
./scripts/mainnet/1-deploy-program.sh
```

**Note**: Config and KEDOLOG setup only need to be done once!

## ⚠️ Important Notes

1. **Irreversible**: Mainnet deployments are permanent
2. **Costs Real Money**: All transactions cost real SOL
3. **Test First**: Always test on devnet before mainnet
4. **Backup Everything**: Save all deployment info and keypairs
5. **Double Check**: Verify all addresses and amounts before confirming

---

**Ready to deploy?** Start with devnet testing! 🚀

