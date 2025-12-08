'use client';

/**
 * Price Service - Fetches real-time token prices
 * Supports multiple price sources with fallback
 */

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

// CoinGecko IDs for tokens
const COINGECKO_IDS: Record<string, string> = {
    SOL: 'solana',
    USDC: 'usd-coin',
    USDT: 'tether',
    WETH: 'weth',
    ETH: 'ethereum',
    BTC: 'bitcoin',
};

// Fallback prices for localnet/testing
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
 * Fetch price from CoinGecko API
 */
async function fetchFromCoinGecko(symbol: string): Promise<number | null> {
    const id = COINGECKO_IDS[symbol.toUpperCase()];
    if (!id) return null;

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
            { next: { revalidate: 30 } }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        return data[id]?.usd || null;
    } catch (error) {
        console.warn(`Failed to fetch price from CoinGecko for ${symbol}:`, error);
        return null;
    }
}

/**
 * Fetch price from Jupiter API (Solana-specific)
 */
async function fetchFromJupiter(mintAddress: string): Promise<number | null> {
    try {
        const response = await fetch(
            `https://price.jup.ag/v4/price?ids=${mintAddress}`,
            { next: { revalidate: 30 } }
        );

        if (!response.ok) {
            throw new Error(`Jupiter API error: ${response.status}`);
        }

        const data = await response.json();
        return data.data?.[mintAddress]?.price || null;
    } catch (error) {
        console.warn(`Failed to fetch price from Jupiter:`, error);
        return null;
    }
}

/**
 * Get token price with caching and fallback
 */
export async function getTokenPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = priceCache[upperSymbol];
    if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION) {
        return cached.price;
    }

    // Stablecoins are always $1
    if (upperSymbol === 'USDC' || upperSymbol === 'USDT') {
        priceCache[upperSymbol] = {
            price: 1,
            change24h: 0,
            lastUpdated: Date.now(),
        };
        return 1;
    }

    // Try CoinGecko first
    let price = await fetchFromCoinGecko(upperSymbol);

    // Use fallback if API fails
    if (price === null) {
        price = FALLBACK_PRICES[upperSymbol] || 0;
        console.warn(`Using fallback price for ${upperSymbol}: $${price}`);
    }

    // Update cache
    priceCache[upperSymbol] = {
        price,
        change24h: 0,
        lastUpdated: Date.now(),
    };

    return price;
}

/**
 * Get multiple token prices at once
 */
export async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    await Promise.all(
        symbols.map(async (symbol) => {
            prices[symbol.toUpperCase()] = await getTokenPrice(symbol);
        })
    );

    return prices;
}

/**
 * Calculate TVL for a pool
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
 * Hook-friendly price fetcher
 */
export function usePriceService() {
    return {
        getTokenPrice,
        getTokenPrices,
        calculatePoolTVL,
        FALLBACK_PRICES,
    };
}
