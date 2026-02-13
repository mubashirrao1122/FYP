use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use pyth_sdk_solana::load_price_feed_from_account_info;
use crate::errors::CustomError;
use crate::perps_math::{self, PositionState, notional_value, required_margin_scaled, unrealized_pnl};
use crate::state::{PerpsGlobalState, PerpsMarket, PerpsOraclePrice, PerpsPosition, PerpsUserAccount};

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
) -> Result<()> {
    require!(!ctx.accounts.global.paused, CustomError::PerpsPaused);
    require!(max_leverage > 0, CustomError::InvalidLeverage);
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
    market.collateral_vault = ctx.accounts.collateral_vault.key();
    market.bump = ctx.bumps.market;
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

    // Compute signed base delta from side + size
    let trade_base_delta: i64 = match side {
        PositionSide::Long => size_i64,
        PositionSide::Short => size_i64.checked_neg().ok_or(error!(CustomError::CalculationOverflow))?,
    };

    let position = &mut ctx.accounts.position;

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
