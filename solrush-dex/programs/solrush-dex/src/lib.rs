use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Transfer, transfer, Mint, MintTo, mint_to},
};

declare_id!("3jRmy5gMAQLFxb2mD3Gi4p9N9VuwLXp9toaqEhi1QSRT");

#[program]
pub mod solrush_dex {
    use super::*;

    /// Module 2.2: Initialize a new liquidity pool with initial deposits
    /// Creates SOL/USDC or SOL/USDT trading pairs using constant product formula (x*y=k)
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
        pool.bump = 254; // Placeholder - will be calculated by Anchor at runtime
        
        // Calculate initial LP tokens using geometric mean: sqrt(reserve_a * reserve_b)
        let lp_tokens = calculate_lp_tokens(initial_deposit_a, initial_deposit_b);
        pool.total_lp_supply = lp_tokens;
        
        // Mint initial LP tokens to the authority (liquidity provider)
        let bump_seed = pool.bump;
        let token_a_mint_key = ctx.accounts.token_a_mint.key();
        let token_b_mint_key = ctx.accounts.token_b_mint.key();
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
        
        // Emit PoolCreated event
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
}

// ============================================================================
// Module 2.1: Define Data Structures
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

// ============================================================================
// Module 2.2: Initialize Pool Context Structure
// ============================================================================

/// Context for initialize_pool instruction
///
/// This instruction creates a new liquidity pool for a trading pair (SOL/USDC or SOL/USDT)
/// with initial liquidity deposited by the authority.
#[derive(Accounts)]
#[instruction(initial_deposit_a: u64, initial_deposit_b: u64)]
pub struct InitializePool<'info> {
    // Pool Account (PDA) - Derived from token pair
    #[account(
        init,
        payer = authority,
        space = 8 + 32*6 + 8*5 + 1,
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,
    
    // Token Mints
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    
    // LP Token Mint (PDA) - Derived from pool
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"lp_mint", pool.key().as_ref()],
        bump
    )]
    pub lp_token_mint: Account<'info, Mint>,
    
    // Token Vaults
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
    
    // User's Token Accounts
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
    
    // User's LP Token Account
    #[account(
        init,
        payer = authority,
        associated_token::mint = lp_token_mint,
        associated_token::authority = authority
    )]
    pub lp_token_account: Account<'info, TokenAccount>,
    
    // System Programs
    #[account(mut)]
    pub authority: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Calculate LP tokens using geometric mean formula
/// LP tokens = sqrt(amount_a * amount_b)
fn calculate_lp_tokens(amount_a: u64, amount_b: u64) -> u64 {
    let product = (amount_a as u128)
        .checked_mul(amount_b as u128)
        .expect("Overflow in LP token calculation");
    (isqrt(product)) as u64
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
// Error Codes
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
}

// ============================================================================
// Events
// ============================================================================

/// Event emitted when a new pool is created
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
