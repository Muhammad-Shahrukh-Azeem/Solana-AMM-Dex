#!/usr/bin/env node

const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Keypair, PublicKey } = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW");
const ROOT_DIR = path.resolve(__dirname, "..");
const IDL_PATH = path.join(ROOT_DIR, "target", "idl", "kedolik_stake_lock.json");
const DEFAULT_WALLET = "~/.config/solana/mainnet-deployer.json";

function expandHome(filePath) {
  if (!filePath.startsWith("~")) {
    return filePath;
  }
  return path.join(os.homedir(), filePath.slice(1));
}

function loadKeypair(filePath) {
  const raw = JSON.parse(fs.readFileSync(expandHome(filePath), "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  if (!process.env.NEW_AUTHORITY) {
    throw new Error("Usage: NEW_AUTHORITY=<wallet> node deployments/transfer-devnet-staking-admin.js");
  }

  const clusterUrl = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const walletPath = process.env.ANCHOR_WALLET || DEFAULT_WALLET;
  const admin = loadKeypair(walletPath);
  const newAuthority = new PublicKey(process.env.NEW_AUTHORITY);
  const connection = new anchor.web3.Connection(clusterUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new anchor.Program(idl, provider);
  const [adminConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_config")],
    PROGRAM_ID
  );

  const config = await program.account.adminConfig.fetch(adminConfig);
  if (!config.authority.equals(admin.publicKey)) {
    throw new Error(`Wallet is not current admin. Current admin is ${config.authority.toString()}`);
  }

  const signature = await program.methods
    .transferAdminAuthority(newAuthority)
    .accounts({
      adminConfig,
      authority: admin.publicKey,
    })
    .rpc();

  console.log(
    JSON.stringify(
      {
        programId: PROGRAM_ID.toString(),
        adminConfig: adminConfig.toString(),
        oldAuthority: admin.publicKey.toString(),
        newAuthority: newAuthority.toString(),
        signature,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
