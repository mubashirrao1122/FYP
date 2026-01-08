'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { MarketView } from '@/lib/perps/types';

interface PerpsChartProps {
  market?: MarketView | null;
  loading?: boolean;
  error?: string | null;
}

export function PerpsChart({ market, loading = false, error }: PerpsChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetKey = useMemo(() => market?.id ?? 'perps-chart', [market?.id]);
  const [isDark, setIsDark] = useState(true);
  const [timeframe, setTimeframe] = useState('1h');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!market || !containerRef.current) return;
    if (typeof window === 'undefined') return;

    const symbolQuote = market.quoteSymbol === 'USDC' ? 'USDT' : market.quoteSymbol;
    const symbol = `BINANCE:${market.baseSymbol}${symbolQuote}`;
    const scriptId = 'tradingview-widget-script';

    const buildWidget = () => {
      if (!(window as typeof window & { TradingView?: any }).TradingView) return;
      containerRef.current!.innerHTML = '';
      new (window as typeof window & { TradingView: any }).TradingView.widget({
        autosize: true,
        symbol,
        interval: '30',
        timezone: 'Etc/UTC',
        theme: isDark ? 'dark' : 'light',
        style: '1',
        locale: 'en',
        enable_publishing: false,
        hide_top_toolbar: true,
        hide_legend: true,
        save_image: false,
        container_id: widgetKey,
      });
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = buildWidget;
      document.body.appendChild(script);
    } else {
      buildWidget();
    }
  }, [market, widgetKey, isDark]);

  if (loading) {
    return (
      <div className="h-[420px] rounded-2xl border border-white/10 bg-[#121826] animate-pulse" />
    );
  }

  if (error) {
    return (
      <div className="h-[420px] rounded-2xl border border-white/10 bg-[#121826] flex items-center justify-center text-sm text-[#9CA3AF]">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#121826] p-5 transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-[#E5E7EB]">Market</div>
          <div className="text-xs text-[#9CA3AF]">Chart</div>
        </div>
        <div className="relative h-[320px] rounded-xl border border-white/10 bg-[#0B0E14] overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#9CA3AF]">
            Chart will appear once a market is initialized
          </div>
        </div>
      </div>
    );
  }

  const changeColor =
    market.change24h === null ? 'text-[#94A3B8] dark:text-[#6B7280]' : market.change24h >= 0
      ? 'text-[#22C55E]'
      : 'text-[#EF4444]';
  const formattedChange =
    market.change24h === null ? '—' : `${market.change24h >= 0 ? '+' : ''}${market.change24h.toFixed(2)}%`;
  const formattedPrice =
    market.markPrice === null
      ? '—'
      : `$${market.markPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121826] p-5 transition-colors duration-200">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-[#E5E7EB]">{market.symbol}</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#161C2D] text-[#9CA3AF]">
              Live · Solana
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-semibold text-[#E5E7EB] tabular-nums">{formattedPrice}</span>
            <span
              className={`text-sm font-medium ${changeColor}`}
              title={market.change24h === null ? 'Available after first trades' : undefined}
            >
              {formattedChange}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          {['5m', '15m', '1h', '4h', '1d'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 rounded-lg border ${
                timeframe === tf
                  ? 'border-[#8B5CF6] text-[#E5E7EB]'
                  : 'border-white/10 text-[#9CA3AF]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        id={widgetKey}
        className="relative h-[320px] rounded-xl border border-white/10 bg-[#0B0E14] overflow-hidden"
      >
        {market.markPrice === null && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#9CA3AF] bg-[#0B0E14]/70">
            Chart available once market data streams are connected
          </div>
        )}
      </div>
    </div>
  );
}
