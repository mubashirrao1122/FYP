use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint, MintTo, mint_to},
};

use crate::state::{RushConfig, UserLiquidityPosition, LiquidityPool};
use crate::errors::CustomError;
use crate::events::{RushTokenInitialized, RewardsClaimed, RewardsConfigUpdated, RewardsPaused};

// ========================================================================
// MODULE 4.2: INITIALIZE RUSH TOKEN
// ========================================================================

/// Initialize RUSH token and rewards configuration
pub fn initialize_rush_token(
    ctx: Context<InitializeRushToken>,
) -> Result<()> {
    // Constants
    const RUSH_DECIMALS: u8 = 6;
    const MAX_RUSH_SUPPLY: u64 = 1_000_000;
    const MAX_RUSH_SUPPLY_BASE: u64 = 1_000_000 * 1_000_000;
    const APY_NUMERATOR: u64 = 50;
    const APY_DENOMINATOR: u64 = 100;
    const SECONDS_PER_YEAR: u64 = 31_536_000;
    
    // Calculate yearly rewards
    let yearly_rewards = (MAX_RUSH_SUPPLY as u128 * APY_NUMERATOR as u128)
        .checked_div(APY_DENOMINATOR as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    
    require!(
        yearly_rewards <= MAX_RUSH_SUPPLY,
        CustomError::InvalidAmount
    );
    
    // Calculate rewards per second
    let rewards_per_second_base = (yearly_rewards as u128)
        .checked_mul(10u128.pow(RUSH_DECIMALS as u32))
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(SECONDS_PER_YEAR as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    
    // Initialize config
    let rush_config = &mut ctx.accounts.rush_config;
    let now_timestamp = Clock::get()?.unix_timestamp;
    
    rush_config.mint = ctx.accounts.rush_mint.key();
    rush_config.authority = rush_config.key();
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
    
    msg!("╔════════════════════════════════════════════════════════════╗");
    msg!("║         RUSH TOKEN INITIALIZATION SUCCESSFUL              ║");
    msg!("╚════════════════════════════════════════════════════════════╝");
    msg!("📊 Configuration:");
    msg!("  • Total Supply: {} RUSH", MAX_RUSH_SUPPLY);
    msg!("  • APY: {}%", APY_NUMERATOR);
    msg!("  • Rewards/Second: {:.2} RUSH", rewards_per_second_base as f64 / 1e6);
    msg!("═══════════════════════════════════════════════════════════════");
    
    Ok(())
}

// ========================================================================
// MODULE 4.3: CALCULATE PENDING REWARDS
// ========================================================================

/// Calculate pending RUSH rewards for a liquidity provider
pub fn calculate_pending_rewards(
    ctx: Context<CalculateRewards>,
) -> Result<u64> {
    let position = &ctx.accounts.position;
    let pool = &ctx.accounts.pool;
    let rush_config = &ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    
    require!(position.lp_tokens > 0, CustomError::InvalidAmount);
    require!(pool.total_lp_supply > 0, CustomError::InsufficientLiquidity);
    
    // Calculate time elapsed
    let time_elapsed = current_time
        .checked_sub(position.last_claim_timestamp)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    
    if time_elapsed == 0 {
        return Ok(0);
    }
    
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
    
    // Validate against max supply
    let new_minted_total = rush_config.minted_so_far
        .checked_add(user_rewards)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    
    require!(
        new_minted_total <= rush_config.total_supply,
        CustomError::InvalidAmount
    );
    
    msg!(
        "📊 Rewards calculated: {} base units ({:.6} RUSH)",
        user_rewards,
        user_rewards as f64 / 1_000_000.0
    );
    
    Ok(user_rewards)
}

// ========================================================================
// MODULE 4.4: CLAIM RUSH REWARDS
// ========================================================================

/// Claim accrued RUSH rewards and mint them to user's account
pub fn claim_rush_rewards(
    ctx: Context<ClaimRewards>,
) -> Result<()> {
    let position = &mut ctx.accounts.position;
    let pool = &ctx.accounts.pool;
    let rush_config = &mut ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Check if rewards are paused
    require!(!rush_config.is_paused, CustomError::InvalidAmount);
    
    // Validation
    require!(position.lp_tokens > 0, CustomError::InvalidAmount);
    require!(pool.total_lp_supply > 0, CustomError::InsufficientLiquidity);
    
    // Calculate rewards
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
    
    // Validate max supply
    let new_minted_total = rush_config.minted_so_far
        .checked_add(user_rewards)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    
    require!(
        new_minted_total <= rush_config.total_supply,
        CustomError::InvalidAmount
    );
    
    // Mint RUSH tokens
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
    
    // Update state
    position.last_claim_timestamp = current_time;
    position.total_rush_claimed = position.total_rush_claimed
        .checked_add(user_rewards)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    
    rush_config.minted_so_far = new_minted_total;
    
    // Emit event
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
    
    msg!("╔════════════════════════════════════════════════════════════╗");
    msg!("║              ✅ REWARDS CLAIMED SUCCESSFULLY               ║");
    msg!("╚════════════════════════════════════════════════════════════╝");
    msg!("💰 Amount: {:.6} RUSH", user_rewards as f64 / 1_000_000.0);
    msg!("═══════════════════════════════════════════════════════════════");
    
    Ok(())
}

// ========================================================================
// MODULE 4.6: ADMIN FUNCTIONS
// ========================================================================

/// Update RUSH APY (authority only)
pub fn update_rush_apy(
    ctx: Context<UpdateRushAPY>,
    new_apy: u64,
) -> Result<()> {
    let rush_config = &mut ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Verify authority
    require_eq!(
        ctx.accounts.authority.key(),
        rush_config.authority,
        CustomError::InvalidAuthority
    );
    
    // Validate APY (0-500%)
    require!(new_apy > 0 && new_apy <= 500, CustomError::InvalidAmount);
    
    // Calculate new rewards per second
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
    
    msg!("✅ APY updated: {}% -> {}%", previous_apy, new_apy);
    
    Ok(())
}

/// Pause or resume RUSH rewards distribution (authority only)
pub fn pause_rush_rewards(
    ctx: Context<PauseRewards>,
) -> Result<()> {
    let rush_config = &mut ctx.accounts.rush_config;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Verify authority
    require_eq!(
        ctx.accounts.authority.key(),
        rush_config.authority,
        CustomError::InvalidAuthority
    );
    
    // Toggle pause state
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
    
    msg!("⚠️ Rewards {}", if rush_config.is_paused { "PAUSED" } else { "RESUMED" });
    
    Ok(())
}

// ========================================================================
// ACCOUNT CONTEXTS
// ========================================================================

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
    pub position: Account<'info, UserLiquidityPosition>,
    pub pool: Account<'info, LiquidityPool>,
    pub rush_config: Account<'info, RushConfig>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
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
