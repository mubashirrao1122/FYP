use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint, Transfer, transfer},
};
use crate::state::{LiquidityPool, LimitOrder, OrderStatus};
use crate::errors::CustomError;
use crate::events::{LimitOrderCreated, LimitOrderExecuted, LimitOrderCancelled};
use crate::utils::{calculate_output_amount, calculate_pool_price, check_price_condition};
pub fn create_limit_order(
    ctx: Context<CreateLimitOrder>,
    sell_amount: u64,
    target_price: u64,
    minimum_receive: u64,
    expiry_days: i64,
    order_id: u64,
) -> Result<()> {
    require!(sell_amount > 0, CustomError::InvalidAmount);
    require!(target_price > 0, CustomError::InvalidAmount);
    require!(minimum_receive > 0, CustomError::InvalidAmount);
    require!(expiry_days > 0, CustomError::InvalidExpiryTime);
    require!(
        ctx.accounts.user_token_in.amount >= sell_amount,
        CustomError::InsufficientBalance
    );
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
    order.expires_at = now + (expiry_days * 86400);
    order.status = OrderStatus::Pending;
    order.bump = ctx.bumps.limit_order;
    order.order_id = order_id;
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
    Ok(())
}
pub fn execute_limit_order(
    ctx: Context<ExecuteLimitOrder>,
) -> Result<()> {
    let order = &mut ctx.accounts.limit_order;
    let pool = &mut ctx.accounts.pool;
    let now = Clock::get()?.unix_timestamp;
    require!(
        order.status == OrderStatus::Pending,
        CustomError::InvalidOrderStatus
    );
    require!(now < order.expires_at, CustomError::OrderExpired);
    let current_price = calculate_pool_price(pool.reserve_a, pool.reserve_b)?;
    let is_sell = order.sell_token == pool.token_a_mint;
    require!(
        check_price_condition(current_price, order.target_price, is_sell),
        CustomError::PriceConditionNotMet
    );
    let output_amount = calculate_output_amount(
        order.sell_amount,
        if is_sell { pool.reserve_a } else { pool.reserve_b },
        if is_sell { pool.reserve_b } else { pool.reserve_a },
        pool.fee_numerator,
        pool.fee_denominator,
    )?;
    require!(
        output_amount >= order.minimum_receive,
        CustomError::SlippageTooHigh
    );
    let order_key = order.key();
    let order_owner = order.owner;
    let order_pool = order.pool;
    let order_sell_amount = order.sell_amount;
    let order_bump = order.bump;
    let order_order_id = order.order_id;
    let order_signer_seeds: &[&[&[u8]]] = &[&[
        b"limit_order",
        order_pool.as_ref(),
        order_owner.as_ref(),
        &order_order_id.to_le_bytes(),
        &[order_bump],
    ]];
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.order_vault.to_account_info(),
                to: ctx.accounts.pool_vault_in.to_account_info(),
                authority: ctx.accounts.limit_order.to_account_info(),
            },
            order_signer_seeds,
        ),
        order_sell_amount,
    )?;
    let pool = &mut ctx.accounts.pool;
    if is_sell {
        pool.reserve_a = pool
            .reserve_a
            .checked_add(order_sell_amount)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.reserve_b = pool
            .reserve_b
            .checked_sub(output_amount)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;
    } else {
        pool.reserve_b = pool
            .reserve_b
            .checked_add(order_sell_amount)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        pool.reserve_a = pool
            .reserve_a
            .checked_sub(output_amount)
            .ok_or(error!(CustomError::InsufficientPoolReserves))?;
    }
    let pool_key = pool.key();
    let token_a_mint = pool.token_a_mint;
    let token_b_mint = pool.token_b_mint;
    let bump_seed = pool.bump;
    let pool_signer_seeds: &[&[&[u8]]] = &[&[
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
            pool_signer_seeds,
        ),
        output_amount,
    )?;
    let order = &mut ctx.accounts.limit_order;
    order.status = OrderStatus::Executed;
    emit!(LimitOrderExecuted {
        order: order_key,
        owner: order_owner,
        pool: pool_key,
        sell_amount: order.sell_amount,
        receive_amount: output_amount,
        execution_price: current_price,
        executed_at: now,
    });
    Ok(())
}
pub fn cancel_limit_order(
    ctx: Context<CancelLimitOrder>,
) -> Result<()> {
    let order = &mut ctx.accounts.limit_order;
    require!(
        ctx.accounts.user.key() == order.owner,
        CustomError::UnauthorizedOrderOwner
    );
    require!(
        order.status == OrderStatus::Pending,
        CustomError::InvalidOrderStatus
    );
    let now = Clock::get()?.unix_timestamp;
    let order_key = order.key();
    let bump_seed = order.bump;
    let pool_key = order.pool;
    let owner_key = order.owner;
    let order_id = order.order_id;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"limit_order",
        pool_key.as_ref(),
        owner_key.as_ref(),
        &order_id.to_le_bytes(),
        &[bump_seed],
    ]];
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.order_vault.to_account_info(),
                to: ctx.accounts.user_token_in.to_account_info(),
                authority: order.to_account_info(),
            },
            signer_seeds,
        ),
        order.sell_amount,
    )?;
    order.status = OrderStatus::Cancelled;
    emit!(LimitOrderCancelled {
        order: order_key,
        owner: order.owner,
        refunded_amount: order.sell_amount,
        cancelled_at: now,
    });
    Ok(())
}
#[derive(Accounts)]
#[instruction(sell_amount: u64, target_price: u64, minimum_receive: u64, expiry_days: i64, order_id: u64)]
pub struct CreateLimitOrder<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        init,
        payer = user,
        space = LimitOrder::SIZE,
        seeds = [b"limit_order", pool.key().as_ref(), user.key().as_ref(), &order_id.to_le_bytes()],
        bump
    )]
    pub limit_order: Account<'info, LimitOrder>,
    pub sell_token_mint: Account<'info, Mint>,
    #[account(mut, token::mint = sell_token_mint, token::authority = user)]
    pub user_token_in: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
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
#[derive(Accounts)]
pub struct ExecuteLimitOrder<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        mut,
        constraint = limit_order.pool == pool.key() @ CustomError::InvalidPool
    )]
    pub limit_order: Account<'info, LimitOrder>,
    #[account(mut)]
    pub order_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_vault_in: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_vault_out: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct CancelLimitOrder<'info> {
    #[account(mut)]
    pub limit_order: Account<'info, LimitOrder>,
    #[account(mut)]
    pub order_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_in: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
