# 🌐 Website Integration Guide

## Overview
This guide shows how to integrate Kedolik CP-Swap into your website for creating pools and swapping tokens.

---

## Prerequisites

```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token @solana/wallet-adapter-react @solana/wallet-adapter-wallets
```

---

## Step 1: Setup Connection and Program

```typescript
// src/utils/solana.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import idl from "./idl/kedolik_cp_swap.json";

// Your deployed program ID (from devnet deployment)
export const PROGRAM_ID = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");

// Your AMM Config address (from init-devnet-config.ts)
export const AMM_CONFIG = new PublicKey("YOUR_AMM_CONFIG_ADDRESS");

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  if (!wallet.publicKey) return null;

  const provider = new AnchorProvider(
    connection,
    wallet as any,
    AnchorProvider.defaultOptions()
  );

  return new Program(idl as Idl, PROGRAM_ID, provider);
}
```

---

## Step 2: Create Pool Function

```typescript
// src/hooks/useCreatePool.ts
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { useProgram, AMM_CONFIG } from "../utils/solana";

export function useCreatePool() {
  const program = useProgram();

  async function createPool(
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    amountA: number,
    amountB: number,
    decimalsA: number,
    decimalsB: number
  ) {
    if (!program) throw new Error("Wallet not connected");

    // Convert amounts to base units
    const initAmountA = new BN(amountA * Math.pow(10, decimalsA));
    const initAmountB = new BN(amountB * Math.pow(10, decimalsB));

    // Derive pool address
    const [poolState] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        AMM_CONFIG.toBuffer(),
        tokenAMint.toBuffer(),
        tokenBMint.toBuffer(),
      ],
      program.programId
    );

    // Derive other PDAs
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_and_lp_mint_auth_seed")],
      program.programId
    );

    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_lp_mint"), poolState.toBuffer()],
      program.programId
    );

    const [vaultA] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolState.toBuffer(), tokenAMint.toBuffer()],
      program.programId
    );

    const [vaultB] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolState.toBuffer(), tokenBMint.toBuffer()],
      program.programId
    );

    const [observationState] = PublicKey.findProgramAddressSync(
      [Buffer.from("observation"), poolState.toBuffer()],
      program.programId
    );

    // User token accounts
    const userTokenA = getAssociatedTokenAddressSync(
      tokenAMint,
      program.provider.publicKey
    );

    const userTokenB = getAssociatedTokenAddressSync(
      tokenBMint,
      program.provider.publicKey
    );

    const userLpToken = getAssociatedTokenAddressSync(
      lpMint,
      program.provider.publicKey
    );

    // Create pool
    const tx = await program.methods
      .initialize(initAmountA, initAmountB, new BN(Date.now()))
      .accounts({
        creator: program.provider.publicKey,
        ammConfig: AMM_CONFIG,
        authority,
        poolState,
        token0Mint: tokenAMint,
        token1Mint: tokenBMint,
        lpMint,
        creatorToken0: userTokenA,
        creatorToken1: userTokenB,
        creatorLpToken: userLpToken,
        token0Vault: vaultA,
        token1Vault: vaultB,
        createPoolFee: program.provider.publicKey, // Fee receiver
        observationState,
        token0Program: TOKEN_PROGRAM_ID,
        token1Program: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SystemProgram.programId,
      })
      .rpc();

    return { poolAddress: poolState, txSignature: tx };
  }

  return { createPool };
}
```

---

## Step 3: Swap Function

```typescript
// src/hooks/useSwap.ts
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { useProgram, AMM_CONFIG } from "../utils/solana";

export function useSwap() {
  const program = useProgram();

  async function swap(
    poolAddress: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    minimumAmountOut: number,
    inputDecimals: number,
    outputDecimals: number
  ) {
    if (!program) throw new Error("Wallet not connected");

    // Convert to base units
    const amountInBN = new BN(amountIn * Math.pow(10, inputDecimals));
    const minAmountOutBN = new BN(minimumAmountOut * Math.pow(10, outputDecimals));

    // Derive PDAs
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_and_lp_mint_auth_seed")],
      program.programId
    );

    const [inputVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolAddress.toBuffer(), inputMint.toBuffer()],
      program.programId
    );

    const [outputVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolAddress.toBuffer(), outputMint.toBuffer()],
      program.programId
    );

    const [observationState] = PublicKey.findProgramAddressSync(
      [Buffer.from("observation"), poolAddress.toBuffer()],
      program.programId
    );

    // User token accounts
    const userInputToken = getAssociatedTokenAddressSync(
      inputMint,
      program.provider.publicKey
    );

    const userOutputToken = getAssociatedTokenAddressSync(
      outputMint,
      program.provider.publicKey
    );

    // Execute swap
    const tx = await program.methods
      .swapBaseInput(amountInBN, minAmountOutBN)
      .accounts({
        payer: program.provider.publicKey,
        authority,
        ammConfig: AMM_CONFIG,
        poolState: poolAddress,
        inputTokenAccount: userInputToken,
        outputTokenAccount: userOutputToken,
        inputVault,
        outputVault,
        inputTokenProgram: TOKEN_PROGRAM_ID,
        outputTokenProgram: TOKEN_PROGRAM_ID,
        inputTokenMint: inputMint,
        outputTokenMint: outputMint,
        observationState,
      })
      .rpc();

    return tx;
  }

  return { swap };
}
```

---

## Step 4: React Components

### Create Pool Component

```typescript
// src/components/CreatePool.tsx
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useCreatePool } from "../hooks/useCreatePool";

export function CreatePool() {
  const { createPool } = useCreatePool();
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreatePool() {
    try {
      setLoading(true);
      
      const result = await createPool(
        new PublicKey(tokenA),
        new PublicKey(tokenB),
        parseFloat(amountA),
        parseFloat(amountB),
        9, // decimals for token A
        6  // decimals for token B
      );

      alert(`Pool created! Address: ${result.poolAddress.toString()}`);
    } catch (error) {
      console.error(error);
      alert("Error creating pool");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-pool">
      <h2>Create Liquidity Pool</h2>
      
      <input
        type="text"
        placeholder="Token A Mint Address"
        value={tokenA}
        onChange={(e) => setTokenA(e.target.value)}
      />
      
      <input
        type="number"
        placeholder="Amount A"
        value={amountA}
        onChange={(e) => setAmountA(e.target.value)}
      />
      
      <input
        type="text"
        placeholder="Token B Mint Address"
        value={tokenB}
        onChange={(e) => setTokenB(e.target.value)}
      />
      
      <input
        type="number"
        placeholder="Amount B"
        value={amountB}
        onChange={(e) => setAmountB(e.target.value)}
      />
      
      <button onClick={handleCreatePool} disabled={loading}>
        {loading ? "Creating..." : "Create Pool"}
      </button>
    </div>
  );
}
```

### Swap Component

```typescript
// src/components/Swap.tsx
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useSwap } from "../hooks/useSwap";

export function Swap() {
  const { swap } = useSwap();
  const [poolAddress, setPoolAddress] = useState("");
  const [inputMint, setInputMint] = useState("");
  const [outputMint, setOutputMint] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [minAmountOut, setMinAmountOut] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSwap() {
    try {
      setLoading(true);
      
      const tx = await swap(
        new PublicKey(poolAddress),
        new PublicKey(inputMint),
        new PublicKey(outputMint),
        parseFloat(amountIn),
        parseFloat(minAmountOut),
        9, // input decimals
        6  // output decimals
      );

      alert(`Swap successful! TX: ${tx}`);
    } catch (error) {
      console.error(error);
      alert("Error swapping");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="swap">
      <h2>Swap Tokens</h2>
      
      <input
        type="text"
        placeholder="Pool Address"
        value={poolAddress}
        onChange={(e) => setPoolAddress(e.target.value)}
      />
      
      <input
        type="text"
        placeholder="Input Token Mint"
        value={inputMint}
        onChange={(e) => setInputMint(e.target.value)}
      />
      
      <input
        type="number"
        placeholder="Amount In"
        value={amountIn}
        onChange={(e) => setAmountIn(e.target.value)}
      />
      
      <input
        type="text"
        placeholder="Output Token Mint"
        value={outputMint}
        onChange={(e) => setOutputMint(e.target.value)}
      />
      
      <input
        type="number"
        placeholder="Minimum Amount Out"
        value={minAmountOut}
        onChange={(e) => setMinAmountOut(e.target.value)}
      />
      
      <button onClick={handleSwap} disabled={loading}>
        {loading ? "Swapping..." : "Swap"}
      </button>
    </div>
  );
}
```

---

## Step 5: App Setup

```typescript
// src/App.tsx
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { CreatePool } from "./components/CreatePool";
import { Swap } from "./components/Swap";

import "@solana/wallet-adapter-react-ui/styles.css";

export function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app">
            <header>
              <h1>Kedolik CP-Swap</h1>
              <WalletMultiButton />
            </header>
            
            <main>
              <CreatePool />
              <Swap />
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

---

## Step 6: Configuration File

```typescript
// src/config/devnet.ts
import { PublicKey } from "@solana/web3.js";

export const DEVNET_CONFIG = {
  programId: new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"),
  ammConfig: new PublicKey("YOUR_AMM_CONFIG_ADDRESS"),
  
  // Test tokens
  tokens: {
    usdc: {
      mint: new PublicKey("YOUR_USDC_MINT"),
      decimals: 6,
      symbol: "USDC",
    },
    sol: {
      mint: new PublicKey("YOUR_SOL_MINT"),
      decimals: 9,
      symbol: "SOL",
    },
    eth: {
      mint: new PublicKey("YOUR_ETH_MINT"),
      decimals: 18,
      symbol: "ETH",
    },
    btc: {
      mint: new PublicKey("YOUR_BTC_MINT"),
      decimals: 8,
      symbol: "BTC",
    },
  },
};
```

---

## 📚 Important Notes

1. **Copy IDL**: Copy `target/idl/kedolik_cp_swap.json` to your website project
2. **Update addresses**: Replace placeholder addresses with your deployed addresses
3. **Error handling**: Add proper error handling and user feedback
4. **Token decimals**: Always use correct decimals for each token
5. **Slippage**: Calculate `minimumAmountOut` with slippage tolerance

---

## 🔧 Testing

1. Connect wallet (Phantom on devnet)
2. Get devnet SOL from faucet
3. Create test token accounts
4. Create a pool
5. Try swapping

---

## Next Steps

- Add pool list/discovery
- Add price calculation
- Add slippage settings
- Add transaction history
- Add liquidity removal
- Deploy to mainnet when ready!

---

Good luck! 🚀


