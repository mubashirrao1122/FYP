'use client';

import React from 'react';
import { PerpsView } from '@/components/perps/PerpsView';
import { usePerps } from '@/lib/hooks/usePerps';

export default function PerpsPage() {
  const { markets, positions, loading, error, warning, hasMarkets } = usePerps();

  return (
    <PerpsView
      markets={markets}
      positions={positions}
      loading={loading}
      error={error}
      warning={warning}
      hasMarkets={hasMarkets}
    />
  );
}
