'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
import { getReadOnlyProgram, fromBN } from '../anchor/setup';
import { TOKEN_DECIMALS, getTokenSymbol } from '../constants';

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
    tvl: number;
    apy: number;
    fee: number;
    volume24h: number;
    authority: string;
}

// Fallback mock data when blockchain is unavailable
const getMockPools = (): Pool[] => [
    {
        id: 'sol-usdc',
        name: 'SOL/USDC',
        address: 'mock-pool-1',
        tokens: ['SOL', 'USDC'],
        tokenAMint: 'So11111111111111111111111111111111111111112',
        tokenBMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        tokenAVault: '',
        tokenBVault: '',
        lpMint: '',
        reserveA: 10000,
        reserveB: 1000000,
        tvl: 2000000,
        apy: 45,
        fee: 0.3,
        volume24h: 5000000,
        authority: '',
    },
    {
        id: 'sol-usdt',
        name: 'SOL/USDT',
        address: 'mock-pool-2',
        tokens: ['SOL', 'USDT'],
        tokenAMint: 'So11111111111111111111111111111111111111112',
        tokenBMint: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS',
        tokenAVault: '',
        tokenBVault: '',
        lpMint: '',
        reserveA: 5000,
        reserveB: 500000,
        tvl: 1000000,
        apy: 38,
        fee: 0.3,
        volume24h: 3000000,
        authority: '',
    },
];

/**
 * Custom hook to fetch all liquidity pools from the blockchain
 */
export const usePools = () => {
    const { connection } = useConnection();
    const [pools, setPools] = useState<Pool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUsingMockData, setIsUsingMockData] = useState(false);

    /**
     * Fetch all pools from the blockchain
     */
    const fetchPools = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const program = getReadOnlyProgram(connection);
            
            if (!program) {
                console.warn('Program not available, using mock data');
                setPools(getMockPools());
                setIsUsingMockData(true);
                return;
            }

            // Fetch all LiquidityPool accounts from the blockchain
            const poolAccounts = await program.account.liquidityPool.all();
            
            if (poolAccounts.length === 0) {
                console.warn('No pools found on chain, using mock data');
                setPools(getMockPools());
                setIsUsingMockData(true);
                return;
            }

            setIsUsingMockData(false);

            // Transform blockchain data to our Pool interface
            const transformedPools: Pool[] = await Promise.all(
                poolAccounts.map(async (account) => {
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

                    // Convert reserves from BN
                    const reserveA = fromBN(poolData.tokenAReserve as BN, decimalsA);
                    const reserveB = fromBN(poolData.tokenBReserve as BN, decimalsB);

                    // Calculate TVL (simplified - using mock SOL price for now)
                    const solPrice = 100; // TODO: Get real price from oracle
                    let tvl = 0;
                    if (tokenASymbol === 'SOL') {
                        tvl = reserveA * solPrice * 2; // Assume equal value
                    } else if (tokenBSymbol === 'SOL') {
                        tvl = reserveB * solPrice * 2;
                    } else {
                        // Stablecoin pair
                        tvl = reserveA + reserveB;
                    }

                    // Get fee from basis points (30 = 0.3%)
                    const feeBasisPoints = poolData.feeBasisPoints as number;
                    const fee = feeBasisPoints / 100;

                    // Calculate APY (simplified formula based on volume and fees)
                    // In production, this should come from historical data
                    const estimatedDailyVolume = tvl * 0.1; // Assume 10% daily volume
                    const dailyFees = estimatedDailyVolume * (fee / 100);
                    const apy = ((dailyFees * 365) / tvl) * 100;

                    return {
                        id: `${tokenASymbol.toLowerCase()}-${tokenBSymbol.toLowerCase()}`,
                        name: (poolData.name as string) || `${tokenASymbol}/${tokenBSymbol}`,
                        address: poolAddress,
                        tokens: [tokenASymbol, tokenBSymbol] as [string, string],
                        tokenAMint,
                        tokenBMint,
                        tokenAVault: (poolData.tokenAVault as PublicKey).toBase58(),
                        tokenBVault: (poolData.tokenBVault as PublicKey).toBase58(),
                        lpMint: (poolData.poolMint as PublicKey).toBase58(),
                        reserveA,
                        reserveB,
                        tvl,
                        apy: Math.round(apy * 100) / 100,
                        fee,
                        volume24h: estimatedDailyVolume, // TODO: Get real volume from indexer
                        authority: (poolData.authority as PublicKey).toBase58(),
                    };
                })
            );

            setPools(transformedPools);
            console.log(`Fetched ${transformedPools.length} pools from blockchain`);
        } catch (err: any) {
            console.error('Failed to fetch pools:', err);
            setError(err.message || 'Failed to fetch pools');
            // Fallback to mock data on error
            setPools(getMockPools());
            setIsUsingMockData(true);
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

    return {
        pools,
        loading,
        error,
        isUsingMockData,
        totalTVL,
        totalVolume24h,
        refreshPools,
        getPoolByAddress,
        getPoolByTokens,
    };
};
