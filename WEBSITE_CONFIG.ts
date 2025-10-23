/**
 * Kedolik CP-Swap Devnet Configuration
 * 
 * Copy this file to your website project and import the constants
 * 
 * Usage:
 *   import { PROGRAM_ID, AMM_CONFIG, KEDOLOG_MINT } from './config';
 */

import { PublicKey } from '@solana/web3.js';

// ============================================================================
// PROGRAM CONFIGURATION
// ============================================================================

/**
 * The deployed CP-Swap program ID on Devnet
 */
export const PROGRAM_ID = new PublicKey('F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc');

/**
 * The AMM configuration account address
 * This controls fee rates and other protocol parameters
 */
export const AMM_CONFIG = new PublicKey('3EUgq3MYni6ui7EWnQaDfRXdJTqYPN4GsFFYd1Nb7ab6');

/**
 * The KEDOLOG protocol token mint address
 * Users can pay fees with this token for a 20% discount
 */
export const KEDOLOG_MINT = new PublicKey('DhKDRUdDLeSGM8tQjsCF8vewTffPFZwi3voZunY7RNsW');

/**
 * Solana cluster to connect to
 */
export const CLUSTER = 'devnet';

/**
 * RPC endpoint URL
 * For production, consider using a dedicated RPC provider like Helius, QuickNode, or Alchemy
 */
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

// ============================================================================
// TEST TOKENS (for development)
// ============================================================================

export const TEST_TOKENS = {
  USDC: new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32'),
  SOL: new PublicKey('6xuEzd4YE3XRXWdSRKZ6V2LELkR6tocvPcnu18E8rwjv'),
  ETH: new PublicKey('CTHA8taNT2LgyQyj2xVD38nmnxTsCbAJ22Vsee4RvHF3'),
  BTC: new PublicKey('ErGy4n8vBRw2mscMgbZg5rf3SdyDdk11LsaXKG8JJsoa'),
};

// ============================================================================
// TOKEN METADATA (for UI display)
// ============================================================================

export const TOKEN_INFO = {
  [KEDOLOG_MINT.toString()]: {
    symbol: 'KEDOLOG',
    name: 'Kedolog Protocol Token',
    decimals: 9,
    logoURI: '/tokens/kedolog.png', // Update with your logo path
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

/**
 * Trade fee rate (1% = 100 basis points)
 */
export const TRADE_FEE_RATE = 100; // 1%

/**
 * Protocol fee rate (100% of trade fees go to protocol)
 */
export const PROTOCOL_FEE_RATE = 10000; // 100%

/**
 * Protocol token discount (20% discount when paying with KEDOLOG)
 */
export const PROTOCOL_TOKEN_DISCOUNT = 2000; // 20%

// ============================================================================
// EXPLORER LINKS
// ============================================================================

export const EXPLORER_BASE_URL = 'https://explorer.solana.com';

export function getExplorerUrl(address: string, type: 'address' | 'tx' = 'address'): string {
  return `${EXPLORER_BASE_URL}/${type}/${address}?cluster=${CLUSTER}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get token info by mint address
 */
export function getTokenInfo(mintAddress: string) {
  return TOKEN_INFO[mintAddress] || {
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    decimals: 9,
    logoURI: '/tokens/default.png',
  };
}

/**
 * Format token amount with correct decimals
 */
export function formatTokenAmount(amount: number | bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = Number(BigInt(amount) / divisor);
  const fractionalPart = Number(BigInt(amount) % divisor);
  
  if (fractionalPart === 0) {
    return wholePart.toLocaleString();
  }
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  return `${wholePart.toLocaleString()}.${fractionalStr}`;
}

/**
 * Parse token amount from user input
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fractional = ''] = amount.split('.');
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFractional);
}

