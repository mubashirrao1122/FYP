'use client';

/**
 * Price Service - Real-time token price fetching
 * 
 * Features:
 * - CoinGecko API (primary source)
 * - Jupiter API (fallback for Solana tokens)
 * - 30-second caching
 * - Rate limiting (50 req/min for CoinGecko free tier)
 * - Devnet fallback prices
 * - Graceful error handling
 */

import { TOKENS } from '../constants';

interface PriceData {
    price: number;
    change24h: number;
    lastUpdated: number;
}

interface PriceCache {
    [symbol: string]: PriceData;
}

// Cache prices for 30 seconds
const CACHE_DURATION = 30 * 1000;
const priceCache: PriceCache = {};

// Rate limiting for CoinGecko (50 requests per minute on free tier)
let requestCount = 0;
let resetTime = Date.now() + 60000;

// CoinGecko token IDs
const COINGECKO_IDS: Record<string, string> = {
    SOL: 'solana',
    USDC: 'usd-coin',
    USDT: 'tether',
    WETH: 'weth',
    ETH: 'ethereum',
    BTC: 'bitcoin',
};

// Fallback prices for devnet/testing
const FALLBACK_PRICES: Record<string, number> = {
    SOL: 100,
    USDC: 1,
    USDT: 1,
    WETH: 2500,
    ETH: 2500,
    BTC: 45000,
    RUSH: 0.1,
};

/**
 * Check if we're on devnet
 */
function isDevnet(): boolean {
    const network = process.env.NEXT_PUBLIC_NETWORK;
    return network === 'devnet' || network === 'localnet' || !network;
}

/**
 * Rate limiting check for CoinGecko API
 */
function canMakeRequest(): boolean {
    const now = Date.now();

    // Reset counter every minute
    if (now > resetTime) {
        requestCount = 0;
        resetTime = now + 60000;
    }

    // Check if we've hit the limit
    if (requestCount >= 50) {
        console.warn('CoinGecko rate limit reached, using cached/fallback prices');
        return false;
    }

    requestCount++;
    return true;
}

/**
 * Fetch price from CoinGecko API
 */
async function fetchFromCoinGecko(symbol: string): Promise<PriceData | null> {
    const id = COINGECKO_IDS[symbol.toUpperCase()];
    if (!id) {
        return null;
    }

    if (!canMakeRequest()) {
        return null;
    }

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
            {
                headers: {
                    'Accept': 'application/json',
                },
                // Don't cache in Next.js, we handle our own caching
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko HTTP ${response.status}`);
        }

        const data = await response.json();
        const tokenData = data[id];

        if (!tokenData || !tokenData.usd) {
            return null;
        }

        return {
            price: tokenData.usd,
            change24h: tokenData.usd_24h_change || 0,
            lastUpdated: Date.now(),
        };
    } catch (error) {
        console.warn(`CoinGecko fetch failed for ${symbol}:`, error);
        return null;
    }
}

/**
 * Fetch price from Jupiter API (Solana-specific tokens)
 */
async function fetchFromJupiter(symbol: string): Promise<PriceData | null> {
    try {
        // Get mint address for the symbol
        const upperSymbol = symbol.toUpperCase() as keyof typeof TOKENS;
        const mint = TOKENS[upperSymbol];

        if (!mint) {
            return null;
        }

        const response = await fetch(
            `https://price.jup.ag/v4/price?ids=${mint.toBase58()}`,
            {
                headers: {
                    'Accept': 'application/json',
                },
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            throw new Error(`Jupiter HTTP ${response.status}`);
        }

        const data = await response.json();
        const priceData = data.data?.[mint.toBase58()];

        if (!priceData || !priceData.price) {
            return null;
        }

        return {
            price: priceData.price,
            change24h: 0, // Jupiter doesn't provide 24h change
            lastUpdated: Date.now(),
        };
    } catch (error) {
        console.warn(`Jupiter fetch failed for ${symbol}:`, error);
        return null;
    }
}

/**
 * Get token price (returns just the price number)
 * 
 * Priority:
 * 1. Cached price (if fresh)
 * 2. CoinGecko API
 * 3. Jupiter API (for Solana tokens)
 * 4. Fallback price
 */
export async function getTokenPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();

    // On devnet, always use fallback prices
    if (isDevnet()) {
        return FALLBACK_PRICES[upperSymbol] || 1;
    }

    // Check cache first
    const cached = priceCache[upperSymbol];
    if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION) {
        return cached.price;
    }

    // Try CoinGecko first
    let priceData = await fetchFromCoinGecko(upperSymbol);

    // Fallback to Jupiter for Solana tokens not on CoinGecko
    if (!priceData && upperSymbol !== 'USDC' && upperSymbol !== 'USDT') {
        priceData = await fetchFromJupiter(upperSymbol);
    }

    // Use fallback if all APIs fail
    if (!priceData) {
        console.warn(`Using fallback price for ${upperSymbol}`);
        return FALLBACK_PRICES[upperSymbol] || 1;
    }

    // Cache the successful result
    priceCache[upperSymbol] = priceData;

    return priceData.price;
}

/**
 * Get token price with 24h change percentage
 */
export async function getTokenPriceWithChange(
    symbol: string
): Promise<{ price: number; change24h: number; isDevnet: boolean }> {
    const upperSymbol = symbol.toUpperCase();

    // On devnet, return fallback
    if (isDevnet()) {
        return {
            price: FALLBACK_PRICES[upperSymbol] || 1,
            change24h: 0,
            isDevnet: true,
        };
    }

    // Check cache
    const cached = priceCache[upperSymbol];
    if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION) {
        return {
            price: cached.price,
            change24h: cached.change24h,
            isDevnet: false,
        };
    }

    // Fetch new data
    let priceData = await fetchFromCoinGecko(upperSymbol);

    if (!priceData) {
        priceData = await fetchFromJupiter(upperSymbol);
    }

    if (!priceData) {
        return {
            price: FALLBACK_PRICES[upperSymbol] || 1,
            change24h: 0,
            isDevnet: false,
        };
    }

    priceCache[upperSymbol] = priceData;

    return {
        price: priceData.price,
        change24h: priceData.change24h,
        isDevnet: false,
    };
}

/**
 * Get multiple token prices in one call
 */
export async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    // Fetch prices in parallel
    await Promise.all(
        symbols.map(async (symbol) => {
            prices[symbol.toUpperCase()] = await getTokenPrice(symbol);
        })
    );

    return prices;
}

/**
 * Calculate pool TVL (Total Value Locked)
 */
export async function calculatePoolTVL(
    tokenASymbol: string,
    tokenAReserve: number,
    tokenBSymbol: string,
    tokenBReserve: number
): Promise<number> {
    const [priceA, priceB] = await Promise.all([
        getTokenPrice(tokenASymbol),
        getTokenPrice(tokenBSymbol),
    ]);

    return tokenAReserve * priceA + tokenBReserve * priceB;
}

/**
 * Hook-friendly price service export
 */
export function usePriceService() {
    return {
        getTokenPrice,
        getTokenPriceWithChange,
        getTokenPrices,
        calculatePoolTVL,
        FALLBACK_PRICES,
        isDevnet: isDevnet(),
    };
}
