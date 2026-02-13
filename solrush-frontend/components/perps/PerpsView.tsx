'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PerpsChart } from '@/components/perps/PerpsChart';
import { PerpsTradePanel } from '@/components/perps/PerpsTradePanel';
import { OrderBook } from '@/components/perps/OrderBook';
import { RecentTrades } from '@/components/perps/RecentTrades';
import { MarketSelector } from '@/components/perps/MarketSelector';
import type { MarketView, PositionView } from '@/lib/perps/types';
import { usePythPrice } from '@/lib/perps/usePythPrice';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePerpsTrading } from '@/lib/hooks/usePerpsTrading';
import { Wallet, ChevronDown, Monitor, Clock, List } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OrderLevel } from '@/components/perps/OrderBook';
import type { Trade } from '@/components/perps/RecentTrades';

interface PerpsViewProps {
  markets: MarketView[];
  positions: PositionView[];
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
  hasMarkets?: boolean;
}

export function PerpsView({
  markets,
  positions,
  loading,
  error,
  warning,
  hasMarkets = false,
}: PerpsViewProps) {
  const { publicKey } = useWallet();
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const { closePosition: onChainClose, status: closeStatus } = usePerpsTrading();
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);

  const handleClosePosition = useCallback(async (position: PositionView) => {
    setClosingPositionId(position.id);
    try {
      await onChainClose({ marketPubkey: position.marketId });
    } catch (err) {
      console.error('Failed to close position:', err);
    } finally {
      setClosingPositionId(null);
    }
  }, [onChainClose]);

  // Mock Data Generation (to be replaced with real data hooks later)
  const currentPrice = usePythPrice(selectedMarketId ? markets.find(m => m.id === selectedMarketId)?.oraclePriceId : null).price?.price || 0;

  const { bids: mockBids, asks: mockAsks } = useMemo(() => {
    const depth = 12;
    const price = currentPrice || 100; // Fallback to 100 if 0
    const askData: OrderLevel[] = [];
    const bidData: OrderLevel[] = [];
    let currentTotal = 0;

    for (let i = 0; i < depth; i++) {
      const p = price * (1 + (i + 1) * 0.0005);
      const s = Math.random() * 100 + 10;
      currentTotal += s;
      askData.push({ price: p, size: s, total: currentTotal });
    }

    currentTotal = 0;
    for (let i = 0; i < depth; i++) {
      const p = price * (1 - (i + 1) * 0.0005);
      const s = Math.random() * 100 + 10;
      currentTotal += s;
      bidData.push({ price: p, size: s, total: currentTotal });
    }
    return { asks: askData.reverse(), bids: bidData };
  }, [currentPrice]);

  const mockTrades = useMemo(() => {
    const data: Trade[] = [];
    const now = Date.now();
    const price = currentPrice || 100;

    for (let i = 0; i < 20; i++) {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const priceOffset = (Math.random() * 2) - 1;
      data.push({
        id: `trade-${i}`,
        price: price + priceOffset,
        size: Math.random() * 10 + 0.1,
        time: now - (i * Math.random() * 5000),
        side,
      });
    }
    return data;
  }, [currentPrice]);

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

  const formatCurrency = (value: number | null) =>
    value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercent = (value: number | null) =>
    value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0B1220] text-[#E5E7EB]">
      <div className="shrink-0">
        <Navbar />
      </div>

      {/* Stats Bar */}
      <div className="h-14 border-b border-[#1F2937] flex items-center px-4 bg-[#0F172A] shrink-0 z-20 gap-6">
        <div className="flex items-center gap-2 mr-2">
          <MarketSelector
            markets={markets}
            selectedId={selectedMarketId}
            onChange={setSelectedMarketId}
          />
        </div>

        <div className="h-8 w-px bg-[#1F2937]" />

        <div className="flex items-center gap-6 text-xs overflow-x-auto no-scrollbar mask-gradient-right flex-1">
          <div className="flex flex-col">
            <span className="text-[#9CA3AF] text-[10px] uppercase font-medium">Mark Price</span>
            <span className={`font-mono text-sm font-medium ${liveMarket?.change24h && liveMarket.change24h >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {liveMarket?.markPrice ? formatCurrency(liveMarket.markPrice) : '-'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#9CA3AF] text-[10px] uppercase font-medium">24h Change</span>
            <span className={`font-mono text-sm font-medium ${liveMarket?.change24h && liveMarket.change24h >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {liveMarket?.change24h ? formatPercent(liveMarket.change24h) : '-'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#9CA3AF] text-[10px] uppercase font-medium">24h Volume</span>
            <span className="text-[#E5E7EB] font-mono text-sm">{liveMarket?.volume24h ? formatCurrency(liveMarket.volume24h) : '-'}</span>
          </div>
          <div className="flex flex-col hidden sm:flex">
            <span className="text-[#9CA3AF] text-[10px] uppercase font-medium">Open Interest</span>
            <span className="text-[#E5E7EB] font-mono text-sm">{liveMarket?.openInterest ? formatCurrency(liveMarket.openInterest) : '-'}</span>
          </div>
          <div className="flex flex-col hidden lg:flex">
            <span className="text-[#9CA3AF] text-[10px] uppercase font-medium">Funding / 1h</span>
            <span className="text-[#F59E0B] font-mono text-sm">0.0012%</span>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chart & Positions */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#1F2937]">
          {/* Chart Area */}
          <div className="flex-1 relative min-h-[400px]">
            <PerpsChart
              market={liveMarket}
              loading={loading}
              error={combinedError || undefined}
            />
          </div>

          {/* Bottom Tabs: Positions/Orders */}
          <div className="h-[280px] border-t border-[#1F2937] bg-[#0F172A] flex flex-col shrink-0">
            <Tabs defaultValue="positions" className="flex flex-col h-full">
              <div className="px-4 border-b border-[#1F2937] flex items-center justify-between bg-[#111827]">
                <TabsList className="h-9 bg-transparent p-0 gap-6">
                  <TabsTrigger value="positions" className="h-full px-0 data-[state=active]:text-[#2DD4BF] data-[state=active]:border-b-2 data-[state=active]:border-[#2DD4BF] rounded-none bg-transparent">
                    Positions {positions.length > 0 && `(${positions.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="h-full px-0 data-[state=active]:text-[#2DD4BF] data-[state=active]:border-b-2 data-[state=active]:border-[#2DD4BF] rounded-none bg-transparent">
                    Orders (0)
                  </TabsTrigger>
                  <TabsTrigger value="history" className="h-full px-0 data-[state=active]:text-[#2DD4BF] data-[state=active]:border-b-2 data-[state=active]:border-[#2DD4BF] rounded-none bg-transparent">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="pnl" className="h-full px-0 data-[state=active]:text-[#2DD4BF] data-[state=active]:border-b-2 data-[state=active]:border-[#2DD4BF] rounded-none bg-transparent">
                    P&L Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-auto bg-[#0B1220] no-scrollbar">
                <TabsContent value="positions" className="h-full mt-0 p-0">
                  {positions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#64748B] gap-2">
                      <div className="p-3 rounded-full bg-[#1F2937]/50">
                        <Wallet className="w-6 h-6 opacity-50" />
                      </div>
                      <p className="text-sm">No open positions</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="text-[#6B7280] uppercase bg-[#111827] sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 font-medium">Market</th>
                          <th className="px-4 py-2 font-medium">Side</th>
                          <th className="px-4 py-2 font-medium text-right">Size (USD)</th>
                          <th className="px-4 py-2 font-medium text-right">Net Value</th>
                          <th className="px-4 py-2 font-medium text-right">Entry Price</th>
                          <th className="px-4 py-2 font-medium text-right">Mark Price</th>
                          <th className="px-4 py-2 font-medium text-right">Liq. Price</th>
                          <th className="px-4 py-2 font-medium text-right">PnL</th>
                          <th className="px-4 py-2 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F2937]">
                        {positions.map((position) => (
                          <tr key={position.id} className="hover:bg-[#1F2937]/50 transition-colors">
                            <td className="px-4 py-2 font-medium text-[#E5E7EB]">{position.marketId}</td>
                            <td className={`px-4 py-2 font-medium ${position.side === 'long' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                              {position.side.toUpperCase()} {position.leverage}x
                            </td>
                            <td className="px-4 py-2 text-right text-[#E5E7EB]">{formatCurrency(position.sizeUsd)}</td>
                            <td className="px-4 py-2 text-right text-[#E5E7EB]">{formatCurrency(position.collateralUsd)}</td>
                            <td className="px-4 py-2 text-right text-[#E5E7EB]">{formatCurrency(position.entryPrice)}</td>
                            <td className="px-4 py-2 text-right text-[#E5E7EB]">{formatCurrency(liveMarket?.markPrice || 0)}</td>
                            <td className="px-4 py-2 text-right text-[#F59E0B]">{formatCurrency(position.liquidationPrice)}</td>
                            <td className={`px-4 py-2 text-right font-medium ${position.unrealizedPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                              {position.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnl)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                className="text-[10px] bg-[#1F2937] hover:bg-[#374151] text-[#E5E7EB] px-2 py-1 rounded border border-[#374151] disabled:opacity-50"
                                onClick={() => handleClosePosition(position)}
                                disabled={closingPositionId === position.id}
                              >
                                {closingPositionId === position.id ? 'Closing…' : 'Close'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </TabsContent>
                {/* Other tabs placeholders */}
                <TabsContent value="orders" className="h-full mt-0 flex items-center justify-center text-[#64748B]">No open orders</TabsContent>
                <TabsContent value="history" className="h-full mt-0 flex items-center justify-center text-[#64748B]">No trade history</TabsContent>
                <TabsContent value="pnl" className="h-full mt-0 flex items-center justify-center text-[#64748B]">No P&L data available</TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Middle Column: Order Book & Trades (Fixed Width) */}
        <div className="w-[280px] flex flex-col border-r border-[#1F2937] shrink-0 hidden md:flex bg-[#0B1220]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 border-b border-[#1F2937]">
              <OrderBook
                currentPrice={liveMarket?.markPrice || 0}
                bids={mockBids}
                asks={mockAsks}
              />
            </div>
            <div className="h-[40%] min-h-0">
              <RecentTrades
                currentPrice={liveMarket?.markPrice || 0}
                trades={mockTrades}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Trade Form (Fixed Width) */}
        <div className="w-[320px] bg-[#0F172A] shrink-0 flex flex-col border-l border-[#1F2937] z-10 overflow-y-auto no-scrollbar">
          <PerpsTradePanel
            market={liveMarket}
            disabled={loading || markets.length === 0 || Boolean(warning) || !hasMarkets}
            emptyState={markets.length === 0 || !hasMarkets}
            error={combinedError}
          />
        </div>
      </div>
    </div>
  );
}
