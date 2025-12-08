'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from '@project-serum/anchor';
import { getReadOnlyProgram, fromBN } from '../anchor/setup';
import { findPositionAddress } from '../anchor/pda';
import { TOKENS, TOKEN_DECIMALS, TOKEN_LIST, getTokenSymbol } from '../constants';
import { usePools } from './usePools';

export interface TokenHolding {
    symbol: string;
    name: string;
    mint: string;
    balance: number;
    decimals: number;
    usdValue: number;
    logoUri?: string;
}

export interface LiquidityPosition {
    poolAddress: string;
    poolName: string;
    lpBalance: number;
    tokenASymbol: string;
    tokenBSymbol: string;
    tokenAAmount: number;
    tokenBAmount: number;
    sharePercent: number;
    usdValue: number;
    pendingRewards: number;
}

export interface Transaction {
    signature: string;
    type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'claim_rewards' | 'transfer';
    timestamp: number;
    status: 'success' | 'failed' | 'pending';
    details: {
        tokenA?: string;
        tokenB?: string;
        amountA?: number;
        amountB?: number;
    };
}

export interface PortfolioData {
    totalValue: number;
    tokenHoldings: TokenHolding[];
    liquidityPositions: LiquidityPosition[];
    transactions: Transaction[];
}

/**
 * Custom hook for fetching real portfolio data from the blockchain
 */
export const usePortfolio = () => {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const { pools } = usePools();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [portfolio, setPortfolio] = useState<PortfolioData>({
        totalValue: 0,
        tokenHoldings: [],
        liquidityPositions: [],
        transactions: [],
    });

    /**
     * Fetch SOL balance
     */
    const fetchSolBalance = useCallback(async (): Promise<number> => {
        if (!publicKey) return 0;
        try {
            const balance = await connection.getBalance(publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (err) {
            console.error('Failed to fetch SOL balance:', err);
            return 0;
        }
    }, [connection, publicKey]);

    /**
     * Fetch SPL token balances
     */
    const fetchTokenBalances = useCallback(async (): Promise<TokenHolding[]> => {
        if (!publicKey) return [];

        const holdings: TokenHolding[] = [];

        try {
            // First add SOL balance
            const solBalance = await fetchSolBalance();

            // Fetch real SOL price from oracle
            const { oracleService } = await import('../services/oracleService');
            const solPrice = await oracleService.getTokenPrice('SOL');
            holdings.push({
                symbol: 'SOL',
                name: 'Solana',
                mint: TOKENS.SOL.toBase58(),
                balance: solBalance,
                decimals: 9,
                usdValue: solBalance * solPrice,
                logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
            });

            // Fetch all token accounts for this wallet
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                publicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            for (const { account } of tokenAccounts.value) {
                const parsedInfo = account.data.parsed.info;
                const mintAddress = parsedInfo.mint;
                const balance = parsedInfo.tokenAmount.uiAmount || 0;
                const decimals = parsedInfo.tokenAmount.decimals;

                // Skip zero balances
                if (balance === 0) continue;

                // Get token info
                const symbol = getTokenSymbol(mintAddress);
                const tokenInfo = TOKEN_LIST.find(t => t.mint.toBase58() === mintAddress);

                // Fetch real price from oracle
                const { oracleService } = await import('../services/oracleService');
                const tokenPrice = await oracleService.getTokenPrice(symbol || 'UNKNOWN', mintAddress);
                const usdValue = balance * tokenPrice;

                holdings.push({
                    symbol: symbol || 'UNKNOWN',
                    name: tokenInfo?.name || 'Unknown Token',
                    mint: mintAddress,
                    balance,
                    decimals,
                    usdValue,
                    logoUri: undefined,
                });
            }

            return holdings;
        } catch (err) {
            console.error('Failed to fetch token balances:', err);
            return holdings; // Return what we have (at least SOL)
        }
    }, [connection, publicKey, fetchSolBalance]);

    /**
     * Fetch liquidity positions from all pools
     */
    const fetchLiquidityPositions = useCallback(async (): Promise<LiquidityPosition[]> => {
        if (!publicKey || pools.length === 0) return [];

        const positions: LiquidityPosition[] = [];

        try {
            const program = getReadOnlyProgram(connection);
            if (!program) return [];

            for (const pool of pools) {
                try {
                    const poolPubkey = new PublicKey(pool.address);
                    const [positionPda] = findPositionAddress(poolPubkey, publicKey);

                    // Try to fetch user's position for this pool
                    const positionAccount = await program.account.userLiquidityPosition.fetch(positionPda);

                    if (positionAccount) {
                        const lpTokens = fromBN(positionAccount.lpTokens as BN, 6);

                        // Skip if no LP tokens
                        if (lpTokens === 0) continue;

                        // Calculate share percentage
                        const totalLp = pool.reserveA > 0 ? lpTokens / pool.reserveA : 0;
                        const sharePercent = totalLp * 100;

                        // Calculate token amounts based on share
                        const tokenAAmount = pool.reserveA * (sharePercent / 100);
                        const tokenBAmount = pool.reserveB * (sharePercent / 100);

                        // Calculate USD value using real prices
                        const { oracleService } = await import('../services/oracleService');
                        const priceA = await oracleService.getTokenPrice(pool.tokens[0]);
                        const priceB = await oracleService.getTokenPrice(pool.tokens[1]);
                        const usdValue = (tokenAAmount * priceA) + (tokenBAmount * priceB);

                        positions.push({
                            poolAddress: pool.address,
                            poolName: pool.name,
                            lpBalance: lpTokens,
                            tokenASymbol: pool.tokens[0],
                            tokenBSymbol: pool.tokens[1],
                            tokenAAmount,
                            tokenBAmount,
                            sharePercent,
                            usdValue,
                            pendingRewards: 0, // Calculated separately
                        });
                    }
                } catch (err) {
                    // Position doesn't exist for this pool, which is fine
                    continue;
                }
            }

            return positions;
        } catch (err) {
            console.error('Failed to fetch liquidity positions:', err);
            return [];
        }
    }, [connection, publicKey, pools]);

    /**
     * Fetch recent transactions
     */
    const fetchTransactions = useCallback(async (): Promise<Transaction[]> => {
        if (!publicKey) return [];

        try {
            const signatures = await connection.getSignaturesForAddress(
                publicKey,
                { limit: 20 }
            );

            const transactions: Transaction[] = signatures.map(sig => ({
                signature: sig.signature,
                type: 'transfer' as const, // Would need to parse tx to determine actual type
                timestamp: sig.blockTime || Date.now() / 1000,
                status: sig.err ? 'failed' : 'success',
                details: {},
            }));

            return transactions;
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
            return [];
        }
    }, [connection, publicKey]);

    /**
     * Fetch all portfolio data
     */
    const fetchPortfolio = useCallback(async () => {
        if (!publicKey) {
            setPortfolio({
                totalValue: 0,
                tokenHoldings: [],
                liquidityPositions: [],
                transactions: [],
            });
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [tokenHoldings, liquidityPositions, transactions] = await Promise.all([
                fetchTokenBalances(),
                fetchLiquidityPositions(),
                fetchTransactions(),
            ]);

            // Calculate total portfolio value
            const tokenValue = tokenHoldings.reduce((sum, t) => sum + t.usdValue, 0);
            const lpValue = liquidityPositions.reduce((sum, p) => sum + p.usdValue, 0);
            const totalValue = tokenValue + lpValue;

            setPortfolio({
                totalValue,
                tokenHoldings,
                liquidityPositions,
                transactions,
            });
        } catch (err: any) {
            console.error('Failed to fetch portfolio:', err);
            setError(err.message || 'Failed to fetch portfolio data');
        } finally {
            setLoading(false);
        }
    }, [publicKey, fetchTokenBalances, fetchLiquidityPositions, fetchTransactions]);

    /**
     * Refresh portfolio data
     */
    const refreshPortfolio = useCallback(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    // Fetch on mount and when wallet changes
    useEffect(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchPortfolio();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchPortfolio]);

    return {
        portfolio,
        loading,
        error,
        refreshPortfolio,
        tokenHoldings: portfolio.tokenHoldings,
        liquidityPositions: portfolio.liquidityPositions,
        transactions: portfolio.transactions,
        totalValue: portfolio.totalValue,
    };
};
