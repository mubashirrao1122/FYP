import { PublicKey } from "@solana/web3.js";

// TODO: Replace with actual devnet/mainnet mint addresses
export const TOKENS = {
    SOL: new PublicKey("So11111111111111111111111111111111111111112"),
    USDC: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // Devnet USDC
    USDT: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), // Devnet USDT
    RUSH: new PublicKey("11111111111111111111111111111111"), // Placeholder: System Program ID
};

export const getTokenMint = (symbol: string): PublicKey => {
    switch (symbol) {
        case 'SOL': return TOKENS.SOL;
        case 'USDC': return TOKENS.USDC;
        case 'USDT': return TOKENS.USDT;
        case 'RUSH': return TOKENS.RUSH;
        default: throw new Error(`Unknown token: ${symbol}`);
    }
};
