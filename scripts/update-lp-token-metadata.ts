import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";
import {
  getMetadataAccountDataSerializer,
  getUpdateMetadataAccountV2InstructionDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";
import { none, some } from "@metaplex-foundation/umi";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const DEFAULT_NAME = "KedoX LP";
const DEFAULT_SYMBOL = "KDLX";
const DEFAULT_URI = "https://raw.githubusercontent.com/KedolikSwap/metadata/refs/heads/main/klp.json";

function expandHome(filePath: string): string {
  if (!filePath.startsWith("~")) return filePath;
  return filePath.replace("~", os.homedir());
}

function getCliRpc(): string {
  const output = execSync("solana config get", { encoding: "utf-8" });
  const rpcLine = output.split("\n").find((line) => line.includes("RPC URL"));
  return rpcLine ? rpcLine.split(":").slice(1).join(":").trim() : "https://api.mainnet-beta.solana.com";
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

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npx ts-node scripts/update-lp-token-metadata.ts <POOL_ADDRESS_OR_LP_MINT> [NAME] [SYMBOL] [URI]");
    console.error(`Default: ${DEFAULT_NAME} / ${DEFAULT_SYMBOL} / ${DEFAULT_URI}`);
    process.exit(1);
  }

  const target = new PublicKey(args[0]);
  const name = args[1] || DEFAULT_NAME;
  const symbol = args[2] || DEFAULT_SYMBOL;
  const uri = args[3] || DEFAULT_URI;
  const rpcUrl = process.env.SOLANA_URL || process.env.ANCHOR_PROVIDER_URL || getCliRpc();
  const walletPath = expandHome(process.env.SOLANA_WALLET || process.env.ANCHOR_WALLET || getCliWalletPath());
  const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));
  const wallet = new Wallet(payer);
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync("./target/idl/kedolik_cp_swap.json", "utf-8"));
  const program = new Program(idl as any, provider);

  let lpMint = target;
  try {
    const poolData: any = await (program.account as any).poolState.fetch(target);
    lpMint = poolData.lpMint || poolData.lp_mint;
    console.log(`Pool: ${target.toString()}`);
  } catch (_err) {
    console.log("Target is not a pool state account; treating it as LP mint.");
  }

  const metadata = metadataPda(lpMint);
  const metadataInfo = await connection.getAccountInfo(metadata);
  if (!metadataInfo) {
    throw new Error(`Metadata account does not exist for LP mint ${lpMint.toString()}. Use set-pool-metadata.ts to create it first.`);
  }

  const [currentMetadata] = getMetadataAccountDataSerializer().deserialize(metadataInfo.data);
  const updateAuthority = new PublicKey(currentMetadata.updateAuthority.toString());
  if (!updateAuthority.equals(wallet.publicKey)) {
    throw new Error(`Wallet is not metadata update authority. Current update authority: ${updateAuthority.toString()}`);
  }

  const data = getUpdateMetadataAccountV2InstructionDataSerializer().serialize({
    data: some({
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: currentMetadata.sellerFeeBasisPoints,
      creators: currentMetadata.creators,
      collection: currentMetadata.collection,
      uses: currentMetadata.uses,
    }),
    newUpdateAuthority: none(),
    primarySaleHappened: none(),
    isMutable: some(true),
  });

  const ix = new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  console.log("Updating LP metadata:");
  console.log(`  LP mint: ${lpMint.toString()}`);
  console.log(`  Metadata: ${metadata.toString()}`);
  console.log(`  Name: ${name}`);
  console.log(`  Symbol: ${symbol}`);
  console.log(`  URI: ${uri}`);

  const tx = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer], {
    commitment: "confirmed",
  });

  console.log("Metadata updated successfully.");
  console.log(`Transaction: ${tx}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
