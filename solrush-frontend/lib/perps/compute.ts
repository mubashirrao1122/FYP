import type { MarketView, PositionView } from '@/lib/perps/types';

export const computeMarkPrice = (market: MarketView) => {
  if (market.markPrice !== null) return market.markPrice;
  if (market.indexPrice !== null) return market.indexPrice;
  return null;
};

export const computePnl = (position: PositionView, markPrice: number | null) => {
  if (markPrice === null || position.entryPrice === null) return null;
  const priceDelta =
    position.side === 'long' ? markPrice - position.entryPrice : position.entryPrice - markPrice;
  return priceDelta * position.size;
};

export const computeLiquidationPrice = (
  position: PositionView,
  maintenanceMarginBps?: number | null
) => {
  if (
    position.entryPrice === null ||
    position.margin === null ||
    position.size <= 0 ||
    position.leverage === null
  ) {
    return null;
  }

  const notional = position.entryPrice * position.size;
  const maintenanceMargin = maintenanceMarginBps ? (notional * maintenanceMarginBps) / 10000 : 0;
  const availableMargin = Math.max(position.margin - maintenanceMargin, 0);
  const delta = availableMargin / position.size;

  return position.side === 'long' ? position.entryPrice - delta : position.entryPrice + delta;
};
