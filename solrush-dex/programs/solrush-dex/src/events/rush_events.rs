use anchor_lang::prelude::*;
#[event]
pub struct RushTokenInitialized {
    pub rush_mint: Pubkey,
    pub rush_config: Pubkey,
    pub total_supply: u64,
    pub rewards_per_second: u64,
    pub apy_numerator: u64,
    pub apy_denominator: u64,
    pub start_timestamp: i64,
    pub authority: Pubkey,
}
#[event]
pub struct RewardsClaimed {
    pub user: Pubkey,
    pub position: Pubkey,
    pub pool: Pubkey,
    pub rewards_amount: u64,
    pub rewards_display: f64,
    pub time_elapsed: i64,
    pub user_lp_share: f64,
    pub claimed_at: i64,
    pub total_claimed_lifetime: u64,
}
#[event]
pub struct RewardsConfigUpdated {
    pub previous_apy_numerator: u64,
    pub new_apy_numerator: u64,
    pub new_rewards_per_second: u64,
    pub updated_at: i64,
    pub updated_by: Pubkey,
}
#[event]
pub struct RewardsPaused {
    pub is_paused: bool,
    pub paused_at: i64,
    pub paused_by: Pubkey,
    pub reason: String,
}
