'use client';

import React from 'react';
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
  const { pools, handleAddLiquidity } = usePools();

  return (
    <PoolsView
      pools={pools}
      handleAddLiquidity={handleAddLiquidity}
    />
  );
}
