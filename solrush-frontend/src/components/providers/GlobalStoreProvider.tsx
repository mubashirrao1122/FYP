'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { usePoolsService, Pool } from '@/lib/hooks/services/usePoolsService';
import { useRewardsService, RewardsData, PoolReward } from '@/lib/hooks/services/useRewardsService';

interface GlobalStoreContextType {
    pools: {
        data: Pool[];
        loading: boolean;
        error: string | null;
        isUsingMockData: boolean;
        totalTVL: number;
        totalVolume24h: number;
        averageAPY: number;
        refreshPools: () => void;
        getPoolByAddress: (address: string) => Pool | undefined;
        getPoolByTokens: (tokenA: string, tokenB: string) => Pool | undefined;
    };
    rewards: {
        data: RewardsData;
        poolRewards: PoolReward[];
        loading: boolean;
        error: string | null;
        txSignature: string | null;
        fetchRewardsData: () => Promise<void>;
        claimRewards: (poolAddress: any) => Promise<string>;
        claimAllRewards: () => Promise<string[]>;
        clearError: () => void;
    };
}

const GlobalStoreContext = createContext<GlobalStoreContextType | undefined>(undefined);

export const GlobalStoreProvider = ({ children }: { children: ReactNode }) => {
    const poolsService = usePoolsService();
    const rewardsService = useRewardsService();

    const value = {
        pools: {
            data: poolsService.pools,
            loading: poolsService.loading,
            error: poolsService.error,
            isUsingMockData: poolsService.isUsingMockData,
            totalTVL: poolsService.totalTVL,
            totalVolume24h: poolsService.totalVolume24h,
            averageAPY: poolsService.averageAPY,
            refreshPools: poolsService.refreshPools,
            getPoolByAddress: poolsService.getPoolByAddress,
            getPoolByTokens: poolsService.getPoolByTokens,
        },
        rewards: {
            data: rewardsService.rewards,
            poolRewards: rewardsService.poolRewards,
            loading: rewardsService.loading,
            error: rewardsService.error,
            txSignature: rewardsService.txSignature,
            fetchRewardsData: rewardsService.fetchRewardsData,
            claimRewards: rewardsService.claimRewards,
            claimAllRewards: rewardsService.claimAllRewards,
            clearError: rewardsService.clearError,
        },
    };

    return (
        <GlobalStoreContext.Provider value={value}>
            {children}
        </GlobalStoreContext.Provider>
    );
};

export const useGlobalStore = () => {
    const context = useContext(GlobalStoreContext);
    if (context === undefined) {
        throw new Error('useGlobalStore must be used within a GlobalStoreProvider');
    }
    return context;
};
