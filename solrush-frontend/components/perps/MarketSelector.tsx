import React from 'react';
import type { MarketView } from '@/lib/perps/types';

interface MarketSelectorProps {
  markets: MarketView[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export function MarketSelector({ markets, selectedId, onChange }: MarketSelectorProps) {
  if (markets.length === 0) {
    return (
      <div className="text-sm text-[#94A3B8] dark:text-[#6B7280]">
        No markets available
      </div>
    );
  }

  const selected = markets.find((m) => m.id === selectedId) || markets[0];

  return (
    <div className="flex items-center gap-3">
      <div className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
        {selected.symbol}
      </div>
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#F1F5F9] dark:bg-[#161C2D] text-[#475569] dark:text-[#9CA3AF]">
        Live · Solana
      </span>
      <select
        value={selected.id}
        onChange={(e) => onChange(e.target.value)}
        className="ml-2 rounded-lg border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826] px-2 py-1 text-xs font-medium text-[#0F172A] dark:text-[#E5E7EB] outline-none"
      >
        {markets.map((market) => (
          <option key={market.id} value={market.id}>
            {market.symbol}
          </option>
        ))}
      </select>
    </div>
  );
}
