use anchor_lang::prelude::*;

// ============================================================================
// MODULE 2: LIQUIDITY POOL EVENTS
// ============================================================================

/// Event emitted when a new pool is created (Module 2.2)
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

/// Event emitted when liquidity is added to a pool (Module 2.3)
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

/// Event emitted when liquidity is removed from a pool (Module 2.4)
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

// ============================================================================
// MODULE 3: SWAP & LIMIT ORDER EVENTS
// ============================================================================

/// Event emitted when a swap is executed (Module 3.1)
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

/// Event emitted when a limit order is created (Module 3.4)
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

/// Event emitted when a limit order is executed (Module 3.4)
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

/// Event emitted when a limit order is cancelled (Module 3.4)
#[event]
pub struct LimitOrderCancelled {
    pub order: Pubkey,
    pub owner: Pubkey,
    pub refunded_amount: u64,
    pub cancelled_at: i64,
}

// ============================================================================
// MODULE 4: RUSH REWARDS EVENTS
// ============================================================================

/// Event emitted when RUSH token is initialized (Module 4.2)
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

/// Event emitted when rewards are claimed (Module 4.4)
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

/// Event emitted when rewards config is updated (Module 4.6)
#[event]
pub struct RewardsConfigUpdated {
    pub previous_apy_numerator: u64,
    pub new_apy_numerator: u64,
    pub new_rewards_per_second: u64,
    pub updated_at: i64,
    pub updated_by: Pubkey,
}

/// Event emitted when rewards are paused/resumed (Module 4.6)
#[event]
pub struct RewardsPaused {
    pub is_paused: bool,
    pub paused_at: i64,
    pub paused_by: Pubkey,
    pub reason: String,
}
