'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { usePools } from '@/lib/hooks/usePools';
import { PoolsView } from '@/components/pools/PoolsView';

/**
 * Pools Page - Module 6.4
 * Liquidity pool management with add/remove liquidity and pool browsing
 * Refactored to MVC pattern:
 * - Controller: usePools hook
 * - View: PoolsView component
 */
export default function PoolsPage() {
  const router = useRouter();
  const { pools, loading, error, isUsingMockData, refreshPools } = usePools();

  const handleAddLiquidity = (poolId: string) => {
    // Navigate to liquidity page with pool pre-selected
    router.push(`/liquidity?pool=${poolId}`);
  };

  return (
    <PoolsView
      pools={pools}
      loading={loading}
      error={error}
      isUsingMockData={isUsingMockData}
      handleAddLiquidity={handleAddLiquidity}
      onRefresh={refreshPools}
    />
  );
}
