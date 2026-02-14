use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Initial deposits must be greater than zero")]
    InvalidInitialDeposit,
    #[msg("Insufficient liquidity in pool")]
    InsufficientLiquidity,
    #[msg("Invalid fee parameters")]
    InvalidFeeParameters,
    #[msg("Insufficient pool reserves")]
    InsufficientPoolReserves,
    #[msg("Overflow detected in calculation")]
    CalculationOverflow,
    #[msg("Pool ratio imbalance exceeds tolerance")]
    RatioImbalance,
    #[msg("Insufficient LP token balance")]
    InsufficientLPBalance,
    #[msg("Invalid amount: must be greater than zero")]
    InvalidAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageTooHigh,
    #[msg("Pool is not empty")]
    PoolNotEmpty,
    #[msg("Insufficient user token balance")]
    InsufficientBalance,
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
    #[msg("Invalid authority - must be configured authority")]
    InvalidAuthority,
    #[msg("RUSH rewards are currently paused")]
    RewardsPaused,
    #[msg("Invalid APY configuration")]
    InvalidAPY,
    #[msg("RUSH token supply exhausted")]
    SupplyExhausted,
    #[msg("Transaction deadline exceeded")]
    DeadlineExceeded,
    #[msg("Invalid vault - must be pool's token vault")]
    InvalidVault,
    #[msg("Invalid pool - order does not belong to this pool")]
    InvalidPool,
    #[msg("Invalid LP mint - must be pool's LP token mint")]
    InvalidMint,
    #[msg("Perps global state is paused")]
    PerpsPaused,
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,
    #[msg("Invalid leverage")]
    InvalidLeverage,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Position already open")]
    PositionAlreadyOpen,
    #[msg("No open position")]
    NoOpenPosition,
    #[msg("Order type not supported")]
    OrderTypeNotSupported,
    #[msg("Oracle price unavailable")]
    OraclePriceUnavailable,
    #[msg("Maintenance margin violation")]
    MaintenanceMarginViolation,
    #[msg("Funding update too soon — interval not elapsed")]
    FundingTooSoon,
    #[msg("Invalid funding parameters")]
    InvalidFundingParams,
    #[msg("Position is not liquidatable")]
    NotLiquidatable,
    #[msg("Insurance fund insufficient — market in emergency")]
    InsuranceFundDepleted,
    #[msg("Market is in emergency mode")]
    MarketEmergency,
    #[msg("Liquidator cannot liquidate own position")]
    SelfLiquidation,
    #[msg("Close amount exceeds position size")]
    CloseAmountExceedsPosition,
    #[msg("Initial margin violation — insufficient equity to increase position")]
    InsufficientMargin,
}
