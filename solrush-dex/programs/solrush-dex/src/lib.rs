use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint, MintTo, mint_to, Transfer, transfer, Burn, burn},
};

declare_id!("3jRmy5gMAQLFxb2mD3Gi4p9N9VuwLXp9toaqEhi1QSRT");

// ============================================================================
// STATE STRUCTURES (Module 2.1 - Refactored)
// ============================================================================

/// LiquidityPool Account Structure
/// Represents a single trading pair pool (SOL/USDC or SOL/USDT)
///
/// Space: 8 (discriminator) + 32*6 + 8*5 + 1 = 249 bytes
#[account]
pub struct LiquidityPool {
    // Authority and Token Configuration (192 bytes)
    pub authority: Pubkey,           // Pool creator/admin (32 bytes)
    pub token_a_mint: Pubkey,        // SOL mint address (32 bytes)
    pub token_b_mint: Pubkey,        // USDC or USDT mint address (32 bytes)
    pub token_a_vault: Pubkey,       // Vault holding SOL tokens (32 bytes)
    pub token_b_vault: Pubkey,       // Vault holding USDC/USDT tokens (32 bytes)
    pub lp_token_mint: Pubkey,       // LP token mint address (32 bytes)
    
    // Pool State (24 bytes)
    pub reserve_a: u64,              // Current SOL reserve in pool (8 bytes)
    pub reserve_b: u64,              // Current USDC/USDT reserve in pool (8 bytes)
    pub total_lp_supply: u64,        // Total LP tokens in circulation (8 bytes)
    
    // Fee Configuration (16 bytes)
    pub fee_numerator: u64,          // Fee numerator = 3 for 0.3% (8 bytes)
    pub fee_denominator: u64,        // Fee denominator = 1000 (8 bytes)
    
    // PDA Verification (1 byte)
    pub bump: u8,                    // PDA bump seed (1 byte)
}

impl LiquidityPool {
    pub const SIZE: usize = 8 + 32*6 + 8*5 + 1;
}

/// UserLiquidityPosition Account Structure
/// Tracks individual user's LP token position and rewards
///
/// Space: 8 (discriminator) + 32*2 + 8*4 + 1 = 113 bytes
#[account]
pub struct UserLiquidityPosition {
    pub owner: Pubkey,               // User wallet address (32 bytes)
    pub pool: Pubkey,                // Associated pool account (32 bytes)
    pub lp_tokens: u64,              // LP tokens owned by user (8 bytes)
    pub deposit_timestamp: i64,      // When the LP position was created (8 bytes)
    pub last_claim_timestamp: i64,   // Last RUSH reward claim timestamp (8 bytes)
    pub total_rush_claimed: u64,     // Total RUSH tokens claimed (8 bytes)
    pub bump: u8,                    // PDA bump seed (1 byte)
}

impl UserLiquidityPosition {
    pub const SIZE: usize = 8 + 32*2 + 8*4 + 1;
}

// ============================================================================
// CUSTOM ERRORS (Module 2.2)
// ============================================================================

#[error_code]
pub enum CustomError {
    #[msg("Initial deposits must be greater than zero")]
    InvalidInitialDeposit,
    
    #[msg("Insufficient liquidity in pool")]
    InsufficientLiquidity,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageTooHigh,
    
    #[msg("Invalid fee parameters")]
    InvalidFeeParameters,
    
    #[msg("Overflow detected in calculation")]
    CalculationOverflow,
    
    #[msg("Pool ratio imbalance exceeds tolerance")]
    RatioImbalance,
    
    #[msg("Insufficient user token balance")]
    InsufficientBalance,
    
    #[msg("Insufficient LP token balance")]
    InsufficientLPBalance,
    
    #[msg("Invalid amount: must be greater than zero")]
    InvalidAmount,
    
    #[msg("Insufficient pool reserves")]
    InsufficientPoolReserves,
}

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

// ============================================================================
// UTILITY FUNCTIONS (Module 2.1, 2.3, 2.4 Helpers)
// ============================================================================

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
}

// ============================================================================
// CONTEXTS (Accounts structures)
// ============================================================================

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
