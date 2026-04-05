'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import useSWR from 'swr';
import { useBalance } from './useBalance';
import { usePerps } from './usePerps';
import { usePools } from './usePools';
import { getReadOnlyProgram, fromBN } from '../anchor/setup';
import { findPositionAddress } from '../anchor/pda';
import { oracleService } from '../services/oracleService';
import type { Pool } from './services/usePoolsService';
import type { MarketView, PositionView } from '../perps/types';
import { fetchCryptoNews, type NewsItem } from '../services/news';

/* ─── Types ────────────────────────────────────────────────── */

export interface LiveHolding {
  symbol: string;
  name: string;
  amount: number;
  price: number;
  valueUSD: number;
  allocation: number; // computed after totals
  icon: string;
}

export interface LivePerpPosition {
  market: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  pnlPct: number;
  leverage: number;
  liquidationPrice: number;
}

export interface LiveLpPosition {
  pair: string;
  tokenA: string;
  tokenB: string;
  valueUSD: number;
  feesEarned: number;
  apr: number;
  poolAddress: string;
}

export interface LiveTransaction {
  type: 'SWAP' | 'PERP' | 'LP' | 'REWARD';
  description: string;
  amount: string;
  valueUSD: number;
  time: string; // ISO timestamp
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  txHash: string;
  fullTxHash?: string;
}

/* ─── Token icons ──────────────────────────────────────────── */
const TOKEN_ICONS: Record<string, string> = {
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  WETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  RUSH: '',
};

const TOKEN_NAMES: Record<string, string> = {
  SOL: 'Solana',
  USDC: 'USD Coin',
  USDT: 'Tether',
  WETH: 'Wrapped Ether',
  RUSH: 'SolRush',
};

/* ─── SWR fetcher ──────────────────────────────────────────── */
const jsonFetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://127.0.0.1:8001';

/* ─── Hook ─────────────────────────────────────────────────── */
export function usePortfolioLive() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  // ── Existing hooks ──
  const { balances, loading: balancesLoading, fetchAllBalances } = useBalance();
  const { markets, positions: perpsPositions, loading: perpsLoading, refresh: refreshPerps } = usePerps();
  const { pools, loading: poolsLoading, refreshPools } = usePools();

  // ── Prices ──
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(true);

  const fetchPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const batch = await oracleService.getBatchPrices([
        { symbol: 'SOL' },
        { symbol: 'USDC' },
        { symbol: 'USDT' },
      ]);
      const result: Record<string, number> = {};
      batch.forEach((price, symbol) => { result[symbol] = price; });

      // Also grab mark prices from perps markets (our on-chain oracle)
      for (const m of markets) {
        if (m.markPrice && m.baseSymbol) {
          result[`${m.baseSymbol}_MARK`] = m.markPrice;
        }
      }

      // For localnet, prefer the on-chain oracle mark price for SOL
      if (result['SOL_MARK'] && result['SOL_MARK'] > 0) {
        result['SOL'] = result['SOL_MARK'];
      }

      setPrices(result);
    } catch {
      // keep old prices
    } finally {
      setPricesLoading(false);
    }
  }, [markets]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);
  useEffect(() => {
    const id = setInterval(fetchPrices, 30_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  // ── Holdings (live balances × prices) ──
  const holdings = useMemo<LiveHolding[]>(() => {
    const TRACKED = ['SOL', 'USDC', 'USDT'] as const;
    const raw = TRACKED.map((symbol) => {
      const bal = balances[symbol];
      const amount = bal?.balance ?? 0;
      const price = prices[symbol] ?? (symbol === 'USDC' || symbol === 'USDT' ? 1 : 0);
      const valueUSD = amount * price;
      return {
        symbol,
        name: TOKEN_NAMES[symbol] ?? symbol,
        amount,
        price,
        valueUSD,
        allocation: 0,
        icon: TOKEN_ICONS[symbol] ?? '',
      };
    }).filter((h) => h.amount > 0);

    const totalVal = raw.reduce((s, h) => s + h.valueUSD, 0);
    return raw.map((h) => ({
      ...h,
      allocation: totalVal > 0 ? Math.round((h.valueUSD / totalVal) * 100) : 0,
    }));
  }, [balances, prices]);

  // ── On-chain Perp positions ──
  const marketById = useMemo(
    () => new Map<string, MarketView>(markets.map((m) => [m.id, m])),
    [markets],
  );

  const perpPositions = useMemo<LivePerpPosition[]>(() => {
    return perpsPositions.map((p: PositionView) => {
      const market = marketById.get(p.marketId);
      const markPrice = p.markPrice ?? market?.markPrice ?? 0;
      const entryPrice = p.entryPrice ?? 0;
      const size = p.sizeUsd || (p.size * markPrice);
      const pnl = p.unrealizedPnl ?? 0;
      const pnlPct = size > 0 ? (pnl / size) * 100 : 0;
      const baseSymbol = market?.baseSymbol ?? 'SOL';
      const quoteSymbol = market?.quoteSymbol ?? 'USD';

      return {
        market: `${baseSymbol}/${quoteSymbol}`,
        side: (p.side === 'long' ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
        size,
        entryPrice,
        markPrice,
        pnl,
        pnlPct,
        leverage: p.leverage ?? 1,
        liquidationPrice: p.liquidationPrice ?? 0,
      };
    });
  }, [perpsPositions, marketById]);

  // ── On-chain LP positions ──
  const [lpPositions, setLpPositions] = useState<LiveLpPosition[]>([]);
  const [lpLoading, setLpLoading] = useState(false);
  const [lpRefreshCount, setLpRefreshCount] = useState(0);

  const refreshLp = useCallback(() => setLpRefreshCount((n) => n + 1), []);

  useEffect(() => {
    if (!publicKey || pools.length === 0) {
      setLpPositions([]);
      return;
    }
    let active = true;

    const fetchLp = async () => {
      setLpLoading(true);
      const result: LiveLpPosition[] = [];

      try {
        const program = getReadOnlyProgram(connection);
        if (!program) { setLpLoading(false); return; }

        for (const pool of pools) {
          try {
            const poolPubkey = new PublicKey(pool.address);
            const [positionPda] = findPositionAddress(poolPubkey, publicKey);
            const posAccount = await (program.account as any).userLiquidityPosition.fetchNullable(positionPda);
            if (!posAccount) continue;

            const lpTokens = fromBN(posAccount.lpTokens as BN, 6);
            if (lpTokens === 0) continue;

            const totalLp = pool.totalLPSupply || 1;
            const share = lpTokens / totalLp;
            const tokenAAmount = pool.reserveA * share;
            const tokenBAmount = pool.reserveB * share;

            const priceA = prices[pool.tokens[0]] ?? 1;
            const priceB = prices[pool.tokens[1]] ?? 1;
            const valueUSD = tokenAAmount * priceA + tokenBAmount * priceB;

            // Estimate APR from fee structure and volume
            const apr = pool.apy ?? 0;

            result.push({
              pair: pool.name,
              tokenA: pool.tokens[0],
              tokenB: pool.tokens[1],
              valueUSD,
              feesEarned: 0, // would need a separate accumulator on-chain
              apr,
              poolAddress: pool.address,
            });
          } catch {
            continue;
          }
        }
      } catch {
        // no-op
      }

      if (active) {
        setLpPositions(result);
        setLpLoading(false);
      }
    };

    fetchLp();
    return () => { active = false; };
  }, [publicKey, pools, prices, connection, lpRefreshCount]);

  // ── DB activity (recent trades) ──
  const tradesKey = walletStr ? `${CHAT_API}/api/history/${walletStr}?limit=5` : null;
  const { data: tradesData } = useSWR(tradesKey, jsonFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const transactions = useMemo<LiveTransaction[]>(() => {
    const trades: any[] = tradesData?.trades ?? [];
    if (trades.length === 0) return [];
    return trades.map((t: any) => ({
      type: (t.type ?? 'SWAP') as LiveTransaction['type'],
      description: t.description ?? `${t.token_in ?? ''} → ${t.token_out ?? ''}`,
      amount: t.amount_in ? `${t.amount_in} ${t.token_in ?? ''}` : `$${t.value_usd ?? 0}`,
      valueUSD: t.value_usd ?? 0,
      time: t.created_at ?? new Date().toISOString(),
      status: (t.status ?? 'SUCCESS') as LiveTransaction['status'],
      txHash: t.tx_hash ?? '',
      fullTxHash: t.tx_hash ?? '',
    }));
  }, [tradesData]);

  // ── News ──
  const [news, setNews] = useState<NewsItem[]>([]);
  useEffect(() => {
    fetchCryptoNews(5).then(setNews);
    const id = setInterval(() => fetchCryptoNews(5).then(setNews), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Aggregates ──
  const spotTotal = useMemo(() => holdings.reduce((s, h) => s + h.valueUSD, 0), [holdings]);
  const lpTotal = useMemo(() => lpPositions.reduce((s, l) => s + l.valueUSD, 0), [lpPositions]);
  const perpsPnl = useMemo(() => perpPositions.reduce((s, p) => s + p.pnl, 0), [perpPositions]);
  const totalValue = spotTotal + lpTotal;
  const feesEarned = useMemo(() => lpPositions.reduce((s, l) => s + l.feesEarned, 0), [lpPositions]);

  // ── Refresh all ──
  const refreshAll = useCallback(() => {
    fetchAllBalances();
    refreshPerps();
    refreshPools?.();
    refreshLp();
    fetchPrices();
  }, [fetchAllBalances, refreshPerps, refreshPools, refreshLp, fetchPrices]);

  const loading = balancesLoading || perpsLoading || poolsLoading || pricesLoading;

  return {
    // data
    holdings,
    perpPositions,
    lpPositions,
    transactions,
    news,
    prices,
    // aggregates
    spotTotal,
    lpTotal,
    perpsPnl,
    totalValue,
    feesEarned,
    // state
    loading,
    lpLoading,
    // actions
    refreshAll,
    refreshLp,
  };
}
