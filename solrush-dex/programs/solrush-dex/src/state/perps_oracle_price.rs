use anchor_lang::prelude::*;

#[account]
pub struct PerpsOraclePrice {
    pub admin: Pubkey,
    pub price_i64: i64,
    pub last_update_ts: i64,
    pub bump: u8,
}

impl PerpsOraclePrice {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 1;
}
