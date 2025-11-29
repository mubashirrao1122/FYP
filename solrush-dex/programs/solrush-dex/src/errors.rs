use anchor_lang::prelude::*;

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
    
    // ============================================================================
    // Module 3.4: Limit Order Errors
    // ============================================================================
    
    #[msg("Limit order not found")]
    OrderNotFound,
    
    #[msg("Invalid order status for this operation")]
    InvalidOrderStatus,
    
    #[msg("Limit order has expired")]
    OrderExpired,
    
    #[msg("Only order owner can cancel")]
    UnauthorizedOrderOwner,
    
    #[msg("Price condition not met for execution")]
    PriceConditionNotMet,
    
    #[msg("Invalid expiry time")]
    InvalidExpiryTime,
    
    #[msg("Pyth price data unavailable")]
    PythPriceUnavailable,
    
    #[msg("Pyth price data is stale")]
    StalePriceData,
    
    // ============================================================================
    // Module 4.6: Admin Function Errors
    // ============================================================================
    
    #[msg("Invalid authority - must be configured authority")]
    InvalidAuthority,
}
