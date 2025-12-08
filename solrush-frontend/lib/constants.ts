import { PublicKey } from "@solana/web3.js";

// Network Configuration - Use environment variables
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

// Network-specific RPC endpoints
const RPC_ENDPOINTS: Record<string, string> = {
    localnet: 'http://127.0.0.1:8899',
    devnet: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
    mainnet: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
};

export const CURRENT_NETWORK = NETWORK;
export const RPC_ENDPOINT = RPC_ENDPOINTS[NETWORK] || RPC_ENDPOINTS.devnet;

// Program ID
export const PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID || "HCkVnLDL76FR8JJ9fbWg67kr48AtNqDgsivSt19Dnu9c"
);

// Token Mints - Use environment variables for flexibility across networks
export const TOKENS: Record<string, PublicKey> = {
    SOL: new PublicKey("So11111111111111111111111111111111111111112"),
    USDC: new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
    USDT: new PublicKey(process.env.NEXT_PUBLIC_USDT_MINT || "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    WETH: new PublicKey(process.env.NEXT_PUBLIC_WETH_MINT || "7vfCXTUXx5WJV5JAWYwqBo7dropjUiWDPvR8Ch3HfFPc"),
    RUSH: new PublicKey(process.env.NEXT_PUBLIC_RUSH_MINT || "11111111111111111111111111111111"),
};

// Token Decimals
export const TOKEN_DECIMALS: Record<string, number> = {
    SOL: 9,
    USDC: 6,
    USDT: 6,
    RUSH: 6,
    WETH: 8,
};

// Token Info
export interface TokenInfo {
    symbol: string;
    name: string;
    mint: PublicKey;
    decimals: number;
    logoUri?: string;
}

export const TOKEN_LIST: TokenInfo[] = [
    { symbol: 'SOL', name: 'Solana', mint: TOKENS.SOL, decimals: 9 },
    { symbol: 'USDC', name: 'USD Coin', mint: TOKENS.USDC, decimals: 6 },
    { symbol: 'USDT', name: 'Tether USD', mint: TOKENS.USDT, decimals: 6 },
    { symbol: 'RUSH', name: 'Rush Token', mint: TOKENS.RUSH, decimals: 6 },
];

/**
 * Get token mint by symbol
 */
export const getTokenMint = (symbol: string): PublicKey => {
    const mint = TOKENS[symbol.toUpperCase()];
    if (!mint) {
        throw new Error(`Unknown token: ${symbol}`);
    }
    return mint;
};

/**
 * Get token symbol by mint address
 */
export const getTokenSymbol = (mintAddress: string): string | undefined => {
    for (const [symbol, mint] of Object.entries(TOKENS)) {
        if (mint.toBase58() === mintAddress) {
            return symbol;
        }
    }
    return undefined;
};

/**
 * Get token decimals by symbol
 */
export const getTokenDecimals = (symbol: string): number => {
    return TOKEN_DECIMALS[symbol.toUpperCase()] || 9;
};

/**
 * Get token info by symbol
 */
export const getTokenInfo = (symbol: string): TokenInfo | undefined => {
    return TOKEN_LIST.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
};

// Default slippage tolerance (in basis points)
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%

// Transaction deadline (in seconds)
export const DEFAULT_DEADLINE_SECONDS = 300; // 5 minutes
