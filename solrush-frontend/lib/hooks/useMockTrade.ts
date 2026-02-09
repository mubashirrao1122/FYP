'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { openPosition, closePosition } from '@/lib/perps/mockPositions';

interface TradeParams {
    market: string;
    side: 'long' | 'short';
    size: number;
    leverage: number;
    collateral: number;
}

interface UseMockTradeResult {
    executeTrade: (params: TradeParams) => Promise<string>;
    closePositionTrade: (positionId: string) => Promise<{ pnl: number }>;
    loading: boolean;
    error: string | null;
}

export function useMockTrade(): UseMockTradeResult {
    const { publicKey } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const executeTrade = useCallback(
        async (params: TradeParams): Promise<string> => {
            if (!publicKey) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            setError(null);

            try {
                // Simulate network delay
                await new Promise((resolve) => setTimeout(resolve, 500));

                const result = openPosition(
                    publicKey.toBase58(),
                    params.market,
                    params.side,
                    params.size,
                    params.leverage,
                    params.collateral
                );

                if (!result.success) {
                    throw new Error(result.error || 'Failed to open position');
                }

                // Generate fake transaction signature
                const signature = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                return signature;
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Trade execution failed';
                setError(errorMessage);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [publicKey]
    );

    const closePositionTrade = useCallback(
        async (positionId: string): Promise<{ pnl: number }> => {
            if (!publicKey) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            setError(null);

            try {
                // Simulate network delay
                await new Promise((resolve) => setTimeout(resolve, 500));

                const result = closePosition(publicKey.toBase58(), positionId);

                if (!result.success) {
                    throw new Error(result.error || 'Failed to close position');
                }

                return { pnl: result.pnl || 0 };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to close position';
                setError(errorMessage);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [publicKey]
    );

    return {
        executeTrade,
        closePositionTrade,
        loading,
        error,
    };
}
