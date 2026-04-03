use anchor_lang::prelude::*;
#[account]
pub struct LiquidityPool {
    pub authority: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_vault: Pubkey,
    pub token_b_vault: Pubkey,
    pub lp_token_mint: Pubkey,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub total_lp_supply: u64,
    pub fee_numerator: u64,
    pub fee_denominator: u64,
    pub token_a_decimals: u8,
    pub token_b_decimals: u8,
    pub is_stablecoin_pool: bool,
    pub created_at: i64,
    pub total_volume_a: u64,
    pub total_volume_b: u64,
    pub locked_liquidity: u64,
    pub bump: u8,
}
impl LiquidityPool {
    pub const SIZE: usize = 8     // discriminator
        + 32 * 6  // authority, token_a_mint, token_b_mint, token_a_vault, token_b_vault, lp_token_mint
        + 8 * 5   // reserve_a, reserve_b, total_lp_supply, fee_numerator, fee_denominator
        + 1 + 1   // token_a_decimals, token_b_decimals
        + 1       // is_stablecoin_pool
        + 8       // created_at (i64)
        + 8 * 2   // total_volume_a, total_volume_b
        + 8       // locked_liquidity (reserved for future use)
        + 1;      // bump
    pub fn is_stable_pair(&self) -> bool {
        self.is_stablecoin_pool
    }
    pub fn get_price_a_to_b(&self) -> u64 {
        if self.reserve_a == 0 {
            return 0;
        }
        let numerator = (self.reserve_b as u128) * 1_000_000u128;
        let price = numerator / (self.reserve_a as u128);
        price as u64
    }
    pub fn get_price_b_to_a(&self) -> u64 {
        if self.reserve_b == 0 {
            return 0;
        }
        let numerator = (self.reserve_a as u128) * 1_000_000u128;
        let price = numerator / (self.reserve_b as u128);
        price as u64
    }
    pub fn get_constant_product(&self) -> u128 {
        (self.reserve_a as u128) * (self.reserve_b as u128)
    }
    pub fn get_fee_percentage(&self) -> f64 {
        (self.fee_numerator as f64) / (self.fee_denominator as f64) * 100.0
    }
}
