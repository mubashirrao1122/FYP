'use client';

import { useGlobalStore } from '@/components/providers/GlobalStoreProvider';

export const useRewards = () => {
  const { rewards } = useGlobalStore();

  return {
    rewards: rewards.data,
    poolRewards: rewards.poolRewards,
    loading: rewards.loading,
    error: rewards.error,
    txSignature: rewards.txSignature,
    fetchRewardsData: rewards.fetchRewardsData,
    claimRewards: rewards.claimRewards,
    claimAllRewards: rewards.claimAllRewards,
    clearError: rewards.clearError,
  };
};
