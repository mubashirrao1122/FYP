use anchor_lang::prelude::*;

#[account]
pub struct PerpsUserAccount {
    pub owner: Pubkey,
    pub collateral_quote_u64: u64,
    pub positions_count_u8: u8,
    pub bump: u8,
}

impl PerpsUserAccount {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1;
}
