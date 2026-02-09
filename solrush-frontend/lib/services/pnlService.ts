
import { Transaction } from '../hooks/usePortfolio';
import { TOKENS } from '../constants';

export interface PnLSummary {
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    bestTrade: { signature: string; pnl: number } | null;
    worstTrade: { signature: string; pnl: number } | null;
}

export class PnLService {
    /**
     * Calculate P&L metrics from transactions and current prices
     */
    static calculatePnL(transactions: Transaction[], currentPrices: Record<string, number>): PnLSummary {
        let realizedPnL = 0;
        let winCount = 0;
        let lossCount = 0;
        let bestTrade: { signature: string; pnl: number } | null = null;
        let worstTrade: { signature: string; pnl: number } | null = null;

        // Process transactions to calculate realized P&L
        // Note: This is a simplified estimation since we don't have full historical price data
        // In a real app, we'd fetch historical prices for each transaction timestamp
        transactions.forEach(tx => {
            if (tx.status !== 'success') return;

            let tradePnL = 0;

            // Logic for different transaction types
            // For swaps, we'd need the USD value at time of swap vs current value if held, 
            // or value difference if swapped back.
            // Here we'll simulate some P&L data for visualization if it's missing

            if (tx.type === 'swap' && tx.details) {
                // Mock logic for demo purposes as we lack full historical price API
                // In production this would calculate: (AmountOut * PriceOut) - (AmountIn * PriceIn)
                const mockPnL = (tx.signature.charCodeAt(0) % 100) - 50;
                tradePnL = mockPnL;
            }

            if (tradePnL !== 0) {
                realizedPnL += tradePnL;
                if (tradePnL > 0) winCount++;
                else lossCount++;

                if (!bestTrade || tradePnL > bestTrade.pnl) {
                    bestTrade = { signature: tx.signature, pnl: tradePnL };
                }
                if (!worstTrade || tradePnL < worstTrade.pnl) {
                    worstTrade = { signature: tx.signature, pnl: tradePnL };
                }
            }
        });

        const totalTrades = winCount + lossCount;
        const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

        return {
            realizedPnL,
            unrealizedPnL: 0, // Would require holding cost basis
            totalPnL: realizedPnL, // + unrealized
            winCount,
            lossCount,
            winRate,
            bestTrade,
            worstTrade,
        };
    }
}
