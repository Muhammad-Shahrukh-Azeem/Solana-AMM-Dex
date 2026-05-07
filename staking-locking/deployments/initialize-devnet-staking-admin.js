#!/usr/bin/env node

const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");

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
  const clusterUrl = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const walletPath = process.env.ANCHOR_WALLET || DEFAULT_WALLET;
  const admin = loadKeypair(walletPath);
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

  const existing = await connection.getAccountInfo(adminConfig);
  let signature = null;
  if (!existing) {
    signature = await program.methods
      .initializeAdminConfig()
      .accounts({
        authority: admin.publicKey,
        adminConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const config = await program.account.adminConfig.fetch(adminConfig);
  console.log(
    JSON.stringify(
      {
        programId: PROGRAM_ID.toString(),
        adminConfig: adminConfig.toString(),
        authority: config.authority.toString(),
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
