'use client';

import { useGlobalStore } from '@/components/providers/GlobalStoreProvider';

export const usePools = () => {
    const { pools } = useGlobalStore();

    return {
        pools: pools.data,
        loading: pools.loading,
        error: pools.error,
        isUsingMockData: pools.isUsingMockData,
        totalTVL: pools.totalTVL,
        totalVolume24h: pools.totalVolume24h,
        averageAPY: pools.averageAPY,
        refreshPools: pools.refreshPools,
        getPoolByAddress: pools.getPoolByAddress,
        getPoolByTokens: pools.getPoolByTokens,
    };
};
