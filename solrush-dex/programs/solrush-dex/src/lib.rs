use anchor_lang::prelude::*;
mod state;
mod errors;
mod utils;
mod events;
mod instructions;
mod constants;

pub use state::*;
pub use errors::*;
pub use events::*;
pub use instructions::*;
pub use constants::*;

declare_id!("FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1");
#[program]
pub mod solrush_dex {
    use super::*;
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
    ) -> Result<()> {
        instructions::pool::initialize_pool(ctx)
    }
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
        min_lp_tokens: u64,
    ) -> Result<()> {
        instructions::pool::add_liquidity(ctx, amount_a, amount_b, min_lp_tokens)
    }
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_tokens_to_burn: u64,
        min_amount_a: u64,
        min_amount_b: u64,
    ) -> Result<()> {
        instructions::pool::remove_liquidity(ctx, lp_tokens_to_burn, min_amount_a, min_amount_b)
    }
    pub fn close_pool(ctx: Context<ClosePool>) -> Result<()> {
        instructions::pool::close_pool(ctx)
    }
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
        is_a_to_b: bool,
        deadline: i64,
    ) -> Result<()> {
        instructions::swap::swap(ctx, amount_in, minimum_amount_out, is_a_to_b, deadline)
    }
    pub fn market_buy(
        ctx: Context<MarketBuy>,
        amount_b_in: u64,
        min_a_received: u64,
        deadline: i64,
    ) -> Result<()> {
        instructions::swap::market_buy(ctx, amount_b_in, min_a_received, deadline)
    }
    pub fn market_sell(
        ctx: Context<MarketSell>,
        amount_a_in: u64,
        min_b_received: u64,
        deadline: i64,
    ) -> Result<()> {
        instructions::swap::market_sell(ctx, amount_a_in, min_b_received, deadline)
    }
    pub fn create_limit_order(
        ctx: Context<CreateLimitOrder>,
        sell_amount: u64,
        target_price: u64,
        minimum_receive: u64,
        expiry_days: i64,
        order_id: u64,
    ) -> Result<()> {
        instructions::limit_orders::create_limit_order(
            ctx,
            sell_amount,
            target_price,
            minimum_receive,
            expiry_days,
            order_id,
        )
    }
    pub fn execute_limit_order(ctx: Context<ExecuteLimitOrder>) -> Result<()> {
        instructions::limit_orders::execute_limit_order(ctx)
    }
    pub fn cancel_limit_order(ctx: Context<CancelLimitOrder>) -> Result<()> {
        instructions::limit_orders::cancel_limit_order(ctx)
    }
    pub fn initialize_rush_token(ctx: Context<InitializeRushToken>) -> Result<()> {
        instructions::rewards::initialize_rush_token(ctx)
    }
    pub fn calculate_pending_rewards(ctx: Context<CalculateRewards>) -> Result<u64> {
        instructions::rewards::calculate_pending_rewards(ctx)
    }
    pub fn claim_rush_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::rewards::claim_rush_rewards(ctx)
    }
    pub fn update_rush_apy(ctx: Context<UpdateRushAPY>, new_apy: u64) -> Result<()> {
        instructions::rewards::update_rush_apy(ctx, new_apy)
    }
    pub fn pause_rush_rewards(ctx: Context<PauseRewards>) -> Result<()> {
        instructions::rewards::pause_rush_rewards(ctx)
    }
}
