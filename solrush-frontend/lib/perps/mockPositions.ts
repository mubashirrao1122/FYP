'use client';

import type { PositionView } from '@/lib/perps/types';
import { getCurrentPrices, getMockMarketBySymbol } from './mockData';
import { computePnl, computeLiquidationPrice } from './compute';

// Storage keys
const POSITIONS_STORAGE_KEY = 'mock_perps_positions';
const BALANCE_STORAGE_KEY = 'mock_perps_balance';

const INITIAL_BALANCE = 10000; // $10,000 initial balance

// Get user's balance
export function getBalance(walletAddress: string | null): number {
    if (typeof window === 'undefined' || !walletAddress) return INITIAL_BALANCE;

    const key = `${BALANCE_STORAGE_KEY}_${walletAddress}`;
    const stored = localStorage.getItem(key);

    if (stored) {
        try {
            return parseFloat(stored);
        } catch {
            return INITIAL_BALANCE;
        }
    }

    // Initialize balance
    localStorage.setItem(key, INITIAL_BALANCE.toString());
    return INITIAL_BALANCE;
}

// Update user's balance
export function updateBalance(walletAddress: string, newBalance: number): void {
    if (typeof window === 'undefined') return;

    const key = `${BALANCE_STORAGE_KEY}_${walletAddress}`;
    localStorage.setItem(key, newBalance.toString());
}

// Get all positions for a wallet
export function getPositions(walletAddress: string | null): PositionView[] {
    if (typeof window === 'undefined' || !walletAddress) return [];

    const key = `${POSITIONS_STORAGE_KEY}_${walletAddress}`;
    const stored = localStorage.getItem(key);

    if (!stored) return [];

    try {
        const positions: PositionView[] = JSON.parse(stored);
        const currentPrices = getCurrentPrices();

        // Update mark prices and recalculate PnL
        return positions.map((position) => {
            const market = getMockMarketBySymbol(position.marketId);
            const markPrice = market?.markPrice || currentPrices[position.marketId] || position.markPrice;

            const updated: PositionView = {
                ...position,
                markPrice,
                pnl: null,
                liquidationPrice: null,
            };

            return {
                ...updated,
                pnl: computePnl(updated, markPrice),
                liquidationPrice: computeLiquidationPrice(updated, market?.maintenanceMarginBps || 500),
            };
        });
    } catch {
        return [];
    }
}

// Save positions
function savePositions(walletAddress: string, positions: PositionView[]): void {
    if (typeof window === 'undefined') return;

    const key = `${POSITIONS_STORAGE_KEY}_${walletAddress}`;
    localStorage.setItem(key, JSON.stringify(positions));
}

// Generate unique position ID
function generatePositionId(): string {
    return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Open a new position
export function openPosition(
    walletAddress: string,
    marketSymbol: string,
    side: 'long' | 'short',
    size: number,
    leverage: number,
    collateral: number
): { success: boolean; error?: string; positionId?: string } {
    if (typeof window === 'undefined') {
        return { success: false, error: 'Window not available' };
    }

    // Validate inputs
    if (size <= 0) {
        return { success: false, error: 'Size must be greater than 0' };
    }

    if (leverage < 1 || leverage > 20) {
        return { success: false, error: 'Leverage must be between 1 and 20' };
    }

    if (collateral <= 0) {
        return { success: false, error: 'Collateral must be greater than 0' };
    }

    // Check balance
    const balance = getBalance(walletAddress);
    if (balance < collateral) {
        return { success: false, error: `Insufficient balance. Available: $${balance.toFixed(2)}` };
    }

    // Get market
    const market = getMockMarketBySymbol(marketSymbol);
    if (!market) {
        return { success: false, error: 'Market not found' };
    }

    // Validate leverage
    if (market.maxLeverage && leverage > market.maxLeverage) {
        return { success: false, error: `Max leverage for this market is ${market.maxLeverage}x` };
    }

    // Calculate position value
    const positionValue = collateral * leverage;
    const marketPrice = market.markPrice ?? 0;
    if (positionValue < size * marketPrice * 0.9 || positionValue > size * marketPrice * 1.1) {
        return { success: false, error: 'Position value mismatch with size and price' };
    }

    // Create position
    const positionId = generatePositionId();
    const newPosition: PositionView = {
        id: positionId,
        marketId: marketSymbol,
        side,
        size,
        entryPrice: market.markPrice,
        markPrice: market.markPrice,
        pnl: 0,
        leverage,
        margin: collateral,
        liquidationPrice: null,
    };

    // Calculate liquidation price
    newPosition.liquidationPrice = computeLiquidationPrice(newPosition, market.maintenanceMarginBps);

    // Update positions
    const positions = getPositions(walletAddress);
    positions.push(newPosition);
    savePositions(walletAddress, positions);

    // Deduct collateral from balance
    updateBalance(walletAddress, balance - collateral);

    return { success: true, positionId };
}

// Close a position
export function closePosition(
    walletAddress: string,
    positionId: string
): { success: boolean; error?: string; pnl?: number } {
    if (typeof window === 'undefined') {
        return { success: false, error: 'Window not available' };
    }

    const positions = getPositions(walletAddress);
    const positionIndex = positions.findIndex((p) => p.id === positionId);

    if (positionIndex === -1) {
        return { success: false, error: 'Position not found' };
    }

    const position = positions[positionIndex];
    const pnl = position.pnl || 0;

    // Calculate final balance change
    const balanceChange = (position.margin || 0) + pnl;

    // Update balance
    const currentBalance = getBalance(walletAddress);
    updateBalance(walletAddress, currentBalance + balanceChange);

    // Remove position
    positions.splice(positionIndex, 1);
    savePositions(walletAddress, positions);

    return { success: true, pnl };
}

// Check for liquidations
export function checkLiquidations(walletAddress: string): string[] {
    if (typeof window === 'undefined') return [];

    const positions = getPositions(walletAddress);
    const liquidatedIds: string[] = [];

    positions.forEach((position) => {
        if (!position.liquidationPrice || !position.markPrice) return;

        const shouldLiquidate =
            (position.side === 'long' && position.markPrice <= position.liquidationPrice) ||
            (position.side === 'short' && position.markPrice >= position.liquidationPrice);

        if (shouldLiquidate) {
            liquidatedIds.push(position.id);
            // Close position with loss
            closePosition(walletAddress, position.id);
        }
    });

    return liquidatedIds;
}

// Reset all positions and balance
export function resetPositions(walletAddress: string): void {
    if (typeof window === 'undefined') return;

    const posKey = `${POSITIONS_STORAGE_KEY}_${walletAddress}`;
    const balKey = `${BALANCE_STORAGE_KEY}_${walletAddress}`;

    localStorage.removeItem(posKey);
    localStorage.setItem(balKey, INITIAL_BALANCE.toString());
}
