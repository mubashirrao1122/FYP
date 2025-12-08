use anchor_lang::prelude::*;
#[event]
pub struct PoolCreated {
    pub pool: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub lp_token_supply: u64,
    pub authority: Pubkey,
}
#[event]
pub struct LiquidityAdded {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub lp_tokens_minted: u64,
    pub new_reserve_a: u64,
    pub new_reserve_b: u64,
}
#[event]
pub struct LiquidityRemoved {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub lp_tokens_burned: u64,
    pub amount_a_received: u64,
    pub amount_b_received: u64,
    pub new_reserve_a: u64,
    pub new_reserve_b: u64,
}
