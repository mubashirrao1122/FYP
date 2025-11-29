use anchor_lang::prelude::*;

// Module declarations
mod state;
mod errors;
mod utils;
mod events;
mod instructions;

// Re-export for external use
pub use state::*;
pub use errors::*;
pub use events::*;
pub use instructions::*;

declare_id!("3jRmy5gMAQLFxb2mD3Gi4p9N9VuwLXp9toaqEhi1QSRT");

// ============================================================================
// PROGRAM MODULE
// ============================================================================

#[program]
pub mod solrush_dex {
    use super::*;

    // ========================================================================
    // MODULE 2: LIQUIDITY POOL MANAGEMENT
    // ========================================================================

    /// Initialize a new liquidity pool
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        initial_deposit_a: u64,
        initial_deposit_b: u64,
    ) -> Result<()> {
        instructions::pool::initialize_pool(ctx, initial_deposit_a, initial_deposit_b)
    }

    /// Add liquidity to an existing pool
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
        min_lp_tokens: u64,
    ) -> Result<()> {
        instructions::pool::add_liquidity(ctx, amount_a, amount_b, min_lp_tokens)
    }

    /// Remove liquidity from a pool
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_tokens_to_burn: u64,
        min_amount_a: u64,
        min_amount_b: u64,
    ) -> Result<()> {
        instructions::pool::remove_liquidity(ctx, lp_tokens_to_burn, min_amount_a, min_amount_b)
    }

    // ========================================================================
    // MODULE 3: TRADING & SWAPS
    // ========================================================================

    /// Execute a token swap
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
        is_a_to_b: bool,
    ) -> Result<()> {
        instructions::swap::swap(ctx, amount_in, minimum_amount_out, is_a_to_b)
    }

    /// Market buy: Buy token A with token B
    pub fn market_buy(
        ctx: Context<MarketBuy>,
        usdc_amount: u64,
        min_sol_received: u64,
    ) -> Result<()> {
        instructions::swap::market_buy(ctx, usdc_amount, min_sol_received)
    }

    /// Market sell: Sell token A for token B
    pub fn market_sell(
        ctx: Context<MarketSell>,
        sol_amount: u64,
        min_usdc_received: u64,
    ) -> Result<()> {
        instructions::swap::market_sell(ctx, sol_amount, min_usdc_received)
    }

    // ========================================================================
    // MODULE 3.4: LIMIT ORDERS
    // ========================================================================

    /// Create a limit order
    pub fn create_limit_order(
        ctx: Context<CreateLimitOrder>,
        sell_amount: u64,
        target_price: u64,
        minimum_receive: u64,
        expiry_days: i64,
    ) -> Result<()> {
        instructions::limit_orders::create_limit_order(
            ctx,
            sell_amount,
            target_price,
            minimum_receive,
            expiry_days,
        )
    }

    /// Execute a limit order
    pub fn execute_limit_order(ctx: Context<ExecuteLimitOrder>) -> Result<()> {
        instructions::limit_orders::execute_limit_order(ctx)
    }

    /// Cancel a limit order
    pub fn cancel_limit_order(ctx: Context<CancelLimitOrder>) -> Result<()> {
        instructions::limit_orders::cancel_limit_order(ctx)
    }

    // ========================================================================
    // MODULE 4: RUSH TOKEN REWARDS
    // ========================================================================

    /// Initialize RUSH token and rewards system
    pub fn initialize_rush_token(ctx: Context<InitializeRushToken>) -> Result<()> {
        instructions::rewards::initialize_rush_token(ctx)
    }

    /// Calculate pending rewards for a position
    pub fn calculate_pending_rewards(ctx: Context<CalculateRewards>) -> Result<u64> {
        instructions::rewards::calculate_pending_rewards(ctx)
    }

    /// Claim accumulated RUSH rewards
    pub fn claim_rush_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::rewards::claim_rush_rewards(ctx)
    }

    /// Update RUSH APY (admin only)
    pub fn update_rush_apy(ctx: Context<UpdateRushAPY>, new_apy: u64) -> Result<()> {
        instructions::rewards::update_rush_apy(ctx, new_apy)
    }

    /// Pause or resume rewards distribution (admin only)
    pub fn pause_rush_rewards(ctx: Context<PauseRewards>) -> Result<()> {
        instructions::rewards::pause_rush_rewards(ctx)
    }
}
