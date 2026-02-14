use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint, MintTo, mint_to, Transfer, transfer, Burn, burn},
};
use crate::state::{LiquidityPool, UserLiquidityPosition};
use crate::errors::CustomError;
use crate::events::{PoolCreated, LiquidityAdded, LiquidityRemoved};
use crate::utils::{
    calculate_lp_tokens_for_add_liquidity,
    calculate_remove_liquidity_amounts,
    validate_ratio_imbalance,
};

pub const MINIMUM_LIQUIDITY: u64 = 1000;

pub fn initialize_pool(
    ctx: Context<InitializePool>,
) -> Result<()> {
    require!(
        ctx.accounts.token_a_mint.key() != ctx.accounts.token_b_mint.key(),
        CustomError::InvalidAmount
    );
    
    let pool = &mut ctx.accounts.pool;
    let clock = Clock::get()?;
    
    pool.authority = ctx.accounts.authority.key();
    pool.token_a_mint = ctx.accounts.token_a_mint.key();
    pool.token_b_mint = ctx.accounts.token_b_mint.key();
    pool.token_a_vault = ctx.accounts.token_a_vault.key();
    pool.token_b_vault = ctx.accounts.token_b_vault.key();
    pool.lp_token_mint = ctx.accounts.lp_token_mint.key();
    
    // Initialize with zero reserves - liquidity added separately
    pool.reserve_a = 0;
    pool.reserve_b = 0;
    
    pool.token_a_decimals = ctx.accounts.token_a_mint.decimals;
    pool.token_b_decimals = ctx.accounts.token_b_mint.decimals;
    pool.is_stablecoin_pool = false;
    pool.fee_numerator = 3;
    pool.fee_denominator = 1000;
    pool.bump = ctx.bumps.pool;
    pool.created_at = clock.unix_timestamp;
    pool.total_volume_a = 0;
    pool.total_volume_b = 0;
    pool.total_lp_supply = 0;
    pool.locked_liquidity = 0;
    
    emit!(PoolCreated {
        pool: pool.key(),
        token_a_mint: ctx.accounts.token_a_mint.key(),
        token_b_mint: ctx.accounts.token_b_mint.key(),
        reserve_a: 0,
        reserve_b: 0,
        lp_token_supply: 0,
        authority: ctx.accounts.authority.key(),
    });
    
    Ok(())
}

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
    if pool.total_lp_supply > 0 {
        validate_ratio_imbalance(amount_a, amount_b, pool.reserve_a, pool.reserve_b)?;
    }
    let lp_tokens_to_mint = calculate_lp_tokens_for_add_liquidity(
        amount_a,
        amount_b,
        pool.reserve_a,
        pool.reserve_b,
        pool.total_lp_supply,
    )?;
    require!(
        lp_tokens_to_mint >= min_lp_tokens,
        CustomError::SlippageTooHigh
    );
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
    Ok(())
}
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
    let (amount_a, amount_b) = calculate_remove_liquidity_amounts(
        lp_tokens_to_burn,
        pool.total_lp_supply,
        pool.reserve_a,
        pool.reserve_b,
    )?;
    require!(amount_a >= min_amount_a, CustomError::SlippageTooHigh);
    require!(amount_b >= min_amount_b, CustomError::SlippageTooHigh);
    require!(
        ctx.accounts.token_a_vault.amount >= amount_a,
        CustomError::InsufficientPoolReserves
    );
    require!(
        ctx.accounts.token_b_vault.amount >= amount_b,
        CustomError::InsufficientPoolReserves
    );
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
    Ok(())
}

pub fn close_pool(ctx: Context<ClosePool>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(pool.total_lp_supply == 0, CustomError::PoolNotEmpty);
    require!(pool.reserve_a == 0, CustomError::PoolNotEmpty);
    require!(pool.reserve_b == 0, CustomError::PoolNotEmpty);

    let token_a_mint = pool.token_a_mint;
    let token_b_mint = pool.token_b_mint;
    let bump_seed = pool.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        token_a_mint.as_ref(),
        token_b_mint.as_ref(),
        &[bump_seed],
    ]];

    // Close Token A Vault
    anchor_spl::token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::CloseAccount {
                account: ctx.accounts.token_a_vault.to_account_info(),
                destination: ctx.accounts.authority.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        )
    )?;

    // Close Token B Vault
    anchor_spl::token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::CloseAccount {
                account: ctx.accounts.token_b_vault.to_account_info(),
                destination: ctx.accounts.authority.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        )
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = LiquidityPool::SIZE,
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool: Box<Account<'info, LiquidityPool>>,
    pub token_a_mint: Box<Account<'info, Mint>>,
    pub token_b_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"lp_mint", pool.key().as_ref()],
        bump
    )]
    pub lp_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = authority,
        token::mint = token_a_mint,
        token::authority = pool
    )]
    pub token_a_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = authority,
        token::mint = token_b_mint,
        token::authority = pool
    )]
    pub token_b_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = lp_token_mint,
        associated_token::authority = authority
    )]
    pub lp_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClosePool<'info> {
    #[account(
        mut,
        close = authority,
        has_one = authority,
        has_one = token_a_vault,
        has_one = token_b_vault,
        seeds = [b"pool", pool.token_a_mint.as_ref(), pool.token_b_mint.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub token_a_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_b_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint @ CustomError::InvalidMint
    )]
    pub lp_token_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        space = UserLiquidityPosition::SIZE,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserLiquidityPosition>,
    #[account(
        mut,
        constraint = token_a_vault.key() == pool.token_a_vault @ CustomError::InvalidVault
    )]
    pub token_a_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = token_b_vault.key() == pool.token_b_vault @ CustomError::InvalidVault
    )]
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
    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint @ CustomError::InvalidMint
    )]
    pub lp_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserLiquidityPosition>,
    #[account(
        mut,
        constraint = token_a_vault.key() == pool.token_a_vault @ CustomError::InvalidVault
    )]
    pub token_a_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = token_b_vault.key() == pool.token_b_vault @ CustomError::InvalidVault
    )]
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
