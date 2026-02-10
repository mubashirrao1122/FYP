'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getConnection } from '@/lib/solana/connection';
import { fetchPerpsMarketExists, fetchPerpsMarkets, fetchPerpsPositions, resolveSymbol } from '@/lib/perps/onchain';
import { PublicKey } from '@solana/web3.js';
import { fetchPythPrices } from '@/lib/perps/pyth';
import { computeLiquidationPrice, computePnl } from '@/lib/perps/compute';
import type { MarketView, PositionView } from '@/lib/perps/types';
import type { Idl } from '@coral-xyz/anchor';

interface UsePerpsResult {
  markets: MarketView[];
  positions: PositionView[];
  loading: boolean;
  error?: string | null;
  warning?: string | null;
  hasMarkets: boolean;
}

const ZERO_ORACLE = `0x${'00'.repeat(32)}`;

export function usePerps(): UsePerpsResult {
  const { publicKey } = useWallet();
  const [markets, setMarkets] = useState<MarketView[]>([]);
  const [positions, setPositions] = useState<PositionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [idl, setIdl] = useState<Idl | null>(null);
  const [hasMarkets, setHasMarkets] = useState(false);
  const initialLoad = useRef(true);

  useEffect(() => {
    let active = true;
    const loadIdl = async () => {
      try {
        const response = await fetch('/idl/solrush_dex.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Unable to load perps IDL.');
        }
        const json = (await response.json()) as Idl;
        if (!json.types) {
          throw new Error('Perps IDL missing `types`.');
        }
        if (!active) return;
        setIdl(json);
        setWarning(null);
      } catch (err) {
        if (!active) return;
        setIdl(null);
        setWarning(err instanceof Error ? err.message : 'Perps IDL failed to load.');
      }
    };

    loadIdl();
    const interval = setInterval(loadIdl, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const connection = getConnection();

    const load = async () => {
      try {
        if (initialLoad.current) {
          setLoading(true);
        }
        setError(null);

        // Check if mock mode is enabled
        const useMock = process.env.NEXT_PUBLIC_USE_MOCK_PERPS === 'true';

        if (useMock) {
          // Use mock data
          const { getMockMarkets, updateAllPrices } = await import('@/lib/perps/mockData');
          const { getPositions, checkLiquidations } = await import('@/lib/perps/mockPositions');

          // Update prices
          updateAllPrices();

          // Get markets
          const mockMarkets = getMockMarkets();
          setHasMarkets(mockMarkets.length > 0);
          setMarkets(mockMarkets);

          // Get positions if wallet connected
          if (publicKey) {
            const mockPositions = getPositions(publicKey.toBase58());
            setPositions(mockPositions);

            // Check for liquidations
            checkLiquidations(publicKey.toBase58());
          } else {
            setPositions([]);
          }

          if (!active) return;
          setLoading(false);
          initialLoad.current = false;
          return;
        }

        if (!idl) {
          const exists = await fetchPerpsMarketExists(connection);
          if (!active) return;
          setHasMarkets(exists);
          setMarkets([]);
          setPositions([]);
          return;
        }

        const rawMarkets = await fetchPerpsMarkets(connection, idl);
        const marketKeys = rawMarkets.map((market) => new PublicKey(market.id));
        setHasMarkets(rawMarkets.length > 0);
        const oracleIds = rawMarkets
          .map((market) => market.oraclePriceId)
          .filter((id): id is string => Boolean(id) && id !== ZERO_ORACLE);

        const prices = await fetchPythPrices(oracleIds);

        const marketViews: MarketView[] = rawMarkets.map((market) => {
          const baseSymbol = resolveSymbol(market.baseMint);
          const quoteSymbol = resolveSymbol(market.quoteMint);
          const normalizedOracle = market.oraclePriceId ?? '';
          const priceData = normalizedOracle ? prices[normalizedOracle] : undefined;
          const indexPrice = priceData?.price ?? null;
          const markPrice = market.markPrice > 0 ? market.markPrice : indexPrice;

          return {
            id: market.id,
            symbol: `${baseSymbol}-PERP`,
            baseMint: market.baseMint,
            quoteMint: market.quoteMint,
            baseSymbol,
            quoteSymbol,
            oraclePriceId: market.oraclePriceId ?? null,
            markPrice,
            indexPrice,
            fundingRate: market.fundingRateBps / 10000,
            openInterest: market.openInterest,
            change24h: null,
            volume24h: null,
            borrowRate: null,
            maxLeverage: market.maxLeverage ?? null,
            maintenanceMarginBps: market.maintenanceMarginBps ?? null,
            lastUpdated: priceData?.publishTime ?? null,
          };
        });

        const marketById = new Map(marketViews.map((market) => [market.id, market]));
        const rawPositions = publicKey
          ? await fetchPerpsPositions(connection, publicKey, marketKeys, idl)
          : [];

        const positionViews: PositionView[] = rawPositions.map((position) => {
          const market = marketById.get(position.market);
          const markPrice = market?.markPrice ?? null;
          const entryPrice = position.entryPrice || null;
          const base: PositionView = {
            id: position.id,
            marketId: position.market,
            side: position.side,
            size: position.size,
            sizeUsd: position.size * (markPrice || 0),
            entryPrice,
            markPrice,
            unrealizedPnl: 0, // Computed below
            leverage: position.leverage || null,
            margin: position.collateral || null,
            collateralUsd: position.collateral || 0,
            liquidationPrice: null,
          };

          const pnl = computePnl(base, markPrice) || 0;

          return {
            ...base,
            unrealizedPnl: pnl,
            liquidationPrice: computeLiquidationPrice(base, market?.maintenanceMarginBps ?? null),
          };
        });

        if (!active) return;
        setMarkets(marketViews);
        setPositions(positionViews);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load perps data.');
      } finally {
        if (!active) return;
        setLoading(false);
        initialLoad.current = false;
      }
    };

    load();
    const interval = setInterval(load, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [publicKey, idl]);

  return useMemo(
    () => ({
      markets,
      positions,
      loading,
      error,
      warning,
      hasMarkets,
    }),
    [markets, positions, loading, error, warning, hasMarkets]
  );
}
