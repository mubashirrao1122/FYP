/**
 * Centralized Solana configuration constants.
 * All values are read from NEXT_PUBLIC_ env vars injected by start.sh from localnet-config.json.
 */

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? 'localnet';

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (NETWORK === 'mainnet'
    ? 'https://api.mainnet-beta.solana.com'
    : NETWORK === 'localnet'
    ? 'http://127.0.0.1:8899'
    : 'https://api.devnet.solana.com');

export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? '';

// Token mint addresses (synced from localnet-config.json via start.sh)
export const MINTS: Record<string, string> = {
  USDC: process.env.NEXT_PUBLIC_USDC_MINT ?? '',
  USDT: process.env.NEXT_PUBLIC_USDT_MINT ?? '',
  WETH: process.env.NEXT_PUBLIC_WETH_MINT ?? '',
  RUSH: process.env.NEXT_PUBLIC_RUSH_MINT ?? '',
};

// Token metadata for the UI
export const TOKEN_INFO: Record<
  string,
  { symbol: string; name: string; decimals: number; color: string }
> = {
  SOL:  { symbol: 'SOL',  name: 'Solana',           decimals: 9, color: '#9945FF' },
  USDC: { symbol: 'USDC', name: 'USD Coin',          decimals: 6, color: '#2775CA' },
  USDT: { symbol: 'USDT', name: 'Tether USD',        decimals: 6, color: '#26A17B' },
  WETH: { symbol: 'WETH', name: 'Wrapped Ethereum',  decimals: 8, color: '#627EEA' },
  RUSH: { symbol: 'RUSH', name: 'RUSH Token',        decimals: 6, color: '#00FFC2' },
};

export const SUPPORTED_TOKENS = Object.keys(TOKEN_INFO);

// Fee config (must match programs/solrush-dex/src/constants.rs)
export const FEE_NUMERATOR   = 3;    // 0.3%
export const FEE_DENOMINATOR = 1000;

// Individual named mint exports (used by perps/onchain.ts and other libs)
export const SOL_MINT  = null as null; // SOL is native, no mint address
export const USDC_MINT = MINTS.USDC;
export const USDT_MINT = MINTS.USDT;
export const WETH_MINT = MINTS.WETH;
export const RUSH_MINT = MINTS.RUSH;
