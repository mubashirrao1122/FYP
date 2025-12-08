use anchor_lang::prelude::*;
#[account]
pub struct RushConfig {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub total_supply: u64,
    pub minted_so_far: u64,
    pub rewards_per_second: u64,
    pub apy_numerator: u64,
    pub apy_denominator: u64,
    pub start_timestamp: i64,
    pub is_paused: bool,
    pub bump: u8,
}
impl RushConfig {
    pub const SIZE: usize = 8 + 32*2 + 8*6 + 2;
    pub const SECONDS_PER_YEAR: u64 = 31_536_000;
    pub fn yearly_rewards(&self) -> u64 {
        (self.total_supply * self.apy_numerator) / self.apy_denominator
    }
    pub fn remaining_rewards(&self) -> u64 {
        self.total_supply.saturating_sub(self.minted_so_far)
    }
    pub fn has_remaining_rewards(&self) -> bool {
        self.remaining_rewards() > 0
    }
    pub fn is_active(&self) -> bool {
        !self.is_paused && self.has_remaining_rewards()
    }
    pub fn distribution_percentage(&self) -> f64 {
        if self.total_supply == 0 {
            return 0.0;
        }
        (self.minted_so_far as f64) / (self.total_supply as f64) * 100.0
    }
    pub fn calculate_rewards(
        &self,
        time_elapsed: u64,
        user_lp_tokens: u64,
        total_lp_supply: u64,
    ) -> u64 {
        if total_lp_supply == 0 || user_lp_tokens == 0 || self.is_paused {
            return 0;
        }
        let base_rewards = (self.rewards_per_second as u128) * (time_elapsed as u128);
        let user_rewards = base_rewards * (user_lp_tokens as u128) / (total_lp_supply as u128);
        let remaining = self.remaining_rewards() as u128;
        let final_rewards = user_rewards.min(remaining);
        final_rewards as u64
    }
}
