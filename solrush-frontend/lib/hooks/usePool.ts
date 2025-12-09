'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect, useCallback } from 'react';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getProgram, getReadOnlyProgram, toBN, fromBN } from '../anchor/setup';
import { findPoolAddress, findLpMintAddress, findPositionAddress } from '../anchor/pda';
import { getTokenMint, TOKEN_DECIMALS } from '../constants';
import { calculateFeeBasisPoints } from '../types/pool';
import { getTokenPrice } from '../services/priceService';

export interface PoolData {
  address: string;
  tokenA: string;
  tokenB: string;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  reserveA: number;
  reserveB: number;
  totalLPSupply: number;
  lpTokenDecimals: number;
  fee: number;
  feeBasisPoints: number;
  tvl: number;
  apy: number;
  userLiquidity?: number;
  userLpBalance?: number;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  lpMint: PublicKey;
  loading: boolean;
  error: string | null;
}

interface AddLiquidityParams {
  amountA: number;
  amountB: number;
  minLpTokens?: number;
}

interface RemoveLiquidityParams {
  lpTokenAmount: number;
  minAmountA: number;
  minAmountB: number;
}

export interface UserPosition {
  lpTokens: number;            // User's LP token balance
  depositTimestamp: Date;      // When position was created
  lastClaimTimestamp: Date;    // Last time rewards claimed
  totalRushClaimed: number;    // Total RUSH rewards claimed
  shareOfPool: number;         // Percentage ownership of pool
  valueA: number;              // Current value in token A
  valueB: number;              // Current value in token B
  totalValueUSD: number;       // Total position value estimate
}

/**
 * Custom hook for pool data management and liquidity operations
 */
export function usePool(poolAddress?: string, tokenASymbol?: string, tokenBSymbol?: string) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [pool, setPool] = useState<PoolData | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  /**
   * Fetch pool data from blockchain
   */
  const fetchPoolData = useCallback(async (): Promise<PoolData | null> => {
    if (!tokenASymbol || !tokenBSymbol) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const program = getReadOnlyProgram(connection);
      if (!program) {
        throw new Error('Failed to initialize program');
      }

      const tokenAMint = getTokenMint(tokenASymbol);
      const tokenBMint = getTokenMint(tokenBSymbol);
      const [poolPda] = findPoolAddress(tokenAMint, tokenBMint);

      const poolAccount = await (program.account as any).liquidityPool.fetch(poolPda);

      // Get LP mint address
      const lpMint = poolAccount.lpTokenMint as PublicKey;

      // Get reserves (convert from BN)
      const reserveA = (poolAccount.reserveA as BN).toNumber();
      const reserveB = (poolAccount.reserveB as BN).toNumber();

      // Fetch real token prices
      const decimalA = TOKEN_DECIMALS[tokenASymbol] || 9;
      const decimalB = TOKEN_DECIMALS[tokenBSymbol] || 6;

      const [priceA, priceB] = await Promise.all([
        getTokenPrice(tokenASymbol),
        getTokenPrice(tokenBSymbol),
      ]);

      const valueA = (reserveA / Math.pow(10, decimalA)) * priceA;
      const valueB = (reserveB / Math.pow(10, decimalB)) * priceB;
      const tvl = valueA + valueB;

      // Get user's LP balance if connected
      let userLpBalance = 0;
      if (wallet.publicKey) {
        try {
          const userLpAccount = await getAssociatedTokenAddress(lpMint, wallet.publicKey);
          const balance = await connection.getTokenAccountBalance(userLpAccount);
          userLpBalance = parseFloat(balance.value.uiAmountString || '0');
        } catch (e) {
          // User doesn't have LP tokens yet
        }
      }

      // Calculate fee from numerator/denominator
      const feeBasisPoints = calculateFeeBasisPoints(
        poolAccount.feeNumerator as BN,
        poolAccount.feeDenominator as BN
      );

      const poolData: PoolData = {
        address: poolPda.toBase58(),
        tokenA: tokenASymbol,
        tokenB: tokenBSymbol,
        tokenAMint: poolAccount.tokenAMint as PublicKey,
        tokenBMint: poolAccount.tokenBMint as PublicKey,
        reserveA,
        reserveB,
        totalLPSupply: 0, // Will be fetched from mint
        lpTokenDecimals: 6,
        fee: feeBasisPoints / 10000,
        feeBasisPoints,
        tvl,
        apy: 0, // Calculate based on historical data
        userLpBalance,
        tokenAVault: poolAccount.tokenAVault as PublicKey,
        tokenBVault: poolAccount.tokenBVault as PublicKey,
        lpMint,
        loading: false,
        error: null,
      };

      setPool(poolData);
      return poolData;
    } catch (err: any) {
      console.error("Failed to fetch pool:", err);
      const errorMsg = err.message || 'Failed to fetch pool data';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey, tokenASymbol, tokenBSymbol]);

  /**
   * Fetch user's liquidity position from blockchain
   */
  const fetchUserPosition = useCallback(async (): Promise<UserPosition | null> => {
    if (!wallet.publicKey || !tokenASymbol || !tokenBSymbol || !pool) {
      setUserPosition(null);
      return null;
    }

    try {
      const program = getReadOnlyProgram(connection);
      if (!program) {
        throw new Error('Failed to initialize program');
      }

      const tokenAMint = getTokenMint(tokenASymbol);
      const tokenBMint = getTokenMint(tokenBSymbol);
      const [poolPda] = findPoolAddress(tokenAMint, tokenBMint);
      const [positionPda] = findPositionAddress(poolPda, wallet.publicKey);

      // Fetch position account (may not exist)
      const positionAccount = await (program.account as any).userLiquidityPosition.fetchNullable(positionPda);

      // Get user's LP token balance
      const lpMint = pool.lpMint;
      const userLpAccount = await getAssociatedTokenAddress(lpMint, wallet.publicKey);
      let lpTokens = 0;
      try {
        const lpBalance = await connection.getTokenAccountBalance(userLpAccount);
        lpTokens = parseFloat(lpBalance.value.uiAmountString || '0');
      } catch {
        // User doesn't have LP tokens yet
      }

      if (!positionAccount || lpTokens === 0) {
        setUserPosition(null);
        return null;
      }

      // Calculate share of pool
      const totalLPSupply = pool.totalLPSupply || 1;
      const shareOfPool = (lpTokens / totalLPSupply) * 100;

      // Calculate current value using pool reserves
      const shareDecimal = lpTokens / totalLPSupply;
      const decimalA = TOKEN_DECIMALS[tokenASymbol] || 9;
      const decimalB = TOKEN_DECIMALS[tokenBSymbol] || 6;

      const valueA = pool.reserveA * shareDecimal;
      const valueB = pool.reserveB * shareDecimal;

      // Estimate USD value (simplified)
      const solPrice = 100; // Mock price
      const tokenAPrice = tokenASymbol === 'SOL' ? solPrice : 1;
      const tokenBPrice = tokenBSymbol === 'SOL' ? solPrice : 1;

      const totalValueUSD =
        (valueA / Math.pow(10, decimalA)) * tokenAPrice +
        (valueB / Math.pow(10, decimalB)) * tokenBPrice;

      const position: UserPosition = {
        lpTokens,
        depositTimestamp: new Date((positionAccount.depositedAt as BN).toNumber() * 1000),
        lastClaimTimestamp: new Date((positionAccount.lastClaim as BN).toNumber() * 1000),
        totalRushClaimed: fromBN(positionAccount.totalRushClaimed as BN, 6),
        shareOfPool,
        valueA,
        valueB,
        totalValueUSD,
      };

      setUserPosition(position);
      return position;
    } catch (err: any) {
      console.error('Failed to fetch user position:', err);
      setUserPosition(null);
      return null;
    }
  }, [connection, wallet.publicKey, tokenASymbol, tokenBSymbol, pool]);


  /**
   * Calculate LP tokens to receive when adding liquidity
   */
  const calculateLPTokens = useCallback((amountA: number, amountB: number): number => {
    if (!pool) return 0;

    const existingA = pool.reserveA;
    const existingB = pool.reserveB;
    const existingSupply = pool.totalLPSupply;

    if (existingSupply === 0 || existingA === 0) {
      // First liquidity provider: mint sqrt(a * b)
      return Math.sqrt(amountA * amountB);
    }

    // Calculate liquidity for both token amounts
    const liquidityFromA = (amountA / existingA) * existingSupply;
    const liquidityFromB = (amountB / existingB) * existingSupply;

    // Take the minimum (constrained by pool ratio)
    return Math.min(liquidityFromA, liquidityFromB);
  }, [pool]);

  /**
   * Calculate pool share percentage
   */
  const calculatePoolShare = useCallback((userLPTokens: number): number => {
    if (!pool) return 0;
    const totalSupply = pool.totalLPSupply;
    if (totalSupply === 0) return 100;
    return (userLPTokens / (totalSupply + userLPTokens)) * 100;
  }, [pool]);

  /**
   * Add liquidity to pool
   */
  const addLiquidity = useCallback(async (params: AddLiquidityParams): Promise<string> => {
    if (!wallet.publicKey || !tokenASymbol || !tokenBSymbol) {
      throw new Error('Wallet not connected or pool not specified');
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);

    try {
      const program = getProgram(connection, wallet);
      if (!program) {
        throw new Error('Failed to initialize program');
      }

      const tokenAMint = getTokenMint(tokenASymbol);
      const tokenBMint = getTokenMint(tokenBSymbol);
      const [poolPda] = findPoolAddress(tokenAMint, tokenBMint);

      // Fetch pool to get vault addresses
      const poolAccount = await (program.account as any).liquidityPool.fetch(poolPda);

      const lpMint = poolAccount.lpTokenMint as PublicKey;
      const tokenAVault = poolAccount.tokenAVault as PublicKey;
      const tokenBVault = poolAccount.tokenBVault as PublicKey;

      // Get user token accounts
      const userTokenA = await getAssociatedTokenAddress(tokenAMint, wallet.publicKey);
      const userTokenB = await getAssociatedTokenAddress(tokenBMint, wallet.publicKey);
      const userLpToken = await getAssociatedTokenAddress(lpMint, wallet.publicKey);

      // Get user position PDA
      const [userPosition] = findPositionAddress(poolPda, wallet.publicKey);

      // Convert amounts
      const decimalA = TOKEN_DECIMALS[tokenASymbol] || 9;
      const decimalB = TOKEN_DECIMALS[tokenBSymbol] || 6;

      const amountABN = toBN(params.amountA, decimalA);
      const amountBBN = toBN(params.amountB, decimalB);

      const tx = await program.methods
        .addLiquidity(amountABN, amountBBN)
        .accounts({
          user: wallet.publicKey,
          pool: poolPda,
          userTokenA,
          userTokenB,
          tokenAVault,
          tokenBVault,
          lpTokenMint: lpMint,
          userLpTokenAccount: userLpToken,
          userPosition,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      setTxSignature(tx);

      // Refresh pool data
      await fetchPoolData();

      return tx;
    } catch (err: any) {
      console.error("Add liquidity error:", err);
      const errorMsg = err.message || 'Failed to add liquidity';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, tokenASymbol, tokenBSymbol, fetchPoolData]);

  /**
   * Remove liquidity from pool
   */
  const removeLiquidity = useCallback(async (params: RemoveLiquidityParams): Promise<string> => {
    if (!wallet.publicKey || !tokenASymbol || !tokenBSymbol) {
      throw new Error('Wallet not connected or pool not specified');
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);

    try {
      const program = getProgram(connection, wallet);
      if (!program) {
        throw new Error('Failed to initialize program');
      }

      const tokenAMint = getTokenMint(tokenASymbol);
      const tokenBMint = getTokenMint(tokenBSymbol);
      const [poolPda] = findPoolAddress(tokenAMint, tokenBMint);

      // Fetch pool to get vault addresses
      const poolAccount = await (program.account as any).liquidityPool.fetch(poolPda);

      const lpMint = poolAccount.lpTokenMint as PublicKey;
      const tokenAVault = poolAccount.tokenAVault as PublicKey;
      const tokenBVault = poolAccount.tokenBVault as PublicKey;

      // Get user token accounts
      const userTokenA = await getAssociatedTokenAddress(tokenAMint, wallet.publicKey);
      const userTokenB = await getAssociatedTokenAddress(tokenBMint, wallet.publicKey);
      const userLpToken = await getAssociatedTokenAddress(lpMint, wallet.publicKey);

      // Get user position PDA
      const [userPosition] = findPositionAddress(poolPda, wallet.publicKey);

      // Convert amounts
      const decimalA = TOKEN_DECIMALS[tokenASymbol] || 9;
      const decimalB = TOKEN_DECIMALS[tokenBSymbol] || 6;

      const lpAmountBN = toBN(params.lpTokenAmount, 6); // LP tokens have 6 decimals
      const minAmountABN = toBN(params.minAmountA, decimalA);
      const minAmountBBN = toBN(params.minAmountB, decimalB);

      const tx = await program.methods
        .removeLiquidity(lpAmountBN, minAmountABN, minAmountBBN)
        .accounts({
          user: wallet.publicKey,
          pool: poolPda,
          lpTokenMint: lpMint,
          userPosition,
          tokenAVault,
          tokenBVault,
          userLpTokenAccount: userLpToken,
          userTokenA,
          userTokenB,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxSignature(tx);

      // Refresh pool data
      await fetchPoolData();

      return tx;
    } catch (err: any) {
      console.error("Remove liquidity error:", err);
      const errorMsg = err.message || 'Failed to remove liquidity';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, tokenASymbol, tokenBSymbol, fetchPoolData]);

  /**
   * Close the pool (only if empty)
   */
  const closePool = useCallback(async (): Promise<string> => {
    if (!wallet.publicKey || !tokenASymbol || !tokenBSymbol) {
      throw new Error('Wallet not connected or pool not specified');
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);

    try {
      const program = getProgram(connection, wallet);
      if (!program) {
        throw new Error('Failed to initialize program');
      }

      const tokenAMint = getTokenMint(tokenASymbol);
      const tokenBMint = getTokenMint(tokenBSymbol);
      const [poolPda] = findPoolAddress(tokenAMint, tokenBMint);

      // Fetch pool to get vault addresses
      const poolAccount = await program.account.liquidityPool.fetch(poolPda);
      const tokenAVault = poolAccount.tokenAVault as PublicKey;
      const tokenBVault = poolAccount.tokenBVault as PublicKey;

      const tx = await program.methods
        .closePool()
        .accounts({
          pool: poolPda,
          authority: wallet.publicKey,
          tokenAVault,
          tokenBVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxSignature(tx);
      setPool(null); // Pool is closed

      return tx;
    } catch (err: any) {
      console.error("Close pool error:", err);
      const errorMsg = err.message || 'Failed to close pool';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, tokenASymbol, tokenBSymbol]);

  /**
   * Calculate expected tokens when removing liquidity
   */
  const calculateRemoveAmounts = useCallback((lpAmount: number): { amountA: number; amountB: number } => {
    if (!pool || pool.totalLPSupply === 0) {
      return { amountA: 0, amountB: 0 };
    }

    const share = lpAmount / pool.totalLPSupply;
    return {
      amountA: pool.reserveA * share,
      amountB: pool.reserveB * share,
    };
  }, [pool]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch pool data on mount and when tokens change
  useEffect(() => {
    if (tokenASymbol && tokenBSymbol) {
      fetchPoolData();
    }
  }, [fetchPoolData, tokenASymbol, tokenBSymbol]);

  // Refresh pool data periodically (every 30 seconds)
  useEffect(() => {
    if (!tokenASymbol || !tokenBSymbol) return;

    const interval = setInterval(() => {
      fetchPoolData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchPoolData, tokenASymbol, tokenBSymbol]);

  // Fetch user position when pool or wallet changes
  useEffect(() => {
    if (pool && wallet.publicKey) {
      fetchUserPosition();
    } else {
      setUserPosition(null);
    }
  }, [pool, wallet.publicKey, fetchUserPosition]);

  return {
    pool,
    userPosition,
    loading,
    error,
    txSignature,
    fetchPoolData,
    fetchUserPosition,
    addLiquidity,
    removeLiquidity,
    closePool,
    calculateLPTokens,
    calculatePoolShare,
    calculateRemoveAmounts,
    clearError,
  };
}

/**
 * Hook for creating new liquidity pools
 */
export function useCreatePool() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  /**
   * Create a new liquidity pool
   */
  const createPool = useCallback(async (
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
  ): Promise<string> => {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);

    try {
      const program = getProgram(connection, wallet);
      if (!program) {
        throw new Error('Failed to initialize program');
      }

      // Sort mints to ensure deterministic order (smaller first) matches PDA derivation
      const [mintA, mintB] = tokenAMint.toBuffer().compare(tokenBMint.toBuffer()) < 0
        ? [tokenAMint, tokenBMint]
        : [tokenBMint, tokenAMint];

      // Derive PDAs using sorted mints
      const [poolPda] = findPoolAddress(mintA, mintB);
      const [lpMintPda] = findLpMintAddress(poolPda);

      // Derive vault addresses (automatically created by program)
      const tokenAVault = await getAssociatedTokenAddress(
        mintA,
        poolPda,
        true // Allow owner off curve (PDA)
      );
      const tokenBVault = await getAssociatedTokenAddress(
        mintB,
        poolPda,
        true
      );

      // Call initializePool instruction with sorted mints
      const tx = await program.methods
        .initializePool()
        .accounts({
          authority: wallet.publicKey,
          pool: poolPda,
          tokenAMint: mintA,
          tokenBMint: mintB,
          tokenAVault,
          tokenBVault,
          lpTokenMint: lpMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      setTxSignature(tx);
      console.log('Pool created:', tx);

      return tx;
    } catch (err: any) {
      console.error('Create pool error:', err);
      const errorMsg = err.message || 'Failed to create pool';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  /**
   * Check if a pool already exists
   */
  const checkPoolExists = useCallback(async (
    tokenAMint: PublicKey,
    tokenBMint: PublicKey
  ): Promise<boolean> => {
    try {
      const program = getReadOnlyProgram(connection);
      if (!program) return false;

      const [poolPda] = findPoolAddress(tokenAMint, tokenBMint);
      const poolAccount = await program.account.liquidityPool.fetchNullable(poolPda);

      return poolAccount !== null;
    } catch {
      return false;
    }
  }, [connection]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createPool,
    checkPoolExists,
    loading,
    error,
    txSignature,
    clearError,
  };
}
