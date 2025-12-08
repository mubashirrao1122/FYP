import { PublicKey } from "@solana/web3.js";
import { BN } from "@project-serum/anchor";

// ========== Token Types ==========
export interface TokenInfo {
    symbol: string;
    name: string;
    mint: PublicKey;
    decimals: number;
    logoUri?: string;
}

// ========== Pool Types ==========
export interface LiquidityPool {
    address: PublicKey;
    authority: PublicKey;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    tokenAVault: PublicKey;
    tokenBVault: PublicKey;
    lpMint: PublicKey;
    reserveA: BN;
    reserveB: BN;
    totalLpSupply: BN;
    feeNumerator: number;
    feeDenominator: number;
    bump: number;
}

export interface PoolDisplayData {
    address: string;
    name: string;
    tokenA: TokenInfo;
    tokenB: TokenInfo;
    reserveA: number;
    reserveB: number;
    tvl: number;
    volume24h: number;
    apy: number;
    fee: number;
}

// ========== User Position Types ==========
export interface UserLiquidityPosition {
    owner: PublicKey;
    pool: PublicKey;
    lpTokens: BN;
    depositedA: BN;
    depositedB: BN;
    lastRewardTime: BN;
    bump: number;
}

export interface UserPositionDisplay {
    poolAddress: string;
    poolName: string;
    lpBalance: number;
    valueUsd: number;
    sharePercent: number;
    tokenAAmount: number;
    tokenBAmount: number;
    pendingRewards: number;
}

// ========== Swap Types ==========
export interface SwapQuote {
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
    fee: number;
    minReceived: number;
    exchangeRate: number;
    route?: string[];
}

export interface SwapParams {
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    minOutputAmount: number;
    slippage: number;
}

export enum SwapDirection {
    AToB = 'AToB',
    BToA = 'BToA',
}

// ========== Limit Order Types ==========
export interface LimitOrder {
    id: string;
    owner: PublicKey;
    pool: PublicKey;
    sellToken: PublicKey;
    buyToken: PublicKey;
    sellAmount: BN;
    targetPrice: BN;
    minimumReceive: BN;
    createdAt: number;
    expiresAt: number;
    status: OrderStatus;
    bump: number;
    orderId: number;
}

export enum OrderStatus {
    Pending = 'pending',
    Executed = 'executed',
    Cancelled = 'cancelled',
    Expired = 'expired',
}

export interface LimitOrderDisplay {
    id: string;
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    targetPrice: number;
    minReceive: number;
    status: OrderStatus;
    expiresAt: Date;
    createdAt: Date;
}

// ========== Rewards Types ==========
export interface RushConfig {
    authority: PublicKey;
    rushMint: PublicKey;
    totalSupply: BN;
    circulatingSupply: BN;
    rewardRate: BN;
    isPaused: boolean;
    bump: number;
}

export interface RewardsData {
    claimable: number;
    totalEarned: number;
    claimed: number;
    rushBalance: number;
    lastClaimTime?: number;
}

export interface PoolReward {
    poolAddress: string;
    tokenA: string;
    tokenB: string;
    pendingRewards: number;
    earnedRewards: number;
    lpBalance: number;
}

// ========== Transaction Types ==========
export interface TransactionResult {
    signature: string;
    success: boolean;
    error?: string;
}

export interface TransactionHistory {
    signature: string;
    type: 'swap' | 'addLiquidity' | 'removeLiquidity' | 'claimRewards' | 'createOrder' | 'cancelOrder';
    timestamp: number;
    status: 'confirmed' | 'failed' | 'pending';
    details: Record<string, any>;
}

// ========== UI State Types ==========
export interface LoadingState {
    isLoading: boolean;
    message?: string;
}

export interface ErrorState {
    hasError: boolean;
    message?: string;
    code?: string;
}

// ========== Form Types ==========
export interface SwapFormData {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    slippage: number;
}

export interface AddLiquidityFormData {
    tokenA: string;
    tokenB: string;
    amountA: string;
    amountB: string;
}

export interface RemoveLiquidityFormData {
    lpAmount: string;
    slippage: number;
}

export interface LimitOrderFormData {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    targetPrice: string;
    expiryDays: number;
}
