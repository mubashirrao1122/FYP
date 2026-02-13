use anchor_lang::prelude::*;

/// Perps position account.
///
/// `base_position_i64` is signed: positive = long, negative = short.
/// The legacy `side` field is kept for ABI compatibility but is now derived
/// from the sign of `base_position_i64`.
///
/// `realized_pnl_i128` accumulates PnL from partial/full closes, in
/// PRICE_SCALE-squared units (base_units × price_units).  To get quote
/// value divide by PRICE_SCALE.
#[account]
pub struct PerpsPosition {
    pub owner: Pubkey,
    pub market: Pubkey,
    /// Legacy direction indicator.  Derived from `base_position_i64` sign.
    /// 0 = long (or empty), 1 = short.
    pub side: u8,
    /// Signed base position.  +ve = long, -ve = short, 0 = no position.
    pub base_position_i64: i64,
    /// Weighted-average entry price (PRICE_SCALE units, always >= 0).
    pub entry_price_i64: i64,
    /// Collateral locked for this position (quote token atomic units).
    pub collateral_u64: u64,
    pub leverage_u16: u16,
    /// Cumulative funding index at last settlement (placeholder for Phase 3).
    pub last_funding_i128: i128,
    pub bump: u8,
    /// Accumulated realized PnL from partial/full closes (signed, scaled).
    pub realized_pnl_i128: i128,
}

impl PerpsPosition {
    // 8 (discriminator) + 32 + 32 + 1 + 8 + 8 + 8 + 2 + 16 + 1 + 16 = 132
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 2 + 16 + 1 + 16;

    /// Helper: is this position empty / closed?
    pub fn is_empty(&self) -> bool {
        self.base_position_i64 == 0
    }

    /// Helper: derive side from signed base.
    pub fn derived_side(&self) -> u8 {
        if self.base_position_i64 >= 0 { 0 } else { 1 }
    }
}
