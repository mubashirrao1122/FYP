'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getTokenMint, TOKEN_DECIMALS, TOKENS } from '../constants';

export interface TokenBalance {
    symbol: string;
    balance: number;
    uiBalance: string;
    mint: PublicKey;
    decimals: number;
}

/**
 * Hook to fetch and manage user token balances
 */
export function useBalance() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    
    const [balances, setBalances] = useState<Record<string, TokenBalance>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch SOL balance
     */
    const fetchSolBalance = useCallback(async (): Promise<number> => {
        if (!publicKey) return 0;
        
        try {
            const balance = await connection.getBalance(publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (err) {
            console.error("Failed to fetch SOL balance:", err);
            return 0;
        }
    }, [connection, publicKey]);

    /**
     * Fetch SPL token balance
     */
    const fetchTokenBalance = useCallback(async (symbol: string): Promise<number> => {
        if (!publicKey) return 0;
        
        try {
            const mint = getTokenMint(symbol);
            const tokenAccount = await getAssociatedTokenAddress(mint, publicKey);
            const balance = await connection.getTokenAccountBalance(tokenAccount);
            return parseFloat(balance.value.uiAmountString || '0');
        } catch (err) {
            // Token account doesn't exist
            return 0;
        }
    }, [connection, publicKey]);

    /**
     * Fetch all balances
     */
    const fetchAllBalances = useCallback(async () => {
        if (!publicKey) {
            setBalances({});
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const tokenSymbols = Object.keys(TOKENS);
            const balancePromises = tokenSymbols.map(async (symbol) => {
                const balance = symbol === 'SOL' 
                    ? await fetchSolBalance()
                    : await fetchTokenBalance(symbol);
                
                const decimals = TOKEN_DECIMALS[symbol] || 9;
                
                return {
                    symbol,
                    balance,
                    uiBalance: balance.toFixed(decimals > 6 ? 4 : 2),
                    mint: TOKENS[symbol],
                    decimals,
                };
            });

            const results = await Promise.all(balancePromises);
            
            const balanceMap: Record<string, TokenBalance> = {};
            results.forEach(result => {
                balanceMap[result.symbol] = result;
            });

            setBalances(balanceMap);
        } catch (err: any) {
            console.error("Failed to fetch balances:", err);
            setError(err.message || 'Failed to fetch balances');
        } finally {
            setLoading(false);
        }
    }, [publicKey, fetchSolBalance, fetchTokenBalance]);

    /**
     * Get balance for a specific token
     */
    const getBalance = useCallback((symbol: string): number => {
        return balances[symbol]?.balance || 0;
    }, [balances]);

    /**
     * Check if user has sufficient balance
     */
    const hasSufficientBalance = useCallback((symbol: string, amount: number): boolean => {
        const balance = getBalance(symbol);
        return balance >= amount;
    }, [getBalance]);

    /**
     * Refresh a specific token balance
     */
    const refreshBalance = useCallback(async (symbol: string) => {
        if (!publicKey) return;

        try {
            const balance = symbol === 'SOL'
                ? await fetchSolBalance()
                : await fetchTokenBalance(symbol);

            const decimals = TOKEN_DECIMALS[symbol] || 9;

            setBalances(prev => ({
                ...prev,
                [symbol]: {
                    symbol,
                    balance,
                    uiBalance: balance.toFixed(decimals > 6 ? 4 : 2),
                    mint: TOKENS[symbol],
                    decimals,
                },
            }));
        } catch (err) {
            console.error(`Failed to refresh ${symbol} balance:`, err);
        }
    }, [publicKey, fetchSolBalance, fetchTokenBalance]);

    // Fetch balances on mount and when wallet changes
    useEffect(() => {
        fetchAllBalances();
    }, [fetchAllBalances]);

    // Auto-refresh balances every 30 seconds
    useEffect(() => {
        if (!publicKey) return;

        const interval = setInterval(() => {
            fetchAllBalances();
        }, 30000);

        return () => clearInterval(interval);
    }, [publicKey, fetchAllBalances]);

    return {
        balances,
        loading,
        error,
        getBalance,
        hasSufficientBalance,
        refreshBalance,
        fetchAllBalances,
    };
}

export default useBalance;
