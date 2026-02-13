'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PositionView, MarketView } from '@/lib/perps/types';

interface PerpsPositionsProps {
  positions: PositionView[];
  markets: MarketView[];
  loading?: boolean;
}

export function PerpsPositions({ positions, markets, loading }: PerpsPositionsProps) {
  const [tab, setTab] = React.useState<'positions' | 'orders' | 'history'>('positions');
  const marketById = new Map(markets.map((m) => [m.id, m]));

  return (
    <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">Positions</h3>
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#0B1220]">
        <div className="grid grid-cols-8 gap-2 px-4 py-3 text-[11px] uppercase tracking-wide text-[#6B7280] dark:text-[#6B7280]">
          <div>Market</div>
          <div>Side</div>
          <div>Size</div>
          <div>Entry</div>
          <div>Liq</div>
          <div>PnL</div>
          <div>Margin</div>
          <div>Actions</div>
        </div>
        <div className="border-t border-[#E2E8F0] dark:border-[#1F2937]">
          {loading ? (
            <div className="px-4 py-6 text-sm text-[#475569] dark:text-[#9CA3AF]">Loading positions…</div>
          ) : tab === 'positions' && positions.length > 0 ? (
            positions.map((position) => {
              const market = marketById.get(position.marketId);
              const pnl =
                position.unrealizedPnl === null
                  ? '—'
                  : `$${position.unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
              const entry =
                position.entryPrice === null ? '—' : `$${position.entryPrice.toFixed(2)}`;
              const liq =
                position.liquidationPrice === null
                  ? '—'
                  : `$${position.liquidationPrice.toFixed(2)}`;
              const margin =
                position.margin === null ? '—' : `$${position.margin.toLocaleString()}`;
              return (
                <div
                  key={position.id}
                  className="grid grid-cols-8 gap-2 px-4 py-3 text-sm text-[#475569] dark:text-[#9CA3AF] border-t border-[#E2E8F0] dark:border-[#1F2937] hover:bg-white dark:hover:bg-[#111827] transition-colors"
                >
                  <div className="text-[#0F172A] dark:text-[#E5E7EB] font-medium">
                    {market ? market.symbol : position.marketId}
                  </div>
                  <div className="uppercase">{position.side}</div>
                  <div className="tabular-nums">{position.size}</div>
                  <div className="tabular-nums" title={entry === '—' ? 'Available after first trades' : undefined}>
                    {entry}
                  </div>
                  <div className="tabular-nums" title={liq === '—' ? 'Available after first trades' : undefined}>
                    {liq}
                  </div>
                  <div className="tabular-nums" title={pnl === '—' ? 'Available after first trades' : undefined}>
                    {pnl}
                  </div>
                  <div className="tabular-nums" title={margin === '—' ? 'Available after first trades' : undefined}>
                    {margin}
                  </div>
                  <div className="text-xs text-[#6B7280] dark:text-[#6B7280]">—</div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-6 text-center">
              <div className="text-sm font-medium text-[#0F172A] dark:text-[#E5E7EB]">
                {tab === 'positions' ? 'No open positions' : tab === 'orders' ? 'No open orders' : 'No trade history'}
              </div>
              <div className="mt-1 text-xs text-[#475569] dark:text-[#9CA3AF]">
                {tab === 'positions'
                  ? 'Once you open a trade, positions will appear here.'
                  : tab === 'orders'
                    ? 'Limit orders will appear here once placed.'
                    : 'Executed trades will appear here.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
