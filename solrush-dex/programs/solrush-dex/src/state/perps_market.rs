use anchor_lang::prelude::*;

#[account]
pub struct PerpsMarket {
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub pyth_feed_id: [u8; 32],
    pub oracle_price_account: Pubkey,
    pub max_leverage: u16,
    pub maintenance_margin_bps: u16,
    pub funding_rate_i64: i64,
    pub open_interest_i128: i128,
    pub cumulative_funding_i128: i128,
    pub last_funding_ts: i64,
    pub collateral_vault: Pubkey,
    pub bump: u8,
}

impl PerpsMarket {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 2 + 2 + 8 + 16 + 16 + 8 + 32 + 1;
}
