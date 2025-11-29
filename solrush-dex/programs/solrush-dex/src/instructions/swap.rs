use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};

use crate::state::LiquidityPool;
use crate::errors::CustomError;
use crate::events::SwapExecuted;
use crate::utils::calculate_output_amount;

// ========================================================================
// MODULE 3.1: SWAP
// ========================================================================

/// Generic swap function supporting bidirectional swaps
/// Supports: SOL→USDC or USDC→SOL
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
// ACCOUNT CONTEXTS
// ========================================================================

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
