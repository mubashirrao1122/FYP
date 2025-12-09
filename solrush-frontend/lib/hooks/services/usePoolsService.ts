'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { getReadOnlyProgram, fromBN } from '../../anchor/setup';
import { TOKEN_DECIMALS, getTokenSymbol } from '../../constants';
import { getTokenPrice, calculatePoolTVL } from '../../services/priceService';

export interface Pool {
    id: string;
    name: string;
    address: string;
    tokens: [string, string];
    tokenAMint: string;
    tokenBMint: string;
    tokenAVault: string;
    tokenBVault: string;
    lpMint: string;
    reserveA: number;
    reserveB: number;
    formattedReserveA: string;
    formattedReserveB: string;
    tvl: number;
    apy: number;
    fee: number;
    volume24h: number;
    authority: string;
    tokenADecimals: number;
    tokenBDecimals: number;
    totalLPSupply: number;
}

/**
 * Custom hook to fetch all liquidity pools from the blockchain
 * No mock data fallback - shows actual blockchain state
 */
export const usePoolsService = () => {
    const { connection } = useConnection();
    const [pools, setPools] = useState<Pool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUsingMockData] = useState(false); // Always false now - no mock data

    /**
     * Fetch all pools from the blockchain
     */
    const fetchPools = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const program = getReadOnlyProgram(connection);

            if (!program) {
                setError('Program not available. Check network connection and program deployment.');
                setPools([]);
                return;
            }

            // Fetch all LiquidityPool accounts from the blockchain
            const poolAccounts = await (program.account as any).liquidityPool.all();

            if (poolAccounts.length === 0) {
                // Empty state is not an error - just no pools initialized yet
                setPools([]);
                return;
            }

            // Transform blockchain data to our Pool interface
            const transformedPools: Pool[] = await Promise.all(
                poolAccounts.map(async (account: any) => {
                    const poolData = account.account;
                    const poolAddress = account.publicKey.toBase58();

                    // Get token symbols from mints
                    const tokenAMint = (poolData.tokenAMint as PublicKey).toBase58();
                    const tokenBMint = (poolData.tokenBMint as PublicKey).toBase58();
                    const tokenASymbol = getTokenSymbol(tokenAMint) || 'TOKEN_A';
                    const tokenBSymbol = getTokenSymbol(tokenBMint) || 'TOKEN_B';

                    // Get decimals for proper conversion
                    const decimalsA = TOKEN_DECIMALS[tokenASymbol] || 9;
                    const decimalsB = TOKEN_DECIMALS[tokenBSymbol] || 6;

                    // FIXED: Use correct field names matching IDL (reserve_a→reserveA, reserve_b→reserveB)
                    const reserveA = fromBN(poolData.reserveA as BN, decimalsA);
                    const reserveB = fromBN(poolData.reserveB as BN, decimalsB);

                    // Format reserves for display
                    const formattedReserveA = reserveA.toLocaleString(undefined, {
                        maximumFractionDigits: decimalsA > 6 ? 4 : 2
                    });
                    const formattedReserveB = reserveB.toLocaleString(undefined, {
                        maximumFractionDigits: decimalsB > 6 ? 4 : 2
                    });

                    // FIXED: Calculate TVL using real prices
                    const tvl = await calculatePoolTVL(
                        tokenASymbol,
                        reserveA,
                        tokenBSymbol,
                        reserveB
                    );

                    // Get fee from numerator/denominator
                    let feePercent = 0.3; // Default 0.3%
                    if (poolData.feeNumerator && poolData.feeDenominator) {
                        const feeNum = (poolData.feeNumerator as BN).toNumber();
                        const feeDenom = (poolData.feeDenominator as BN).toNumber();
                        feePercent = (feeNum / feeDenom) * 100;
                    }

                    // Get total LP supply
                    const totalLPSupply = poolData.totalLpSupply
                        ? fromBN(poolData.totalLpSupply as BN, 6)
                        : Math.sqrt(reserveA * reserveB);

                    // FIXED: Calculate APY based on actual fee structure
                    // This is still an estimate - real APY should come from historical data
                    // APY = (daily_fees * 365 / TVL) * 100
                    // Assuming average daily volume is ~5% of TVL
                    const estimatedDailyVolumePercent = 5; // 5% of TVL
                    const estimatedDailyVolume = tvl * (estimatedDailyVolumePercent / 100);
                    const dailyFees = estimatedDailyVolume * (feePercent / 100);
                    const apy = tvl > 0 ? ((dailyFees * 365) / tvl) * 100 : 0;

                    return {
                        id: `${tokenASymbol.toLowerCase()}-${tokenBSymbol.toLowerCase()}`,
                        name: poolData.name || `${tokenASymbol}/${tokenBSymbol}`,
                        address: poolAddress,
                        tokens: [tokenASymbol, tokenBSymbol] as [string, string],
                        tokenAMint,
                        tokenBMint,
                        tokenAVault: (poolData.tokenAVault as PublicKey)?.toBase58() || '',
                        tokenBVault: (poolData.tokenBVault as PublicKey)?.toBase58() || '',
                        lpMint: (poolData.lpTokenMint as PublicKey)?.toBase58() || '',
                        reserveA,
                        reserveB,
                        formattedReserveA,
                        formattedReserveB,
                        tvl,
                        apy: Math.round(apy * 100) / 100,
                        fee: feePercent,
                        volume24h: estimatedDailyVolume,
                        authority: (poolData.authority as PublicKey)?.toBase58() || '',
                        tokenADecimals: decimalsA,
                        tokenBDecimals: decimalsB,
                        totalLPSupply,
                    };
                })
            );

            setPools(transformedPools);
        } catch (err: any) {
            console.error('Failed to fetch pools:', err);
            setError(err.message || 'Failed to fetch pools from blockchain');
            setPools([]);
        } finally {
            setLoading(false);
        }
    }, [connection]);

    /**
     * Refresh pools data
     */
    const refreshPools = useCallback(() => {
        fetchPools();
    }, [fetchPools]);

    /**
     * Get a specific pool by address
     */
    const getPoolByAddress = useCallback((address: string): Pool | undefined => {
        return pools.find(pool => pool.address === address);
    }, [pools]);

    /**
     * Get a specific pool by token pair
     */
    const getPoolByTokens = useCallback((tokenA: string, tokenB: string): Pool | undefined => {
        return pools.find(pool =>
            (pool.tokens[0] === tokenA && pool.tokens[1] === tokenB) ||
            (pool.tokens[0] === tokenB && pool.tokens[1] === tokenA)
        );
    }, [pools]);

    // Fetch pools on mount
    useEffect(() => {
        fetchPools();
    }, [fetchPools]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchPools();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchPools]);

    // Calculate aggregate stats
    const totalTVL = pools.reduce((sum, pool) => sum + pool.tvl, 0);
    const totalVolume24h = pools.reduce((sum, pool) => sum + pool.volume24h, 0);
    const averageAPY = pools.length > 0
        ? pools.reduce((sum, pool) => sum + pool.apy, 0) / pools.length
        : 0;

    return {
        pools,
        loading,
        error,
        isUsingMockData,
        totalTVL,
        totalVolume24h,
        averageAPY,
        refreshPools,
        getPoolByAddress,
        getPoolByTokens,
    };
};
