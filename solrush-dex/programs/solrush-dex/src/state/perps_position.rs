use anchor_lang::prelude::*;

#[account]
pub struct PerpsPosition {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub side: u8, // 0 = long, 1 = short
    pub size_i64: i64,
    pub entry_price_i64: i64,
    pub collateral_u64: u64,
    pub leverage_u16: u16,
    pub last_funding_i128: i128,
    pub bump: u8,
}

impl PerpsPosition {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 2 + 16 + 1;
}
