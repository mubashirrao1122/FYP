import { PublicKey } from "@solana/web3.js";

// Network Configuration - Use environment variables
export const DEVNET_RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const MAINNET_RPC = process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com";

// Current Network
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "devnet";
export const RPC_ENDPOINT = NETWORK === "mainnet" ? MAINNET_RPC : DEVNET_RPC;

// Program ID
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "HCkVnLDL76FR8JJ9fbWg67kr48AtNqDgsivSt19Dnu9c"
);

// Token Mints (Devnet)
export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWaJY42sPiKrraxgS5g5Pab9BbAJtPREHtVb2nNB"
);
export const USDT_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDT_MINT || "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
);
export const WETH_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_WETH_MINT || "7vfCXTUXx5WJV5JAWYwqBo7dropjUiWDPvR8Ch3HfFPc"
);
export const RUSH_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_RUSH_MINT || "3jRmy5gMAQLFxb2mD3Gi4p9N9VuwLXp9toaqEhi1QSRT"
);

// Token Decimals
export const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  WETH: 8,
  RUSH: 6,
};

// Liquidity Pools Configuration
export const POOLS = {
  SOL_USDC: {
    name: "SOL/USDC",
    tokenA: SOL_MINT,
    tokenB: USDC_MINT,
  },
  SOL_USDT: {
    name: "SOL/USDT",
    tokenA: SOL_MINT,
    tokenB: USDT_MINT,
  },
  SOL_WETH: {
    name: "SOL/wETH",
    tokenA: SOL_MINT,
    tokenB: WETH_MINT,
  },
};

// Fee Configuration
export const SWAP_FEE_BP = 25; // 0.25% (25 basis points)
export const LP_REWARDS_PERCENTAGE = 80; // 80% of fees go to LPs

// Slippage Configuration
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
export const MAX_SLIPPAGE_BPS = 5000; // 50%

// Transaction Configuration
export const TX_DEADLINE_SECONDS = 300; // 5 minutes

// Explorer URLs
export const EXPLORER_BASE_URL = "https://explorer.solana.com";
export const EXPLORER_CLUSTER = NETWORK === "mainnet" ? "" : `?cluster=${NETWORK}`;

export const getExplorerTxUrl = (signature: string): string => {
  return `${EXPLORER_BASE_URL}/tx/${signature}${EXPLORER_CLUSTER}`;
};

export const getExplorerAccountUrl = (address: string): string => {
  return `${EXPLORER_BASE_URL}/address/${address}${EXPLORER_CLUSTER}`;
};

export const getExplorerBlockUrl = (block: number): string => {
  return `${EXPLORER_BASE_URL}/block/${block}${EXPLORER_CLUSTER}`;
};
