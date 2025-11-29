use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint, MintTo, mint_to, Transfer, transfer, Burn, burn},
};

// Module declarations
mod state;
mod errors;
mod utils;

// Import state structures and types
use state::{LiquidityPool, UserLiquidityPosition, LimitOrder, OrderStatus, RushConfig};

// Import error types
use errors::CustomError;

declare_id!("3jRmy5gMAQLFxb2mD3Gi4p9N9VuwLXp9toaqEhi1QSRT");

// ============================================================================
// STATE STRUCTURES (Module 2.1 - Refactored)
// ============================================================================
// NOTE: LiquidityPool and UserLiquidityPosition are defined in state/mod.rs
// Re-exported above for convenience

// ============================================================================
// EVENTS (Module 2.2, 2.3, 2.4)
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

// ============================================================================
// EVENTS (Module 3.4: Limit Orders)
// ============================================================================

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
// EVENTS (Module 4: RUSH Token & Rewards System)
// ============================================================================

/// Event emitted when RUSH token configuration is initialized (Module 4.2)
#[event]
pub struct RushTokenInitialized {
    pub rush_mint: Pubkey,           // Address of RUSH token mint
    pub rush_config: Pubkey,         // Address of RushConfig account
    pub total_supply: u64,           // Max RUSH tokens (1,000,000 * 10^6)
    pub rewards_per_second: u64,     // Reward rate (~15.85 RUSH/sec for 50% APY)
    pub apy_numerator: u64,          // APY numerator (50 for 50%)
    pub apy_denominator: u64,        // APY denominator (100)
    pub start_timestamp: i64,        // When rewards distribution begins
    pub authority: Pubkey,           // Minting authority
}

/// Event emitted when RUSH rewards are claimed (Module 4.4)
#[event]
pub struct RewardsClaimed {
    pub user: Pubkey,                // User who claimed rewards
    pub position: Pubkey,            // UserLiquidityPosition account
    pub pool: Pubkey,                // Pool where LP tokens are held
    pub rewards_amount: u64,         // Amount of RUSH claimed (in base units)
    pub rewards_display: f64,        // Amount for display (in RUSH tokens)
    pub time_elapsed: i64,           // Seconds since last claim
    pub user_lp_share: f64,          // User's share percentage (0.0 to 1.0)
    pub claimed_at: i64,             // Timestamp when claimed
    pub total_claimed_lifetime: u64, // Total RUSH claimed by user (cumulative)
}

// ============================================================================
// EVENTS (Module 4.5 & 4.6: View & Admin Functions)
// ============================================================================

/// Event emitted when RUSH APY is updated by authority (Module 4.6)
#[event]
pub struct RewardsConfigUpdated {
    pub previous_apy_numerator: u64,  // Previous APY numerator
    pub new_apy_numerator: u64,       // New APY numerator
    pub new_rewards_per_second: u64,  // Updated rewards per second
    pub updated_at: i64,              // When the update occurred
    pub updated_by: Pubkey,           // Authority who made the update
}

/// Event emitted when RUSH rewards are paused (Module 4.6)
#[event]
pub struct RewardsPaused {
    pub is_paused: bool,              // True if paused, false if resumed
    pub paused_at: i64,               // When the pause occurred
    pub paused_by: Pubkey,            // Authority who paused rewards
    pub reason: String,               // Reason for pause/resume
}

// ============================================================================
// DATA STRUCTURES (Module 4.5: View Functions)
// ============================================================================

/// Comprehensive rewards information for a user's LP position
/// Returned by get_user_rewards_info (Module 4.5)
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UserRewardsInfo {
    pub pending_rewards: u64,         // Unclaimed RUSH rewards in base units
    pub total_claimed: u64,           // Total RUSH claimed to date (base units)
    pub current_apy: u64,             // Current APY percentage (e.g., 50 for 50%)
    pub position_value_usd: u64,      // Estimated USD value of position (scaled by 1e6)
    pub time_since_deposit: i64,      // Seconds elapsed since initial deposit
}

/// Calculate LP tokens using geometric mean formula
/// LP tokens = sqrt(amount_a * amount_b)
/// Used in initialize_pool (Module 2.2)
fn calculate_lp_tokens(amount_a: u64, amount_b: u64) -> Result<u64> {
    let product = (amount_a as u128)
        .checked_mul(amount_b as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    Ok((isqrt(product)) as u64)
}

/// Calculate LP tokens to mint when adding liquidity (Module 2.3)
/// Formula: min(lp_from_a, lp_from_b)
/// where: lp_from_x = (amount_x / reserve_x) * total_lp_supply
fn calculate_lp_tokens_for_add_liquidity(
    amount_a: u64,
    amount_b: u64,
    reserve_a: u64,
    reserve_b: u64,
    total_lp_supply: u64,
) -> Result<u64> {
    require!(amount_a > 0 && amount_b > 0, CustomError::InvalidAmount);
    require!(reserve_a > 0 && reserve_b > 0, CustomError::InsufficientLiquidity);

    let lp_from_a = (amount_a as u128)
        .checked_mul(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;

    let lp_from_b = (amount_b as u128)
        .checked_mul(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_b as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;

    Ok(if lp_from_a < lp_from_b { lp_from_a } else { lp_from_b })
}

/// Calculate return amounts when removing liquidity (Module 2.4)
/// Formulas:
/// amount_a = (lp_tokens_to_burn / total_lp_supply) * reserve_a
/// amount_b = (lp_tokens_to_burn / total_lp_supply) * reserve_b
fn calculate_remove_liquidity_amounts(
    lp_tokens_to_burn: u64,
    total_lp_supply: u64,
    reserve_a: u64,
    reserve_b: u64,
) -> Result<(u64, u64)> {
    require!(lp_tokens_to_burn > 0, CustomError::InvalidAmount);
    require!(total_lp_supply > 0, CustomError::InsufficientLiquidity);

    let amount_a = (lp_tokens_to_burn as u128)
        .checked_mul(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;

    let amount_b = (lp_tokens_to_burn as u128)
        .checked_mul(reserve_b as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;

    Ok((amount_a, amount_b))
}

/// Validate that amounts maintain pool ratio within 1% tolerance (Module 2.3)
fn validate_ratio_imbalance(
    amount_a: u64,
    amount_b: u64,
    reserve_a: u64,
    reserve_b: u64,
) -> Result<()> {
    let expected_ratio = (reserve_b as u128)
        .checked_mul(10000)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let provided_ratio = (amount_b as u128)
        .checked_mul(10000)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(amount_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let tolerance = 100u128;
    let diff = if expected_ratio > provided_ratio {
        expected_ratio - provided_ratio
    } else {
        provided_ratio - expected_ratio
    };

    require!(diff <= tolerance, CustomError::RatioImbalance);
    Ok(())
}

/// Module 2.5 & 3.1: Calculate output amount for swaps with fee
/// 
/// Implements constant product formula: (x + amount_in) * (y - amount_out) = x * y
/// With fee deduction applied before swap calculation
/// 
/// Parameters:
/// - input_amount: Amount of input token to swap
/// - input_reserve: Current reserve of input token in pool
/// - output_reserve: Current reserve of output token in pool
/// - fee_numerator: Fee numerator (e.g., 3 for 0.3% fee)
/// - fee_denominator: Fee denominator (e.g., 1000 for 0.3% fee)
/// 
/// Returns: Amount of output tokens received
fn calculate_output_amount(
    input_amount: u64,
    input_reserve: u64,
    output_reserve: u64,
    fee_numerator: u64,
    fee_denominator: u64,
) -> Result<u64> {
    require!(input_amount > 0, CustomError::InvalidAmount);
    require!(
        input_reserve > 0 && output_reserve > 0,
        CustomError::InsufficientLiquidity
    );

    // Calculate amount after fee deduction
    // amount_with_fee = input_amount * (fee_denominator - fee_numerator) / fee_denominator
    let fee_amount = (input_amount as u128)
        .checked_mul(fee_numerator as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(fee_denominator as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let amount_with_fee = (input_amount as u128)
        .checked_sub(fee_amount)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    // Apply constant product formula
    // k = input_reserve * output_reserve
    // output = output_reserve - (k / (input_reserve + amount_with_fee))
    let k = (input_reserve as u128)
        .checked_mul(output_reserve as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let new_input_reserve = (input_reserve as u128)
        .checked_add(amount_with_fee)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let new_output_reserve = k
        .checked_div(new_input_reserve)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let output_amount = (output_reserve as u128)
        .checked_sub(new_output_reserve)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    require!(output_amount > 0, CustomError::InsufficientLiquidity);

    Ok(output_amount as u64)
}

/// Integer square root using Newton's method
fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    
    let mut x = n;
    let mut y = (x + 1) / 2;
    
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    
    x
}

// ============================================================================
// MODULE 3.5: PRICE CALCULATION HELPERS (Pyth Oracle & Local Pool Price)
// ============================================================================

/// Calculate local pool price with 6 decimal precision
/// 
/// Formula: price = (reserve_b * 1_000_000) / reserve_a
/// Returns price of token_a in terms of token_b
fn calculate_pool_price(reserve_a: u64, reserve_b: u64) -> Result<u64> {
    require!(reserve_a > 0, CustomError::InsufficientLiquidity);
    
    let price = (reserve_b as u128)
        .checked_mul(1_000_000)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    
    Ok(price)
}

/// Compare pool price against target price for limit order execution
/// 
/// For sell orders (selling token_a for token_b):
/// - Condition: pool_price >= target_price (want more token_b per token_a)
/// 
/// Parameters:
/// - pool_price: Current pool price (reserve_b / reserve_a) with 6 decimals
/// - target_price: Target price with 6 decimals
/// - is_sell: true if selling token_a, false if selling token_b
/// 
/// Returns: true if price condition is met
fn check_price_condition(
    pool_price: u64,
    target_price: u64,
    is_sell: bool,
) -> bool {
    if is_sell {
        // For sell: we want pool_price >= target_price
        // (want to receive more per unit)
        pool_price >= target_price
    } else {
        // For buy: we want pool_price <= target_price
        // (want to pay less per unit)
        pool_price <= target_price
    }
}

// ============================================================================
// PROGRAM INSTRUCTIONS
// ============================================================================

#[program]
pub mod solrush_dex {
    use super::*;

    // ========================================================================
    // MODULE 2.2: INITIALIZE POOL
    // ========================================================================

    /// Initialize a new liquidity pool with initial deposits
    /// 
    /// Requirements:
    /// - Both initial deposits must be > 0
    /// - Creates LP token mint with pool as authority
    /// - Creates token vaults for both tokens
    /// - Calculates initial LP supply using geometric mean
    /// - Mints initial LP tokens to caller
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        initial_deposit_a: u64,
        initial_deposit_b: u64,
    ) -> Result<()> {
        // Validation: Both deposits must be greater than 0
        require!(
            initial_deposit_a > 0 && initial_deposit_b > 0,
            CustomError::InvalidInitialDeposit
        );

        let pool = &mut ctx.accounts.pool;
        
        // Set pool configuration
        pool.authority = ctx.accounts.authority.key();
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.token_a_vault = ctx.accounts.token_a_vault.key();
        pool.token_b_vault = ctx.accounts.token_b_vault.key();
        pool.lp_token_mint = ctx.accounts.lp_token_mint.key();
        
        // Initialize reserves with first deposits
        pool.reserve_a = initial_deposit_a;
        pool.reserve_b = initial_deposit_b;
        
        // Set fee parameters: 0.3% fee (numerator=3, denominator=1000)
        pool.fee_numerator = 3;
        pool.fee_denominator = 1000;
        pool.bump = ctx.bumps.pool;
        
        // Calculate initial LP tokens using geometric mean: sqrt(reserve_a * reserve_b)
        let lp_tokens = calculate_lp_tokens(initial_deposit_a, initial_deposit_b)?;
        pool.total_lp_supply = lp_tokens;
        
        // Mint initial LP tokens
        let token_a_mint_key = ctx.accounts.token_a_mint.key();
        let token_b_mint_key = ctx.accounts.token_b_mint.key();
        let bump_seed = pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            token_a_mint_key.as_ref(),
            token_b_mint_key.as_ref(),
            &[bump_seed],
        ]];
        
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.lp_token_mint.to_account_info(),
                    to: ctx.accounts.lp_token_account.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            lp_tokens,
        )?;
        
        // Transfer initial deposits from user to vaults
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_a.to_account_info(),
                    to: ctx.accounts.token_a_vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            initial_deposit_a,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_b.to_account_info(),
                    to: ctx.accounts.token_b_vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            initial_deposit_b,
        )?;
        
        // Emit event
        emit!(PoolCreated {
            pool: pool.key(),
            token_a_mint: ctx.accounts.token_a_mint.key(),
            token_b_mint: ctx.accounts.token_b_mint.key(),
            reserve_a: initial_deposit_a,
            reserve_b: initial_deposit_b,
            lp_token_supply: lp_tokens,
            authority: ctx.accounts.authority.key(),
        });

        msg!(
            "✓ Pool initialized: A={} | B={} | LP={} | Fee=0.3%",
            initial_deposit_a,
            initial_deposit_b,
            lp_tokens
        );
        Ok(())
    }

    // ========================================================================
    // MODULE 2.3: ADD LIQUIDITY
    // ========================================================================

    /// Add liquidity to an existing pool
    ///
    /// LP Calculation: min(lp_from_a, lp_from_b)
    /// where:
    ///   lp_from_a = (amount_a / reserve_a) * total_lp_supply
    ///   lp_from_b = (amount_b / reserve_b) * total_lp_supply
    ///
    /// Requirements:
    /// - Both amounts must be > 0
    /// - User must have sufficient token balance
    /// - Ratio validation: |expected_ratio - provided_ratio| <= 1%
    /// - Slippage protection: lp_to_mint >= min_lp_tokens
    /// - Creates or updates user position with deposit timestamp
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
        min_lp_tokens: u64,
    ) -> Result<()> {
        require!(amount_a > 0 && amount_b > 0, CustomError::InvalidAmount);
        require!(
            ctx.accounts.user_token_a.amount >= amount_a,
            CustomError::InsufficientBalance
        );
        require!(
            ctx.accounts.user_token_b.amount >= amount_b,
            CustomError::InsufficientBalance
        );

        let pool = &mut ctx.accounts.pool;

        // Validate ratio imbalance (1% tolerance)
        validate_ratio_imbalance(amount_a, amount_b, pool.reserve_a, pool.reserve_b)?;

        // Calculate LP tokens: min(lp_from_a, lp_from_b)
        let lp_tokens_to_mint = calculate_lp_tokens_for_add_liquidity(
            amount_a,
            amount_b,
            pool.reserve_a,
            pool.reserve_b,
            pool.total_lp_supply,
        )?;

        // Slippage protection
        require!(
            lp_tokens_to_mint >= min_lp_tokens,
            CustomError::SlippageTooHigh
        );

        // Transfer tokens from user to vaults
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_a.to_account_info(),
                    to: ctx.accounts.token_a_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_a,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_b.to_account_info(),
                    to: ctx.accounts.token_b_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_b,
        )?;

        // Update pool reserves
        pool.reserve_a = pool
            .reserve_a
            .checked_add(amount_a)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.reserve_b = pool
            .reserve_b
            .checked_add(amount_b)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.total_lp_supply = pool
            .total_lp_supply
            .checked_add(lp_tokens_to_mint)
            .ok_or(error!(CustomError::CalculationOverflow))?;

        // Mint LP tokens to user
        let pool_key = pool.key();
        let token_a_mint_key = pool.token_a_mint;
        let token_b_mint_key = pool.token_b_mint;
        let bump_seed = pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            token_a_mint_key.as_ref(),
            token_b_mint_key.as_ref(),
            &[bump_seed],
        ]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.lp_token_mint.to_account_info(),
                    to: ctx.accounts.user_lp_token_account.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            lp_tokens_to_mint,
        )?;

        // Create or update user position
        let user_position = &mut ctx.accounts.user_position;
        if user_position.owner == Pubkey::default() {
            user_position.owner = ctx.accounts.user.key();
            user_position.pool = pool_key;
            user_position.deposit_timestamp = Clock::get()?.unix_timestamp;
            user_position.bump = ctx.bumps.user_position;
        }

        user_position.lp_tokens = user_position
            .lp_tokens
            .checked_add(lp_tokens_to_mint)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        user_position.last_claim_timestamp = Clock::get()?.unix_timestamp;

        emit!(LiquidityAdded {
            user: ctx.accounts.user.key(),
            pool: pool_key,
            amount_a,
            amount_b,
            lp_tokens_minted: lp_tokens_to_mint,
            new_reserve_a: pool.reserve_a,
            new_reserve_b: pool.reserve_b,
        });

        msg!(
            "✓ Liquidity added: A={} | B={} | LP minted={} | New reserves: A={}, B={}",
            amount_a,
            amount_b,
            lp_tokens_to_mint,
            pool.reserve_a,
            pool.reserve_b
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 2.4: REMOVE LIQUIDITY
    // ========================================================================

    /// Remove liquidity from a pool and burn LP tokens
    ///
    /// Return Amount Calculation:
    ///   amount_a = (lp_tokens_to_burn / total_lp_supply) * reserve_a
    ///   amount_b = (lp_tokens_to_burn / total_lp_supply) * reserve_b
    ///
    /// Requirements:
    /// - lp_tokens_to_burn must be > 0
    /// - User must have sufficient LP token balance
    /// - Slippage protection: returned amounts >= min requirements
    /// - Pool must have sufficient reserves
    /// - Updates user position after removal
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_tokens_to_burn: u64,
        min_amount_a: u64,
        min_amount_b: u64,
    ) -> Result<()> {
        require!(lp_tokens_to_burn > 0, CustomError::InvalidAmount);
        require!(
            ctx.accounts.user_lp_token_account.amount >= lp_tokens_to_burn,
            CustomError::InsufficientLPBalance
        );
        require!(
            ctx.accounts.user_position.lp_tokens >= lp_tokens_to_burn,
            CustomError::InsufficientLPBalance
        );

        let pool = &mut ctx.accounts.pool;

        // Calculate proportional return amounts
        let (amount_a, amount_b) = calculate_remove_liquidity_amounts(
            lp_tokens_to_burn,
            pool.total_lp_supply,
            pool.reserve_a,
            pool.reserve_b,
        )?;

        // Slippage protection
        require!(amount_a >= min_amount_a, CustomError::SlippageTooHigh);
        require!(amount_b >= min_amount_b, CustomError::SlippageTooHigh);
        
        // Verify pool has sufficient reserves
        require!(
            ctx.accounts.token_a_vault.amount >= amount_a,
            CustomError::InsufficientPoolReserves
        );
        require!(
            ctx.accounts.token_b_vault.amount >= amount_b,
            CustomError::InsufficientPoolReserves
        );

        // Burn LP tokens from user
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.lp_token_mint.to_account_info(),
                    from: ctx.accounts.user_lp_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            lp_tokens_to_burn,
        )?;

        // Update pool reserves
        pool.reserve_a = pool
            .reserve_a
            .checked_sub(amount_a)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        pool.reserve_b = pool
            .reserve_b
            .checked_sub(amount_b)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        pool.total_lp_supply = pool
            .total_lp_supply
            .checked_sub(lp_tokens_to_burn)
            .ok_or(error!(CustomError::CalculationOverflow))?;

        // Transfer tokens from vaults back to user
        let pool_key = pool.key();
        let token_a_mint = pool.token_a_mint;
        let token_b_mint = pool.token_b_mint;
        let bump_seed = pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            token_a_mint.as_ref(),
            token_b_mint.as_ref(),
            &[bump_seed],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_a_vault.to_account_info(),
                    to: ctx.accounts.user_token_a.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount_a,
        )?;

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_b_vault.to_account_info(),
                    to: ctx.accounts.user_token_b.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount_b,
        )?;

        // Update user position
        let user_position = &mut ctx.accounts.user_position;
        user_position.lp_tokens = user_position
            .lp_tokens
            .checked_sub(lp_tokens_to_burn)
            .ok_or(error!(CustomError::InsufficientLPBalance))?;

        emit!(LiquidityRemoved {
            user: ctx.accounts.user.key(),
            pool: pool_key,
            lp_tokens_burned: lp_tokens_to_burn,
            amount_a_received: amount_a,
            amount_b_received: amount_b,
            new_reserve_a: pool.reserve_a,
            new_reserve_b: pool.reserve_b,
        });

        msg!(
            "✓ Liquidity removed: LP burned={} | Received: A={}, B={} | New reserves: A={}, B={}",
            lp_tokens_to_burn,
            amount_a,
            amount_b,
            pool.reserve_a,
            pool.reserve_b
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 3.1: SWAP
    // ========================================================================

    /// Execute a swap transaction with constant product formula
    /// 
    /// Parameters:
    /// - amount_in: Amount of input token to swap
    /// - minimum_amount_out: Minimum output amount (slippage protection)
    /// - is_a_to_b: true = Token A to Token B (SOL→USDC), false = Token B to Token A (USDC→SOL)
    /// 
    /// Formula:
    /// amount_in_with_fee = amount_in * 997 / 1000  (0.3% fee deduction)
    /// numerator = amount_in_with_fee * output_reserve
    /// denominator = (input_reserve * 1000) + amount_in_with_fee
    /// amount_out = numerator / denominator
    /// 
    /// Requirements:
    /// - amount_in > 0
    /// - Pool must have sufficient output liquidity
    /// - User must have sufficient input token balance
    /// - amount_out >= minimum_amount_out (slippage protection)
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
        is_a_to_b: bool,
    ) -> Result<()> {
        // Validation: Input amount must be greater than 0
        require!(amount_in > 0, CustomError::InvalidAmount);

        let pool = &mut ctx.accounts.pool;

        // Determine input/output reserves based on direction
        let (input_reserve, output_reserve) = if is_a_to_b {
            (pool.reserve_a, pool.reserve_b)
        } else {
            (pool.reserve_b, pool.reserve_a)
        };

        // Verify pool has sufficient liquidity
        require!(
            output_reserve > 0 && input_reserve > 0,
            CustomError::InsufficientLiquidity
        );

        // Verify user has sufficient input token balance
        require!(
            ctx.accounts.user_token_in.amount >= amount_in,
            CustomError::InsufficientBalance
        );

        // Calculate output using constant product formula with fee
        let amount_out = calculate_output_amount(
            amount_in,
            input_reserve,
            output_reserve,
            pool.fee_numerator,
            pool.fee_denominator,
        )?;

        // Slippage protection: verify output >= minimum_amount_out
        require!(
            amount_out >= minimum_amount_out,
            CustomError::SlippageTooHigh
        );

        // Verify pool vault has sufficient output tokens
        require!(
            ctx.accounts.pool_vault_out.amount >= amount_out,
            CustomError::InsufficientPoolReserves
        );

        // Calculate fee for tracking
        let fee_amount = (amount_in as u128)
            .checked_mul(pool.fee_numerator as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(pool.fee_denominator as u128)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;

        // Transfer input tokens from user to pool vault
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_in.to_account_info(),
                    to: ctx.accounts.pool_vault_in.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;

        // Update pool reserves (input increases, output decreases)
        if is_a_to_b {
            pool.reserve_a = pool
                .reserve_a
                .checked_add(amount_in)
                .ok_or(error!(CustomError::CalculationOverflow))?;
            pool.reserve_b = pool
                .reserve_b
                .checked_sub(amount_out)
                .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        } else {
            pool.reserve_b = pool
                .reserve_b
                .checked_add(amount_in)
                .ok_or(error!(CustomError::CalculationOverflow))?;
            pool.reserve_a = pool
                .reserve_a
                .checked_sub(amount_out)
                .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        }

        // Transfer output tokens from pool vault to user
        let pool_key = pool.key();
        let token_a_mint = pool.token_a_mint;
        let token_b_mint = pool.token_b_mint;
        let bump_seed = pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            token_a_mint.as_ref(),
            token_b_mint.as_ref(),
            &[bump_seed],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_vault_out.to_account_info(),
                    to: ctx.accounts.user_token_out.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount_out,
        )?;

        // Emit swap event
        emit!(SwapExecuted {
            user: ctx.accounts.user.key(),
            pool: pool_key,
            amount_in,
            amount_out,
            fee_amount,
            is_a_to_b,
            new_reserve_a: pool.reserve_a,
            new_reserve_b: pool.reserve_b,
        });

        msg!(
            "✓ Swap executed: Direction={} | In={} | Out={} | Fee={} | New reserves: A={}, B={}",
            if is_a_to_b { "A→B" } else { "B→A" },
            amount_in,
            amount_out,
            fee_amount,
            pool.reserve_a,
            pool.reserve_b
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 3.2: MARKET BUY (Wrapper around swap())
    // ========================================================================

    /// Market buy: Buy SOL with USDC
    /// 
    /// This is a simplified wrapper around swap() with is_a_to_b=false (USDC → SOL)
    /// Provides user-friendly naming: "I'm buying SOL" instead of "swapping USDC for SOL"
    /// 
    /// Parameters:
    /// - usdc_amount: How much USDC to spend
    /// - min_sol_received: Minimum SOL expected (slippage protection)
    pub fn market_buy(
        ctx: Context<MarketBuy>,
        usdc_amount: u64,
        min_sol_received: u64,
    ) -> Result<()> {
        // Validation: USDC amount must be greater than 0
        require!(usdc_amount > 0, CustomError::InvalidAmount);

        let pool = &mut ctx.accounts.pool;

        // Determine input/output reserves for USDC→SOL swap (is_a_to_b=false, so B→A)
        let (input_reserve, output_reserve) = (pool.reserve_b, pool.reserve_a);

        // Verify pool has sufficient SOL liquidity
        require!(
            output_reserve > 0 && input_reserve > 0,
            CustomError::InsufficientLiquidity
        );

        // Verify user has sufficient USDC balance
        require!(
            ctx.accounts.user_token_in.amount >= usdc_amount,
            CustomError::InsufficientBalance
        );

        // Calculate SOL output using constant product formula with 0.3% fee
        let sol_amount_out = calculate_output_amount(
            usdc_amount,
            input_reserve,
            output_reserve,
            pool.fee_numerator,
            pool.fee_denominator,
        )?;

        // Slippage protection: verify output >= minimum_amount_out
        require!(
            sol_amount_out >= min_sol_received,
            CustomError::SlippageTooHigh
        );

        // Verify pool vault has sufficient SOL
        require!(
            ctx.accounts.pool_vault_out.amount >= sol_amount_out,
            CustomError::InsufficientPoolReserves
        );

        // Calculate fee for tracking
        let fee_amount = (usdc_amount as u128)
            .checked_mul(pool.fee_numerator as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(pool.fee_denominator as u128)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;

        // Transfer USDC from user to pool vault
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_in.to_account_info(),
                    to: ctx.accounts.pool_vault_in.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // Update pool reserves: USDC increases (reserve_b), SOL decreases (reserve_a)
        pool.reserve_b = pool
            .reserve_b
            .checked_add(usdc_amount)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.reserve_a = pool
            .reserve_a
            .checked_sub(sol_amount_out)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;

        // Transfer SOL from pool vault to user
        let pool_key = pool.key();
        let token_a_mint = pool.token_a_mint;
        let token_b_mint = pool.token_b_mint;
        let bump_seed = pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            token_a_mint.as_ref(),
            token_b_mint.as_ref(),
            &[bump_seed],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_vault_out.to_account_info(),
                    to: ctx.accounts.user_token_out.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            sol_amount_out,
        )?;

        // Emit swap event (is_a_to_b=false for USDC→SOL)
        emit!(SwapExecuted {
            user: ctx.accounts.user.key(),
            pool: pool_key,
            amount_in: usdc_amount,
            amount_out: sol_amount_out,
            fee_amount,
            is_a_to_b: false,
            new_reserve_a: pool.reserve_a,
            new_reserve_b: pool.reserve_b,
        });

        msg!(
            "🛒 Market buy executed: Spent USDC={} | Received SOL={} | Fee={}",
            usdc_amount,
            sol_amount_out,
            fee_amount
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 3.3: MARKET SELL (Wrapper around swap())
    // ========================================================================

    /// Market sell: Sell SOL for USDC
    /// 
    /// This is a simplified wrapper around swap() with is_a_to_b=true (SOL → USDC)
    /// Provides user-friendly naming: "I'm selling SOL" instead of "swapping SOL for USDC"
    /// 
    /// Parameters:
    /// - sol_amount: How much SOL to sell
    /// - min_usdc_received: Minimum USDC expected (slippage protection)
    pub fn market_sell(
        ctx: Context<MarketSell>,
        sol_amount: u64,
        min_usdc_received: u64,
    ) -> Result<()> {
        // Validation: SOL amount must be greater than 0
        require!(sol_amount > 0, CustomError::InvalidAmount);

        let pool = &mut ctx.accounts.pool;

        // Determine input/output reserves for SOL→USDC swap (is_a_to_b=true, so A→B)
        let (input_reserve, output_reserve) = (pool.reserve_a, pool.reserve_b);

        // Verify pool has sufficient USDC liquidity
        require!(
            output_reserve > 0 && input_reserve > 0,
            CustomError::InsufficientLiquidity
        );

        // Verify user has sufficient SOL balance
        require!(
            ctx.accounts.user_token_in.amount >= sol_amount,
            CustomError::InsufficientBalance
        );

        // Calculate USDC output using constant product formula with 0.3% fee
        let usdc_amount_out = calculate_output_amount(
            sol_amount,
            input_reserve,
            output_reserve,
            pool.fee_numerator,
            pool.fee_denominator,
        )?;

        // Slippage protection: verify output >= minimum_amount_out
        require!(
            usdc_amount_out >= min_usdc_received,
            CustomError::SlippageTooHigh
        );

        // Verify pool vault has sufficient USDC
        require!(
            ctx.accounts.pool_vault_out.amount >= usdc_amount_out,
            CustomError::InsufficientPoolReserves
        );

        // Calculate fee for tracking
        let fee_amount = (sol_amount as u128)
            .checked_mul(pool.fee_numerator as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(pool.fee_denominator as u128)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;

        // Transfer SOL from user to pool vault
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_in.to_account_info(),
                    to: ctx.accounts.pool_vault_in.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            sol_amount,
        )?;

        // Update pool reserves: SOL increases (reserve_a), USDC decreases (reserve_b)
        pool.reserve_a = pool
            .reserve_a
            .checked_add(sol_amount)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.reserve_b = pool
            .reserve_b
            .checked_sub(usdc_amount_out)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;

        // Transfer USDC from pool vault to user
        let pool_key = pool.key();
        let token_a_mint = pool.token_a_mint;
        let token_b_mint = pool.token_b_mint;
        let bump_seed = pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            token_a_mint.as_ref(),
            token_b_mint.as_ref(),
            &[bump_seed],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_vault_out.to_account_info(),
                    to: ctx.accounts.user_token_out.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            usdc_amount_out,
        )?;

        // Emit swap event (is_a_to_b=true for SOL→USDC)
        emit!(SwapExecuted {
            user: ctx.accounts.user.key(),
            pool: pool_key,
            amount_in: sol_amount,
            amount_out: usdc_amount_out,
            fee_amount,
            is_a_to_b: true,
            new_reserve_a: pool.reserve_a,
            new_reserve_b: pool.reserve_b,
        });

        msg!(
            "📊 Market sell executed: Sold SOL={} | Received USDC={} | Fee={}",
            sol_amount,
            usdc_amount_out,
            fee_amount
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 3.4: CREATE LIMIT ORDER
    // ========================================================================

    /// Create a limit order that waits for price condition before execution
    /// 
    /// Parameters:
    /// - sell_amount: Amount of tokens to sell
    /// - target_price: Target price with 6 decimals (e.g., 105000000 = 105.0)
    /// - minimum_receive: Minimum tokens to receive
    /// - expiry_days: Order valid for X days
    pub fn create_limit_order(
        ctx: Context<CreateLimitOrder>,
        sell_amount: u64,
        target_price: u64,
        minimum_receive: u64,
        expiry_days: i64,
    ) -> Result<()> {
        // Validation
        require!(sell_amount > 0, CustomError::InvalidAmount);
        require!(target_price > 0, CustomError::InvalidAmount);
        require!(minimum_receive > 0, CustomError::InvalidAmount);
        require!(expiry_days > 0, CustomError::InvalidExpiryTime);

        // Verify user has sufficient sell tokens
        require!(
            ctx.accounts.user_token_in.amount >= sell_amount,
            CustomError::InsufficientBalance
        );

        // Create limit order account
        let order = &mut ctx.accounts.limit_order;
        let now = Clock::get()?.unix_timestamp;
        
        order.owner = ctx.accounts.user.key();
        order.pool = ctx.accounts.pool.key();
        order.sell_token = ctx.accounts.user_token_in.mint;
        order.buy_token = ctx.accounts.user_token_out.mint;
        order.sell_amount = sell_amount;
        order.target_price = target_price;
        order.minimum_receive = minimum_receive;
        order.created_at = now;
        order.expires_at = now + (expiry_days * 86400); // 86400 seconds per day
        order.status = OrderStatus::Pending;
        order.bump = ctx.bumps.limit_order;

        // Transfer sell tokens from user to escrow vault
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_in.to_account_info(),
                    to: ctx.accounts.order_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            sell_amount,
        )?;

        emit!(LimitOrderCreated {
            order: order.key(),
            owner: ctx.accounts.user.key(),
            pool: ctx.accounts.pool.key(),
            sell_token: ctx.accounts.user_token_in.mint,
            buy_token: ctx.accounts.user_token_out.mint,
            sell_amount,
            target_price,
            minimum_receive,
            expires_at: order.expires_at,
        });

        msg!(
            "⏰ Limit order created: Amount={} | Target Price={} | Expires at={}",
            sell_amount,
            target_price,
            order.expires_at
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 3.4: EXECUTE LIMIT ORDER
    // ========================================================================

    /// Execute a limit order when price condition is met
    /// Can be called by anyone (bot, keeper, or owner)
    pub fn execute_limit_order(
        ctx: Context<ExecuteLimitOrder>,
    ) -> Result<()> {
        let order = &mut ctx.accounts.limit_order;
        let pool = &mut ctx.accounts.pool;
        let now = Clock::get()?.unix_timestamp;

        // Verify order status
        require!(
            order.status == OrderStatus::Pending,
            CustomError::InvalidOrderStatus
        );

        // Verify order hasn't expired
        require!(now < order.expires_at, CustomError::OrderExpired);

        // Get current pool price using Pyth Oracle
        let current_price = calculate_pool_price(pool.reserve_a, pool.reserve_b)?;

        // Determine if this is a sell order (selling token_a) or buy order
        let is_sell = order.sell_token == pool.token_a_mint;

        // Check if price condition is met
        require!(
            check_price_condition(current_price, order.target_price, is_sell),
            CustomError::PriceConditionNotMet
        );

        // Calculate output amount using AMM
        let output_amount = utils::calculate_output_amount(
            order.sell_amount,
            if is_sell { pool.reserve_a } else { pool.reserve_b },
            if is_sell { pool.reserve_b } else { pool.reserve_a },
            pool.fee_numerator,
            pool.fee_denominator,
        )?;

        // Verify meets minimum receive requirement
        require!(
            output_amount >= order.minimum_receive,
            CustomError::SlippageTooHigh
        );

        // Update pool reserves
        if is_sell {
            pool.reserve_a = pool
                .reserve_a
                .checked_add(order.sell_amount)
                .ok_or(error!(CustomError::CalculationOverflow))?;
            pool.reserve_b = pool
                .reserve_b
                .checked_sub(output_amount)
                .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        } else {
            pool.reserve_b = pool
                .reserve_b
                .checked_add(order.sell_amount)
                .ok_or(error!(CustomError::CalculationOverflow))?;
            pool.reserve_a = pool
                .reserve_a
                .checked_sub(output_amount)
                .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        }

        // Transfer output tokens to order owner
        let pool_key = pool.key();
        let token_a_mint = pool.token_a_mint;
        let token_b_mint = pool.token_b_mint;
        let bump_seed = pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            token_a_mint.as_ref(),
            token_b_mint.as_ref(),
            &[bump_seed],
        ]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_vault_out.to_account_info(),
                    to: ctx.accounts.user_token_out.to_account_info(),
                    authority: pool.to_account_info(),
                },
                signer_seeds,
            ),
            output_amount,
        )?;

        // Update order status
        order.status = OrderStatus::Executed;

        emit!(LimitOrderExecuted {
            order: order.key(),
            owner: order.owner,
            pool: pool_key,
            sell_amount: order.sell_amount,
            receive_amount: output_amount,
            execution_price: current_price,
            executed_at: now,
        });

        msg!(
            "✅ Limit order executed: Sold={} | Received={} | Price={}",
            order.sell_amount,
            output_amount,
            current_price
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 3.4: CANCEL LIMIT ORDER
    // ========================================================================

    /// Cancel a pending limit order and refund escrow
    /// Only the order owner can cancel
    pub fn cancel_limit_order(
        ctx: Context<CancelLimitOrder>,
    ) -> Result<()> {
        let order = &mut ctx.accounts.limit_order;

        // Verify caller is order owner
        require!(
            ctx.accounts.user.key() == order.owner,
            CustomError::UnauthorizedOrderOwner
        );

        // Verify order is still pending
        require!(
            order.status == OrderStatus::Pending,
            CustomError::InvalidOrderStatus
        );

        let now = Clock::get()?.unix_timestamp;

        // Refund escrowed tokens to owner
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.order_vault.to_account_info(),
                    to: ctx.accounts.user_token_in.to_account_info(),
                    authority: order.to_account_info(),
                },
            ),
            order.sell_amount,
        )?;

        // Update order status
        order.status = OrderStatus::Cancelled;

        emit!(LimitOrderCancelled {
            order: order.key(),
            owner: order.owner,
            refunded_amount: order.sell_amount,
            cancelled_at: now,
        });

        msg!(
            "❌ Limit order cancelled: Amount refunded={}",
            order.sell_amount
        );

        Ok(())
    }

    // ========================================================================
    // MODULE 4.2: INITIALIZE RUSH TOKEN
    // ========================================================================

    /// Initialize RUSH token and rewards configuration
    /// 
    /// Creates a new SPL token mint for RUSH with 6 decimals and sets up the rewards system.
    /// This instruction establishes the base configuration for distributing RUSH token rewards
    /// to liquidity providers.
    ///
    /// Calculations:
    /// - Total Supply: 1,000,000 RUSH tokens (1,000,000 * 10^6 = 1e12 base units)
    /// - Initial APY: 50% annually
    /// - Yearly Rewards: 500,000 RUSH tokens per year
    /// - Reward Rate: rewards_per_second = (500,000 * 10^6) / 31,536,000 ≈ 15,853,375 base units/sec
    ///              ≈ 15.85 RUSH tokens per second
    ///
    /// The APY is configurable via apy_numerator and apy_denominator:
    /// - apy_numerator = 50 (represents 50%)
    /// - apy_denominator = 100 (divisor)
    /// - Actual APY = (50 / 100) * 100% = 50%
    ///
    /// Parameters: None (uses hardcoded values for security)
    pub fn initialize_rush_token(
        ctx: Context<InitializeRushToken>,
    ) -> Result<()> {
        // ====================================================================
        // CONSTANTS
        // ====================================================================
        const RUSH_DECIMALS: u8 = 6;
        const MAX_RUSH_SUPPLY: u64 = 1_000_000; // 1 million tokens
        const MAX_RUSH_SUPPLY_BASE: u64 = 1_000_000 * 1_000_000; // With 6 decimals = 1e12
        const APY_NUMERATOR: u64 = 50; // 50% APY
        const APY_DENOMINATOR: u64 = 100; // /100 = 50%
        const SECONDS_PER_YEAR: u64 = 365 * 24 * 60 * 60; // 31,536,000 seconds
        
        // ====================================================================
        // CALCULATIONS
        // ====================================================================
        
        // Calculate yearly rewards: (1,000,000 * 50) / 100 = 500,000 RUSH/year
        let yearly_rewards = (MAX_RUSH_SUPPLY as u128 * APY_NUMERATOR as u128)
            .checked_div(APY_DENOMINATOR as u128)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;
        
        // Verify yearly rewards doesn't exceed total supply
        require!(
            yearly_rewards <= MAX_RUSH_SUPPLY,
            CustomError::InvalidAmount
        );
        
        // Calculate rewards per second: (500,000 * 10^6) / 31,536,000
        // In base units: 15,853,375 base units per second
        let rewards_per_second_base = (yearly_rewards as u128)
            .checked_mul(10u128.pow(RUSH_DECIMALS as u32))
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(SECONDS_PER_YEAR as u128)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;
        
        // ====================================================================
        // INITIALIZE RUSH CONFIG
        // ====================================================================
        
        let rush_config = &mut ctx.accounts.rush_config;
        let rush_config_key = rush_config.key();
        let rush_mint_key = ctx.accounts.rush_mint.key();
        let authority_key = ctx.accounts.authority.key();
        let bump_seed = ctx.bumps.rush_config;
        let now_timestamp = Clock::get()?.unix_timestamp;
        
        rush_config.mint = rush_mint_key;
        rush_config.authority = rush_config_key; // PDA is authority
        rush_config.total_supply = MAX_RUSH_SUPPLY_BASE;
        rush_config.minted_so_far = 0; // No tokens minted yet
        rush_config.rewards_per_second = rewards_per_second_base;
        rush_config.apy_numerator = APY_NUMERATOR;
        rush_config.apy_denominator = APY_DENOMINATOR;
        rush_config.start_timestamp = now_timestamp;
        rush_config.bump = bump_seed;
        
        // ====================================================================
        // EMIT EVENT
        // ====================================================================
        
        emit!(RushTokenInitialized {
            rush_mint: rush_mint_key,
            rush_config: rush_config_key,
            total_supply: MAX_RUSH_SUPPLY_BASE,
            rewards_per_second: rewards_per_second_base,
            apy_numerator: APY_NUMERATOR,
            apy_denominator: APY_DENOMINATOR,
            start_timestamp: now_timestamp,
            authority: authority_key,
        });
        
        // ====================================================================
        // LOGGING
        // ====================================================================
        
        msg!("╔════════════════════════════════════════════════════════════╗");
        msg!("║         RUSH TOKEN INITIALIZATION SUCCESSFUL              ║");
        msg!("╚════════════════════════════════════════════════════════════╝");
        msg!("📊 Configuration:");
        msg!("  • Mint: {}", rush_mint_key);
        msg!("  • Total Supply: {} RUSH (1e12 base units)", MAX_RUSH_SUPPLY);
        msg!("  • APY: {}%", APY_NUMERATOR);
        msg!("  • Rewards/Second: {:.2} RUSH", rewards_per_second_base as f64 / 1e6);
        msg!("  • Yearly Distribution: {:.0} RUSH", yearly_rewards as f64);
        msg!("  • Start Timestamp: {}", now_timestamp);
        msg!("═══════════════════════════════════════════════════════════════");
        
        Ok(())
    }

    // ========================================================================
    // MODULE 4.3: CALCULATE PENDING REWARDS
    // ========================================================================

    /// Calculate pending RUSH rewards for a liquidity provider
    /// 
    /// Algorithm:
    /// 1. Time elapsed = current_time - last_claim_timestamp
    /// 2. User share = user_lp_tokens / total_lp_supply
    /// 3. Period rewards = rewards_per_second * time_elapsed
    /// 4. User rewards = period_rewards * user_share
    /// 5. Convert to token units (multiply by 10^decimals)
    /// 6. Validate against max supply
    ///
    /// Returns: Amount of RUSH tokens (in base units with 6 decimals)
    pub fn calculate_pending_rewards(
        ctx: Context<CalculateRewards>,
    ) -> Result<u64> {
        let position = &ctx.accounts.position;
        let pool = &ctx.accounts.pool;
        let rush_config = &ctx.accounts.rush_config;
        let current_time = Clock::get()?.unix_timestamp;
        
        // ====================================================================
        // VALIDATION
        // ====================================================================
        
        require!(
            position.lp_tokens > 0,
            CustomError::InvalidAmount
        );
        require!(
            pool.total_lp_supply > 0,
            CustomError::InsufficientLiquidity
        );
        
        // ====================================================================
        // STEP 1: CALCULATE TIME ELAPSED
        // ====================================================================
        
        let time_elapsed = current_time
            .checked_sub(position.last_claim_timestamp)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;
        
        // No rewards if no time has passed
        if time_elapsed == 0 {
            return Ok(0);
        }
        
        // ====================================================================
        // STEP 2 & 3: CALCULATE USER SHARE AND PERIOD REWARDS
        // ====================================================================
        
        // User share as fixed-point (scale by 10^12 for precision)
        let user_share_fixed = (position.lp_tokens as u128)
            .checked_mul(1_000_000_000_000u128) // scale by 10^12
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(pool.total_lp_supply as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // Total rewards in this period (base units per second * elapsed seconds)
        let period_rewards_fixed = (rush_config.rewards_per_second as u128)
            .checked_mul(time_elapsed as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // ====================================================================
        // STEP 4: CALCULATE USER'S PORTION
        // ====================================================================
        
        let user_rewards_fixed = period_rewards_fixed
            .checked_mul(user_share_fixed)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(1_000_000_000_000u128)  // remove fixed-point scaling
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // Convert to u64
        let user_rewards = user_rewards_fixed
            .try_into()
            .map_err(|_| error!(CustomError::CalculationOverflow))?;
        
        // ====================================================================
        // STEP 5: VALIDATE AGAINST MAX SUPPLY
        // ====================================================================
        
        let new_minted_total = rush_config.minted_so_far
            .checked_add(user_rewards)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        require!(
            new_minted_total <= rush_config.total_supply,
            CustomError::InvalidAmount
        );
        
        msg!(
            "📊 Rewards calculated: {} base units ({:.6} RUSH) | Time: {} sec | Share: {:.6}%",
            user_rewards,
            user_rewards as f64 / 1_000_000.0,
            time_elapsed,
            (user_share_fixed as f64 / 1_000_000_000_000.0) * 100.0
        );
        
        Ok(user_rewards)
    }

    // ========================================================================
    // MODULE 4.4: CLAIM RUSH REWARDS
    // ========================================================================

    /// Claim accrued RUSH rewards and mint them to user's account
    /// 
    /// Steps:
    /// 1. Calculate pending rewards
    /// 2. Validate rewards > 0
    /// 3. Mint RUSH tokens to user
    /// 4. Update position.last_claim_timestamp
    /// 5. Update position.total_rush_claimed
    /// 6. Update rush_config.minted_so_far
    /// 7. Emit RewardsClaimed event
    pub fn claim_rush_rewards(
        ctx: Context<ClaimRewards>,
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        let pool = &ctx.accounts.pool;
        let rush_config = &mut ctx.accounts.rush_config;
        let current_time = Clock::get()?.unix_timestamp;
        
        // ====================================================================
        // STEP 1: CALCULATE PENDING REWARDS
        // ====================================================================
        
        // Validation
        require!(
            position.lp_tokens > 0,
            CustomError::InvalidAmount
        );
        require!(
            pool.total_lp_supply > 0,
            CustomError::InsufficientLiquidity
        );
        
        // Time elapsed
        let time_elapsed = current_time
            .checked_sub(position.last_claim_timestamp)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;
        
        // User share (fixed-point with 10^12 scaling)
        let user_share_fixed = (position.lp_tokens as u128)
            .checked_mul(1_000_000_000_000u128)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(pool.total_lp_supply as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // Period rewards
        let period_rewards_fixed = (rush_config.rewards_per_second as u128)
            .checked_mul(time_elapsed as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // User rewards
        let user_rewards_fixed = period_rewards_fixed
            .checked_mul(user_share_fixed)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(1_000_000_000_000u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        let user_rewards = user_rewards_fixed
            .try_into()
            .map_err(|_| error!(CustomError::CalculationOverflow))?;
        
        // ====================================================================
        // STEP 2: VALIDATE REWARDS > 0
        // ====================================================================
        
        require!(
            user_rewards > 0,
            CustomError::InvalidAmount
        );
        
        // ====================================================================
        // STEP 3: VALIDATE MAX SUPPLY
        // ====================================================================
        
        let new_minted_total = rush_config.minted_so_far
            .checked_add(user_rewards)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        require!(
            new_minted_total <= rush_config.total_supply,
            CustomError::InvalidAmount
        );
        
        // ====================================================================
        // STEP 4: MINT RUSH TOKENS
        // ====================================================================
        
        let bump_seed = rush_config.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"rush_config", &[bump_seed]]];
        
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.rush_mint.to_account_info(),
                    to: ctx.accounts.user_rush_account.to_account_info(),
                    authority: rush_config.to_account_info(),
                },
                signer_seeds,
            ),
            user_rewards,
        )?;
        
        // ====================================================================
        // STEP 5-6: UPDATE STATE
        // ====================================================================
        
        position.last_claim_timestamp = current_time;
        position.total_rush_claimed = position.total_rush_claimed
            .checked_add(user_rewards)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        rush_config.minted_so_far = new_minted_total;
        
        // ====================================================================
        // STEP 7: EMIT EVENT
        // ====================================================================
        
        let user_share_percent = (user_share_fixed as f64 / 1_000_000_000_000.0) * 100.0;
        let user_rewards_display = user_rewards as f64 / 1_000_000.0;
        
        emit!(RewardsClaimed {
            user: ctx.accounts.user.key(),
            position: position.key(),
            pool: pool.key(),
            rewards_amount: user_rewards,
            rewards_display: user_rewards_display,
            time_elapsed: time_elapsed as i64,
            user_lp_share: user_share_fixed as f64 / 1_000_000_000_000.0,
            claimed_at: current_time,
            total_claimed_lifetime: position.total_rush_claimed,
        });
        
        msg!("╔════════════════════════════════════════════════════════════╗");
        msg!("║              ✅ REWARDS CLAIMED SUCCESSFULLY               ║");
        msg!("╚════════════════════════════════════════════════════════════╝");
        msg!("💰 Reward Details:");
        msg!("   • Amount: {:.6} RUSH ({} base units)", user_rewards_display, user_rewards);
        msg!("   • Your Share: {:.6}%", user_share_percent);
        msg!("   • Time Held: {} seconds ({:.2} days)", time_elapsed, time_elapsed as f64 / 86400.0);
        msg!("   • Lifetime Total: {:.6} RUSH", position.total_rush_claimed as f64 / 1_000_000.0);
        msg!("═════════════════════════════════════════════════════════════");
        
        Ok(())
    }

    // ========================================================================
    // MODULE 4.5: VIEW FUNCTIONS (READ-ONLY)
    // ========================================================================

    /// Get comprehensive rewards information for a user's LP position
    /// 
    /// Returns UserRewardsInfo containing:
    /// - Pending rewards (unclaimed)
    /// - Total claimed (historical)
    /// - Current APY
    /// - Position value in USD (estimated)
    /// - Time since deposit
    pub fn get_user_rewards_info(
        ctx: Context<GetUserRewards>,
    ) -> Result<UserRewardsInfo> {
        let position = &ctx.accounts.position;
        let pool = &ctx.accounts.pool;
        let rush_config = &ctx.accounts.rush_config;
        let current_time = Clock::get()?.unix_timestamp;
        
        // ====================================================================
        // STEP 1: VALIDATE POSITION
        // ====================================================================
        
        require!(
            position.lp_tokens > 0,
            CustomError::InvalidAmount
        );
        require!(
            pool.total_lp_supply > 0,
            CustomError::InsufficientLiquidity
        );
        
        // ====================================================================
        // STEP 2: CALCULATE PENDING REWARDS
        // ====================================================================
        
        let time_elapsed = current_time
            .checked_sub(position.last_claim_timestamp)
            .ok_or(error!(CustomError::CalculationOverflow))? as u64;
        
        // User share (fixed-point with 10^12 scaling)
        let user_share_fixed = (position.lp_tokens as u128)
            .checked_mul(1_000_000_000_000u128)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(pool.total_lp_supply as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // Period rewards
        let period_rewards_fixed = (rush_config.rewards_per_second as u128)
            .checked_mul(time_elapsed as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // User rewards
        let user_rewards_fixed = period_rewards_fixed
            .checked_mul(user_share_fixed)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(1_000_000_000_000u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        let pending_rewards = user_rewards_fixed
            .try_into()
            .unwrap_or(0u64);
        
        // Ensure we don't exceed max supply
        let pending_rewards = if rush_config.minted_so_far + pending_rewards > rush_config.total_supply {
            rush_config.total_supply.saturating_sub(rush_config.minted_so_far)
        } else {
            pending_rewards
        };
        
        // ====================================================================
        // STEP 3: GET TOTAL CLAIMED (from position state)
        // ====================================================================
        
        let total_claimed = position.total_rush_claimed;
        
        // ====================================================================
        // STEP 4: GET CURRENT APY
        // ====================================================================
        
        let current_apy = rush_config.apy_numerator;
        
        // ====================================================================
        // STEP 5: CALCULATE POSITION VALUE IN USD
        // ====================================================================
        // 
        // Estimated calculation:
        // position_value_usd = (lp_tokens / total_lp_supply) * (reserve_a + reserve_b)
        // scaled by 1e6 for precision
        //
        // Note: In production, use oracle prices for token values
        
        let user_lp_percentage = (position.lp_tokens as u128)
            .checked_mul(1_000_000_000_000u128)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(pool.total_lp_supply as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // Total pool value (in base units, assuming 1:1 for now)
        let total_pool_value = (pool.reserve_a as u128)
            .checked_add(pool.reserve_b as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // User's share of pool value
        let position_value = total_pool_value
            .checked_mul(user_lp_percentage)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(1_000_000_000_000u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        let position_value_usd = (position_value as u64)
            .saturating_mul(1_000_000); // Scale by 1e6
        
        // ====================================================================
        // STEP 6: CALCULATE TIME SINCE DEPOSIT
        // ====================================================================
        
        let time_since_deposit = current_time
            .checked_sub(position.deposit_timestamp)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        // ====================================================================
        // STEP 7: RETURN USER REWARDS INFO
        // ====================================================================
        
        Ok(UserRewardsInfo {
            pending_rewards,
            total_claimed,
            current_apy,
            position_value_usd,
            time_since_deposit,
        })
    }

    // ========================================================================
    // MODULE 4.6: ADMIN FUNCTIONS
    // ========================================================================

    /// Update RUSH APY (authority only)
    /// 
    /// Requires:
    /// - Signer to be the configured authority
    /// - new_apy: APY percentage (e.g., 30 for 30%)
    /// 
    /// Effects:
    /// - Updates apy_numerator
    /// - Recalculates rewards_per_second
    /// - Emits RewardsConfigUpdated event
    pub fn update_rush_apy(
        ctx: Context<UpdateRushAPY>,
        new_apy: u64,
    ) -> Result<()> {
        let rush_config = &mut ctx.accounts.rush_config;
        let current_time = Clock::get()?.unix_timestamp;
        
        // ====================================================================
        // STEP 1: VERIFY AUTHORITY
        // ====================================================================
        
        require_eq!(
            ctx.accounts.authority.key(),
            rush_config.authority,
            CustomError::InvalidAuthority
        );
        
        // ====================================================================
        // STEP 2: VALIDATE APY (0-500%)
        // ====================================================================
        
        require!(
            new_apy > 0 && new_apy <= 500,
            CustomError::InvalidAmount
        );
        
        // ====================================================================
        // STEP 3: CALCULATE NEW REWARDS PER SECOND
        // ====================================================================
        // 
        // Calculation:
        // rewards_per_second = (total_supply * new_apy) / apy_denominator / seconds_per_year
        // seconds_per_year = 365 * 24 * 60 * 60 = 31,536,000
        //
        // Example: total_supply=1M, new_apy=50, denominator=100
        // yearly_rewards = (1,000,000 * 50) / 100 = 500,000 RUSH
        // rewards_per_second = 500,000 / 31,536,000 = ~15.85 RUSH/sec
        
        let yearly_rewards = (rush_config.total_supply as u128)
            .checked_mul(new_apy as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .checked_div(rush_config.apy_denominator as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        
        let seconds_per_year: u128 = 31_536_000;
        let new_rewards_per_second = yearly_rewards
            .checked_div(seconds_per_year)
            .ok_or(error!(CustomError::CalculationOverflow))?
            .try_into()
            .map_err(|_| error!(CustomError::CalculationOverflow))?;
        
        // ====================================================================
        // STEP 4: UPDATE STATE
        // ====================================================================
        
        let previous_apy = rush_config.apy_numerator;
        rush_config.apy_numerator = new_apy;
        rush_config.rewards_per_second = new_rewards_per_second;
        
        // ====================================================================
        // STEP 5: EMIT EVENT
        // ====================================================================
        
        emit!(RewardsConfigUpdated {
            previous_apy_numerator: previous_apy,
            new_apy_numerator: new_apy,
            new_rewards_per_second,
            updated_at: current_time,
            updated_by: ctx.accounts.authority.key(),
        });
        
        msg!("╔════════════════════════════════════════════════════════════╗");
        msg!("║           ✅ APY UPDATED SUCCESSFULLY                      ║");
        msg!("╚════════════════════════════════════════════════════════════╝");
        msg!("📊 APY Update Details:");
        msg!("   • Previous APY: {}%", previous_apy);
        msg!("   • New APY: {}%", new_apy);
        msg!("   • New Rewards/Sec: {} base units (~{:.2} RUSH/sec)", 
             new_rewards_per_second, new_rewards_per_second as f64 / 1_000_000.0);
        msg!("   • Annual Distribution: {:.0} RUSH", yearly_rewards as f64 / 1_000_000.0);
        msg!("═════════════════════════════════════════════════════════════");
        
        Ok(())
    }

    /// Pause or resume RUSH rewards distribution (authority only)
    /// 
    /// Requires:
    /// - Signer to be the configured authority
    /// - Sets is_paused flag in RushConfig
    /// 
    /// Effects:
    /// - Toggles reward distribution on/off
    /// - Emits RewardsPaused event
    /// - All reward claims will fail while paused
    pub fn pause_rush_rewards(
        ctx: Context<PauseRewards>,
    ) -> Result<()> {
        let rush_config = &mut ctx.accounts.rush_config;
        let current_time = Clock::get()?.unix_timestamp;
        
        // ====================================================================
        // STEP 1: VERIFY AUTHORITY
        // ====================================================================
        
        require_eq!(
            ctx.accounts.authority.key(),
            rush_config.authority,
            CustomError::InvalidAuthority
        );
        
        // ====================================================================
        // STEP 2: TOGGLE PAUSE STATE
        // ====================================================================
        
        let was_paused = rush_config.is_paused;
        rush_config.is_paused = !was_paused;
        let is_now_paused = rush_config.is_paused;
        
        // ====================================================================
        // STEP 3: EMIT EVENT
        // ====================================================================
        
        let reason = if is_now_paused {
            "Emergency pause triggered - rewards distribution halted".to_string()
        } else {
            "Rewards resumed - distribution re-enabled".to_string()
        };
        
        emit!(RewardsPaused {
            is_paused: is_now_paused,
            paused_at: current_time,
            paused_by: ctx.accounts.authority.key(),
            reason: reason.clone(),
        });
        
        // ====================================================================
        // STEP 4: LOG MESSAGE
        // ====================================================================
        
        if is_now_paused {
            msg!("╔════════════════════════════════════════════════════════════╗");
            msg!("║                ⏸️  REWARDS PAUSED                          ║");
            msg!("╚════════════════════════════════════════════════════════════╝");
            msg!("⚠️  Emergency Status:");
            msg!("   • Rewards are now PAUSED");
            msg!("   • New reward claims will FAIL");
            msg!("   • Existing balances are SAFE");
            msg!("   • Only authority can resume");
            msg!("═════════════════════════════════════════════════════════════");
        } else {
            msg!("╔════════════════════════════════════════════════════════════╗");
            msg!("║              ▶️  REWARDS RESUMED                           ║");
            msg!("╚════════════════════════════════════════════════════════════╝");
            msg!("✅ Status Updated:");
            msg!("   • Rewards are now ACTIVE");
            msg!("   • Reward claims ENABLED");
            msg!("   • Distribution RESUMED");
            msg!("═════════════════════════════════════════════════════════════");
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(initial_deposit_a: u64, initial_deposit_b: u64)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = LiquidityPool::SIZE,
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,
    
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"lp_mint", pool.key().as_ref()],
        bump
    )]
    pub lp_token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = token_a_mint,
        token::authority = pool
    )]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        token::mint = token_b_mint,
        token::authority = pool
    )]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_a_mint,
        token::authority = authority
    )]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_b_mint,
        token::authority = authority
    )]
    pub user_token_b: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = lp_token_mint,
        associated_token::authority = authority
    )]
    pub lp_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    #[account(mut)]
    pub lp_token_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = UserLiquidityPosition::SIZE,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserLiquidityPosition>,
    
    #[account(mut)]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_a_vault.mint,
        token::authority = user
    )]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_b_vault.mint,
        token::authority = user
    )]
    pub user_token_b: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = lp_token_mint,
        token::authority = user
    )]
    pub user_lp_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    #[account(mut)]
    pub lp_token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserLiquidityPosition>,
    
    #[account(mut)]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = lp_token_mint,
        token::authority = user
    )]
    pub user_lp_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_a_vault.mint,
        token::authority = user
    )]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_b_vault.mint,
        token::authority = user
    )]
    pub user_token_b: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// SWAP CONTEXT (Module 3.1)
// ============================================================================

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    /// User's input token account (from token based on is_a_to_b)
    #[account(mut)]
    pub user_token_in: Account<'info, TokenAccount>,
    
    /// User's output token account (to token based on is_a_to_b)
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    
    /// Pool's input token vault (receives input tokens)
    #[account(mut)]
    pub pool_vault_in: Account<'info, TokenAccount>,
    
    /// Pool's output token vault (sends output tokens)
    #[account(mut)]
    pub pool_vault_out: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// MARKET BUY CONTEXT (Module 3.2)
// ============================================================================

/// Account structure for market_buy instruction
/// Buy SOL with USDC (USDC→SOL swap wrapper)
#[derive(Accounts)]
pub struct MarketBuy<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    /// User's USDC token account (input)
    #[account(mut)]
    pub user_token_in: Account<'info, TokenAccount>,
    
    /// User's SOL token account (output)
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    
    /// Pool's USDC vault (receives USDC)
    #[account(mut)]
    pub pool_vault_in: Account<'info, TokenAccount>,
    
    /// Pool's SOL vault (sends SOL)
    #[account(mut)]
    pub pool_vault_out: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// MARKET SELL CONTEXT (Module 3.3)
// ============================================================================

/// Account structure for market_sell instruction
/// Sell SOL for USDC (SOL→USDC swap wrapper)
#[derive(Accounts)]
pub struct MarketSell<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    /// User's SOL token account (input)
    #[account(mut)]
    pub user_token_in: Account<'info, TokenAccount>,
    
    /// User's USDC token account (output)
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    
    /// Pool's SOL vault (receives SOL)
    #[account(mut)]
    pub pool_vault_in: Account<'info, TokenAccount>,
    
    /// Pool's USDC vault (sends USDC)
    #[account(mut)]
    pub pool_vault_out: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// CREATE LIMIT ORDER CONTEXT (Module 3.4)
// ============================================================================

#[derive(Accounts)]
#[instruction(sell_amount: u64, target_price: u64, minimum_receive: u64, expiry_days: i64)]
pub struct CreateLimitOrder<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    #[account(
        init,
        payer = user,
        space = LimitOrder::SIZE,
        seeds = [b"limit_order", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub limit_order: Account<'info, LimitOrder>,
    
    /// User's sell token mint
    pub sell_token_mint: Account<'info, Mint>,
    
    /// User's sell token account
    #[account(mut, token::mint = sell_token_mint, token::authority = user)]
    pub user_token_in: Account<'info, TokenAccount>,
    
    /// User's buy token account  
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    
    /// Escrow vault for sell tokens
    #[account(
        init,
        payer = user,
        token::mint = sell_token_mint,
        token::authority = limit_order
    )]
    pub order_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// EXECUTE LIMIT ORDER CONTEXT (Module 3.4)
// ============================================================================

#[derive(Accounts)]
pub struct ExecuteLimitOrder<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    #[account(mut)]
    pub limit_order: Account<'info, LimitOrder>,
    
    /// Output token account for order owner
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    
    /// Pool's output vault
    #[account(mut)]
    pub pool_vault_out: Account<'info, TokenAccount>,
    
    /// Pyth price account for real-time price feed
    pub pyth_price_account: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// CANCEL LIMIT ORDER CONTEXT (Module 3.4)
// ============================================================================

#[derive(Accounts)]
pub struct CancelLimitOrder<'info> {
    #[account(mut)]
    pub limit_order: Account<'info, LimitOrder>,
    
    /// Escrow vault holding sell tokens
    #[account(mut)]
    pub order_vault: Account<'info, TokenAccount>,
    
    /// User's sell token account (to receive refund)
    #[account(mut)]
    pub user_token_in: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// INITIALIZE RUSH TOKEN CONTEXT (Module 4.2)
// ============================================================================

/// Account validation and initialization context for Module 4.2
/// Initializes RUSH token mint and RushConfig account for rewards system
#[derive(Accounts)]
pub struct InitializeRushToken<'info> {
    /// RushConfig account - stores all RUSH token configuration
    /// Seeds: ["rush_config"]
    /// This is a PDA derived from the program itself
    #[account(
        init,
        payer = authority,
        space = RushConfig::SIZE,
        seeds = [b"rush_config"],
        bump
    )]
    pub rush_config: Account<'info, RushConfig>,
    
    /// RUSH token mint - the actual SPL token mint
    /// Will be initialized with:
    /// - 6 decimals (matching USDC for consistency)
    /// - Authority = rush_config (for minting rewards)
    /// - Freeze authority = None (tokens cannot be frozen)
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = rush_config,
    )]
    pub rush_mint: Account<'info, Mint>,
    
    /// Authority who pays for account creation
    /// Must be a signer (validates transaction)
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Solana System Program - required for account creation
    pub system_program: Program<'info, System>,
    
    /// SPL Token Program - required for token operations
    pub token_program: Program<'info, Token>,
    
    /// Solana Rent Sysvar - required for rent calculations
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// CALCULATE PENDING REWARDS CONTEXT (Module 4.3)
// ============================================================================

/// Account validation context for calculating pending RUSH rewards
/// Reads all necessary accounts to compute accrued rewards since last claim
#[derive(Accounts)]
pub struct CalculateRewards<'info> {
    /// User's liquidity position - contains lp_tokens and last_claim_timestamp
    pub position: Account<'info, UserLiquidityPosition>,
    
    /// Pool account - contains total_lp_supply for share calculation
    pub pool: Account<'info, LiquidityPool>,
    
    /// RUSH configuration - contains rewards_per_second
    pub rush_config: Account<'info, RushConfig>,
}

// ============================================================================
// CLAIM REWARDS CONTEXT (Module 4.4)
// ============================================================================

/// Account validation context for claiming RUSH rewards
/// Handles minting RUSH tokens and updating position state
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    /// User's liquidity position - will be updated with new claim timestamp
    #[account(mut)]
    pub position: Account<'info, UserLiquidityPosition>,
    
    /// Pool account - needed for share calculation
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    /// RUSH configuration - minted_so_far will be updated
    #[account(mut)]
    pub rush_config: Account<'info, RushConfig>,
    
    /// RUSH token mint - will mint tokens via CPI
    #[account(mut)]
    pub rush_mint: Account<'info, Mint>,
    
    /// User's RUSH token account (created if needed)
    /// Associated with rush_mint and user authority
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = rush_mint,
        associated_token::authority = user,
    )]
    pub user_rush_account: Account<'info, TokenAccount>,
    
    /// User who claims rewards (must sign and pay for account creation if needed)
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// SPL Token Program
    pub token_program: Program<'info, Token>,
    
    /// Associated Token Program (for ATA creation)
    pub associated_token_program: Program<'info, AssociatedToken>,
    
    /// System Program (for account creation)
    pub system_program: Program<'info, System>,
}

// ============================================================================
// GET USER REWARDS INFO CONTEXT (Module 4.5)
// ============================================================================

/// Account validation context for getting user rewards information (read-only)
/// Fetches data from position, pool, and rush_config to calculate rewards
#[derive(Accounts)]
pub struct GetUserRewards<'info> {
    /// User's liquidity position - contains lp_tokens and claim timestamps
    pub position: Account<'info, UserLiquidityPosition>,
    
    /// Pool account - contains total_lp_supply and reserves for share calculation
    pub pool: Account<'info, LiquidityPool>,
    
    /// RUSH configuration - contains rewards_per_second and APY settings
    pub rush_config: Account<'info, RushConfig>,
}

// ============================================================================
// UPDATE RUSH APY CONTEXT (Module 4.6)
// ============================================================================

/// Account validation context for updating RUSH APY (authority only)
/// Allows authority to adjust reward distribution parameters
#[derive(Accounts)]
pub struct UpdateRushAPY<'info> {
    /// RUSH configuration - will be updated with new APY
    #[account(mut)]
    pub rush_config: Account<'info, RushConfig>,
    
    /// Authority signer - must match rush_config.authority
    pub authority: Signer<'info>,
}

// ============================================================================
// PAUSE RUSH REWARDS CONTEXT (Module 4.6)
// ============================================================================

/// Account validation context for pausing/resuming RUSH rewards (authority only)
/// Allows emergency pause of reward distribution
#[derive(Accounts)]
pub struct PauseRewards<'info> {
    /// RUSH configuration - is_paused flag will be toggled
    #[account(mut)]
    pub rush_config: Account<'info, RushConfig>,
    
    /// Authority signer - must match rush_config.authority
    pub authority: Signer<'info>,
}

