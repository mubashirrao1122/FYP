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

#[event]
pub struct Liquidated {
    /// The position that was liquidated.
    pub position: Pubkey,
    /// Owner of the liquidated position.
    pub owner: Pubkey,
    /// The liquidator who triggered the liquidation.
    pub liquidator: Pubkey,
    /// Market of the position.
    pub market: Pubkey,
    /// Base size that was closed during liquidation.
    pub size_closed_i64: i64,
    /// Mark price at liquidation.
    pub mark_price_i64: i64,
    /// Fee paid to the liquidator (quote token atomic units).
    pub liquidator_fee_u64: u64,
    /// Penalty sent to the insurance fund (quote token atomic units).
    pub insurance_penalty_u64: u64,
    /// Bad debt absorbed by insurance fund (0 if equity >= 0).
    pub bad_debt_u64: u64,
    /// Whether the market entered emergency mode.
    pub emergency: bool,
}
