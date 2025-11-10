# Fee System Quick Reference

## 🎯 One Wallet for All Fees

```
create_pool_fee_receiver = THE fee wallet
```

All fees go here:
- ✅ Pool creation fees (1 SOL)
- ✅ Protocol fees from swaps
- ✅ KEDOLOG discount fees

## 🔑 Two Independent Roles

| Role | Field | Can Do |
|------|-------|--------|
| **Admin** | `protocol_owner` | Change configs, update fee receiver |
| **Fee Receiver** | `create_pool_fee_receiver` | Collect all fees |

## 📝 Update Parameters

```typescript
// Change fee receiver (admin only)
updateAmmConfig(8, 0, [new_fee_receiver])

// Change admin (admin only)
updateAmmConfig(3, 0, [new_admin])
```

## 💻 Frontend: Get Fee Receiver

```typescript
const ammConfig = await program.account.ammConfig.fetch(ammConfigPDA);
const feeReceiver = ammConfig.createPoolFeeReceiver;
```

## 🔄 Swap with KEDOLOG

```typescript
const feeReceiverKedologAccount = await getAssociatedTokenAddress(
  KEDOLOG_MINT,
  ammConfig.createPoolFeeReceiver  // ← Use this!
);

await program.methods
  .swapBaseInputWithProtocolToken(...)
  .accounts({
    protocolTokenTreasury: feeReceiverKedologAccount,
    // ...
  })
  .remainingAccounts([
    { pubkey: KEDOLOG_VAULT_0, ... },
    { pubkey: KEDOLOG_VAULT_1, ... },
  ])
  .rpc();
```

## 💰 Collect Fees

```typescript
// Only fee receiver can do this!
await program.methods
  .collectProtocolFee(amount0, amount1)
  .accounts({
    owner: feeReceiverWallet,  // Must be fee receiver
    // ...
  })
  .rpc();
```

## 🧪 Test

```bash
npx ts-node scripts/test-fee-receiver-management.ts
```

## 📚 Full Docs

- `FEE_RECEIVER_MANAGEMENT.md` - Complete guide
- `FRONTEND_INTEGRATION_FEE_RECEIVER.md` - Frontend integration
