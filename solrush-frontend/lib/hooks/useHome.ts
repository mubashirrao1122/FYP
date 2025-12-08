'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePools } from './usePools';

export interface DashboardStats {
    totalTVL: number;
    totalVolume24h: number;
    totalPools: number;
    topPools: Array<{
        id: string;
        name: string;
        tvl: number;
        apy: number;
        volume24h: number;
    }>;
}

export const useHome = () => {
    const router = useRouter();
    const { publicKey } = useWallet();
    const { pools, loading, error, isUsingMockData, totalTVL, totalVolume24h } = usePools();

    const handleLaunchApp = () => {
        router.push('/swap');
    };

    // Get top pools by TVL
    const topPools = [...pools]
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, 3)
        .map(pool => ({
            id: pool.id,
            name: pool.name,
            tvl: pool.tvl,
            apy: pool.apy,
            volume24h: pool.volume24h,
        }));

    // Dashboard stats derived from real pool data
    const stats: DashboardStats = {
        totalTVL,
        totalVolume24h,
        totalPools: pools.length,
        topPools,
    };

    // Format helpers
    const formatCurrency = (value: number): string => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(2)}K`;
        }
        return `$${value.toFixed(2)}`;
    };

    return {
        publicKey,
        handleLaunchApp,
        stats,
        pools,
        topPools,
        loading,
        error,
        isUsingMockData,
        formatCurrency,
    };
};
