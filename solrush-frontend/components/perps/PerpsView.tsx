'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
import { Wallet } from 'lucide-react';
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
  onPositionChange?: () => void;
}

export function PerpsView({
  markets,
  positions,
  loading,
  error,
  warning,
  hasMarkets = false,
  onPositionChange,
}: PerpsViewProps) {
  const { publicKey } = useWallet();
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const { closePosition: onChainClose, status: closeStatus } = usePerpsTrading();
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [closePercents, setClosePercents] = useState<Record<string, number>>({});

  // Auto-select the first available market when markets load
  useEffect(() => {
    if (!selectedMarketId && markets.length > 0) {
      setSelectedMarketId(markets[0].id);
    }
  }, [markets, selectedMarketId]);

  const getClosePercent = (id: string) => closePercents[id] ?? 100;
  const setClosePercent = (id: string, pct: number) =>
    setClosePercents((prev) => ({ ...prev, [id]: pct }));

  const handleClosePosition = useCallback(async (position: PositionView) => {
    const pct = closePercents[position.id] ?? 100;
    const amountBase = Math.round(position.size * (pct / 100));
    if (amountBase <= 0) return;
    setClosingPositionId(position.id);
    try {
      await onChainClose({ marketPubkey: position.marketId, amountBase });
    } catch (err) {
      console.error('Failed to close position:', err);
    } finally {
      setClosingPositionId(null);
    }
  }, [onChainClose, closePercents]);

  // Mock Data Generation
  const currentPrice = usePythPrice(selectedMarketId ? markets.find(m => m.id === selectedMarketId)?.oraclePriceId : null).price?.price || 0;

  // ── Seeded PRNG to avoid hydration mismatch (Math.random() differs server vs client) ──
  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  const { bids: mockBids, asks: mockAsks } = useMemo(() => {
    const depth = 12;
    const price = currentPrice || 100;
    const askData: OrderLevel[] = [];
    const bidData: OrderLevel[] = [];
    const rng = seededRandom(Math.floor(price * 100) || 42);
    let currentTotal = 0;

    for (let i = 0; i < depth; i++) {
      const p = price * (1 + (i + 1) * 0.0005);
      const s = rng() * 100 + 10;
      currentTotal += s;
      askData.push({ price: p, size: s, total: currentTotal });
    }

    currentTotal = 0;
    for (let i = 0; i < depth; i++) {
      const p = price * (1 - (i + 1) * 0.0005);
      const s = rng() * 100 + 10;
      currentTotal += s;
      bidData.push({ price: p, size: s, total: currentTotal });
    }
    return { asks: askData.reverse(), bids: bidData };
  }, [currentPrice]);

  const mockTrades = useMemo(() => {
    const data: Trade[] = [];
    const now = Date.now();
    const price = currentPrice || 100;
    const rng = seededRandom(Math.floor(price * 100 + 1) || 99);

    for (let i = 0; i < 20; i++) {
      const side = rng() > 0.5 ? 'buy' : 'sell';
      const priceOffset = (rng() * 2) - 1;
      data.push({
        id: `trade-${i}`,
        price: price + priceOffset,
        size: rng() * 10 + 0.1,
        time: now - (i * 5000),
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
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <Navbar />

      {/* Stats Bar */}
      <div className="h-14 border-b border-border/30 flex items-center px-4 glass-card shrink-0 z-20 gap-6">
        <div className="flex items-center gap-2 mr-2">
          <MarketSelector
            markets={markets}
            selectedId={selectedMarketId}
            onChange={setSelectedMarketId}
          />
        </div>

        <div className="h-8 w-px bg-border/30" />

        <div className="flex items-center gap-6 text-xs overflow-x-auto no-scrollbar mask-gradient-right flex-1">
          <div className="flex flex-col">
            <span className="text-foreground/40 text-[10px] uppercase font-medium">Mark Price</span>
            <span className={`font-data text-sm font-medium ${liveMarket?.change24h && liveMarket.change24h >= 0 ? 'text-neon-green' : 'text-destructive'}`}>
              {liveMarket?.markPrice ? formatCurrency(liveMarket.markPrice) : '-'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground/40 text-[10px] uppercase font-medium">24h Change</span>
            <span className={`font-data text-sm font-medium ${liveMarket?.change24h && liveMarket.change24h >= 0 ? 'text-neon-green' : 'text-destructive'}`}>
              {liveMarket?.change24h ? formatPercent(liveMarket.change24h) : '-'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground/40 text-[10px] uppercase font-medium">24h Volume</span>
            <span className="text-foreground font-data text-sm">{liveMarket?.volume24h ? formatCurrency(liveMarket.volume24h) : '-'}</span>
          </div>
          <div className="flex flex-col hidden sm:flex">
            <span className="text-foreground/40 text-[10px] uppercase font-medium">Open Interest</span>
            <span className="text-foreground font-data text-sm">{liveMarket?.openInterest ? formatCurrency(liveMarket.openInterest) : '-'}</span>
          </div>
          <div className="flex flex-col hidden lg:flex">
            <span className="text-foreground/40 text-[10px] uppercase font-medium">Funding / 1h</span>
            <span className="text-neon-amber font-data text-sm">0.0012%</span>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chart & Positions */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border/20">
          {/* Chart Area */}
          <div className="flex-1 relative min-h-[400px]">
            <PerpsChart
              market={liveMarket}
              loading={loading}
              error={combinedError || undefined}
            />
          </div>

          {/* Bottom Tabs: Positions/Orders */}
          <div className="h-[280px] border-t border-border/20 glass-card flex flex-col shrink-0">
            <Tabs defaultValue="positions" className="flex flex-col h-full">
              <div className="px-4 border-b border-border/20 flex items-center justify-between bg-card/80">
                <TabsList className="h-9 bg-transparent p-0 gap-6">
                  <TabsTrigger value="positions" className="h-full px-0 data-[state=active]:text-neon-cyan data-[state=active]:border-b-2 data-[state=active]:border-neon-cyan data-[state=active]:shadow-[0_2px_8px_rgba(6,182,212,0.2)] rounded-none bg-transparent text-foreground/50">
                    Positions {positions.length > 0 && `(${positions.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="h-full px-0 data-[state=active]:text-neon-cyan data-[state=active]:border-b-2 data-[state=active]:border-neon-cyan data-[state=active]:shadow-[0_2px_8px_rgba(6,182,212,0.2)] rounded-none bg-transparent text-foreground/50">
                    Orders (0)
                  </TabsTrigger>
                  <TabsTrigger value="history" className="h-full px-0 data-[state=active]:text-neon-cyan data-[state=active]:border-b-2 data-[state=active]:border-neon-cyan data-[state=active]:shadow-[0_2px_8px_rgba(6,182,212,0.2)] rounded-none bg-transparent text-foreground/50">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="pnl" className="h-full px-0 data-[state=active]:text-neon-cyan data-[state=active]:border-b-2 data-[state=active]:border-neon-cyan data-[state=active]:shadow-[0_2px_8px_rgba(6,182,212,0.2)] rounded-none bg-transparent text-foreground/50">
                    P&L Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-auto bg-background/50 no-scrollbar">
                <TabsContent value="positions" className="h-full mt-0 p-0">
                  {positions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-foreground/30 gap-2">
                      <div className="p-3 rounded-full bg-muted/30">
                        <Wallet className="w-6 h-6 opacity-50" />
                      </div>
                      <p className="text-sm">No open positions</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="text-foreground/40 uppercase bg-card/80 sticky top-0 z-10">
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
                      <tbody className="divide-y divide-border/10">
                        {positions.map((position) => (
                          <tr key={position.id} className="hover:bg-muted/20 hover:shadow-[inset_0_0_30px_rgba(6,182,212,0.03)] transition-all duration-200">
                            <td className="px-4 py-2 font-medium text-foreground">{position.marketId}</td>
                            <td className={`px-4 py-2 font-medium ${position.side === 'long' ? 'text-neon-green' : 'text-destructive'}`}>
                              {position.side.toUpperCase()} {position.leverage}x
                            </td>
                            <td className="px-4 py-2 text-right text-foreground font-data">{formatCurrency(position.sizeUsd)}</td>
                            <td className="px-4 py-2 text-right text-foreground font-data">{formatCurrency(position.collateralUsd)}</td>
                            <td className="px-4 py-2 text-right text-foreground font-data">{formatCurrency(position.entryPrice)}</td>
                            <td className="px-4 py-2 text-right text-foreground font-data">{formatCurrency(liveMarket?.markPrice || 0)}</td>
                            <td className="px-4 py-2 text-right text-neon-amber font-data">{formatCurrency(position.liquidationPrice)}</td>
                            <td className={`px-4 py-2 text-right font-medium font-data ${position.unrealizedPnl >= 0 ? 'text-neon-green' : 'text-destructive'}`}>
                              {position.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnl)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex gap-1">
                                  {[25, 50, 75, 100].map((pct) => (
                                    <button
                                      key={pct}
                                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                                        getClosePercent(position.id) === pct
                                          ? 'bg-neon-blue/20 border-neon-blue text-neon-blue'
                                          : 'bg-muted/30 border-border/30 text-foreground/50 hover:border-foreground/30'
                                      }`}
                                      onClick={() => setClosePercent(position.id, pct)}
                                      disabled={closingPositionId === position.id}
                                    >
                                      {pct}%
                                    </button>
                                  ))}
                                </div>
                                <button
                                  className="text-[10px] bg-muted/30 hover:bg-muted/50 text-foreground px-2 py-1 rounded border border-border/30 disabled:opacity-50 transition-colors"
                                  onClick={() => handleClosePosition(position)}
                                  disabled={closingPositionId === position.id}
                                >
                                  {closingPositionId === position.id
                                    ? 'Closing…'
                                    : `Close ${getClosePercent(position.id)}%`}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </TabsContent>
                {/* Other tabs placeholders */}
                <TabsContent value="orders" className="h-full mt-0 flex items-center justify-center text-foreground/30">No open orders</TabsContent>
                <TabsContent value="history" className="h-full mt-0 flex items-center justify-center text-foreground/30">No trade history</TabsContent>
                <TabsContent value="pnl" className="h-full mt-0 flex items-center justify-center text-foreground/30">No P&L data available</TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Middle Column: Order Book & Trades */}
        <div className="w-[280px] flex flex-col border-r border-border/20 shrink-0 hidden md:flex bg-background/50">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 border-b border-border/20">
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

        {/* Right Column: Trade Form */}
        <div className="w-[320px] bg-[#0B0E11]/80 backdrop-blur-xl shrink-0 flex flex-col border-l border-white/[0.05] z-10 overflow-y-auto no-scrollbar">
          <PerpsTradePanel
            market={liveMarket}
            disabled={loading || markets.length === 0 || Boolean(warning) || !hasMarkets}
            emptyState={markets.length === 0 || !hasMarkets}
            error={combinedError}
            onPositionChange={onPositionChange}
          />
        </div>
      </div>
    </div>
  );
}
