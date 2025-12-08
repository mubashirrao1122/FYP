import { Connection } from '@solana/web3.js';

/**
 * Token price cache entry
 */
interface PriceCacheEntry {
    price: number;
    timestamp: number;
}

/**
 * Price oracle service for fetching real-time token prices
 * Integrates with Jupiter Price API with fallback to cached values
 */
class OracleService {
    private priceCache: Map<string, PriceCacheEntry> = new Map();
    private readonly CACHE_TTL = 60000; // 60 seconds
    private readonly JUPITER_PRICE_API = 'https://price.jup.ag/v4/price';

    /**
     * Get token price in USD
     * @param symbol Token symbol (e.g., 'SOL', 'USDC')
     * @param tokenMint Optional token mint address for better accuracy
     * @returns Price in USD
     */
    async getTokenPrice(symbol: string, tokenMint?: string): Promise<number> {
        // Check cache first
        const cached = this.getCachedPrice(symbol);
        if (cached !== null) {
            return cached;
        }

        try {
            // Stablecoins always return 1
            if (symbol === 'USDC' || symbol === 'USDT' || symbol === 'USDS') {
                this.setCachePrice(symbol, 1);
                return 1;
            }

            // Try Jupiter Price API
            const price = await this.fetchFromJupiter(symbol, tokenMint);

            if (price > 0) {
                this.setCachePrice(symbol, price);
                return price;
            }

            // Fallback to default estimates
            return this.getFallbackPrice(symbol);
        } catch (error) {
            console.error(`Failed to fetch price for ${symbol}:`, error);

            // Return cached price even if expired, or fallback
            const expiredCache = this.priceCache.get(symbol);
            if (expiredCache) {
                console.warn(`Using expired cache for ${symbol}`);
                return expiredCache.price;
            }

            return this.getFallbackPrice(symbol);
        }
    }

    /**
     * Fetch batch prices for multiple tokens
     * @param tokens Array of token symbols or mint addresses
     * @returns Map of symbol/mint to price
     */
    async getBatchPrices(tokens: Array<{ symbol: string; mint?: string }>): Promise<Map<string, number>> {
        const prices = new Map<string, number>();

        // Process in parallel
        await Promise.all(
            tokens.map(async ({ symbol, mint }) => {
                const price = await this.getTokenPrice(symbol, mint);
                prices.set(symbol, price);
                if (mint) {
                    prices.set(mint, price);
                }
            })
        );

        return prices;
    }

    /**
     * Fetch price from Jupiter Price API
     */
    private async fetchFromJupiter(symbol: string, tokenMint?: string): Promise<number> {
        try {
            // Known Solana token mint addresses
            const KNOWN_MINTS: Record<string, string> = {
                'SOL': 'So11111111111111111111111111111111111111112',
                'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
                'SRM': 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
            };

            const mintToQuery = tokenMint || KNOWN_MINTS[symbol];

            if (!mintToQuery) {
                throw new Error(`No mint address for ${symbol}`);
            }

            const response = await fetch(`${this.JUPITER_PRICE_API}?ids=${mintToQuery}`);

            if (!response.ok) {
                throw new Error(`Jupiter API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.data && data.data[mintToQuery]) {
                return data.data[mintToQuery].price || 0;
            }

            return 0;
        } catch (error) {
            console.error('Jupiter API fetch failed:', error);
            return 0;
        }
    }

    /**
     * Get fallback price estimates when API is unavailable
     */
    private getFallbackPrice(symbol: string): number {
        const fallbacks: Record<string, number> = {
            'SOL': 100,
            'USDC': 1,
            'USDT': 1,
            'USDS': 1,
            'RAY': 0.5,
            'SRM': 0.1,
            'RUSH': 0.1,
        };

        return fallbacks[symbol] || 0.01; // Default to 1 cent if unknown
    }

    /**
     * Get cached price if not expired
     */
    private getCachedPrice(symbol: string): number | null {
        const cached = this.priceCache.get(symbol);

        if (!cached) {
            return null;
        }

        const now = Date.now();
        const age = now - cached.timestamp;

        if (age < this.CACHE_TTL) {
            return cached.price;
        }

        return null;
    }

    /**
     * Set price in cache
     */
    private setCachePrice(symbol: string, price: number): void {
        this.priceCache.set(symbol, {
            price,
            timestamp: Date.now(),
        });
    }

    /**
     * Clear all cached prices
     */
    clearCache(): void {
        this.priceCache.clear();
    }

    /**
     * Clear cache for specific token
     */
    clearTokenCache(symbol: string): void {
        this.priceCache.delete(symbol);
    }
}

// Singleton instance
export const oracleService = new OracleService();

// Export the class for testing
export { OracleService };
