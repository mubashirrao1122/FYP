export interface MarketView {
  id: string;
  symbol: string;
  baseMint: string;
  quoteMint: string;
  baseSymbol: string;
  quoteSymbol: string;
  oraclePriceId?: string | null;
  markPrice: number | null;
  indexPrice: number | null;
  fundingRate: number | null;
  openInterest: number | null;
  change24h: number | null;
  volume24h: number | null;
  borrowRate: number | null;
  maxLeverage: number | null;
  maintenanceMarginBps: number | null;
  lastUpdated?: number | null;
}

export interface PositionView {
  id: string;
  marketId: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number | null;
  markPrice: number | null;
  pnl: number | null;
  leverage: number | null;
  margin: number | null;
  liquidationPrice: number | null;
}

export interface AccountView {
  owner: string;
  collateralUsd: number | null;
  availableUsd: number | null;
  positions: PositionView[];
  openOrders?: number | null;
}

export interface PythPrice {
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}
