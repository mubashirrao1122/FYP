'use client';

import type { MarketView } from '@/lib/perps/types';

// Mock market configuration
interface MockMarketConfig {
    symbol: string;
    baseSymbol: string;
    quoteSymbol: string;
    basePrice: number;
    volatility: number;
    fundingRateBps: number;
    maxLeverage: number;
}

const MOCK_MARKET_CONFIGS: MockMarketConfig[] = [
    {
        symbol: 'SOL-PERP',
        baseSymbol: 'SOL',
        quoteSymbol: 'USD',
        basePrice: 100,
        volatility: 0.02,
        fundingRateBps: 10,
        maxLeverage: 20,
    },
    {
        symbol: 'BTC-PERP',
        baseSymbol: 'BTC',
        quoteSymbol: 'USD',
        basePrice: 45000,
        volatility: 0.015,
        fundingRateBps: 8,
        maxLeverage: 15,
    },
    {
        symbol: 'ETH-PERP',
        baseSymbol: 'ETH',
        quoteSymbol: 'USD',
        basePrice: 2500,
        volatility: 0.018,
        fundingRateBps: 9,
        maxLeverage: 20,
    },
];

// Storage keys
const PRICE_STORAGE_KEY = 'mock_perps_prices';
const MARKET_STORAGE_KEY = 'mock_perps_markets';

// Helper to generate random normal distribution (Box-Muller transform)
function randomNormal(mean = 0, stdDev = 1): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
}

// Initialize or get current prices
function initializePrices(): Record<string, number> {
    if (typeof window === 'undefined') return {};

    const stored = localStorage.getItem(PRICE_STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            // Fall through to initialization
        }
    }

    // Initialize with base prices
    const prices: Record<string, number> = {};
    MOCK_MARKET_CONFIGS.forEach((config) => {
        prices[config.symbol] = config.basePrice;
    });
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(prices));
    return prices;
}

// Update price with random walk
export function updatePrice(currentPrice: number, volatility: number): number {
    const dt = 1; // 1 second time step
    const drift = 0; // No long-term trend
    const randomShock = randomNormal(0, 1);
    const change = drift * dt + volatility * Math.sqrt(dt) * randomShock;
    const newPrice = currentPrice * (1 + change);

    // Ensure price doesn't go negative or too extreme
    return Math.max(newPrice, currentPrice * 0.5);
}

// Update all prices
export function updateAllPrices(): Record<string, number> {
    if (typeof window === 'undefined') return {};

    const currentPrices = initializePrices();
    const updatedPrices: Record<string, number> = {};

    MOCK_MARKET_CONFIGS.forEach((config) => {
        const currentPrice = currentPrices[config.symbol] || config.basePrice;
        updatedPrices[config.symbol] = updatePrice(currentPrice, config.volatility);
    });

    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(updatedPrices));
    return updatedPrices;
}

// Get current prices
export function getCurrentPrices(): Record<string, number> {
    if (typeof window === 'undefined') {
        const prices: Record<string, number> = {};
        MOCK_MARKET_CONFIGS.forEach((config) => {
            prices[config.symbol] = config.basePrice;
        });
        return prices;
    }
    return initializePrices();
}

// Generate historical prices for charts
export function generateHistoricalPrices(
    symbol: string,
    periods: number = 100
): Array<{ time: number; price: number }> {
    const config = MOCK_MARKET_CONFIGS.find((c) => c.symbol === symbol);
    if (!config) return [];

    const currentPrice = getCurrentPrices()[symbol] || config.basePrice;
    const prices: Array<{ time: number; price: number }> = [];
    const now = Date.now();

    // Generate backwards from current price
    let price = currentPrice;
    for (let i = periods - 1; i >= 0; i--) {
        const timestamp = now - i * 60000; // 1 minute intervals
        prices.push({ time: timestamp, price });

        // Walk backwards with reverse random walk
        if (i > 0) {
            price = updatePrice(price, config.volatility);
        }
    }

    return prices;
}

// Calculate 24h change
function calculate24hChange(symbol: string): number {
    const currentPrice = getCurrentPrices()[symbol];
    const config = MOCK_MARKET_CONFIGS.find((c) => c.symbol === symbol);
    if (!currentPrice || !config) return 0;

    // Simulate a 24h change between -5% and +5%
    return (Math.random() - 0.5) * 10;
}

// Generate mock markets
export function getMockMarkets(): MarketView[] {
    const prices = getCurrentPrices();
    const now = Date.now();

    return MOCK_MARKET_CONFIGS.map((config, index) => {
        const markPrice = prices[config.symbol] || config.basePrice;
        const indexPrice = markPrice * (1 + (Math.random() - 0.5) * 0.001); // Slight difference

        return {
            id: `mock-market-${index}`,
            symbol: config.symbol,
            baseMint: `mock-${config.baseSymbol.toLowerCase()}-mint`,
            quoteMint: `mock-${config.quoteSymbol.toLowerCase()}-mint`,
            baseSymbol: config.baseSymbol,
            quoteSymbol: config.quoteSymbol,
            oraclePriceId: null,
            markPrice,
            indexPrice,
            fundingRate: config.fundingRateBps / 10000,
            openInterest: Math.random() * 1000000 + 500000, // Random OI between 500k-1.5M
            volume24h: Math.random() * 5000000 + 1000000, // Random volume 1M-6M
            change24h: calculate24hChange(config.symbol),
            borrowRate: null,
            maxLeverage: config.maxLeverage,
            maintenanceMarginBps: 500, // 5% maintenance margin
            lastUpdated: now,
        };
    });
}

// Reset prices to base values
export function resetPrices(): void {
    if (typeof window === 'undefined') return;

    const prices: Record<string, number> = {};
    MOCK_MARKET_CONFIGS.forEach((config) => {
        prices[config.symbol] = config.basePrice;
    });
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(prices));
}

// Get market by symbol
export function getMockMarketBySymbol(symbol: string): MarketView | null {
    const markets = getMockMarkets();
    return markets.find((m) => m.symbol === symbol) || null;
}
