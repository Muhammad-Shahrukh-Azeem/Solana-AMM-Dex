import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";
const METADATA_BASE_URI = "https://raw.githubusercontent.com/KedolikSwap/metadata/main/lp-tokens";

const LP_TOKENS = [
  {
    pool: "554JreVzZoRoCW4igPnuqkLZ3E6gUDYU63pCGNEhJY8m",
    lpMint: "4af7GRWYW4PezainFKmQWcwrPZxE1WtN5eHKecL5o8ky",
    name: "KedoX LP SOL-USDC",
  },
  {
    pool: "E4nsY8kZPc11H21zdaxKEVC7BzkvSgbsMYP42naL57vA",
    lpMint: "6LPmEY5n3dEUr18pc5HVB8HduCQNtVUipCVEuYt9yHHj",
    name: "KedoX LP USDC-USDT",
  },
  {
    pool: "FXUoR7hqhh3W1QzGtADEmzQVECk2pZwGZc85K5PvfaTX",
    lpMint: "6yHkgyw9cEsaoQ6i4mFSBgr9Z9NqmqmMTiToQztXvP6P",
    name: "KedoX LP SOL-USDT",
  },
  {
    pool: "DKLZ3JNvv8NLjmcXsLNiWZaxV4hYCHRMVWTKAk5Aqb48",
    lpMint: "9iasc8vstLvbLD5rDFAkvaacDSxEVn4eWnXm6awFyPKH",
    name: "KedoX LP USDC-KEDOL",
  },
  {
    pool: "HkCZkysbiWR9os7hRqT8V6Xut2qxTRQCLeL1C4BDZC93",
    lpMint: "CtD41zHHHTstMCZ89bsnt3WMkWrx4hfX1QN3uTMumAF9",
    name: "KedoX LP USDT-KEDOL",
  },
  {
    pool: "5RQ4PyDTxhWnRB29BUv1HEXFMoD6ffDpNRyu7MvZMTYc",
    lpMint: "FNkyNA5pc3dawQsQKw5puyKPgKHB8en4ABcuoyo5ghoF",
    name: "KedoX LP WSOL-KEDOL",
  },
] as const;

function expandHome(filePath: string): string {
  if (!filePath.startsWith("~")) return filePath;
  return filePath.replace("~", os.homedir());
}

function getCliWalletPath(): string {
  const output = execSync("solana config get", { encoding: "utf-8" });
  const keypairLine = output.split("\n").find((line) => line.includes("Keypair Path"));
  return expandHome(keypairLine ? keypairLine.split(":")[1].trim() : "~/.config/solana/id.json");
}

function metadataPda(lpMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), lpMint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function authorityPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault_and_lp_mint_auth_seed")], programId)[0];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
  const rpcUrl = process.env.SOLANA_URL || process.env.ANCHOR_PROVIDER_URL || MAINNET_RPC_URL;
  const walletPath = expandHome(process.env.SOLANA_WALLET || process.env.ANCHOR_WALLET || getCliWalletPath());
  const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));
  const wallet = new Wallet(payer);
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync("./target/idl/kedolik_cp_swap.json", "utf-8"));
  const program = new Program(idl as any, provider);
  const poolAuthority = authorityPda(program.programId);

  console.log("LP metadata update");
  console.log(`  RPC: ${rpcUrl}`);
  console.log(`  Wallet: ${wallet.publicKey.toString()}`);
  console.log(`  Program: ${program.programId.toString()}`);
  console.log(`  PDA update authority: ${poolAuthority.toString()}`);
  console.log(`  Dry run: ${dryRun ? "yes" : "no"}`);

  for (const item of LP_TOKENS) {
    const pool = new PublicKey(item.pool);
    const expectedLpMint = new PublicKey(item.lpMint);
    const poolData: any = await (program.account as any).poolState.fetch(pool);
    const lpMint = poolData.lpMint || poolData.lp_mint;
    const ammConfig = poolData.ammConfig || poolData.amm_config;

    if (!lpMint.equals(expectedLpMint)) {
      throw new Error(`Pool ${pool.toString()} LP mint mismatch: expected ${expectedLpMint.toString()}, got ${lpMint.toString()}`);
    }

    const uri = `${METADATA_BASE_URI}/${expectedLpMint.toString()}.json`;
    const metadataAccount = metadataPda(expectedLpMint);

    console.log("");
    console.log(`Updating ${item.name}`);
    console.log(`  Pool: ${pool.toString()}`);
    console.log(`  LP mint: ${expectedLpMint.toString()}`);
    console.log(`  URI: ${uri}`);

    if (dryRun) continue;

    const tx = await (program.methods as any)
      .updateLpTokenMetadata(item.name, "KDLX", uri)
      .accounts({
        authority: wallet.publicKey,
        poolState: pool,
        ammConfig,
        lpMint: expectedLpMint,
        metadataAccount,
        authorityPda: poolAuthority,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc();

    console.log(`  Transaction: ${tx}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
