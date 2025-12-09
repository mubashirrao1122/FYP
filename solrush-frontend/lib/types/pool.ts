import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

/**
 * TypeScript interface matching the Anchor IDL LiquidityPool account structure
 * Fields use camelCase (JavaScript convention) matching the IDL's snake_case field names
 */
export interface LiquidityPoolAccount {
    authority: PublicKey;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    tokenAVault: PublicKey;
    tokenBVault: PublicKey;
    lpTokenMint: PublicKey;  // NOTE: NOT poolMint!
    reserveA: BN;             // NOTE: NOT tokenAReserve!
    reserveB: BN;             // NOTE: NOT tokenBReserve!
    totalLpSupply: BN;
    feeNumerator: BN;
    feeDenominator: BN;
    tokenADecimals: number;
    tokenBDecimals: number;
    isStablecoinPool: boolean;
    createdAt: BN;
    totalVolumeA: BN;
    totalVolumeB: BN;
    lockedLiquidity: BN;
    bump: number;
}

/**
 * Calculate fee in basis points from numerator and denominator
 * @param feeNumerator - Fee numerator from pool account
 * @param feeDenominator - Fee denominator from pool account
 * @returns Fee in basis points (e.g., 30 = 0.3%)
 */
export function calculateFeeBasisPoints(
    feeNumerator: BN | number,
    feeDenominator: BN | number
): number {
    const num = typeof feeNumerator === 'number' ? feeNumerator : feeNumerator.toNumber();
    const denom = typeof feeDenominator === 'number' ? feeDenominator : feeDenominator.toNumber();

    if (denom === 0) {
        console.warn('Fee denominator is 0, returning 0 fee');
        return 0;
    }

    return (num / denom) * 10000;
}
