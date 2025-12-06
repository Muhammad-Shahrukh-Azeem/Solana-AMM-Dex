import * as bs58 from "bs58";

// Base64 data from the account
const base64Data = 'y8HhXw4y3aL6DzWsVVXBtmCwonRBuvH5h8zpg+gwdi5DpY6W5bHYFdfQBwAAAAAAAP8Ki+jPfSp/E/giKWE+lVdAivSCCvLCRvB5olU/Gnv9/wqL6M99Kn8T+CIpYT6VV0CK9IIK8sJG8HmiVT8ae/0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICWmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

const data = Buffer.from(base64Data, 'base64');

console.log('');
console.log('📊 Protocol Token Config Status:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Raw data length:', data.length, 'bytes');
console.log('');

// Skip 8 bytes discriminator
let offset = 8;

// Read bump (1 byte)
const bump = data.readUInt8(offset);
offset += 1;
console.log('Bump:', bump);

// Read protocol_token_mint (32 bytes)
const protocolTokenMint = data.slice(offset, offset + 32);
offset += 32;
console.log('Protocol Token Mint:', bs58.encode(protocolTokenMint));

// Read discount_rate (8 bytes, u64, little-endian)
const discountRate = data.readBigUInt64LE(offset);
offset += 8;
console.log('Discount Rate:', discountRate.toString(), '(' + (Number(discountRate) / 100) + '%)');

// Read authority (32 bytes)
const authority = data.slice(offset, offset + 32);
offset += 32;
console.log('Authority:', bs58.encode(authority));

// Read treasury (32 bytes)
const treasury = data.slice(offset, offset + 32);
offset += 32;
console.log('Treasury:', bs58.encode(treasury));

// Read price_oracle (32 bytes)
const priceOracle = data.slice(offset, offset + 32);
offset += 32;
console.log('Price Oracle:', bs58.encode(priceOracle));

// Read protocol_token_per_usd (8 bytes, u64, little-endian)
const protocolTokenPerUsd = data.readBigUInt64LE(offset);
offset += 8;
console.log('Protocol Token Per USD:', protocolTokenPerUsd.toString());
console.log('');

if (protocolTokenPerUsd === 0n) {
  console.log('❌ ERROR: protocol_token_per_usd is 0!');
  console.log('   This is why the discount feature is failing.');
  console.log('');
  console.log('🔧 TO FIX: Run this command:');
  console.log('   npx ts-node scripts/fetch-kedol-price-from-pool.ts');
  console.log('');
} else {
  console.log('✅ Configuration is VALID!');
  console.log('   Price: 1 USD = ' + (Number(protocolTokenPerUsd) / 1_000_000) + ' KEDOL');
  console.log('');
  console.log('🎯 The KEDOL discount feature should work!');
  console.log('');
}

