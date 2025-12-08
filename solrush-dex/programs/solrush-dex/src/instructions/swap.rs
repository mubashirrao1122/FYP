use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};
use crate::state::LiquidityPool;
use crate::errors::CustomError;
use crate::events::SwapExecuted;
use crate::utils::calculate_output_amount;
pub fn swap(
    ctx: Context<Swap>,
    amount_in: u64,
    minimum_amount_out: u64,
    is_a_to_b: bool,
    deadline: i64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    require!(current_time <= deadline, CustomError::DeadlineExceeded);
    require!(amount_in > 0, CustomError::InvalidAmount);
    let pool = &mut ctx.accounts.pool;
    let (input_reserve, output_reserve) = if is_a_to_b {
        (pool.reserve_a, pool.reserve_b)
    } else {
        (pool.reserve_b, pool.reserve_a)
    };
    require!(
        output_reserve > 0 && input_reserve > 0,
        CustomError::InsufficientLiquidity
    );
    require!(
        ctx.accounts.user_token_in.amount >= amount_in,
        CustomError::InsufficientBalance
    );
    let amount_out = calculate_output_amount(
        amount_in,
        input_reserve,
        output_reserve,
        pool.fee_numerator,
        pool.fee_denominator,
    )?;
    require!(
        amount_out >= minimum_amount_out,
        CustomError::SlippageTooHigh
    );
    require!(
        ctx.accounts.pool_vault_out.amount >= amount_out,
        CustomError::InsufficientPoolReserves
    );
    let fee_numerator_128 = pool.fee_numerator as u128;
    let fee_denominator_128 = pool.fee_denominator as u128;
    let fee_amount = ((amount_in as u128) * fee_numerator_128 + fee_denominator_128 - 1) / fee_denominator_128;
    let fee_amount = fee_amount as u64;
    let pool_key = pool.key();
    let token_a_mint = pool.token_a_mint;
    let token_b_mint = pool.token_b_mint;
    let bump_seed = pool.bump;
    if is_a_to_b {
        pool.reserve_a = pool
            .reserve_a
            .checked_add(amount_in)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.reserve_b = pool
            .reserve_b
            .checked_sub(amount_out)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        pool.total_volume_a = pool.total_volume_a.saturating_add(amount_in);
    } else {
        pool.reserve_b = pool
            .reserve_b
            .checked_add(amount_in)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.reserve_a = pool
            .reserve_a
            .checked_sub(amount_out)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;
        pool.total_volume_b = pool.total_volume_b.saturating_add(amount_in);
    }
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
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        token_a_mint.as_ref(),
        token_b_mint.as_ref(),
        &[bump_seed],
    ]];
    let final_reserve_a = pool.reserve_a;
    let final_reserve_b = pool.reserve_b;
    let _ = pool;
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_vault_out.to_account_info(),
                to: ctx.accounts.user_token_out.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount_out,
    )?;
    emit!(SwapExecuted {
        user: ctx.accounts.user.key(),
        pool: pool_key,
        amount_in,
        amount_out,
        fee_amount,
        is_a_to_b,
        new_reserve_a: final_reserve_a,
        new_reserve_b: final_reserve_b,
    });
    Ok(())
}
pub fn market_buy(
    ctx: Context<MarketBuy>,
    amount_b_in: u64,
    min_a_received: u64,
    deadline: i64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    require!(current_time <= deadline, CustomError::DeadlineExceeded);
    require!(amount_b_in > 0, CustomError::InvalidAmount);
    let pool = &ctx.accounts.pool;
    let (input_reserve, output_reserve) = (pool.reserve_b, pool.reserve_a);
    let fee_numerator = pool.fee_numerator;
    let fee_denominator = pool.fee_denominator;
    let token_a_mint = pool.token_a_mint;
    let token_b_mint = pool.token_b_mint;
    let bump_seed = pool.bump;
    let pool_key = pool.key();
    require!(
        output_reserve > 0 && input_reserve > 0,
        CustomError::InsufficientLiquidity
    );
    require!(
        ctx.accounts.user_token_in.amount >= amount_b_in,
        CustomError::InsufficientBalance
    );
    let amount_a_out = calculate_output_amount(
        amount_b_in,
        input_reserve,
        output_reserve,
        fee_numerator,
        fee_denominator,
    )?;
    require!(
        amount_a_out >= min_a_received,
        CustomError::SlippageTooHigh
    );
    require!(
        ctx.accounts.pool_vault_out.amount >= amount_a_out,
        CustomError::InsufficientPoolReserves
    );
    let fee_numerator_128 = fee_numerator as u128;
    let fee_denominator_128 = fee_denominator as u128;
    let fee_amount = ((amount_b_in as u128) * fee_numerator_128 / fee_denominator_128) as u64;
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_in.to_account_info(),
                to: ctx.accounts.pool_vault_in.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_b_in,
    )?;
    let pool = &mut ctx.accounts.pool;
    pool.reserve_b = pool
        .reserve_b
        .checked_add(amount_b_in)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    pool.reserve_a = pool
        .reserve_a
        .checked_sub(amount_a_out)
        .ok_or(error!(CustomError::InsufficientPoolReserves))?;
    pool.total_volume_b = pool.total_volume_b.saturating_add(amount_b_in);
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
        amount_a_out,
    )?;
    emit!(SwapExecuted {
        user: ctx.accounts.user.key(),
        pool: pool_key,
        amount_in: amount_b_in,
        amount_out: amount_a_out,
        fee_amount,
        is_a_to_b: false,
        new_reserve_a: pool.reserve_a,
        new_reserve_b: pool.reserve_b,
    });
    Ok(())
}
pub fn market_sell(
    ctx: Context<MarketSell>,
    amount_a_in: u64,
    min_b_received: u64,
    deadline: i64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    require!(current_time <= deadline, CustomError::DeadlineExceeded);
    require!(amount_a_in > 0, CustomError::InvalidAmount);
    let pool = &ctx.accounts.pool;
    let (input_reserve, output_reserve) = (pool.reserve_a, pool.reserve_b);
    let fee_numerator = pool.fee_numerator;
    let fee_denominator = pool.fee_denominator;
    let token_a_mint = pool.token_a_mint;
    let token_b_mint = pool.token_b_mint;
    let bump_seed = pool.bump;
    let pool_key = pool.key();
    require!(
        output_reserve > 0 && input_reserve > 0,
        CustomError::InsufficientLiquidity
    );
    require!(
        ctx.accounts.user_token_in.amount >= amount_a_in,
        CustomError::InsufficientBalance
    );
    let amount_b_out = calculate_output_amount(
        amount_a_in,
        input_reserve,
        output_reserve,
        fee_numerator,
        fee_denominator,
    )?;
    require!(
        amount_b_out >= min_b_received,
        CustomError::SlippageTooHigh
    );
    require!(
        ctx.accounts.pool_vault_out.amount >= amount_b_out,
        CustomError::InsufficientPoolReserves
    );
    let fee_numerator_128 = fee_numerator as u128;
    let fee_denominator_128 = fee_denominator as u128;
    let fee_amount = ((amount_a_in as u128) * fee_numerator_128 / fee_denominator_128) as u64;
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_in.to_account_info(),
                to: ctx.accounts.pool_vault_in.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_a_in,
    )?;
    let pool = &mut ctx.accounts.pool;
    pool.reserve_a = pool
        .reserve_a
        .checked_add(amount_a_in)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    pool.reserve_b = pool
        .reserve_b
        .checked_sub(amount_b_out)
        .ok_or(error!(CustomError::InsufficientPoolReserves))?;
    pool.total_volume_a = pool.total_volume_a.saturating_add(amount_a_in);
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
        amount_b_out,
    )?;
    emit!(SwapExecuted {
        user: ctx.accounts.user.key(),
        pool: pool_key,
        amount_in: amount_a_in,
        amount_out: amount_b_out,
        fee_amount,
        is_a_to_b: true,
        new_reserve_a: pool.reserve_a,
        new_reserve_b: pool.reserve_b,
    });
    Ok(())
}
#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        mut,
        token::authority = user
    )]
    pub user_token_in: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = user
    )]
    pub user_token_out: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = pool_vault_in.key() == pool.token_a_vault || pool_vault_in.key() == pool.token_b_vault @ CustomError::InvalidAmount
    )]
    pub pool_vault_in: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = pool_vault_out.key() == pool.token_a_vault || pool_vault_out.key() == pool.token_b_vault @ CustomError::InvalidAmount,
        constraint = pool_vault_in.key() != pool_vault_out.key() @ CustomError::InvalidAmount
    )]
    pub pool_vault_out: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct MarketBuy<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        mut,
        token::authority = user,
        token::mint = pool.token_b_mint
    )]
    pub user_token_in: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = user,
        token::mint = pool.token_a_mint
    )]
    pub user_token_out: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = pool_vault_in.key() == pool.token_b_vault @ CustomError::InvalidAmount
    )]
    pub pool_vault_in: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = pool_vault_out.key() == pool.token_a_vault @ CustomError::InvalidAmount
    )]
    pub pool_vault_out: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct MarketSell<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        mut,
        token::authority = user,
        token::mint = pool.token_a_mint
    )]
    pub user_token_in: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = user,
        token::mint = pool.token_b_mint
    )]
    pub user_token_out: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = pool_vault_in.key() == pool.token_a_vault @ CustomError::InvalidAmount
    )]
    pub pool_vault_in: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = pool_vault_out.key() == pool.token_b_vault @ CustomError::InvalidAmount
    )]
    pub pool_vault_out: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
