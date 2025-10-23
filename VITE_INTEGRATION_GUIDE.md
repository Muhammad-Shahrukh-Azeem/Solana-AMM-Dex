# 🚀 Vite Frontend Integration Guide - Kedolik CP-Swap

Complete guide for integrating Kedolik CP-Swap into your Vite-based frontend application.

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Project Setup](#project-setup)
4. [Configuration](#configuration)
5. [Wallet Integration](#wallet-integration)
6. [Program Integration](#program-integration)
7. [Core Features](#core-features)
8. [Component Examples](#component-examples)
9. [Utilities & Helpers](#utilities--helpers)
10. [Error Handling](#error-handling)
11. [Testing](#testing)
12. [Best Practices](#best-practices)

---

## ✅ PREREQUISITES

### Required Knowledge
- React/Vue/Svelte (depending on your Vite setup)
- TypeScript basics
- Solana blockchain concepts
- Async/await patterns

### Your Deployed Addresses
```typescript
PROGRAM_ID: F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc
AMM_CONFIG: 3EUgq3MYni6ui7EWnQaDfRXdJTqYPN4GsFFYd1Nb7ab6
KEDOLOG_MINT: DhKDRUdDLeSGM8tQjsCF8vewTffPFZwi3voZunY7RNsW
WALLET: JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa
```

---

## 📦 INSTALLATION

### Step 1: Install Dependencies

```bash
cd your-vite-project

# Core Solana & Anchor packages
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token

# Wallet adapter (for connecting user wallets)
npm install @solana/wallet-adapter-base \
            @solana/wallet-adapter-react \
            @solana/wallet-adapter-react-ui \
            @solana/wallet-adapter-wallets

# Specific wallet adapters
npm install @solana/wallet-adapter-phantom \
            @solana/wallet-adapter-solflare \
            @solana/wallet-adapter-backpack

# Utilities
npm install bn.js buffer
```

### Step 2: Install Dev Dependencies

```bash
npm install --save-dev @types/bn.js
```

### Step 3: Configure Vite for Node Polyfills

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer',
      stream: 'stream-browserify',
      util: 'util',
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
        }),
        NodeModulesPolyfillPlugin(),
      ],
    },
  },
  build: {
    rollupOptions: {
      plugins: [rollupNodePolyFill()],
    },
  },
})
```

Install polyfill packages:

```bash
npm install --save-dev @esbuild-plugins/node-globals-polyfill \
                       @esbuild-plugins/node-modules-polyfill \
                       rollup-plugin-node-polyfills \
                       stream-browserify \
                       util \
                       buffer
```

---

## 🔧 PROJECT SETUP

### Step 1: Copy Required Files

```bash
# From your raydium-cp-swap project root
cp target/idl/kedolik_cp_swap.json your-vite-project/src/idl/
cp WEBSITE_CONFIG.ts your-vite-project/src/config/
cp devnet-addresses.json your-vite-project/src/config/
```

### Step 2: Create Project Structure

```
your-vite-project/
├── src/
│   ├── config/
│   │   ├── index.ts              # Main config file
│   │   ├── devnet-addresses.json # Deployed addresses
│   │   └── constants.ts          # Constants
│   ├── idl/
│   │   └── kedolik_cp_swap.json  # Program IDL
│   ├── hooks/
│   │   ├── useProgram.ts         # Program hook
│   │   ├── usePool.ts            # Pool operations hook
│   │   └── useSwap.ts            # Swap operations hook
│   ├── utils/
│   │   ├── solana.ts             # Solana utilities
│   │   ├── token.ts              # Token utilities
│   │   └── math.ts               # Math utilities
│   ├── contexts/
│   │   └── WalletProvider.tsx    # Wallet context
│   ├── components/
│   │   ├── CreatePool.tsx        # Pool creation component
│   │   ├── Swap.tsx              # Swap component
│   │   ├── AddLiquidity.tsx      # Add liquidity component
│   │   └── RemoveLiquidity.tsx   # Remove liquidity component
│   └── types/
│       └── index.ts              # TypeScript types
```

---

## ⚙️ CONFIGURATION

### `src/config/index.ts`

```typescript
import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

export const CLUSTER = 'devnet';
export const COMMITMENT = 'confirmed';

// Use custom RPC for better performance (optional)
export const RPC_ENDPOINT = 
  import.meta.env.VITE_RPC_ENDPOINT || 
  'https://api.devnet.solana.com';

// Create connection instance
export const connection = new Connection(RPC_ENDPOINT, COMMITMENT);

// ============================================================================
// PROGRAM CONFIGURATION
// ============================================================================

export const PROGRAM_ID = new PublicKey(
  'F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc'
);

export const AMM_CONFIG = new PublicKey(
  '3EUgq3MYni6ui7EWnQaDfRXdJTqYPN4GsFFYd1Nb7ab6'
);

export const KEDOLOG_MINT = new PublicKey(
  'DhKDRUdDLeSGM8tQjsCF8vewTffPFZwi3voZunY7RNsW'
);

// ============================================================================
// TEST TOKENS
// ============================================================================

export const TEST_TOKENS = {
  USDC: new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32'),
  SOL: new PublicKey('6xuEzd4YE3XRXWdSRKZ6V2LELkR6tocvPcnu18E8rwjv'),
  ETH: new PublicKey('CTHA8taNT2LgyQyj2xVD38nmnxTsCbAJ22Vsee4RvHF3'),
  BTC: new PublicKey('ErGy4n8vBRw2mscMgbZg5rf3SdyDdk11LsaXKG8JJsoa'),
};

// ============================================================================
// TOKEN METADATA
// ============================================================================

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export const TOKEN_INFO: Record<string, TokenInfo> = {
  [KEDOLOG_MINT.toString()]: {
    symbol: 'KEDOLOG',
    name: 'Kedolog Protocol Token',
    decimals: 9,
    logoURI: '/tokens/kedolog.png',
  },
  [TEST_TOKENS.USDC.toString()]: {
    symbol: 'USDC',
    name: 'USD Coin (Test)',
    decimals: 6,
    logoURI: '/tokens/usdc.png',
  },
  [TEST_TOKENS.SOL.toString()]: {
    symbol: 'SOL',
    name: 'Wrapped SOL (Test)',
    decimals: 9,
    logoURI: '/tokens/sol.png',
  },
  [TEST_TOKENS.ETH.toString()]: {
    symbol: 'ETH',
    name: 'Ethereum (Test)',
    decimals: 18,
    logoURI: '/tokens/eth.png',
  },
  [TEST_TOKENS.BTC.toString()]: {
    symbol: 'BTC',
    name: 'Bitcoin (Test)',
    decimals: 8,
    logoURI: '/tokens/btc.png',
  },
};

// ============================================================================
// FEE CONFIGURATION
// ============================================================================

export const TRADE_FEE_RATE = 100; // 1%
export const PROTOCOL_FEE_RATE = 10000; // 100%
export const PROTOCOL_TOKEN_DISCOUNT = 2000; // 20%

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTokenInfo(mintAddress: string): TokenInfo {
  return TOKEN_INFO[mintAddress] || {
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    decimals: 9,
  };
}

export function getExplorerUrl(
  address: string,
  type: 'address' | 'tx' = 'address'
): string {
  return `https://explorer.solana.com/${type}/${address}?cluster=${CLUSTER}`;
}
```

### `.env` File

Create `.env` in your project root:

```env
# Optional: Custom RPC endpoint
VITE_RPC_ENDPOINT=https://api.devnet.solana.com

# Optional: Enable debug logging
VITE_DEBUG=true
```

---

## 👛 WALLET INTEGRATION

### `src/contexts/WalletProvider.tsx`

```typescript
import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { RPC_ENDPOINT } from '../config';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  // Configure supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
```

### `src/App.tsx`

```typescript
import { WalletProvider } from './contexts/WalletProvider';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

function App() {
  return (
    <WalletProvider>
      <div className="app">
        <header>
          <h1>Kedolik CP-Swap</h1>
          <WalletMultiButton />
        </header>
        
        {/* Your components here */}
      </div>
    </WalletProvider>
  );
}

export default App;
```

---

## 🔌 PROGRAM INTEGRATION

### `src/hooks/useProgram.ts`

```typescript
import { useMemo } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PROGRAM_ID } from '../config';
import idl from '../idl/kedolik_cp_swap.json';

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );

    return new Program(idl as Idl, PROGRAM_ID, provider);
  }, [connection, wallet]);

  return { program, wallet };
}
```

### `src/utils/solana.ts`

```typescript
import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, AMM_CONFIG } from '../config';

/**
 * Derive pool address from token mints
 */
export function getPoolAddress(
  token0Mint: PublicKey,
  token1Mint: PublicKey
): [PublicKey, number] {
  // Ensure token0 < token1
  const [sortedToken0, sortedToken1] = 
    token0Mint.toBuffer().compare(token1Mint.toBuffer()) < 0
      ? [token0Mint, token1Mint]
      : [token1Mint, token0Mint];

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('pool'),
      AMM_CONFIG.toBuffer(),
      sortedToken0.toBuffer(),
      sortedToken1.toBuffer(),
    ],
    PROGRAM_ID
  );
}

/**
 * Derive authority address
 */
export function getAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_and_lp_mint_auth_seed')],
    PROGRAM_ID
  );
}

/**
 * Derive LP mint address
 */
export function getLpMintAddress(poolState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool_lp_mint'), poolState.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get associated token address
 */
export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
  return getAssociatedTokenAddressSync(mint, owner);
}
```

### `src/utils/token.ts`

```typescript
import BN from 'bn.js';

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(
  amount: BN | number | string,
  decimals: number
): string {
  const amountBN = new BN(amount.toString());
  const divisor = new BN(10).pow(new BN(decimals));
  
  const wholePart = amountBN.div(divisor);
  const fractionalPart = amountBN.mod(divisor);
  
  if (fractionalPart.isZero()) {
    return wholePart.toNumber().toLocaleString();
  }
  
  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
    
  return `${wholePart.toNumber().toLocaleString()}.${fractionalStr}`;
}

/**
 * Parse token amount from user input
 */
export function parseTokenAmount(amount: string, decimals: number): BN {
  const [whole = '0', fractional = ''] = amount.split('.');
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
  return new BN(whole + paddedFractional);
}

/**
 * Calculate price from reserves
 */
export function calculatePrice(
  reserve0: BN,
  reserve1: BN,
  decimals0: number,
  decimals1: number
): number {
  const reserve0Scaled = reserve0.toNumber() / Math.pow(10, decimals0);
  const reserve1Scaled = reserve1.toNumber() / Math.pow(10, decimals1);
  
  return reserve1Scaled / reserve0Scaled;
}
```

---

## 🎯 CORE FEATURES

### 1. Create Pool

### `src/hooks/usePool.ts`

```typescript
import { useCallback } from 'react';
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import BN from 'bn.js';
import { useProgram } from './useProgram';
import { AMM_CONFIG } from '../config';
import { getPoolAddress, getAuthority, getLpMintAddress } from '../utils/solana';

export function usePool() {
  const { program, wallet } = useProgram();

  const createPool = useCallback(
    async (
      token0Mint: PublicKey,
      token1Mint: PublicKey,
      initialPrice: BN,
      token0Amount: BN,
      token1Amount: BN
    ) => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      // Ensure token0 < token1
      const [sortedToken0, sortedToken1, sortedAmount0, sortedAmount1] =
        token0Mint.toBuffer().compare(token1Mint.toBuffer()) < 0
          ? [token0Mint, token1Mint, token0Amount, token1Amount]
          : [token1Mint, token0Mint, token1Amount, token0Amount];

      // Derive addresses
      const [poolState] = getPoolAddress(sortedToken0, sortedToken1);
      const [authority] = getAuthority();
      const [lpMint] = getLpMintAddress(poolState);

      // Get token accounts
      const creatorToken0 = getAssociatedTokenAddressSync(
        sortedToken0,
        wallet.publicKey
      );
      const creatorToken1 = getAssociatedTokenAddressSync(
        sortedToken1,
        wallet.publicKey
      );
      const creatorLpToken = getAssociatedTokenAddressSync(
        lpMint,
        wallet.publicKey
      );

      // Vault accounts
      const token0Vault = getAssociatedTokenAddressSync(sortedToken0, authority, true);
      const token1Vault = getAssociatedTokenAddressSync(sortedToken1, authority, true);

      // Create pool
      const tx = await program.methods
        .initialize(initialPrice, sortedAmount0, sortedAmount1)
        .accounts({
          creator: wallet.publicKey,
          ammConfig: AMM_CONFIG,
          authority,
          poolState,
          token0Mint: sortedToken0,
          token1Mint: sortedToken1,
          lpMint,
          creatorToken0,
          creatorToken1,
          creatorLpToken,
          token0Vault,
          token1Vault,
          token0Program: TOKEN_PROGRAM_ID,
          token1Program: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature: tx, poolAddress: poolState };
    },
    [program, wallet]
  );

  return { createPool };
}
```

### `src/components/CreatePool.tsx`

```typescript
import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { usePool } from '../hooks/usePool';
import { parseTokenAmount } from '../utils/token';
import { getExplorerUrl } from '../config';

export function CreatePool() {
  const { createPool } = usePool();
  const [token0Mint, setToken0Mint] = useState('');
  const [token1Mint, setToken1Mint] = useState('');
  const [token0Amount, setToken0Amount] = useState('');
  const [token1Amount, setToken1Amount] = useState('');
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState('');

  const handleCreatePool = async () => {
    try {
      setLoading(true);
      
      const token0 = new PublicKey(token0Mint);
      const token1 = new PublicKey(token1Mint);
      const amount0 = parseTokenAmount(token0Amount, 9); // Adjust decimals
      const amount1 = parseTokenAmount(token1Amount, 9);
      
      // Calculate initial price
      const initialPrice = amount1.mul(new BN(10).pow(new BN(9))).div(amount0);

      const result = await createPool(token0, token1, initialPrice, amount0, amount1);
      
      setSignature(result.signature);
      alert('Pool created successfully!');
    } catch (error) {
      console.error('Error creating pool:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-pool">
      <h2>Create Liquidity Pool</h2>
      
      <div className="form-group">
        <label>Token 0 Mint Address</label>
        <input
          type="text"
          value={token0Mint}
          onChange={(e) => setToken0Mint(e.target.value)}
          placeholder="Token 0 mint address"
        />
      </div>

      <div className="form-group">
        <label>Token 0 Amount</label>
        <input
          type="number"
          value={token0Amount}
          onChange={(e) => setToken0Amount(e.target.value)}
          placeholder="Amount"
        />
      </div>

      <div className="form-group">
        <label>Token 1 Mint Address</label>
        <input
          type="text"
          value={token1Mint}
          onChange={(e) => setToken1Mint(e.target.value)}
          placeholder="Token 1 mint address"
        />
      </div>

      <div className="form-group">
        <label>Token 1 Amount</label>
        <input
          type="number"
          value={token1Amount}
          onChange={(e) => setToken1Amount(e.target.value)}
          placeholder="Amount"
        />
      </div>

      <button onClick={handleCreatePool} disabled={loading}>
        {loading ? 'Creating...' : 'Create Pool'}
      </button>

      {signature && (
        <div className="success">
          <p>Transaction successful!</p>
          <a
            href={getExplorerUrl(signature, 'tx')}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Explorer
          </a>
        </div>
      )}
    </div>
  );
}
```

### 2. Swap Tokens

### `src/hooks/useSwap.ts`

```typescript
import { useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import BN from 'bn.js';
import { useProgram } from './useProgram';
import { getPoolAddress, getAuthority } from '../utils/solana';

export function useSwap() {
  const { program, wallet } = useProgram();

  const swap = useCallback(
    async (
      poolState: PublicKey,
      inputMint: PublicKey,
      outputMint: PublicKey,
      amountIn: BN,
      minimumAmountOut: BN
    ) => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const [authority] = getAuthority();

      // Get user token accounts
      const userInputToken = getAssociatedTokenAddressSync(
        inputMint,
        wallet.publicKey
      );
      const userOutputToken = getAssociatedTokenAddressSync(
        outputMint,
        wallet.publicKey
      );

      // Get vault accounts
      const inputVault = getAssociatedTokenAddressSync(inputMint, authority, true);
      const outputVault = getAssociatedTokenAddressSync(outputMint, authority, true);

      // Execute swap
      const tx = await program.methods
        .swapBaseInput(amountIn, minimumAmountOut)
        .accounts({
          payer: wallet.publicKey,
          authority,
          poolState,
          inputTokenAccount: userInputToken,
          outputTokenAccount: userOutputToken,
          inputVault,
          outputVault,
          inputTokenProgram: TOKEN_PROGRAM_ID,
          outputTokenProgram: TOKEN_PROGRAM_ID,
          inputTokenMint: inputMint,
          outputTokenMint: outputMint,
        })
        .rpc();

      return tx;
    },
    [program, wallet]
  );

  return { swap };
}
```

### `src/components/Swap.tsx`

```typescript
import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useSwap } from '../hooks/useSwap';
import { parseTokenAmount } from '../utils/token';
import { getExplorerUrl } from '../config';

export function Swap() {
  const { swap } = useSwap();
  const [poolAddress, setPoolAddress] = useState('');
  const [inputMint, setInputMint] = useState('');
  const [outputMint, setOutputMint] = useState('');
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState('1'); // 1% default
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState('');

  const handleSwap = async () => {
    try {
      setLoading(true);

      const pool = new PublicKey(poolAddress);
      const input = new PublicKey(inputMint);
      const output = new PublicKey(outputMint);
      const amount = parseTokenAmount(amountIn, 9); // Adjust decimals

      // Calculate minimum output with slippage
      const slippageBps = parseFloat(slippage) * 100;
      const minimumOut = amount
        .mul(new BN(10000 - slippageBps))
        .div(new BN(10000));

      const tx = await swap(pool, input, output, amount, minimumOut);

      setSignature(tx);
      alert('Swap successful!');
    } catch (error) {
      console.error('Error swapping:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap">
      <h2>Swap Tokens</h2>

      <div className="form-group">
        <label>Pool Address</label>
        <input
          type="text"
          value={poolAddress}
          onChange={(e) => setPoolAddress(e.target.value)}
          placeholder="Pool address"
        />
      </div>

      <div className="form-group">
        <label>Input Token Mint</label>
        <input
          type="text"
          value={inputMint}
          onChange={(e) => setInputMint(e.target.value)}
          placeholder="Input token mint"
        />
      </div>

      <div className="form-group">
        <label>Output Token Mint</label>
        <input
          type="text"
          value={outputMint}
          onChange={(e) => setOutputMint(e.target.value)}
          placeholder="Output token mint"
        />
      </div>

      <div className="form-group">
        <label>Amount to Swap</label>
        <input
          type="number"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="Amount"
        />
      </div>

      <div className="form-group">
        <label>Slippage Tolerance (%)</label>
        <input
          type="number"
          value={slippage}
          onChange={(e) => setSlippage(e.target.value)}
          placeholder="1"
          step="0.1"
        />
      </div>

      <button onClick={handleSwap} disabled={loading}>
        {loading ? 'Swapping...' : 'Swap'}
      </button>

      {signature && (
        <div className="success">
          <p>Swap successful!</p>
          <a
            href={getExplorerUrl(signature, 'tx')}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Explorer
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## 🛠️ UTILITIES & HELPERS

### `src/utils/math.ts`

```typescript
import BN from 'bn.js';

/**
 * Calculate output amount for constant product AMM
 * Formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
 */
export function calculateAmountOut(
  amountIn: BN,
  reserveIn: BN,
  reserveOut: BN,
  feeBps: number = 100 // 1% fee
): BN {
  // Apply fee
  const amountInWithFee = amountIn.mul(new BN(10000 - feeBps)).div(new BN(10000));
  
  // Calculate output
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.add(amountInWithFee);
  
  return numerator.div(denominator);
}

/**
 * Calculate price impact
 */
export function calculatePriceImpact(
  amountIn: BN,
  amountOut: BN,
  reserveIn: BN,
  reserveOut: BN
): number {
  const spotPrice = reserveOut.mul(new BN(1e9)).div(reserveIn);
  const executionPrice = amountOut.mul(new BN(1e9)).div(amountIn);
  
  const impact = spotPrice
    .sub(executionPrice)
    .mul(new BN(10000))
    .div(spotPrice);
    
  return impact.toNumber() / 100; // Return as percentage
}
```

---

## ⚠️ ERROR HANDLING

### `src/utils/errors.ts`

```typescript
export function parseAnchorError(error: any): string {
  // Anchor errors
  if (error.error?.errorMessage) {
    return error.error.errorMessage;
  }
  
  // Program errors
  if (error.logs) {
    const errorLog = error.logs.find((log: string) => 
      log.includes('Error')
    );
    if (errorLog) return errorLog;
  }
  
  // Generic errors
  if (error.message) {
    return error.message;
  }
  
  return 'Unknown error occurred';
}

export function handleTransactionError(error: any) {
  const message = parseAnchorError(error);
  console.error('Transaction error:', message);
  
  // Show user-friendly message
  if (message.includes('insufficient funds')) {
    return 'Insufficient funds for this transaction';
  }
  if (message.includes('slippage')) {
    return 'Slippage tolerance exceeded. Try increasing slippage.';
  }
  if (message.includes('Not approved')) {
    return 'Token approval required. Please approve the token first.';
  }
  
  return message;
}
```

---

## ✅ TESTING

### Test Connection

```typescript
// src/tests/connection.test.ts
import { connection } from '../config';

async function testConnection() {
  try {
    const version = await connection.getVersion();
    console.log('✅ Connected to Solana:', version);
    
    const slot = await connection.getSlot();
    console.log('✅ Current slot:', slot);
    
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error);
    return false;
  }
}

testConnection();
```

### Test Program

```typescript
// src/tests/program.test.ts
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { connection, PROGRAM_ID } from '../config';
import idl from '../idl/kedolik_cp_swap.json';

async function testProgram() {
  try {
    // Create a read-only provider
    const provider = new AnchorProvider(
      connection,
      {} as any,
      AnchorProvider.defaultOptions()
    );
    
    const program = new Program(idl as any, PROGRAM_ID, provider);
    
    console.log('✅ Program loaded:', program.programId.toString());
    
    // Fetch AMM config
    const config = await program.account.ammConfig.fetch(AMM_CONFIG);
    console.log('✅ AMM Config:', config);
    
    return true;
  } catch (error) {
    console.error('❌ Program test failed:', error);
    return false;
  }
}

testProgram();
```

---

## 🎯 BEST PRACTICES

### 1. Transaction Confirmation

```typescript
async function confirmTransaction(signature: string) {
  const latestBlockhash = await connection.getLatestBlockhash();
  
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
  
  return signature;
}
```

### 2. Token Account Creation

```typescript
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';

async function ensureTokenAccount(mint: PublicKey, owner: PublicKey) {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  
  // Check if account exists
  const accountInfo = await connection.getAccountInfo(ata);
  
  if (!accountInfo) {
    // Create instruction to create ATA
    const ix = createAssociatedTokenAccountInstruction(
      owner, // payer
      ata,   // account
      owner, // owner
      mint   // mint
    );
    
    return { ata, instruction: ix };
  }
  
  return { ata, instruction: null };
}
```

### 3. Slippage Protection

```typescript
function calculateMinimumOutput(
  expectedOutput: BN,
  slippageBps: number
): BN {
  return expectedOutput
    .mul(new BN(10000 - slippageBps))
    .div(new BN(10000));
}

// Usage
const slippage = 100; // 1%
const minOutput = calculateMinimumOutput(expectedOutput, slippage);
```

### 4. Loading States

```typescript
function useTransaction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const execute = async (fn: () => Promise<any>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fn();
      return result;
    } catch (err) {
      const message = handleTransactionError(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { loading, error, execute };
}
```

---

## 🚀 DEPLOYMENT

### Build for Production

```bash
# Build your Vite app
npm run build

# Preview build
npm run preview

# Deploy to your hosting (Vercel, Netlify, etc.)
```

### Environment Variables

```env
# Production .env
VITE_RPC_ENDPOINT=https://your-production-rpc.com
VITE_CLUSTER=devnet
```

---

## 📚 ADDITIONAL RESOURCES

**Documentation:**
- Solana Web3.js: https://solana-labs.github.io/solana-web3.js/
- Anchor: https://www.anchor-lang.com/
- SPL Token: https://spl.solana.com/token

**Your Deployment:**
- Program: `F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc`
- AMM Config: `3EUgq3MYni6ui7EWnQaDfRXdJTqYPN4GsFFYd1Nb7ab6`
- KEDOLOG: `DhKDRUdDLeSGM8tQjsCF8vewTffPFZwi3voZunY7RNsW`

**Support Files:**
- `DEPLOYMENT_SUMMARY.md` - Complete deployment details
- `devnet-addresses.json` - All addresses in JSON format
- `WEBSITE_CONFIG.ts` - Ready-to-use config file

---

**You're ready to integrate!** 🎉

Start with wallet connection, then implement pool creation and swaps.

Last Updated: October 22, 2025

