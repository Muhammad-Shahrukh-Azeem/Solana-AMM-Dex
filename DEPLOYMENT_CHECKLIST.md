# ✅ Devnet Deployment Checklist

## Quick Start

```bash
# 1. Switch to devnet
solana config set --url devnet

# 2. Get SOL
solana airdrop 5

# 3. Deploy
./scripts/deploy-devnet.sh

# 4. Create tokens
./scripts/create-test-tokens.sh

# 5. Initialize config
ts-node scripts/init-devnet-config.ts
```

---

## Detailed Steps

### ☐ 1. Prepare Environment

- [ ] Solana CLI installed
- [ ] Anchor CLI installed
- [ ] Wallet has devnet SOL (at least 5 SOL)
- [ ] All tests passing locally (`anchor test`)

### ☐ 2. Deploy Program

- [ ] Run `./scripts/deploy-devnet.sh`
- [ ] Save program ID
- [ ] Verify deployment on Solana Explorer

### ☐ 3. Create Tokens

- [ ] Run `./scripts/create-test-tokens.sh`
- [ ] Save all token mint addresses
- [ ] Create `devnet-addresses.json` with addresses

### ☐ 4. Initialize Configuration

- [ ] Run `ts-node scripts/init-devnet-config.ts`
- [ ] Save AMM Config address
- [ ] Verify config on-chain

### ☐ 5. Website Integration

- [ ] Copy IDL to website project
- [ ] Update program ID in website
- [ ] Update AMM Config address
- [ ] Update token addresses
- [ ] Test wallet connection
- [ ] Test create pool
- [ ] Test swap

### ☐ 6. Testing

- [ ] Create test pool on devnet
- [ ] Perform test swap
- [ ] Verify balances
- [ ] Check transaction on explorer
- [ ] Test with multiple users

### ☐ 7. Documentation

- [ ] Document all addresses
- [ ] Create user guide
- [ ] Add FAQ
- [ ] Prepare support materials

---

## Important Addresses

```
Program ID:     _______________________________________
AMM Config:     _______________________________________
KEDOLOG Mint:   _______________________________________

Test Tokens:
USDC:           _______________________________________
SOL:            _______________________________________
ETH:            _______________________________________
BTC:            _______________________________________
```

---

## Useful Commands

```bash
# Check devnet balance
solana balance --url devnet

# View program account
solana program show <PROGRAM_ID> --url devnet

# View token account
spl-token account-info <TOKEN_MINT> --url devnet

# Get more SOL
solana airdrop 2 --url devnet

# View transaction
solana confirm -v <TX_SIGNATURE> --url devnet
```

---

## Troubleshooting

### Program deployment fails
- Check SOL balance
- Try `anchor clean && anchor build`
- Increase compute units if needed

### Token creation fails
- Wait between airdrops
- Check network connection
- Verify wallet has SOL

### Website can't connect
- Verify program ID matches
- Check IDL is up to date
- Ensure wallet is on devnet
- Check browser console for errors

---

## Next Steps After Devnet

1. ✅ Test thoroughly on devnet
2. ✅ Gather user feedback
3. ✅ Fix any issues
4. ✅ Audit smart contracts (recommended)
5. ✅ Deploy to mainnet
6. ✅ Launch! 🚀

---

## Resources

- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)
- [Solana Devnet Faucet](https://faucet.solana.com/)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)

---

Good luck with your deployment! 🎉


