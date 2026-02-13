use anchor_lang::prelude::*;

#[event]
pub struct FundingUpdated {
    pub market: Pubkey,
    pub funding_rate: i64,
    pub cumulative_funding: i128,
    pub timestamp: i64,
}

#[event]
pub struct FundingSettled {
    pub position: Pubkey,
    pub funding_delta: i128,
    pub new_collateral: u64,
}
