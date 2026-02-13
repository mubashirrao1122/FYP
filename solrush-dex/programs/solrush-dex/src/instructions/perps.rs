use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use pyth_sdk_solana::load_price_feed_from_account_info;
use crate::errors::CustomError;
use crate::perps_math::{self, PositionState, notional_value, required_margin_scaled, unrealized_pnl, PRICE_SCALE};
use crate::state::{PerpsGlobalState, PerpsMarket, PerpsOraclePrice, PerpsPosition, PerpsUserAccount, InsuranceVault};
use crate::events::{FundingUpdated, FundingSettled, Liquidated};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderType {
    Market = 0,
    Limit = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PositionSide {
    Long = 0,
    Short = 1,
}

// ─────────────────────────────────────────────
// Funding settlement helper (pure, no side effects)
// ─────────────────────────────────────────────

/// Settle accumulated funding for a position.
///
/// funding_delta = base_position × (market_cum_funding − last_cum_funding)
///
/// Positive delta → longs pay (collateral decreases).
/// Negative delta → shorts pay (collateral increases for the position).
///
/// Returns `(new_collateral, new_checkpoint, funding_delta)`.
fn settle_funding_inner(
    base_position: i64,
    collateral: u64,
    last_cum_funding: i128,
    market_cum_funding: i128,
) -> Result<(u64, i128, i128)> {
    if base_position == 0 {
        // No position to settle — just advance checkpoint
        return Ok((collateral, market_cum_funding, 0));
    }
    let cum_diff = market_cum_funding
        .checked_sub(last_cum_funding)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    if cum_diff == 0 {
        return Ok((collateral, market_cum_funding, 0));
    }
    let funding_delta = (base_position as i128)
        .checked_mul(cum_diff)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let new_collateral_i128 = (collateral as i128)
        .checked_sub(funding_delta)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let new_collateral = if new_collateral_i128 <= 0 {
        0u64
    } else {
        u64::try_from(new_collateral_i128)
            .map_err(|_| error!(CustomError::CalculationOverflow))?
    };
    Ok((new_collateral, market_cum_funding, funding_delta))
}

fn read_oracle_price<'info>(oracle_price_account: &AccountInfo<'info>) -> Result<i64> {
    if oracle_price_account.owner == &crate::ID {
        let data = oracle_price_account.try_borrow_data()?;
        let mut slice: &[u8] = &data;
        let oracle = PerpsOraclePrice::try_deserialize(&mut slice)?;
        return Ok(oracle.price_i64);
    }
    let price_feed = load_price_feed_from_account_info(oracle_price_account)
        .map_err(|_| error!(CustomError::OraclePriceUnavailable))?;
    let clock = Clock::get()?;
    let price = price_feed
        .get_price_no_older_than(clock.unix_timestamp, 60)
        .ok_or(error!(CustomError::OraclePriceUnavailable))?;
    Ok(price.price)
}

#[derive(Accounts)]
pub struct InitializePerpsGlobal<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = PerpsGlobalState::LEN,
        seeds = [b"perps_global"],
        bump
    )]
    pub global: Account<'info, PerpsGlobalState>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_global(ctx: Context<InitializePerpsGlobal>, fee_bps: u16) -> Result<()> {
    let global = &mut ctx.accounts.global;
    global.authority = ctx.accounts.admin.key();
    global.paused = false;
    global.fee_bps = fee_bps;
    global.bump = ctx.bumps.global;
    Ok(())
}

#[derive(Accounts)]
pub struct CreatePerpsMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"perps_global"],
        bump = global.bump,
        constraint = global.authority == admin.key() @ CustomError::UnauthorizedAdmin
    )]
    pub global: Account<'info, PerpsGlobalState>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    /// CHECK: validated by oracle adapter or pyth in handler
    pub oracle_price_account: AccountInfo<'info>,
    #[account(
        init,
        payer = admin,
        space = PerpsMarket::LEN,
        seeds = [b"perps_market", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, PerpsMarket>,
    #[account(
        init,
        payer = admin,
        token::mint = quote_mint,
        token::authority = market
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeOraclePrice<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"perps_global"],
        bump = global.bump,
        constraint = global.authority == admin.key() @ CustomError::UnauthorizedAdmin
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        init,
        payer = admin,
        space = PerpsOraclePrice::LEN,
        seeds = [b"perps_oracle", admin.key().as_ref()],
        bump
    )]
    pub oracle: Account<'info, PerpsOraclePrice>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_oracle_price(ctx: Context<InitializeOraclePrice>, price_i64: i64) -> Result<()> {
    let oracle = &mut ctx.accounts.oracle;
    oracle.admin = ctx.accounts.admin.key();
    oracle.price_i64 = price_i64;
    oracle.last_update_ts = Clock::get()?.unix_timestamp;
    oracle.bump = ctx.bumps.oracle;
    Ok(())
}

#[derive(Accounts)]
pub struct SetOraclePrice<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"perps_global"],
        bump = global.bump,
        constraint = global.authority == admin.key() @ CustomError::UnauthorizedAdmin
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        mut,
        seeds = [b"perps_oracle", admin.key().as_ref()],
        bump = oracle.bump
    )]
    pub oracle: Account<'info, PerpsOraclePrice>,
}

pub fn set_oracle_price(ctx: Context<SetOraclePrice>, price_i64: i64) -> Result<()> {
    let oracle = &mut ctx.accounts.oracle;
    oracle.price_i64 = price_i64;
    oracle.last_update_ts = Clock::get()?.unix_timestamp;
    Ok(())
}
pub fn create_market(
    ctx: Context<CreatePerpsMarket>,
    pyth_feed_id: [u8; 32],
    max_leverage: u16,
    maintenance_margin_bps: u16,
    max_funding_rate: i64,
    funding_interval_secs: i64,
) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);
    require!(max_leverage > 0, CustomError::InvalidLeverage);
    require!(max_funding_rate >= 0, CustomError::InvalidFundingParams);
    require!(funding_interval_secs > 0, CustomError::InvalidFundingParams);
    let _ = read_oracle_price(&ctx.accounts.oracle_price_account)?;
    let market = &mut ctx.accounts.market;
    market.base_mint = ctx.accounts.base_mint.key();
    market.quote_mint = ctx.accounts.quote_mint.key();
    market.pyth_feed_id = pyth_feed_id;
    market.oracle_price_account = ctx.accounts.oracle_price_account.key();
    market.max_leverage = max_leverage;
    market.maintenance_margin_bps = maintenance_margin_bps;
    market.funding_rate_i64 = 0;
    market.open_interest_i128 = 0;
    market.cumulative_funding_i128 = 0;
    market.last_funding_ts = Clock::get()?.unix_timestamp;
    market.max_funding_rate_i64 = max_funding_rate;
    market.funding_interval_secs = funding_interval_secs;
    market.collateral_vault = ctx.accounts.collateral_vault.key();
    market.bump = ctx.bumps.market;
    // Liquidation defaults: 2.5% fee to liquidator, 2.5% penalty to insurance
    market.liquidation_fee_bps = 250;
    market.liquidation_penalty_bps = 250;
    market.emergency = false;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePerpsUser<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = PerpsUserAccount::LEN,
        seeds = [b"perps_user", owner.key().as_ref()],
        bump
    )]
    pub user: Account<'info, PerpsUserAccount>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_user(ctx: Context<InitializePerpsUser>) -> Result<()> {
    let user = &mut ctx.accounts.user;
    user.owner = ctx.accounts.owner.key();
    user.collateral_quote_u64 = 0;
    user.positions_count_u8 = 0;
    user.bump = ctx.bumps.user;
    Ok(())
}

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [b"perps_global"],
        bump = global.bump
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        mut,
        seeds = [b"perps_user", owner.key().as_ref()],
        bump = user.bump,
        constraint = user.owner == owner.key()
    )]
    pub user: Account<'info, PerpsUserAccount>,
    #[account(
        mut,
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    #[account(mut, constraint = user_quote_ata.mint == market.quote_mint)]
    pub user_quote_ata: Account<'info, TokenAccount>,
    #[account(mut, address = market.collateral_vault, constraint = collateral_vault.mint == market.quote_mint)]
    pub collateral_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);
    require!(amount > 0, CustomError::InvalidAmount);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_quote_ata.to_account_info(),
                to: ctx.accounts.collateral_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
    )?;
    let user = &mut ctx.accounts.user;
    user.collateral_quote_u64 = user
        .collateral_quote_u64
        .checked_add(amount)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    Ok(())
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"perps_global"],
        bump = global.bump
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        mut,
        seeds = [b"perps_user", owner.key().as_ref()],
        bump = user.bump,
        constraint = user.owner == owner.key()
    )]
    pub user: Account<'info, PerpsUserAccount>,
    #[account(
        mut,
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    /// CHECK: validated in handler
    pub oracle_price_account: AccountInfo<'info>,
    #[account(
        init_if_needed,
        payer = owner,
        space = PerpsPosition::LEN,
        seeds = [b"perps_position", owner.key().as_ref(), market.key().as_ref()],
        bump,
        constraint = position.owner == Pubkey::default() || position.owner == owner.key(),
        constraint = position.market == Pubkey::default() || position.market == market.key()
    )]
    pub position: Account<'info, PerpsPosition>,
    pub system_program: Program<'info, System>,
}

pub fn open_position(
    ctx: Context<OpenPosition>,
    side: PositionSide,
    size_i64: i64,
    leverage_u16: u16,
    order_type: OrderType,
) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);
    require!(order_type == OrderType::Market, CustomError::OrderTypeNotSupported);
    require!(size_i64 > 0, CustomError::InvalidAmount);
    require!(leverage_u16 > 0, CustomError::InvalidLeverage);
    require!(
        leverage_u16 <= ctx.accounts.market.max_leverage,
        CustomError::InvalidLeverage
    );

    require!(
        ctx.accounts.oracle_price_account.key() == ctx.accounts.market.oracle_price_account,
        CustomError::OraclePriceUnavailable
    );
    let price = read_oracle_price(&ctx.accounts.oracle_price_account)?;

    // ── Settle accumulated funding before trade ──
    let position = &mut ctx.accounts.position;
    let (settled_coll, settled_checkpoint, funding_delta) = settle_funding_inner(
        position.base_position_i64,
        position.collateral_u64,
        position.last_funding_i128,
        ctx.accounts.market.cumulative_funding_i128,
    )?;
    position.collateral_u64 = settled_coll;
    position.last_funding_i128 = settled_checkpoint;
    if funding_delta != 0 {
        emit!(FundingSettled {
            position: position.key(),
            funding_delta,
            new_collateral: settled_coll,
        });
    }

    // Compute signed base delta from side + size
    let trade_base_delta: i64 = match side {
        PositionSide::Long => size_i64,
        PositionSide::Short => size_i64.checked_neg().ok_or(error!(CustomError::CalculationOverflow))?,
    };

    // Build current position state snapshot
    let current_state = PositionState {
        base_position: position.base_position_i64,
        entry_price: position.entry_price_i64,
        realized_pnl: position.realized_pnl_i128,
        last_cum_funding: position.last_funding_i128,
    };

    // Apply the trade via the position engine (pure function)
    let result = perps_math::apply_trade_to_position(&current_state, trade_base_delta, price)?;

    // Compute notional after the trade for margin requirement
    let new_notional = notional_value(result.new_base_position, price)?;
    let required = required_margin_scaled(new_notional, leverage_u16)?;
    let required_u64 = u64::try_from(required).map_err(|_| error!(CustomError::CalculationOverflow))?;

    // Compute how much additional collateral is needed.
    // If position already has collateral, we only need the delta.
    let old_collateral = position.collateral_u64;
    let additional_collateral = required_u64.saturating_sub(old_collateral);

    let user = &mut ctx.accounts.user;
    require!(
        user.collateral_quote_u64 >= additional_collateral,
        CustomError::InsufficientCollateral
    );
    user.collateral_quote_u64 = user
        .collateral_quote_u64
        .checked_sub(additional_collateral)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    // If a partial close occurred (pnl_delta != 0), credit realized PnL to user
    if result.pnl_delta > 0 {
        let pnl_credit = u64::try_from(result.pnl_delta)
            .map_err(|_| error!(CustomError::CalculationOverflow))?;
        user.collateral_quote_u64 = user
            .collateral_quote_u64
            .checked_add(pnl_credit)
            .ok_or(error!(CustomError::CalculationOverflow))?;
    }
    // If pnl_delta < 0, the loss was already encapsulated in the reduced notional

    // Determine if this is a brand new position (prevously empty)
    let was_empty = current_state.base_position == 0;

    // Update on-chain position fields
    position.owner = ctx.accounts.owner.key();
    position.market = ctx.accounts.market.key();
    position.base_position_i64 = result.new_base_position;
    position.entry_price_i64 = result.new_entry_price;
    position.realized_pnl_i128 = result.new_realized_pnl;
    position.side = position.derived_side();
    position.collateral_u64 = required_u64;
    position.leverage_u16 = leverage_u16;
    position.last_funding_i128 = ctx.accounts.market.cumulative_funding_i128;
    position.bump = ctx.bumps.position;

    // Update open interest — add new notional, subtract old
    let old_notional = notional_value(current_state.base_position, price)?;
    let oi_delta = new_notional
        .checked_sub(old_notional)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    ctx.accounts.market.open_interest_i128 = ctx
        .accounts
        .market
        .open_interest_i128
        .checked_add(oi_delta)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    // Increment positions count only for fresh positions
    if was_empty && result.new_base_position != 0 {
        user.positions_count_u8 = user
            .positions_count_u8
            .checked_add(1)
            .ok_or(error!(CustomError::CalculationOverflow))?;
    }
    // If position was flipped to empty (unlikely via open_position but technically possible), decrement
    if !was_empty && result.new_base_position == 0 {
        user.positions_count_u8 = user.positions_count_u8.saturating_sub(1);
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"perps_global"],
        bump = global.bump
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        mut,
        seeds = [b"perps_user", owner.key().as_ref()],
        bump = user.bump,
        constraint = user.owner == owner.key()
    )]
    pub user: Account<'info, PerpsUserAccount>,
    #[account(
        mut,
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    /// CHECK: validated in handler
    pub oracle_price_account: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"perps_position", owner.key().as_ref(), market.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == owner.key(),
        constraint = position.market == market.key()
    )]
    pub position: Account<'info, PerpsPosition>,
}

pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);
    let position = &mut ctx.accounts.position;
    require!(position.base_position_i64 != 0, CustomError::NoOpenPosition);

    require!(
        ctx.accounts.oracle_price_account.key() == ctx.accounts.market.oracle_price_account,
        CustomError::OraclePriceUnavailable
    );
    let price = read_oracle_price(&ctx.accounts.oracle_price_account)?;

    // ── Settle accumulated funding before close ──
    let (settled_coll, settled_checkpoint, funding_delta) = settle_funding_inner(
        position.base_position_i64,
        position.collateral_u64,
        position.last_funding_i128,
        ctx.accounts.market.cumulative_funding_i128,
    )?;
    position.collateral_u64 = settled_coll;
    position.last_funding_i128 = settled_checkpoint;
    if funding_delta != 0 {
        emit!(FundingSettled {
            position: position.key(),
            funding_delta,
            new_collateral: settled_coll,
        });
    }

    // Use position engine: closing = trade of -base_position
    let current_state = PositionState {
        base_position: position.base_position_i64,
        entry_price: position.entry_price_i64,
        realized_pnl: position.realized_pnl_i128,
        last_cum_funding: position.last_funding_i128,
    };

    let close_delta = position.base_position_i64
        .checked_neg()
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let result = perps_math::apply_trade_to_position(&current_state, close_delta, price)?;

    // result.new_base_position should be 0 (full close)
    // result.pnl_delta has the realized PnL from this close

    // Compute collateral return: old collateral + pnl_delta (clamped to 0 min)
    let mut collateral_i128 = i128::from(position.collateral_u64);
    collateral_i128 = collateral_i128
        .checked_add(result.pnl_delta)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    if collateral_i128 < 0 {
        collateral_i128 = 0;
    }
    let collateral_return = u64::try_from(collateral_i128)
        .map_err(|_| error!(CustomError::CalculationOverflow))?;

    let user = &mut ctx.accounts.user;
    user.collateral_quote_u64 = user
        .collateral_quote_u64
        .checked_add(collateral_return)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    // Update open interest
    let old_notional = notional_value(position.base_position_i64, price)?;
    ctx.accounts.market.open_interest_i128 = ctx
        .accounts
        .market
        .open_interest_i128
        .checked_sub(old_notional)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    // Reset position fields (full close)
    position.base_position_i64 = 0;
    position.entry_price_i64 = 0;
    position.collateral_u64 = 0;
    position.leverage_u16 = 0;
    position.last_funding_i128 = 0;
    position.realized_pnl_i128 = result.new_realized_pnl;
    position.side = 0;

    user.positions_count_u8 = user
        .positions_count_u8
        .saturating_sub(1);
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"perps_global"],
        bump = global.bump
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        mut,
        seeds = [b"perps_user", owner.key().as_ref()],
        bump = user.bump,
        constraint = user.owner == owner.key()
    )]
    pub user: Account<'info, PerpsUserAccount>,
    #[account(
        mut,
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    #[account(mut, constraint = user_quote_ata.mint == market.quote_mint)]
    pub user_quote_ata: Account<'info, TokenAccount>,
    #[account(mut, address = market.collateral_vault, constraint = collateral_vault.mint == market.quote_mint)]
    pub collateral_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);
    let user = &mut ctx.accounts.user;
    require!(user.collateral_quote_u64 >= amount, CustomError::InsufficientCollateral);
    require!(
        user.positions_count_u8 == 0,
        CustomError::MaintenanceMarginViolation
    );

    user.collateral_quote_u64 = user
        .collateral_quote_u64
        .checked_sub(amount)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let seeds: &[&[&[u8]]] = &[&[
        b"perps_market",
        ctx.accounts.market.base_mint.as_ref(),
        ctx.accounts.market.quote_mint.as_ref(),
        &[ctx.accounts.market.bump],
    ]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.collateral_vault.to_account_info(),
                to: ctx.accounts.user_quote_ata.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            seeds,
        ),
        amount,
    )?;
    Ok(())
}

// ─────────────────────────────────────────────────────
// Phase 3 — Funding rate update (permissionless crank)
// ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct UpdateFunding<'info> {
    #[account(
        seeds = [b"perps_global"],
        bump = global.bump
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        mut,
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    /// CHECK: validated against market.oracle_price_account in handler
    pub oracle_price_account: AccountInfo<'info>,
}

/// Update the cumulative funding index for a market.
///
/// `mark_price_i64` — the current perpetual mark price (PRICE_SCALE).
///
/// premium = (mark − index) / index   (scaled by PRICE_SCALE)
/// funding_rate = clamp(premium, ±max_funding_rate)
/// cum_funding += index_price × funding_rate / PRICE_SCALE
pub fn update_funding(ctx: Context<UpdateFunding>, mark_price_i64: i64) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);

    let market = &mut ctx.accounts.market;

    require!(
        ctx.accounts.oracle_price_account.key() == market.oracle_price_account,
        CustomError::OraclePriceUnavailable
    );

    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
        .checked_sub(market.last_funding_ts)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    require!(elapsed >= market.funding_interval_secs, CustomError::FundingTooSoon);

    // Index price from oracle
    let index_price = read_oracle_price(&ctx.accounts.oracle_price_account)?;
    require!(index_price > 0, CustomError::OraclePriceUnavailable);

    let mark = mark_price_i64 as i128;
    let index = index_price as i128;
    let price_scale = PRICE_SCALE;

    // premium = (mark - index) * PRICE_SCALE / index
    let premium = (mark - index)
        .checked_mul(price_scale)
        .ok_or(error!(CustomError::CalculationOverflow))?
        / index;

    // Clamp by ±max_funding_rate
    let max_rate = market.max_funding_rate_i64 as i128;
    let clamped_rate = premium.max(-max_rate).min(max_rate);

    // Store the current period funding rate
    market.funding_rate_i64 = i64::try_from(clamped_rate)
        .map_err(|_| error!(CustomError::CalculationOverflow))?;

    // cum_funding += index_price * clamped_rate / PRICE_SCALE
    // This gives atomic-quote-per-base-unit increment.
    let funding_increment = index
        .checked_mul(clamped_rate)
        .ok_or(error!(CustomError::CalculationOverflow))?
        / price_scale;

    market.cumulative_funding_i128 = market
        .cumulative_funding_i128
        .checked_add(funding_increment)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    market.last_funding_ts = now;

    emit!(FundingUpdated {
        market: market.key(),
        funding_rate: market.funding_rate_i64,
        cumulative_funding: market.cumulative_funding_i128,
        timestamp: now,
    });

    Ok(())
}

// ─────────────────────────────────────────────────────
// Phase 4 — Insurance vault initialization
// ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeInsuranceVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"perps_global"],
        bump = global.bump,
        constraint = global.authority == admin.key() @ CustomError::UnauthorizedAdmin
    )]
    pub global: Account<'info, PerpsGlobalState>,
    #[account(
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    #[account(
        init,
        payer = admin,
        space = InsuranceVault::LEN,
        seeds = [b"insurance_vault", market.key().as_ref()],
        bump
    )]
    pub insurance_vault: Account<'info, InsuranceVault>,
    /// The SPL token account that will hold insurance funds (quote mint).
    #[account(
        init,
        payer = admin,
        token::mint = quote_mint,
        token::authority = insurance_vault
    )]
    pub insurance_vault_ata: Account<'info, TokenAccount>,
    pub quote_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_insurance_vault(ctx: Context<InitializeInsuranceVault>) -> Result<()> {
    let iv = &mut ctx.accounts.insurance_vault;
    iv.market = ctx.accounts.market.key();
    iv.vault_ata = ctx.accounts.insurance_vault_ata.key();
    iv.balance_u64 = 0;
    iv.bump = ctx.bumps.insurance_vault;
    Ok(())
}

// ─────────────────────────────────────────────────────
// Phase 4 — Deposit to insurance fund
// ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct DepositInsurance<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    #[account(
        mut,
        seeds = [b"insurance_vault", market.key().as_ref()],
        bump = insurance_vault.bump,
        constraint = insurance_vault.market == market.key()
    )]
    pub insurance_vault: Account<'info, InsuranceVault>,
    #[account(mut, address = insurance_vault.vault_ata)]
    pub insurance_vault_ata: Account<'info, TokenAccount>,
    #[account(mut, constraint = depositor_ata.mint == market.quote_mint)]
    pub depositor_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit_insurance(ctx: Context<DepositInsurance>, amount: u64) -> Result<()> {
    require!(amount > 0, CustomError::InvalidAmount);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_ata.to_account_info(),
                to: ctx.accounts.insurance_vault_ata.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        amount,
    )?;
    ctx.accounts.insurance_vault.balance_u64 = ctx
        .accounts
        .insurance_vault
        .balance_u64
        .checked_add(amount)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    Ok(())
}

// ─────────────────────────────────────────────────────
// Phase 4 — Liquidation
// ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct LiquidatePosition<'info> {
    /// The liquidator — anyone can call this (permissionless).
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"perps_global"],
        bump = global.bump
    )]
    pub global: Account<'info, PerpsGlobalState>,
    /// The position owner's user account.
    #[account(
        mut,
        seeds = [b"perps_user", position_owner.key().as_ref()],
        bump = user.bump,
        constraint = user.owner == position_owner.key()
    )]
    pub user: Account<'info, PerpsUserAccount>,
    /// CHECK: we only read the key — validated via seeds on `user` and `position`.
    pub position_owner: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"perps_market", market.base_mint.as_ref(), market.quote_mint.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, PerpsMarket>,
    /// CHECK: validated against market.oracle_price_account
    pub oracle_price_account: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"perps_position", position_owner.key().as_ref(), market.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == position_owner.key(),
        constraint = position.market == market.key()
    )]
    pub position: Account<'info, PerpsPosition>,
    #[account(
        mut,
        seeds = [b"insurance_vault", market.key().as_ref()],
        bump = insurance_vault.bump,
        constraint = insurance_vault.market == market.key()
    )]
    pub insurance_vault: Account<'info, InsuranceVault>,
    #[account(mut, address = insurance_vault.vault_ata)]
    pub insurance_vault_ata: Account<'info, TokenAccount>,
    /// Collateral vault of the market (to pay liquidator fee).
    #[account(mut, address = market.collateral_vault)]
    pub collateral_vault: Account<'info, TokenAccount>,
    /// Liquidator's quote-token ATA to receive the liquidation fee.
    #[account(mut, constraint = liquidator_ata.mint == market.quote_mint)]
    pub liquidator_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn liquidate_position(ctx: Context<LiquidatePosition>) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);

    // Prevent self-liquidation
    require!(
        ctx.accounts.liquidator.key() != ctx.accounts.position_owner.key(),
        CustomError::SelfLiquidation
    );

    let position = &mut ctx.accounts.position;
    require!(position.base_position_i64 != 0, CustomError::NoOpenPosition);

    require!(
        ctx.accounts.oracle_price_account.key() == ctx.accounts.market.oracle_price_account,
        CustomError::OraclePriceUnavailable
    );
    let price = read_oracle_price(&ctx.accounts.oracle_price_account)?;

    // ── Settle accumulated funding before liquidation check ──
    let (settled_coll, settled_checkpoint, funding_delta) = settle_funding_inner(
        position.base_position_i64,
        position.collateral_u64,
        position.last_funding_i128,
        ctx.accounts.market.cumulative_funding_i128,
    )?;
    position.collateral_u64 = settled_coll;
    position.last_funding_i128 = settled_checkpoint;
    if funding_delta != 0 {
        emit!(FundingSettled {
            position: position.key(),
            funding_delta,
            new_collateral: settled_coll,
        });
    }

    // ── STEP 1: Liquidation eligibility ──
    let liquidatable = perps_math::is_liquidatable(
        position.collateral_u64,
        position.base_position_i64,
        position.entry_price_i64,
        price,
        ctx.accounts.market.maintenance_margin_bps,
    )?;
    require!(liquidatable, CustomError::NotLiquidatable);

    // ── STEP 2: Compute close size (partial or full) ──
    let close_size_abs = perps_math::compute_liquidation_close_size(
        position.collateral_u64,
        position.base_position_i64,
        position.entry_price_i64,
        price,
        ctx.accounts.market.maintenance_margin_bps,
    )?;
    let abs_base = position.base_position_i64.unsigned_abs() as i64;
    let actual_close = close_size_abs.min(abs_base);
    let is_full_close = actual_close >= abs_base;

    // Compute the close delta (opposite direction of position)
    let close_delta: i64 = if position.base_position_i64 > 0 {
        actual_close.checked_neg().ok_or(error!(CustomError::CalculationOverflow))?
    } else {
        actual_close
    };

    // Apply the trade
    let current_state = perps_math::PositionState {
        base_position: position.base_position_i64,
        entry_price: position.entry_price_i64,
        realized_pnl: position.realized_pnl_i128,
        last_cum_funding: position.last_funding_i128,
    };
    let result = perps_math::apply_trade_to_position(&current_state, close_delta, price)?;

    // ── Compute fees ──
    let closed_notional = perps_math::notional_value(actual_close, price)?;
    // liquidation_fee = closed_notional * fee_bps / 10_000 / PRICE_SCALE
    // (notional is in PRICE_SCALE-squared units: base_units * price_units)
    let liq_fee_scaled = closed_notional
        .checked_mul(ctx.accounts.market.liquidation_fee_bps as i128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        / 10_000i128;
    let liq_fee = u64::try_from(
        liq_fee_scaled / perps_math::PRICE_SCALE
    ).unwrap_or(0);

    let penalty_scaled = closed_notional
        .checked_mul(ctx.accounts.market.liquidation_penalty_bps as i128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        / 10_000i128;
    let insurance_penalty = u64::try_from(
        penalty_scaled / perps_math::PRICE_SCALE
    ).unwrap_or(0);

    // ── Compute equity after trade to determine bad debt ──
    // Effective collateral after the partial close
    let mut remaining_collateral_i128 = i128::from(position.collateral_u64);
    remaining_collateral_i128 = remaining_collateral_i128
        .checked_add(result.pnl_delta)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    // Deduct fees from remaining collateral
    remaining_collateral_i128 = remaining_collateral_i128
        .checked_sub(liq_fee as i128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    remaining_collateral_i128 = remaining_collateral_i128
        .checked_sub(insurance_penalty as i128)
        .ok_or(error!(CustomError::CalculationOverflow))?;

    let mut bad_debt: u64 = 0;
    let mut market_emergency = false;

    if remaining_collateral_i128 < 0 {
        // ── STEP 3: Bad debt — draw from insurance fund ──
        let deficit = remaining_collateral_i128.unsigned_abs();
        bad_debt = u64::try_from(deficit).unwrap_or(u64::MAX);

        let iv = &mut ctx.accounts.insurance_vault;
        if iv.balance_u64 >= bad_debt {
            iv.balance_u64 = iv.balance_u64.checked_sub(bad_debt).unwrap();
        } else {
            // Insurance fund insufficient — set emergency flag
            bad_debt = iv.balance_u64; // absorb what we can
            iv.balance_u64 = 0;
            ctx.accounts.market.emergency = true;
            market_emergency = true;
        }
        remaining_collateral_i128 = 0;
    }

    let remaining_collateral = u64::try_from(remaining_collateral_i128)
        .map_err(|_| error!(CustomError::CalculationOverflow))?;

    // ── Transfer liquidation fee to liquidator from collateral vault ──
    let actual_liq_fee = liq_fee.min(ctx.accounts.collateral_vault.amount);
    if actual_liq_fee > 0 {
        let seeds: &[&[&[u8]]] = &[&[
            b"perps_market",
            ctx.accounts.market.base_mint.as_ref(),
            ctx.accounts.market.quote_mint.as_ref(),
            &[ctx.accounts.market.bump],
        ]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.collateral_vault.to_account_info(),
                    to: ctx.accounts.liquidator_ata.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                seeds,
            ),
            actual_liq_fee,
        )?;
    }

    // ── Transfer penalty to insurance vault from collateral vault ──
    let actual_penalty = insurance_penalty.min(
        ctx.accounts.collateral_vault.amount.saturating_sub(actual_liq_fee)
    );
    if actual_penalty > 0 {
        let seeds: &[&[&[u8]]] = &[&[
            b"perps_market",
            ctx.accounts.market.base_mint.as_ref(),
            ctx.accounts.market.quote_mint.as_ref(),
            &[ctx.accounts.market.bump],
        ]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.collateral_vault.to_account_info(),
                    to: ctx.accounts.insurance_vault_ata.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                seeds,
            ),
            actual_penalty,
        )?;
        ctx.accounts.insurance_vault.balance_u64 = ctx
            .accounts
            .insurance_vault
            .balance_u64
            .checked_add(actual_penalty)
            .ok_or(error!(CustomError::CalculationOverflow))?;
    }

    // ── Update open interest ──
    let closed_oi = perps_math::notional_value(actual_close, price)?;
    ctx.accounts.market.open_interest_i128 = ctx
        .accounts
        .market
        .open_interest_i128
        .checked_sub(closed_oi)
        .unwrap_or(0);

    // ── Update position ──
    if is_full_close {
        position.base_position_i64 = 0;
        position.entry_price_i64 = 0;
        position.collateral_u64 = 0;
        position.leverage_u16 = 0;
        position.last_funding_i128 = 0;
        position.realized_pnl_i128 = result.new_realized_pnl;
        position.side = 0;

        let user = &mut ctx.accounts.user;
        user.positions_count_u8 = user.positions_count_u8.saturating_sub(1);
    } else {
        position.base_position_i64 = result.new_base_position;
        position.entry_price_i64 = result.new_entry_price;
        position.realized_pnl_i128 = result.new_realized_pnl;
        position.collateral_u64 = remaining_collateral;
        position.side = position.derived_side();
    }

    // Return any remaining collateral to user (for full liquidation)
    if is_full_close && remaining_collateral > 0 {
        let user = &mut ctx.accounts.user;
        user.collateral_quote_u64 = user
            .collateral_quote_u64
            .checked_add(remaining_collateral)
            .ok_or(error!(CustomError::CalculationOverflow))?;
    }

    // ── STEP 4: Emit event ──
    emit!(Liquidated {
        position: ctx.accounts.position.key(),
        owner: ctx.accounts.position_owner.key(),
        liquidator: ctx.accounts.liquidator.key(),
        market: ctx.accounts.market.key(),
        size_closed_i64: actual_close,
        mark_price_i64: price,
        liquidator_fee_u64: actual_liq_fee,
        insurance_penalty_u64: actual_penalty,
        bad_debt_u64: bad_debt,
        emergency: market_emergency,
    });

    Ok(())
}
