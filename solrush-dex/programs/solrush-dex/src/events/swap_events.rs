use anchor_lang::prelude::*;
#[event]
pub struct SwapExecuted {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub fee_amount: u64,
    pub is_a_to_b: bool,
    pub new_reserve_a: u64,
    pub new_reserve_b: u64,
}
