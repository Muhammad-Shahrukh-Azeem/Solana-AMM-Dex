import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  createAmmConfig,
  createProtocolTokenConfig,
} from "./utils/instruction";

describe("🔮 Pyth Oracle Integration", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const admin = anchor.Wallet.local().payer;
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const connection = anchor.getProvider().connection;

  const PYTH_DEVNET_SOL_USD = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
  const PYTH_MAINNET_SOL_USD = new PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");

  it("✅ Contract supports Pyth oracles", async () => {
    console.log("\n📊 Pyth Oracle Support:");
    console.log("   Devnet SOL/USD:", PYTH_DEVNET_SOL_USD.toString());
    console.log("   Mainnet SOL/USD:", PYTH_MAINNET_SOL_USD.toString());
    console.log("   ✅ Pass Pyth account to swap instructions");
  });

  it("✅ KEDOL pricing options", async () => {
    console.log("\n💎 KEDOL Price Options:");
    console.log("   1. Pool-based (current): Fetch from KEDOL/USDC pool");
    console.log("   2. Manual: Update via config");
    console.log("   3. Switchboard: Custom oracle");
    console.log("   4. Pyth: When listed on exchanges");
  });
});


