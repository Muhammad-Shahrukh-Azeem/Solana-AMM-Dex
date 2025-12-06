import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

/**
 * Batch Set LP Token Metadata
 *
 * This script sets metadata for all existing pools in batch mode.
 * It reads pool addresses from command line arguments or a config file.
 */

const KEDOLOG_MINT = new PublicKey('FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Generic LP token metadata for all pools
const GENERIC_LP_METADATA = {
  name: 'Kedolik LP',
  symbol: 'KLP',
  uri: 'https://raw.githubusercontent.com/KedolikSwap/metadata/refs/heads/main/klp.json'
};

// Pool addresses for mainnet (confirmed pools only)
const POOL_ADDRESSES = [
  '8KYfYHmPyzpzqYQzVzHR3uv94E1UX8TsaEFLqBWzenRJ', // KEDOL-USDC
  '3ZXK4N8Hf1uZjYqndX3bRPXf71wS6gj3DSiSjPTveE1L', // SOL-USDC
  '9zbYdushUHfJ67SJCDAYCMtaHdg5UMnJwmGWWGuXgh3',   // KEDOL-SOL
  '8XY3zNwLLBnehgvWPGjtDJRUsV48hRoPYmpVTSrApUsa', // KEDOL-USDT
  '8GasayczHWCWe5bk7opeZhgRxdk3Ve9uunuqHK2Kx35A', // USDC-USDT
];

// Convert pool addresses to config objects
const POOL_CONFIGS = POOL_ADDRESSES.map(address => ({
  address,
  ...GENERIC_LP_METADATA
}));

async function setPoolMetadata(
  program: Program,
  poolConfig: typeof POOL_CONFIGS[0],
  wallet: Wallet
): Promise<boolean> {
  try {
    const poolAddress = new PublicKey(poolConfig.address);
    console.log(`\n🏷️  Processing pool: ${poolConfig.name} (${poolAddress.toString()})`);

    // Fetch pool state
    const poolData: any = await (program.account as any).poolState.fetch(poolAddress);
    const lpMint = poolData.lpMint || poolData.lp_mint;

    // Check if metadata already exists
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        lpMint.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

    try {
      const metadataInfo = await program.provider.connection.getAccountInfo(metadataAccount);
      if (metadataInfo) {
        console.log(`   ⚠️  Metadata already exists, skipping...`);
        return true; // Consider this successful
      }
    } catch (e) {
      // Continue if metadata doesn't exist
    }

    // Call the set_lp_token_metadata instruction
    console.log(`   🚀 Setting metadata...`);

    const PROGRAM_ID = program.programId;
    const tx = await program.methods
      .setLpTokenMetadata(poolConfig.name, poolConfig.symbol, poolConfig.uri)
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

    console.log(`   ✅ Success! TX: ${tx}`);
    return true;

  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🏷️  Batch Set LP Token Metadata");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);
  const customPools = args.length > 0 ? args : null;

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
  console.log(`🔗 RPC: ${rpcUrl}\n`);

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

  // Determine which pools to process
  const poolsToProcess = customPools ?
    customPools.map(addr => ({ address: addr, name: `Pool ${addr.slice(0, 8)}`, symbol: 'LP', uri: '' })) :
    POOL_CONFIGS;

  console.log(`📋 Processing ${poolsToProcess.length} pools...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const poolConfig of poolsToProcess) {
    const success = await setPoolMetadata(program, poolConfig, wallet);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Batch Complete!");
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📈 Success Rate: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);

  if (failCount > 0) {
    console.log("\n💡 Tip: Failed pools may already have metadata set or you may not be the creator.");
    console.log("   Check the error messages above for details.");
  }
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});

