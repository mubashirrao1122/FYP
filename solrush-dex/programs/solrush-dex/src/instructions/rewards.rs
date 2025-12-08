use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint, MintTo, mint_to},
};
use crate::state::{RushConfig, UserLiquidityPosition, LiquidityPool};
use crate::errors::CustomError;
use crate::events::{RushTokenInitialized, RewardsClaimed, RewardsConfigUpdated, RewardsPaused};
pub fn initialize_rush_token(
    ctx: Context<InitializeRushToken>,
) -> Result<()> {
    const RUSH_DECIMALS: u8 = 6;
    const MAX_RUSH_SUPPLY: u64 = 1_000_000;
    const MAX_RUSH_SUPPLY_BASE: u64 = 1_000_000 * 1_000_000;
    const APY_NUMERATOR: u64 = 50;
    const APY_DENOMINATOR: u64 = 100;
    const SECONDS_PER_YEAR: u64 = 31_536_000;
    let yearly_rewards = (MAX_RUSH_SUPPLY as u128 * APY_NUMERATOR as u128)
        .checked_div(APY_DENOMINATOR as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    require!(
        yearly_rewards <= MAX_RUSH_SUPPLY,
        CustomError::InvalidAmount
    );
    let rewards_per_second_base = (yearly_rewards as u128)
        .checked_mul(10u128.pow(RUSH_DECIMALS as u32))
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(SECONDS_PER_YEAR as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    let rush_config = &mut ctx.accounts.rush_config;
    let now_timestamp = Clock::get()?.unix_timestamp;
    rush_config.mint = ctx.accounts.rush_mint.key();
    rush_config.authority = ctx.accounts.authority.key();
    rush_config.total_supply = MAX_RUSH_SUPPLY_BASE;
    rush_config.minted_so_far = 0;
    rush_config.rewards_per_second = rewards_per_second_base;
    rush_config.apy_numerator = APY_NUMERATOR;
    rush_config.apy_denominator = APY_DENOMINATOR;
    rush_config.start_timestamp = now_timestamp;
    rush_config.is_paused = false;
    rush_config.bump = ctx.bumps.rush_config;
    emit!(RushTokenInitialized {
        rush_mint: ctx.accounts.rush_mint.key(),
        rush_config: rush_config.key(),
        total_supply: MAX_RUSH_SUPPLY_BASE,
        rewards_per_second: rewards_per_second_base,
        apy_numerator: APY_NUMERATOR,
        apy_denominator: APY_DENOMINATOR,
        start_timestamp: now_timestamp,
        authority: ctx.accounts.authority.key(),
    });
    Ok(())
}
pub fn calculate_pending_rewards(
    ctx: Context<CalculateRewards>,
) -> Result<u64> {
    let position = &ctx.accounts.position;
    let pool = &ctx.accounts.pool;
    let rush_config = &ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    require!(position.lp_tokens > 0, CustomError::InvalidAmount);
    require!(pool.total_lp_supply > 0, CustomError::InsufficientLiquidity);
    let time_elapsed = current_time
        .checked_sub(position.last_claim_timestamp)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    if time_elapsed == 0 {
        return Ok(0);
    }
    let user_share_fixed = (position.lp_tokens as u128)
        .checked_mul(1_000_000_000_000u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(pool.total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let period_rewards_fixed = (rush_config.rewards_per_second as u128)
        .checked_mul(time_elapsed as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let user_rewards_fixed = period_rewards_fixed
        .checked_mul(user_share_fixed)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(1_000_000_000_000u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let user_rewards = user_rewards_fixed
        .try_into()
        .map_err(|_| error!(CustomError::CalculationOverflow))?;
    let new_minted_total = rush_config.minted_so_far
        .checked_add(user_rewards)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    require!(
        new_minted_total <= rush_config.total_supply,
        CustomError::InvalidAmount
    );
    Ok(user_rewards)
}
pub fn claim_rush_rewards(
    ctx: Context<ClaimRewards>,
) -> Result<()> {
    let position = &mut ctx.accounts.position;
    let pool = &ctx.accounts.pool;
    let rush_config = &mut ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    require!(!rush_config.is_paused, CustomError::InvalidAmount);
    require!(position.lp_tokens > 0, CustomError::InvalidAmount);
    require!(pool.total_lp_supply > 0, CustomError::InsufficientLiquidity);
    let time_elapsed = current_time
        .checked_sub(position.last_claim_timestamp)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    let user_share_fixed = (position.lp_tokens as u128)
        .checked_mul(1_000_000_000_000u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(pool.total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let period_rewards_fixed = (rush_config.rewards_per_second as u128)
        .checked_mul(time_elapsed as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let user_rewards_fixed = period_rewards_fixed
        .checked_mul(user_share_fixed)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(1_000_000_000_000u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let user_rewards = user_rewards_fixed
        .try_into()
        .map_err(|_| error!(CustomError::CalculationOverflow))?;
    require!(user_rewards > 0, CustomError::InvalidAmount);
    let new_minted_total = rush_config.minted_so_far
        .checked_add(user_rewards)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    require!(
        new_minted_total <= rush_config.total_supply,
        CustomError::InvalidAmount
    );
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
    position.last_claim_timestamp = current_time;
    position.total_rush_claimed = position.total_rush_claimed
        .checked_add(user_rewards)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    rush_config.minted_so_far = new_minted_total;
    emit!(RewardsClaimed {
        user: ctx.accounts.user.key(),
        position: position.key(),
        pool: pool.key(),
        rewards_amount: user_rewards,
        rewards_display: user_rewards as f64 / 1_000_000.0,
        time_elapsed: time_elapsed as i64,
        user_lp_share: user_share_fixed as f64 / 1_000_000_000_000.0,
        claimed_at: current_time,
        total_claimed_lifetime: position.total_rush_claimed,
    });
    Ok(())
}
pub fn update_rush_apy(
    ctx: Context<UpdateRushAPY>,
    new_apy: u64,
) -> Result<()> {
    let rush_config = &mut ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    require_eq!(
        ctx.accounts.authority.key(),
        rush_config.authority,
        CustomError::InvalidAuthority
    );
    require!(new_apy > 0 && new_apy <= 500, CustomError::InvalidAmount);
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
    let previous_apy = rush_config.apy_numerator;
    rush_config.apy_numerator = new_apy;
    rush_config.rewards_per_second = new_rewards_per_second;
    emit!(RewardsConfigUpdated {
        previous_apy_numerator: previous_apy,
        new_apy_numerator: new_apy,
        new_rewards_per_second,
        updated_at: current_time,
        updated_by: ctx.accounts.authority.key(),
    });
    Ok(())
}
pub fn pause_rush_rewards(
    ctx: Context<PauseRewards>,
) -> Result<()> {
    let rush_config = &mut ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    require_eq!(
        ctx.accounts.authority.key(),
        rush_config.authority,
        CustomError::InvalidAuthority
    );
    let was_paused = rush_config.is_paused;
    rush_config.is_paused = !was_paused;
    let reason = if rush_config.is_paused {
        "Emergency pause triggered".to_string()
    } else {
        "Rewards resumed".to_string()
    };
    emit!(RewardsPaused {
        is_paused: rush_config.is_paused,
        paused_at: current_time,
        paused_by: ctx.accounts.authority.key(),
        reason: reason.clone(),
    });
    Ok(())
}
#[derive(Accounts)]
pub struct InitializeRushToken<'info> {
    #[account(
        init,
        payer = authority,
        space = RushConfig::SIZE,
        seeds = [b"rush_config"],
        bump
    )]
    pub rush_config: Account<'info, RushConfig>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = rush_config,
    )]
    pub rush_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
#[derive(Accounts)]
pub struct CalculateRewards<'info> {
    #[account(
        constraint = position.owner == user.key() @ CustomError::InvalidAuthority
    )]
    pub position: Account<'info, UserLiquidityPosition>,
    pub pool: Account<'info, LiquidityPool>,
    pub rush_config: Account<'info, RushConfig>,
    pub user: Signer<'info>,
}
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        constraint = position.owner == user.key() @ CustomError::InvalidAuthority
    )]
    pub position: Account<'info, UserLiquidityPosition>,
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    pub rush_config: Account<'info, RushConfig>,
    #[account(mut)]
    pub rush_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = rush_mint,
        associated_token::authority = user,
    )]
    pub user_rush_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct UpdateRushAPY<'info> {
    #[account(mut)]
    pub rush_config: Account<'info, RushConfig>,
    pub authority: Signer<'info>,
}
#[derive(Accounts)]
pub struct PauseRewards<'info> {
    #[account(mut)]
    pub rush_config: Account<'info, RushConfig>,
    pub authority: Signer<'info>,
}
