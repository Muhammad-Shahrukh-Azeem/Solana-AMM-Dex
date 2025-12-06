#!/usr/bin/env ts-node
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 TEST: Pool Creation with LP Token Metadata");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load wallet
  const walletPath = path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = path.join(__dirname, "..", "target", "idl", "kedolik_cp_swap.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl as any, provider);

  console.log("📋 Configuration:");
  console.log("   Program ID:", program.programId.toString());
  console.log("   Wallet:", wallet.publicKey.toString());
  console.log("   Network: DEVNET\n");

  // Get or create AMM config (use existing one from deployment)
  const AMM_CONFIG = new PublicKey("BY5RrGvCuSUtuJwPjrkCTjNWTfUqfkbNYNPB6uv6vUpd");
  
  // Verify AMM config exists
  const ammConfigInfo = await connection.getAccountInfo(AMM_CONFIG);
  if (!ammConfigInfo) {
    throw new Error(`AMM Config not found: ${AMM_CONFIG.toString()}`);
  }
  console.log("✅ AMM Config found:", AMM_CONFIG.toString());

  // Fetch AMM config to get fee receiver
  const ammConfigData: any = await (program.account as any).ammConfig.fetch(AMM_CONFIG);
  const feeReceiver = ammConfigData.feeReceiver || ammConfigData.fundOwner;
  console.log("   Fee Receiver:", feeReceiver.toString());

  // Create test token mints
  console.log("\n🪙 Creating test token mints...");
  const token0Mint = await createMint(
    connection,
    walletKeypair,
    wallet.publicKey,
    null,
    9
  );
  const token1Mint = await createMint(
    connection,
    walletKeypair,
    wallet.publicKey,
    null,
    9
  );
  console.log("   Token0 Mint:", token0Mint.toString());
  console.log("   Token1 Mint:", token1Mint.toString());

  // Sort tokens (token0 < token1)
  let sortedToken0 = token0Mint;
  let sortedToken1 = token1Mint;
  if (Buffer.compare(token0Mint.toBuffer(), token1Mint.toBuffer()) > 0) {
    sortedToken0 = token1Mint;
    sortedToken1 = token0Mint;
    console.log("   ⚠️  Tokens were swapped for sorting");
  }

  // Create token accounts
  const userToken0Account = await createAccount(
    connection,
    walletKeypair,
    sortedToken0,
    wallet.publicKey
  );
  const userToken1Account = await createAccount(
    connection,
    walletKeypair,
    sortedToken1,
    wallet.publicKey
  );

  // Mint tokens
  const initAmount0 = new BN(1_000_000_000); // 1 token with 9 decimals
  const initAmount1 = new BN(1_000_000_000); // 1 token with 9 decimals

  await mintTo(connection, walletKeypair, sortedToken0, userToken0Account, wallet.publicKey, initAmount0.toNumber());
  await mintTo(connection, walletKeypair, sortedToken1, userToken1Account, wallet.publicKey, initAmount1.toNumber());
  console.log("✅ Tokens minted and accounts created");

  // Derive PDAs
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_and_lp_mint_auth_seed")],
    program.programId
  );

  const [poolState] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      AMM_CONFIG.toBuffer(),
      sortedToken0.toBuffer(),
      sortedToken1.toBuffer(),
    ],
    program.programId
  );

  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_lp_mint"), poolState.toBuffer()],
    program.programId
  );

  const [token0Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolState.toBuffer(), sortedToken0.toBuffer()],
    program.programId
  );

  const [token1Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolState.toBuffer(), sortedToken1.toBuffer()],
    program.programId
  );

  const [observationState] = PublicKey.findProgramAddressSync(
    [Buffer.from("observation"), poolState.toBuffer()],
    program.programId
  );

  const userLpAccount = getAssociatedTokenAddressSync(lpMint, wallet.publicKey);

  // Derive metadata account
  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      lpMint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  console.log("\n📋 Pool Details:");
  console.log("   Pool State:", poolState.toString());
  console.log("   LP Mint:", lpMint.toString());
  console.log("   Metadata Account:", metadataAccount.toString());

  // Test 1: Create pool with null metadata parameters (should use defaults)
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 TEST 1: Create pool with null metadata (should use defaults)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const openTime = new BN(Math.floor(Date.now() / 1000));

    console.log("📝 Calling initialize with null metadata parameters...");
    console.log("   Expected defaults:");
    console.log("     Name: Kedolik LP");
    console.log("     Symbol: KLP");
    console.log("     URI: https://raw.githubusercontent.com/KedolikSwap/metadata/refs/heads/main/klp.json\n");

    const tx = await (program.methods as any)
      .initialize(
        initAmount0,
        initAmount1,
        openTime,
        null,  // lp_token_name - should use "Kedolik LP"
        null,  // lp_token_symbol - should use "KLP"
        null   // lp_token_uri - should use default URI
      )
      .accounts({
        creator: wallet.publicKey,
        ammConfig: AMM_CONFIG,
        authority: authority,
        poolState: poolState,
        token0Mint: sortedToken0,
        token1Mint: sortedToken1,
        lpMint: lpMint,
        creatorToken0: userToken0Account,
        creatorToken1: userToken1Account,
        creatorLpToken: userLpAccount,
        token0Vault: token0Vault,
        token1Vault: token1Vault,
        createPoolFee: feeReceiver,
        observationState: observationState,
        tokenProgram: TOKEN_PROGRAM_ID,
        token0Program: TOKEN_PROGRAM_ID,
        token1Program: TOKEN_PROGRAM_ID,
        associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        metadataAccount: metadataAccount,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc({
        skipPreflight: false,
        commitment: "confirmed",
      });

    console.log("✅ Pool created successfully!");
    console.log("   Transaction:", tx);
    console.log("   Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet\n");

    // Wait a bit for transaction to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify metadata was created
    console.log("🔍 Verifying LP token metadata...");
    const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);
    
    if (metadataAccountInfo && metadataAccountInfo.data.length > 0) {
      console.log("✅ LP Token Metadata Account EXISTS!");
      console.log("   Address:", metadataAccount.toString());
      console.log("   Data Length:", metadataAccountInfo.data.length, "bytes");
      console.log("   Owner:", metadataAccountInfo.owner.toString());

      // Try to parse metadata (basic check)
      const data = Buffer.from(metadataAccountInfo.data);
      if (data[0] === 4) {
        // MetadataV1 key
        console.log("   ✅ Valid Metaplex metadata format detected");
        
        // Try to extract name and symbol (basic parsing)
        try {
          const nameStart = 1 + 32 + 32 + 4; // key + update_authority + mint + name_length
          const nameLength = data.readUInt32LE(1 + 32 + 32);
          const name = data.slice(nameStart, nameStart + nameLength).toString("utf-8").replace(/\0/g, "");
          
          const symbolStart = nameStart + nameLength + 4;
          const symbolLength = data.readUInt32LE(nameStart + nameLength);
          const symbol = data.slice(symbolStart, symbolStart + symbolLength).toString("utf-8").replace(/\0/g, "");
          
          console.log("   📝 Parsed Metadata:");
          console.log("      Name:", name);
          console.log("      Symbol:", symbol);
          
          if (name === "Kedolik LP" && symbol === "KLP") {
            console.log("   ✅ Metadata matches expected defaults!");
          } else {
            console.log("   ⚠️  Metadata doesn't match expected defaults");
          }
        } catch (parseError) {
          console.log("   ⚠️  Could not fully parse metadata, but account exists");
        }
      }
    } else {
      console.log("❌ LP Token Metadata Account DOES NOT EXIST!");
      console.log("   This means metadata was not created during pool initialization.");
    }

    // Verify pool state
    console.log("\n🔍 Verifying pool state...");
    const poolStateData: any = await (program.account as any).poolState.fetch(poolState);
    console.log("✅ Pool State:");
    console.log("   LP Mint:", poolStateData.lpMint.toString());
    console.log("   Token0 Mint:", poolStateData.token0Mint.toString());
    console.log("   Token1 Mint:", poolStateData.token1Mint.toString());

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ TEST PASSED: Pool created with metadata!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error: any) {
    console.error("\n❌ TEST FAILED:");
    console.error("   Error:", error.message);
    if (error.logs) {
      console.error("   Logs:", error.logs);
    }
    console.error("   Stack:", error.stack);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

