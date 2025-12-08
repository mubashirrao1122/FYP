use anchor_lang::prelude::*;
#[account]
pub struct UserLiquidityPosition {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub lp_tokens: u64,
    pub deposit_timestamp: i64,
    pub last_claim_timestamp: i64,
    pub total_rush_claimed: u64,
    pub bump: u8,
}
impl UserLiquidityPosition {
    pub const SIZE: usize = 8 + 32*2 + 8*4 + 1;
    pub fn get_pool_share(&self, total_lp_supply: u64) -> u64 {
        if total_lp_supply == 0 {
            return 0;
        }
        let share = (self.lp_tokens as u128) * 1_000_000u128 / (total_lp_supply as u128);
        share as u64
    }
    pub fn get_time_since_last_claim(&self, current_timestamp: i64) -> i64 {
        current_timestamp - self.last_claim_timestamp
    }
    pub fn has_liquidity(&self) -> bool {
        self.lp_tokens > 0
    }
    pub fn get_position_age_days(&self, current_timestamp: i64) -> u64 {
        let seconds_elapsed = (current_timestamp - self.deposit_timestamp) as u64;
        seconds_elapsed / 86400
    }
}
