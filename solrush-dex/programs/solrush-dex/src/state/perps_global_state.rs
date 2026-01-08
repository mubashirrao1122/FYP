use anchor_lang::prelude::*;

#[account]
pub struct PerpsGlobalState {
    pub authority: Pubkey,
    pub paused: bool,
    pub fee_bps: u16,
    pub bump: u8,
}

impl PerpsGlobalState {
    pub const LEN: usize = 8 + 32 + 1 + 2 + 1;
}
