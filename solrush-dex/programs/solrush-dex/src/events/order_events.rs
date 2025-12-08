use anchor_lang::prelude::*;
#[event]
pub struct LimitOrderCreated {
    pub order: Pubkey,
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub sell_token: Pubkey,
    pub buy_token: Pubkey,
    pub sell_amount: u64,
    pub target_price: u64,
    pub minimum_receive: u64,
    pub expires_at: i64,
}
#[event]
pub struct LimitOrderExecuted {
    pub order: Pubkey,
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub sell_amount: u64,
    pub receive_amount: u64,
    pub execution_price: u64,
    pub executed_at: i64,
}
#[event]
pub struct LimitOrderCancelled {
    pub order: Pubkey,
    pub owner: Pubkey,
    pub refunded_amount: u64,
    pub cancelled_at: i64,
}
