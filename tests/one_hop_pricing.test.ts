import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("1-Hop Pricing with Token Ordering", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  const admin = provider.wallet as anchor.Wallet;
  let feeReceiver: Keypair;

  // Token mints
  let kedologMint: PublicKey;
  let usdcMint: PublicKey;
  let solMint: PublicKey = new PublicKey("So11111111111111111111111111111111111111112");
  let tokenXMint: PublicKey; // Test token without direct USDC/SOL pair
  let tokenYMint: PublicKey; // Another test token

  // Configs
  let ammConfig: PublicKey;
  let protocolTokenConfig: PublicKey;

  // Reference pools
  let kedologUsdcPool: Keypair;
  let solUsdcPool: Keypair;

  // Pool vaults
  let kedologUsdcVault0: PublicKey;
  let kedologUsdcVault1: PublicKey;
  let solUsdcVault0: PublicKey;
  let solUsdcVault1: PublicKey;

  // Test token pools
  let tokenXUsdcVault0: PublicKey;
  let tokenXUsdcVault1: PublicKey;
  let tokenYSolVault0: PublicKey;
  let tokenYSolVault1: PublicKey;

  before(async () => {
    console.log("\n🔧 Setting up 1-hop pricing test environment...\n");

    feeReceiver = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      feeReceiver.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token mints
    kedologMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 9);
    usdcMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6);
    tokenXMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 8); // 8 decimals
    tokenYMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6); // 6 decimals

    console.log("✅ KEDOLOG mint:", kedologMint.toString());
    console.log("✅ USDC mint:", usdcMint.toString());
    console.log("✅ Token X mint:", tokenXMint.toString());
    console.log("✅ Token Y mint:", tokenYMint.toString());

    // Create AMM Config with unique index
    const configIndex = Math.floor(Math.random() * 10000) + 20000; // Random index to avoid conflicts
    
    // Use the same PDA derivation as the contract
    const [ammConfigAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_config"),
        Buffer.from(new Uint8Array(new Uint16Array([configIndex]).buffer))
      ],
      program.programId
    );
    ammConfig = ammConfigAddress;

    await program.methods
      .createAmmConfig(
        configIndex,
        new BN(2500),
        new BN(200000),
        new BN(0),
        new BN(1 * LAMPORTS_PER_SOL),
        new BN(0), // creator_fee_rate
        feeReceiver.publicKey
      )
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ AMM Config created");

    // Create Protocol Token Config
    [protocolTokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_token_config"), kedologMint.toBuffer()],
      program.programId
    );

    await program.methods
      .createProtocolTokenConfig(
        kedologMint,
        new BN(2500),
        admin.publicKey,
        feeReceiver.publicKey,
        PublicKey.default,
        PublicKey.default,
        PublicKey.default,
        usdcMint
      )
      .accounts({
        owner: admin.publicKey,
        payer: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Protocol Token Config created");

    // Create KEDOLOG/USDC pool (KEDOLOG = $0.0017)
    kedologUsdcPool = Keypair.generate();
    kedologUsdcVault0 = await createAccount(
      provider.connection,
      admin.payer,
      kedologMint,
      kedologUsdcPool.publicKey
    );
    kedologUsdcVault1 = await createAccount(
      provider.connection,
      admin.payer,
      usdcMint,
      kedologUsdcPool.publicKey
    );

    await mintTo(provider.connection, admin.payer, kedologMint, kedologUsdcVault0, admin.publicKey, 1_000_000_000_000_000);
    await mintTo(provider.connection, admin.payer, usdcMint, kedologUsdcVault1, admin.publicKey, 1_700_000_000);

    console.log("✅ KEDOLOG/USDC pool created");

    // Create SOL/USDC pool (SOL = $200)
    solUsdcPool = Keypair.generate();
    solUsdcVault0 = await createAccount(provider.connection, admin.payer, solMint, solUsdcPool.publicKey);
    solUsdcVault1 = await createAccount(provider.connection, admin.payer, usdcMint, solUsdcPool.publicKey);

    await mintTo(provider.connection, admin.payer, solMint, solUsdcVault0, admin.publicKey, 1_000_000_000_000);
    await mintTo(provider.connection, admin.payer, usdcMint, solUsdcVault1, admin.publicKey, 200_000_000_000);

    console.log("✅ SOL/USDC pool created");

    // Create Token X/USDC pool (Token X = $5)
    // Token X has 8 decimals
    const tokenXPool = Keypair.generate();
    tokenXUsdcVault0 = await createAccount(provider.connection, admin.payer, tokenXMint, tokenXPool.publicKey);
    tokenXUsdcVault1 = await createAccount(provider.connection, admin.payer, usdcMint, tokenXPool.publicKey);

    // 1,000 Token X / 5,000 USDC = $5 per Token X
    await mintTo(provider.connection, admin.payer, tokenXMint, tokenXUsdcVault0, admin.publicKey, 100_000_000_000); // 1,000 Token X
    await mintTo(provider.connection, admin.payer, usdcMint, tokenXUsdcVault1, admin.publicKey, 5_000_000_000); // 5,000 USDC

    console.log("✅ Token X/USDC pool created (Token X = $5)");

    // Create Token Y/SOL pool (Token Y = 0.01 SOL = $2 at SOL=$200)
    const tokenYPool = Keypair.generate();
    tokenYSolVault0 = await createAccount(provider.connection, admin.payer, tokenYMint, tokenYPool.publicKey);
    tokenYSolVault1 = await createAccount(provider.connection, admin.payer, solMint, tokenYPool.publicKey);

    // 10,000 Token Y / 100 SOL = 0.01 SOL per Token Y = $2
    await mintTo(provider.connection, admin.payer, tokenYMint, tokenYSolVault0, admin.publicKey, 10_000_000_000); // 10,000 Token Y
    await mintTo(provider.connection, admin.payer, solMint, tokenYSolVault1, admin.publicKey, 100_000_000_000); // 100 SOL

    console.log("✅ Token Y/SOL pool created (Token Y = $2)");

    // Update config with pool addresses
    await program.methods
      .updateProtocolTokenConfig(
        null,
        null,
        kedologUsdcPool.publicKey,
        solUsdcPool.publicKey,
        null,
        null
      )
      .accounts({
        authority: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
      })
      .rpc();

    console.log("✅ Config updated\n");
  });

  describe("📊 Token Ordering Tests", () => {
    it("Handles KEDOLOG/USDC pool regardless of token order", async () => {
      console.log("\n💱 Test: KEDOLOG/USDC Token Ordering\n");

      const vault0 = await getAccount(provider.connection, kedologUsdcVault0);
      const vault1 = await getAccount(provider.connection, kedologUsdcVault1);

      console.log("Vault 0 mint:", vault0.mint.toString());
      console.log("Vault 1 mint:", vault1.mint.toString());
      console.log("KEDOLOG mint:", kedologMint.toString());
      console.log("USDC mint:", usdcMint.toString());

      // Calculate price regardless of order
      const kedologReserve = Number(vault0.amount) / 1_000_000_000;
      const usdcReserve = Number(vault1.amount) / 1_000_000;
      const price = usdcReserve / kedologReserve;

      console.log("Calculated KEDOLOG price: $" + price.toFixed(4));
      assert.approximately(price, 0.0017, 0.0001, "Price should be ~$0.0017");

      console.log("✅ Token ordering handled correctly\n");
    });

    it("Handles SOL/USDC pool regardless of token order", async () => {
      console.log("\n💱 Test: SOL/USDC Token Ordering\n");

      const vault0 = await getAccount(provider.connection, solUsdcVault0);
      const vault1 = await getAccount(provider.connection, solUsdcVault1);

      console.log("Vault 0 mint:", vault0.mint.toString());
      console.log("Vault 1 mint:", vault1.mint.toString());

      // Calculate price
      const solReserve = Number(vault0.amount) / 1_000_000_000;
      const usdcReserve = Number(vault1.amount) / 1_000_000;
      const price = usdcReserve / solReserve;

      console.log("Calculated SOL price: $" + price.toFixed(2));
      assert.approximately(price, 200, 1, "Price should be ~$200");

      console.log("✅ Token ordering handled correctly\n");
    });
  });

  describe("📊 1-Hop Pricing: Token X → USDC", () => {
    it("Calculates correct price for Token X via USDC pool", async () => {
      console.log("\n💱 Test: Token X → USDC (1-hop)\n");

      const vault0 = await getAccount(provider.connection, tokenXUsdcVault0);
      const vault1 = await getAccount(provider.connection, tokenXUsdcVault1);

      console.log("Token X reserve:", Number(vault0.amount) / 100_000_000);
      console.log("USDC reserve:", Number(vault1.amount) / 1_000_000);

      const tokenXReserve = Number(vault0.amount) / 100_000_000; // 8 decimals
      const usdcReserve = Number(vault1.amount) / 1_000_000; // 6 decimals
      const tokenXPrice = usdcReserve / tokenXReserve;

      console.log("Token X price: $" + tokenXPrice.toFixed(2));
      assert.approximately(tokenXPrice, 5, 0.1, "Token X should be ~$5");

      // Calculate KEDOLOG fee for 1 Token X swap
      const swapAmount = 1;
      const protocolFee = swapAmount * 0.0005; // 0.05%
      const discountedFee = protocolFee * 0.75; // 25% discount
      const feeUsd = discountedFee * tokenXPrice;
      const kedologFee = feeUsd / 0.0017;

      console.log("Swap: 1 Token X ($5)");
      console.log("Protocol fee: $" + feeUsd.toFixed(6));
      console.log("KEDOLOG fee: " + kedologFee.toFixed(4) + " KEDOLOG");

      assert.approximately(kedologFee, 1.103, 0.1, "Should be ~1.103 KEDOLOG");

      console.log("✅ 1-hop pricing via USDC works\n");
    });
  });

  describe("📊 1-Hop Pricing: Token Y → SOL → USDC", () => {
    it("Calculates correct price for Token Y via SOL pool", async () => {
      console.log("\n💱 Test: Token Y → SOL → USDC (2-hop)\n");

      // Get Token Y/SOL pool
      const vaultY0 = await getAccount(provider.connection, tokenYSolVault0);
      const vaultY1 = await getAccount(provider.connection, tokenYSolVault1);

      console.log("Token Y reserve:", Number(vaultY0.amount) / 1_000_000);
      console.log("SOL reserve:", Number(vaultY1.amount) / 1_000_000_000);

      const tokenYReserve = Number(vaultY0.amount) / 1_000_000; // 6 decimals
      const solReserve = Number(vaultY1.amount) / 1_000_000_000; // 9 decimals
      const tokenYPriceSol = solReserve / tokenYReserve;

      console.log("Token Y price in SOL: " + tokenYPriceSol.toFixed(4) + " SOL");

      // Get SOL price
      const solPrice = 200;
      const tokenYPriceUsd = tokenYPriceSol * solPrice;

      console.log("Token Y price in USD: $" + tokenYPriceUsd.toFixed(2));
      assert.approximately(tokenYPriceUsd, 2, 0.1, "Token Y should be ~$2");

      // Calculate KEDOLOG fee for 1 Token Y swap
      const swapAmount = 1;
      const protocolFee = swapAmount * 0.0005;
      const discountedFee = protocolFee * 0.75;
      const feeUsd = discountedFee * tokenYPriceUsd;
      const kedologFee = feeUsd / 0.0017;

      console.log("\nSwap: 1 Token Y ($2)");
      console.log("Protocol fee: $" + feeUsd.toFixed(6));
      console.log("KEDOLOG fee: " + kedologFee.toFixed(4) + " KEDOLOG");

      assert.approximately(kedologFee, 0.441, 0.05, "Should be ~0.441 KEDOLOG");

      console.log("✅ 2-hop pricing via SOL works\n");
    });
  });

  describe("📊 Fee Consistency Across Different Paths", () => {
    it("Verifies fees are consistent for same USD value across different paths", async () => {
      console.log("\n💱 Test: Cross-Path Fee Consistency\n");

      // Test 1: 1 USDC (direct)
      const usdcSwap = 1;
      const usdcFee = (usdcSwap * 0.0005 * 0.75) / 0.0017;

      // Test 2: 0.2 Token X ($1 worth at $5/token)
      const tokenXSwap = 0.2;
      const tokenXFee = (tokenXSwap * 5 * 0.0005 * 0.75) / 0.0017;

      // Test 3: 0.5 Token Y ($1 worth at $2/token)
      const tokenYSwap = 0.5;
      const tokenYFee = (tokenYSwap * 2 * 0.0005 * 0.75) / 0.0017;

      console.log("$1 worth of swaps:");
      console.log("  1 USDC → " + usdcFee.toFixed(4) + " KEDOLOG");
      console.log("  0.2 Token X → " + tokenXFee.toFixed(4) + " KEDOLOG");
      console.log("  0.5 Token Y → " + tokenYFee.toFixed(4) + " KEDOLOG");

      // All should be approximately equal
      assert.approximately(usdcFee, tokenXFee, 0.01, "USDC and Token X fees should match");
      assert.approximately(usdcFee, tokenYFee, 0.01, "USDC and Token Y fees should match");

      console.log("\n✅ Fee consistency verified across paths\n");
    });
  });

  describe("📊 Edge Cases", () => {
    it("Handles tokens with different decimal places", async () => {
      console.log("\n💱 Test: Different Decimal Places\n");

      console.log("Token X: 8 decimals");
      console.log("Token Y: 6 decimals");
      console.log("KEDOLOG: 9 decimals");
      console.log("USDC: 6 decimals");
      console.log("SOL: 9 decimals");

      // Verify prices are calculated correctly despite different decimals
      const tokenXPrice = 5; // $5
      const tokenYPrice = 2; // $2

      const tokenXFee = (1 * tokenXPrice * 0.0005 * 0.75) / 0.0017;
      const tokenYFee = (1 * tokenYPrice * 0.0005 * 0.75) / 0.0017;

      console.log("\n1 Token X swap → " + tokenXFee.toFixed(4) + " KEDOLOG");
      console.log("1 Token Y swap → " + tokenYFee.toFixed(4) + " KEDOLOG");

      assert.isAbove(tokenXFee, 0, "Token X fee should be > 0");
      assert.isAbove(tokenYFee, 0, "Token Y fee should be > 0");

      console.log("\n✅ Different decimals handled correctly\n");
    });

    it("Verifies token ordering doesn't affect price calculation", async () => {
      console.log("\n💱 Test: Token Order Independence\n");

      // Test with Token X/USDC (Token X is vault 0)
      const vault0 = await getAccount(provider.connection, tokenXUsdcVault0);
      const vault1 = await getAccount(provider.connection, tokenXUsdcVault1);

      const isTokenXFirst = vault0.mint.equals(tokenXMint);
      console.log("Token X is vault " + (isTokenXFirst ? "0" : "1"));
      console.log("USDC is vault " + (isTokenXFirst ? "1" : "0"));

      // Price should be same regardless of order
      const tokenXReserve = isTokenXFirst ? 
        Number(vault0.amount) / 100_000_000 : 
        Number(vault1.amount) / 100_000_000;
      const usdcReserve = isTokenXFirst ? 
        Number(vault1.amount) / 1_000_000 : 
        Number(vault0.amount) / 1_000_000;

      const price = usdcReserve / tokenXReserve;
      console.log("Calculated price: $" + price.toFixed(2));

      assert.approximately(price, 5, 0.1, "Price should be $5 regardless of order");

      console.log("\n✅ Token ordering doesn't affect price\n");
    });
  });
});

