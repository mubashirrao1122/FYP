'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getProgram, getReadOnlyProgram, fromBN } from '../anchor/setup';
import { findRushConfigAddress, findPositionAddress, findPoolAddress } from '../anchor/pda';
import { getTokenMint, TOKENS } from '../constants';

export interface RewardsData {
  claimable: number;
  totalEarned: number;
  claimed: number;
  rushBalance: number;
  lastClaimTime?: number;
  nextClaimTime?: number;
}

export interface PoolReward {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  pendingRewards: number;
  earnedRewards: number;
  lpBalance: number;
}

/**
 * Custom hook for RUSH token rewards management
 */
export const useRewards = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  
  const [rewards, setRewards] = useState<RewardsData>({
    claimable: 0,
    totalEarned: 0,
    claimed: 0,
    rushBalance: 0,
  });
  
  const [poolRewards, setPoolRewards] = useState<PoolReward[]>([]);

  /**
   * Fetch RUSH token balance
   */
  const fetchRushBalance = useCallback(async (): Promise<number> => {
    if (!wallet.publicKey) return 0;
    
    try {
      const rushMint = TOKENS.RUSH;
      const rushAccount = await getAssociatedTokenAddress(rushMint, wallet.publicKey);
      const balance = await connection.getTokenAccountBalance(rushAccount);
      return parseFloat(balance.value.uiAmountString || '0');
    } catch (err) {
      console.error("Failed to fetch RUSH balance:", err);
      return 0;
    }
  }, [connection, wallet.publicKey]);

  /**
   * Fetch RUSH Config from blockchain
   */
  const fetchRushConfig = useCallback(async () => {
    try {
      const program = getReadOnlyProgram(connection);
      if (!program) {
        throw new Error('Failed to initialize program');
      }
      const [rushConfigPda] = findRushConfigAddress();
      
      const configAccount = await program.account.rushConfig.fetch(rushConfigPda);
      return configAccount;
    } catch (err) {
      console.error("Failed to fetch RUSH config:", err);
      return null;
    }
  }, [connection]);

  /**
   * Calculate pending rewards for a pool position
   */
  const calculatePendingRewards = useCallback(async (
    poolAddress: PublicKey
  ): Promise<number> => {
    if (!wallet.publicKey) return 0;
    
    try {
      const program = getReadOnlyProgram(connection);
      if (!program) {
        throw new Error('Failed to initialize program');
      }
      const [positionPda] = findPositionAddress(poolAddress, wallet.publicKey);
      
      const positionAccount = await program.account.userLiquidityPosition.fetch(positionPda);
      
      // Get pool data for reward calculation
      const poolAccount = await program.account.liquidityPool.fetch(poolAddress);
      
      // Calculate rewards based on LP tokens and time
      const lpTokens = (positionAccount.lpTokens as BN).toNumber();
      const lastRewardTime = (positionAccount.lastRewardTime as BN)?.toNumber() || 0;
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Simple reward calculation (in production, use actual reward rate from config)
      const timeElapsed = currentTime - lastRewardTime;
      const rewardRate = 0.0001; // RUSH per LP token per second (example)
      const pendingRewards = lpTokens * rewardRate * timeElapsed;
      
      return pendingRewards / Math.pow(10, 6); // RUSH has 6 decimals
    } catch (err) {
      console.error("Failed to calculate rewards:", err);
      return 0;
    }
  }, [connection, wallet.publicKey]);

  /**
   * Fetch all rewards data
   */
  const fetchRewardsData = useCallback(async () => {
    if (!wallet.publicKey) {
      setRewards({
        claimable: 0,
        totalEarned: 0,
        claimed: 0,
        rushBalance: 0,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch RUSH balance
      const rushBalance = await fetchRushBalance();
      
      // Fetch all pool positions and calculate rewards
      // In a real app, you'd have a list of pools the user has positions in
      // For now, we'll check common pools
      const commonPools = [
        { tokenA: 'SOL', tokenB: 'USDC' },
        { tokenA: 'SOL', tokenB: 'USDT' },
      ];
      
      let totalClaimable = 0;
      const poolRewardsData: PoolReward[] = [];
      
      for (const pool of commonPools) {
        try {
          const tokenAMint = getTokenMint(pool.tokenA);
          const tokenBMint = getTokenMint(pool.tokenB);
          const [poolAddress] = findPoolAddress(tokenAMint, tokenBMint);
          
          const pending = await calculatePendingRewards(poolAddress);
          if (pending > 0) {
            totalClaimable += pending;
            poolRewardsData.push({
              poolAddress: poolAddress.toBase58(),
              tokenA: pool.tokenA,
              tokenB: pool.tokenB,
              pendingRewards: pending,
              earnedRewards: 0, // Would need historical data
              lpBalance: 0, // Would fetch from position
            });
          }
        } catch (e) {
          // Pool or position doesn't exist, skip
        }
      }

      setPoolRewards(poolRewardsData);
      setRewards({
        claimable: totalClaimable,
        totalEarned: rushBalance + totalClaimable, // Simplified
        claimed: rushBalance,
        rushBalance,
      });
    } catch (err: any) {
      console.error("Failed to fetch rewards:", err);
      setError(err.message || 'Failed to fetch rewards');
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey, fetchRushBalance, calculatePendingRewards]);

  /**
   * Claim rewards from a specific pool
   */
  const claimRewards = useCallback(async (
    poolAddress: PublicKey
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
      
      // Get RUSH config and mint
      const [rushConfigPda] = findRushConfigAddress();
      const rushConfig = await program.account.rushConfig.fetch(rushConfigPda);
      const rushMint = rushConfig.rushMint as PublicKey;
      
      // Get user's position and RUSH token account
      const [positionPda] = findPositionAddress(poolAddress, wallet.publicKey);
      const userRushAccount = await getAssociatedTokenAddress(rushMint, wallet.publicKey);

      const tx = await program.methods
        .claimRewards()
        .accounts({
          user: wallet.publicKey,
          pool: poolAddress,
          position: positionPda,
          rushConfig: rushConfigPda,
          rushMint,
          userRushAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxSignature(tx);
      
      // Refresh rewards data
      await fetchRewardsData();
      
      return tx;
    } catch (err: any) {
      console.error("Claim rewards error:", err);
      const errorMsg = err.message || 'Failed to claim rewards';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, fetchRewardsData]);

  /**
   * Claim rewards from all pools
   */
  const claimAllRewards = useCallback(async (): Promise<string[]> => {
    if (!wallet.publicKey || poolRewards.length === 0) {
      throw new Error('No rewards to claim');
    }

    const txSignatures: string[] = [];
    
    for (const poolReward of poolRewards) {
      if (poolReward.pendingRewards > 0) {
        try {
          const tx = await claimRewards(new PublicKey(poolReward.poolAddress));
          txSignatures.push(tx);
        } catch (err) {
          console.error(`Failed to claim from pool ${poolReward.poolAddress}:`, err);
        }
      }
    }

    return txSignatures;
  }, [wallet.publicKey, poolRewards, claimRewards]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch rewards data on mount and when wallet changes
  useEffect(() => {
    fetchRewardsData();
  }, [fetchRewardsData]);

  // Refresh rewards periodically (every 60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRewardsData();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchRewardsData]);

  return {
    rewards,
    poolRewards,
    loading,
    error,
    txSignature,
    fetchRewardsData,
    claimRewards,
    claimAllRewards,
    clearError,
  };
};
