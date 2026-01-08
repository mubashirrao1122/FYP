export interface PerpsMarket {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  markPrice: number;
  change24h: number;
  fundingRate: number;
  openInterest: number;
}

export interface PerpsPosition {
  id: string;
  marketId: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  leverage: number;
  margin: number;
}
