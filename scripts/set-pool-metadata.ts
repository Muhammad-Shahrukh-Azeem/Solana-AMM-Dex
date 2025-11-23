import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

/**
 * Set LP Token Metadata for Existing Pools
 *
 * This script sets metadata (name, symbol, URI) for LP tokens of existing pools.
 * It generates appropriate names based on the token pair and sets the metadata
 * using the Metaplex Token Metadata program.
 */

const KEDOLOG_MINT = new PublicKey('FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

async function main() {
  console.log("🏷️  Set LP Token Metadata");
  console.log("=".repeat(50));

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx ts-node scripts/set-pool-metadata.ts <POOL_ADDRESS> [NAME] [SYMBOL] [URI]");
    console.error("Examples:");
    console.error("  npx ts-node scripts/set-pool-metadata.ts 8KYfYHmPyzpzqYQzVzHR3uv94E1UX8TsaEFLqBWzenRJ");
    console.error("  npx ts-node scripts/set-pool-metadata.ts 8KYfYHmPyzpzqYQzVzHR3uv94E1UX8TsaEFLqBWzenRJ 'KEDOLOG-USDC LP' 'KEDO-USDC' 'https://kedolik.io/metadata/kedo-usdc-lp.json'");
    process.exit(1);
  }

  const poolAddress = new PublicKey(args[0]);
  const customName = args[1];
  const customSymbol = args[2];
  const customUri = args[3];

  // Get network from Solana CLI
  const getCurrentNetwork = (): { network: string; rpcUrl: string } => {
    try {
      const output = execSync('solana config get', { encoding: 'utf-8' });
      const rpcLine = output.split('\n').find(line => line.includes('RPC URL'));
      const rpcUrl = rpcLine ? rpcLine.split(':').slice(1).join(':').trim() : 'https://api.mainnet-beta.solana.com';

      let network = 'mainnet';
      if (rpcUrl.includes('devnet')) network = 'devnet';
      else if (rpcUrl.includes('testnet')) network = 'testnet';
      else if (rpcUrl.includes('mainnet')) network = 'mainnet';

      return { network, rpcUrl };
    } catch (e) {
      return { network: 'mainnet', rpcUrl: 'https://api.mainnet-beta.solana.com' };
    }
  };

  const { network, rpcUrl } = getCurrentNetwork();

  // Setup connection
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log(`📡 Network: ${network.toUpperCase()}`);
  console.log(`🔗 RPC: ${rpcUrl}`);
  console.log(`🏊 Pool: ${poolAddress.toString()}\n`);

  // Get wallet path
  let walletPath: string;
  try {
    const configOutput = execSync('solana config get', { encoding: 'utf-8' });
    const keypairLine = configOutput.split('\n').find(line => line.includes('Keypair Path'));
    walletPath = keypairLine ? keypairLine.split(':')[1].trim() : `${os.homedir()}/.config/solana/id.json`;
    if (walletPath.startsWith('~')) {
      walletPath = walletPath.replace('~', os.homedir());
    }
  } catch (e) {
    walletPath = `${os.homedir()}/.config/solana/id.json`;
  }

  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // Load IDL and program
  const anchorToml = fs.readFileSync('./Anchor.toml', 'utf-8');
  const programIdMatch = anchorToml.match(/kedolik_cp_swap = "([A-Za-z0-9]+)"/);
  if (!programIdMatch) {
    console.error('❌ Could not find program ID in Anchor.toml');
    process.exit(1);
  }
  const PROGRAM_ID = new PublicKey(programIdMatch[1]);

  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);

  try {
    // Fetch pool state
    console.log("📥 Fetching pool information...");
    const poolData: any = await (program.account as any).poolState.fetch(poolAddress);

    const token0Mint = poolData.token0Mint || poolData.token_0_mint;
    const token1Mint = poolData.token1Mint || poolData.token_1_mint;
    const lpMint = poolData.lpMint || poolData.lp_mint;

    console.log(`🔍 Token0: ${token0Mint.toString()}`);
    console.log(`🔍 Token1: ${token1Mint.toString()}`);
    console.log(`🪙 LP Mint: ${lpMint.toString()}\n`);

    // Use generic Kedolik LP metadata for all pools (or custom if specified)
    let name: string;
    let symbol: string;

    if (customName && customSymbol) {
      name = customName;
      symbol = customSymbol;
    } else {
      // All pools use the same generic LP token metadata
      name = 'Kedolik LP';
      symbol = 'KLP';
    }

    const uri = customUri || `https://kedolik.io/metadata/${symbol.toLowerCase().replace('-', '-')}-lp.json`;

    console.log("📋 Metadata to set:");
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   URI: ${uri}\n`);

    // Check if metadata already exists
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(), // Metaplex Token Metadata program
        lpMint.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

    try {
      const metadataInfo = await connection.getAccountInfo(metadataAccount);
      if (metadataInfo) {
        console.log("⚠️  Metadata already exists for this LP token!");
        console.log("   To update existing metadata, you would need to use update_metadata_accounts_v2");
        console.log("   This script only creates new metadata accounts.\n");

        // Ask user if they want to continue anyway (might fail)
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        await new Promise(resolve => {
          readline.question('Do you want to try setting metadata anyway? (y/N): ', (answer: string) => {
            readline.close();
            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
              console.log("Operation cancelled.");
              process.exit(0);
            }
            resolve(undefined);
          });
        });
      }
    } catch (e) {
      // Metadata doesn't exist, continue
    }

    // Call the set_lp_token_metadata instruction
    console.log("🚀 Setting LP token metadata...");

    const tx = await program.methods
      .setLpTokenMetadata(name, symbol, uri)
      .accounts({
        authority: wallet.publicKey,
        payer: wallet.publicKey,
        poolState: poolAddress,
        lpMint: lpMint,
        metadataAccount: metadataAccount,
        authorityPda: PublicKey.findProgramAddressSync(
          [Buffer.from("vault_and_lp_mint_auth_seed")],
          PROGRAM_ID
        )[0],
        tokenMetadataProgram: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("✅ Metadata set successfully!");
    console.log(`📋 Transaction: ${tx}`);
    console.log(`🔍 View on Solscan: https://solscan.io/tx/${tx}?cluster=${network}`);

  } catch (error: any) {
    console.error("❌ Error setting metadata:", error.message);

    if (error.message.includes("InvalidAuthority")) {
      console.error("💡 Only the pool creator can set metadata for this pool.");
    } else if (error.message.includes("already in use")) {
      console.error("💡 Metadata account already exists. Use update_metadata_accounts_v2 to modify existing metadata.");
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

