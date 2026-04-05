/**
 * API utility for matching frontend Solana actions with the SolRush persistent database.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://127.0.0.1:8001';

export interface TradeData {
  wallet_address: string;
  type: string; // SWAP | PERP_OPEN | PERP_CLOSE | LP_ADD | LP_REMOVE | REWARD
  token_in?: string;
  token_out?: string;
  amount_in?: number;
  amount_out?: number;
  price_usd?: number;
  value_usd?: number;
  fee_usd?: number;
  tx_hash?: string;
  description?: string;
  status?: string;
}

export interface PositionData {
  wallet_address: string;
  market: string;
  side: string; // LONG | SHORT
  size_usd: number;
  collateral_usd: number;
  entry_price: number;
  leverage?: number;
  liquidation_price?: number;
  tx_hash?: string;
}

/**
 * Record a completed trade in the PostgreSQL database.
 */
export async function recordTrade(data: TradeData) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    return await response.json();
  } catch (err) {
    console.error('Failed to record trade to SolRush DB:', err);
    return null;
  }
}

/**
 * Record a newly opened perpetual position.
 */
export async function recordPosition(data: PositionData) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    return await response.json();
  } catch (err) {
    console.error('Failed to record position to SolRush DB:', err);
    return null;
  }
}

/**
 * Close an active perpetual position.
 */
export async function closePositionSync(
  positionId: string, 
  exitPrice: number, 
  txHash?: string,
  wallet?: string,
  market?: string
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/positions/${positionId}/close`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        exit_price: exitPrice, 
        tx_hash: txHash,
        wallet_address: wallet,
        market: market
      }),
    });
    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    return await response.json();
  } catch (err) {
    console.error('Failed to sync closed position to SolRush DB:', err);
    return null;
  }
}
