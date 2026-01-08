'use client';

import React, { useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PerpsChart } from '@/components/perps/PerpsChart';
import { PerpsTradePanel } from '@/components/perps/PerpsTradePanel';
import { PerpsPositions } from '@/components/perps/PerpsPositions';
import { StatusCard } from '@/components/perps/StatusCard';
import { MarketSelector } from '@/components/perps/MarketSelector';
import { MetricPill } from '@/components/perps/MetricPill';
import { LaunchStatePanel } from '@/components/perps/LaunchStatePanel';
import type { MarketView, PositionView } from '@/lib/perps/types';
import { usePythPrice } from '@/lib/perps/usePythPrice';
import { useWallet } from '@solana/wallet-adapter-react';

interface PerpsViewProps {
  markets: MarketView[];
  positions: PositionView[];
  loading?: boolean;
  error?: string | null;
}

export function PerpsView({ markets, positions, loading, error }: PerpsViewProps) {
  const { publicKey } = useWallet();
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const selectedMarket = useMemo(
    () => markets.find((m) => m.id === selectedMarketId) || markets[0] || null,
    [markets, selectedMarketId]
  );
  const livePrice = usePythPrice(selectedMarket?.oraclePriceId);
  const combinedError = error || livePrice.error;
  const liveMarket = useMemo(() => {
    if (!selectedMarket) return null;
    if (!livePrice.price) return selectedMarket;
    return {
      ...selectedMarket,
      indexPrice: livePrice.price.price,
      markPrice: selectedMarket.markPrice ?? livePrice.price.price,
      lastUpdated: livePrice.price.publishTime,
    };
  }, [selectedMarket, livePrice.price]);

  const formatValue = (value: number | null, options?: Intl.NumberFormatOptions) =>
    value === null ? '—' : value.toLocaleString(undefined, options);
  const formatPrice = (value: number | null) =>
    value === null ? '—' : `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const formatPercent = (value: number | null) =>
    value === null ? '—' : `${value.toFixed(4)}%`;
  const updatedAgo = liveMarket?.lastUpdated
    ? `${Math.max(0, Math.floor((Date.now() / 1000 - liveMarket.lastUpdated)))}s ago`
    : '—';
  const tooltipFor = (value: number | null) =>
    value === null ? 'Available after first trades' : undefined;

  return (
    <div className="min-h-screen bg-[#0B0E14] transition-colors duration-200 selection:bg-[#8B5CF6]/20">
      <Navbar />

      <main className="relative z-10 max-w-[1320px] mx-auto px-6 pt-16 pb-12">
        {combinedError && (
          <div className="mb-6">
            <StatusCard
              title="Perps failed to load"
              message={combinedError}
              actionLabel="Retry"
              onAction={() => window.location.reload()}
              details={combinedError}
            />
          </div>
        )}

        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold text-[#E5E7EB] tracking-tight">
              Perpetuals
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#161C2D] text-[#9CA3AF]">
              Initializing
            </span>
          </div>
          <p className="text-[#9CA3AF] text-sm sm:text-base max-w-2xl mt-2">
            Trade perpetual markets with transparent funding, margin, and on-chain settlement.
          </p>
        </div>

        {markets.length === 0 && !loading && (
          <div className="mt-6">
            <LaunchStatePanel connected={Boolean(publicKey)} />
          </div>
        )}

        <div className={markets.length === 0 ? 'mt-6 opacity-70' : 'mt-0'}>
          <div className="flex items-center justify-between mb-4">
            <MarketSelector
              markets={markets}
              selectedId={selectedMarketId}
              onChange={setSelectedMarketId}
            />
            <div className="text-xs text-[#6B7280]">Updated {updatedAgo}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`metric-skeleton-${index}`}
                    className="rounded-xl border border-white/10 bg-[#121826] px-3 py-3 animate-pulse"
                  >
                    <div className="h-3 w-16 bg-white/5 rounded" />
                    <div className="mt-2 h-4 w-20 bg-white/5 rounded" />
                  </div>
                ))
              : (
                <>
                  <MetricPill
                    label="Mark"
                    value={liveMarket ? formatPrice(liveMarket.markPrice) : '—'}
                    tooltip={markets.length === 0 ? 'Available once a market is live' : tooltipFor(liveMarket?.markPrice ?? null)}
                    testId="perps-metric-mark"
                  />
                  <MetricPill
                    label="24h Change"
                    value={liveMarket ? formatPercent(liveMarket.change24h) : '—'}
                    tooltip="Available once a market is live"
                    testId="perps-metric-24h-change"
                  />
                  <MetricPill
                    label="24h Volume"
                    value={liveMarket ? formatValue(liveMarket.volume24h) : '—'}
                    tooltip="Available once a market is live"
                    testId="perps-metric-24h-volume"
                  />
                  <MetricPill
                    label="Funding"
                    value={liveMarket ? formatPercent(liveMarket.fundingRate) : '—'}
                    tooltip={markets.length === 0 ? 'Available once a market is live' : tooltipFor(liveMarket?.fundingRate ?? null)}
                    testId="perps-metric-funding"
                  />
                  <MetricPill
                    label="Open Interest"
                    value={liveMarket ? formatValue(liveMarket.openInterest) : '—'}
                    tooltip={markets.length === 0 ? 'Available once a market is live' : tooltipFor(liveMarket?.openInterest ?? null)}
                    testId="perps-metric-open-interest"
                  />
                  <MetricPill
                    label="Borrow Rate"
                    value={liveMarket ? formatPercent(liveMarket.borrowRate) : '—'}
                    tooltip="Available once a market is live"
                    testId="perps-metric-borrow-rate"
                  />
                </>
              )}
          </div>

          <div className="grid grid-cols-12 gap-6 items-start">
            <div className="col-span-12 lg:col-span-7">
              <PerpsChart market={liveMarket} loading={loading} error={combinedError || undefined} />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <PerpsTradePanel
                market={liveMarket}
                disabled={loading || markets.length === 0}
                emptyState={markets.length === 0}
                error={combinedError}
              />
            </div>
          </div>

          <div className="mt-8">
            <PerpsPositions positions={positions} markets={markets} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
}
