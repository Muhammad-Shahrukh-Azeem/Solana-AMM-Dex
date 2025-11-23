# 🛡️ LP Token Verification Guide

## Preventing Spam Classification in Wallets

LP tokens are often flagged as "spam" by wallet applications because they appear as newly created tokens without proper metadata. This guide explains how to ensure your LP tokens are properly verified and recognized by wallets.

## ✅ Verification Requirements

### 1. **Complete Metadata**
Your LP tokens must have complete Metaplex Token Metadata:

```json
{
  "name": "KEDOLOG-USDC LP",
  "symbol": "KEDO-USDC",
  "description": "Liquidity Provider token for KEDOLOG-USDC pool on Kedolik AMM...",
  "image": "https://your-domain.com/images/kedo-usdc-lp.png",
  "external_url": "https://your-domain.com"
}
```

### 2. **Creator Verification**
Set the pool creator as verified in metadata:
- ✅ Creator address should match the pool creator
- ✅ Creator should be marked as `verified: true`

### 3. **Official Branding**
- Use consistent naming: `Kedolik LP` for all pools
- Include official website links
- Use professional token images

### 4. **Standardized Symbols**
- Use unified symbol: `KLP` for all Kedolik LP tokens
- Consistent branding across all pools

## 🚀 Implementation Steps

### Step 1: Set Metadata on New Pools
Modify pool creation to automatically set metadata:

```rust
// In initialize.rs, after minting LP tokens
if set_metadata {
    set_lp_token_metadata(ctx, name, symbol, uri)?;
}
```

### Step 2: Retroactively Set Metadata on Existing Pools
Use the provided script:

```bash
# All pools use the same generic metadata (auto-detected)
npx ts-node scripts/set-pool-metadata.ts 8KYfYHmPyzpzqYQzVzHR3uv94E1UX8TsaEFLqBWzenRJ
npx ts-node scripts/set-pool-metadata.ts 3ZXK4N8Hf1uZjYqndX3bRPXf71wS6gj3DSiSjPTveE1L
npx ts-node scripts/set-pool-metadata.ts 9zbYdushUHfJ67SJCDAYCMtaHdg5UMnJwmGWWGuXgh3

# Or use batch script for all pools at once
npx ts-node scripts/batch-set-metadata.ts
```

### Step 3: Host Metadata Files
Create and host a single metadata JSON file on your domain (all LP tokens share the same metadata):

```
https://kedolik.io/metadata/
├── klp.json          # Copy from scripts/klp-metadata.json
└── images/
    └── tokens/
        └── klp.png   # Single LP token logo for all pools
```

**Note**: LP tokens don't need a "creators" field since they represent protocol ownership rather than individual creation.

### Step 4: Update Metadata (Future)
If you need to update metadata later:

```rust
use anchor_spl::metadata::{update_metadata_accounts_v2, UpdateMetadataAccountsV2, DataV2};

update_metadata_accounts_v2(
    ctx,
    DataV2 {
        name: "Updated Name".to_string(),
        symbol: "UPDATED".to_string(),
        uri: "https://kedolik.io/metadata/updated-lp.json".to_string(),
        seller_fee_basis_points: 0,
        creators: Some(vec![Creator {
            address: pool_creator,
            verified: true,
            share: 100,
        }]),
        collection: None,
        uses: None,
    },
    None, // new_update_authority
    Some(true), // primary_sale_happened
)?;
```

## 🔍 Verification Checklist

- [ ] Metadata account exists for each LP token
- [ ] All LP tokens have name: "Kedolik LP"
- [ ] All LP tokens have symbol: "KLP"
- [ ] URI points to valid, accessible JSON file
- [ ] JSON contains required fields (name, symbol, description, image)
- [ ] Image is hosted and accessible
- [ ] External URL points to official website

## 🛠️ Troubleshooting

### "Metadata already exists"
If metadata was already set, you cannot overwrite it. The account becomes immutable.

### "Invalid authority"
Only the pool creator can set metadata for their pools.

### "Account not found"
Ensure the metadata account PDA is derived correctly.

### Still showing as spam?
- Wait for blockchain indexing (can take 24-48 hours)
- Check that all metadata fields are properly set
- Ensure images load correctly
- Verify creator verification status

## 📊 Monitoring

After setting metadata, monitor:

1. **Wallet Recognition**: Test in Phantom, Solflare, etc.
2. **Explorer Display**: Check Solscan/Solana Explorer
3. **DEX Integration**: Verify display in Raydium, Jupiter
4. **Metadata Accessibility**: Ensure URIs remain online

## 🎯 Best Practices

1. **Unified Branding**: All Kedolik LP tokens share "Kedolik LP" name and "KLP" symbol
2. **Professional Images**: Use a single, professional KLP token image
3. **Regular Updates**: Keep metadata URI accessible long-term
4. **Documentation**: Host comprehensive token information
5. **No Creators Field**: LP tokens don't need creators field (no royalties)

## 📞 Support

If LP tokens are still classified as spam after following this guide:

1. Verify all metadata is correctly set
2. Check image URLs are accessible
3. Wait for blockchain indexing
4. Contact wallet providers if issues persist

---

**Note**: This guide ensures technical compliance. Final classification depends on individual wallet policies and user reports.
