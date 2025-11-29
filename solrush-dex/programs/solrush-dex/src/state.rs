use anchor_lang::prelude::*;

/// LiquidityPool Account Structure
/// Represents a single trading pair pool (SOL/USDC or SOL/USDT)
///
/// Space: 8 (discriminator) + 32*6 + 8*5 + 1 = 249 bytes
#[account]
pub struct LiquidityPool {
    // Authority and Token Configuration (192 bytes)
    pub authority: Pubkey,           // Pool creator/admin (32 bytes)
    pub token_a_mint: Pubkey,        // SOL mint address (32 bytes)
    pub token_b_mint: Pubkey,        // USDC or USDT mint address (32 bytes)
    pub token_a_vault: Pubkey,       // Vault holding SOL tokens (32 bytes)
    pub token_b_vault: Pubkey,       // Vault holding USDC/USDT tokens (32 bytes)
    pub lp_token_mint: Pubkey,       // LP token mint address (32 bytes)
    
    // Pool State (24 bytes)
    pub reserve_a: u64,              // Current SOL reserve in pool (8 bytes)
    pub reserve_b: u64,              // Current USDC/USDT reserve in pool (8 bytes)
    pub total_lp_supply: u64,        // Total LP tokens in circulation (8 bytes)
    
    // Fee Configuration (16 bytes)
    pub fee_numerator: u64,          // Fee numerator = 3 for 0.3% (8 bytes)
    pub fee_denominator: u64,        // Fee denominator = 1000 (8 bytes)
    
    // PDA Verification (1 byte)
    pub bump: u8,                    // PDA bump seed (1 byte)
}

impl LiquidityPool {
    pub const SIZE: usize = 8 + 32*6 + 8*5 + 1;
}

/// UserLiquidityPosition Account Structure
/// Tracks individual user's LP token position and rewards
///
/// Space: 8 (discriminator) + 32*2 + 8*4 + 1 = 113 bytes
#[account]
pub struct UserLiquidityPosition {
    pub owner: Pubkey,               // User wallet address (32 bytes)
    pub pool: Pubkey,                // Associated pool account (32 bytes)
    pub lp_tokens: u64,              // LP tokens owned by user (8 bytes)
    pub deposit_timestamp: i64,      // When the LP position was created (8 bytes)
    pub last_claim_timestamp: i64,   // Last RUSH reward claim timestamp (8 bytes)
    pub total_rush_claimed: u64,     // Total RUSH tokens claimed (8 bytes)
    pub bump: u8,                    // PDA bump seed (1 byte)
}

impl UserLiquidityPosition {
    pub const SIZE: usize = 8 + 32*2 + 8*4 + 1;
}

/// OrderStatus Enum (Module 3.4)
/// Tracks the lifecycle state of a limit order
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderStatus {
    Pending = 0,    // Order awaiting execution
    Executed = 1,   // Order successfully executed
    Cancelled = 2,  // Order cancelled by owner
    Expired = 3,    // Order expiry time passed
}

/// LimitOrder Account Structure (Module 3.4)
/// Stores a single limit order with price conditions and escrow
///
/// Space: 8 (discriminator) + 32*4 + 8*5 + 8*2 + 1 + 1 = 181 bytes
#[account]
pub struct LimitOrder {
    pub owner: Pubkey,           // Order creator wallet (32 bytes)
    pub pool: Pubkey,            // Target pool for execution (32 bytes)
    pub sell_token: Pubkey,      // Token being sold (32 bytes)
    pub buy_token: Pubkey,       // Token being bought (32 bytes)
    
    pub sell_amount: u64,        // Amount of sell_token in escrow (8 bytes)
    pub target_price: u64,       // Target price with 6 decimals (8 bytes)
    pub minimum_receive: u64,    // Minimum output amount (8 bytes)
    pub created_at: i64,         // Timestamp when order created (8 bytes)
    pub expires_at: i64,         // Expiry timestamp (8 bytes)
    
    pub status: OrderStatus,     // Current order status (1 byte)
    pub bump: u8,                // PDA bump seed (1 byte)
}

impl LimitOrder {
    pub const SIZE: usize = 8 + 32*4 + 8*5 + 8*2 + 1 + 1;
}

// ============================================================================
// RUSH TOKEN CONFIGURATION (Module 4)
// ============================================================================

/// RushConfig Account Structure
/// Manages RUSH token configuration and rewards distribution settings
///
/// Space: 8 (discriminator) + 32*2 + 8*6 + 2 = 122 bytes
///
/// Module 4.1 - RUSH Token Configuration
/// The RushConfig stores all settings for the RUSH token incentive mechanism.
/// Key Properties:
/// - Total Supply: 1,000,000 RUSH tokens (with 6 decimals = 1e12 base units)
/// - Initial APY: 50% annually (50% of supply distributed in first year)
/// - Yearly Rewards: 500,000 RUSH tokens
/// - Reward Rate: ~15.85 RUSH per second (500,000 tokens / 31,536,000 seconds)
/// - Distribution: Time-weighted rewards to liquidity providers (LPs)
/// - Calculation: rewards_per_second = (total_supply * apy) / seconds_per_year
///               = (1,000,000 * 50) / 100 / 31,536,000 = 15.85 RUSH/sec
#[account]
pub struct RushConfig {
    pub mint: Pubkey,                // RUSH token mint address (32 bytes)
    pub authority: Pubkey,           // Minting authority (Program PDA) (32 bytes)
    pub total_supply: u64,           // Max supply: 1,000,000 * 10^6 (8 bytes)
    pub minted_so_far: u64,          // Tokens already distributed (8 bytes)
    pub rewards_per_second: u64,     // Base reward rate (RUSH/second) (8 bytes)
    pub apy_numerator: u64,          // APY numerator: 50 for 50% (8 bytes)
    pub apy_denominator: u64,        // APY denominator: 100 (8 bytes)
    pub start_timestamp: i64,        // When rewards distribution starts (8 bytes)
    pub is_paused: bool,             // Emergency pause flag (1 byte) - Module 4.6
    pub bump: u8,                    // PDA bump seed (1 byte)
}

impl RushConfig {
    pub const SIZE: usize = 8 + 32*2 + 8*6 + 2;
    
    /// Calculate total rewards available per year
    /// Formula: (total_supply * apy_numerator) / apy_denominator
    /// Example: (1_000_000 * 50) / 100 = 500,000 RUSH per year
    pub fn yearly_rewards(&self) -> u64 {
        (self.total_supply * self.apy_numerator) / self.apy_denominator
    }
    
    /// Calculate remaining rewards available to distribute
    pub fn remaining_rewards(&self) -> u64 {
        self.total_supply.saturating_sub(self.minted_so_far)
    }
}
