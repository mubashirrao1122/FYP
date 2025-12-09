'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import {
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAccount,
} from '@solana/spl-token';
import { getProgram, getReadOnlyProgram, fromBN } from '../../anchor/setup';
import { findRushConfigAddress, findPositionAddress, findPoolAddress } from '../../anchor/pda';
import { getTokenMint, TOKENS, getTokenSymbol } from '../../constants';
import { getOrCreateATA } from '../../utils/tokenAccounts';

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
export const useRewardsService = () => {
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
            const program = getReadOnlyProgram(connection);
            if (!program) {
                throw new Error('Program not available');
            }

            // Fetch RUSH balance
            const rushBalance = await fetchRushBalance();

            // Dynamically fetch all user's liquidity positions using memcmp filter
            const positions = await (program.account as any).userLiquidityPosition.all([
                {
                    memcmp: {
                        offset: 8, // After 8-byte discriminator, 'owner' is first field
                        bytes: wallet.publicKey.toBase58(),
                    }
                }
            ]);

            let totalClaimable = 0;
            const poolRewardsData: PoolReward[] = [];

            // Process each position
            for (const positionAccount of positions) {
                try {
                    const position = positionAccount.account;
                    const poolAddress = position.pool as PublicKey;

                    // Fetch pool data to get token symbols
                    const poolAccount = await (program.account as any).liquidityPool.fetch(poolAddress);

                    const tokenAMintStr = (poolAccount.tokenAMint as PublicKey).toBase58();
                    const tokenBMintStr = (poolAccount.tokenBMint as PublicKey).toBase58();
                    const tokenA = getTokenSymbol(tokenAMintStr) || 'UNKNOWN';
                    const tokenB = getTokenSymbol(tokenBMintStr) || 'UNKNOWN';

                    // Calculate pending rewards for this pool
                    const pending = await calculatePendingRewards(poolAddress);

                    // Get LP token balance from position
                    const lpTokens = fromBN(position.lpTokens as BN, 6);

                    // Get total earned from position
                    const totalEarned = fromBN(position.totalRushClaimed as BN, 6);

                    // Only add to list if user has LP tokens or pending rewards
                    if (pending > 0 || lpTokens > 0) {
                        totalClaimable += pending;
                        poolRewardsData.push({
                            poolAddress: poolAddress.toBase58(),
                            tokenA,
                            tokenB,
                            pendingRewards: pending,
                            earnedRewards: totalEarned,
                            lpBalance: lpTokens,
                        });
                    }
                } catch (err) {
                    console.error('Failed to process position:', err);
                    // Continue with other positions
                }
            }

            setPoolRewards(poolRewardsData);
            setRewards({
                claimable: totalClaimable,
                totalEarned: rushBalance + totalClaimable,
                claimed: rushBalance,
                rushBalance,
            });
        } catch (err: any) {
            console.error("Failed to fetch rewards:", err);
            setError(err.message || 'Failed to fetch rewards');
        } finally {
            setLoading(false);
        }
    }, [connection, wallet.publicKey, fetchRushBalance, calculatePendingRewards]);

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

            // 1. Check RushConfig exists
            const [rushConfigPda] = findRushConfigAddress();
            const rushConfig = await fetchRushConfig();
            if (!rushConfig) {
                throw new Error('RUSH rewards not initialized');
            }
            const rushMint = rushConfig.rushMint as PublicKey;

            // 2. Check user has position
            const [positionPda] = findPositionAddress(poolAddress, wallet.publicKey);
            const positionAccount = await (program.account as any).userLiquidityPosition.fetchNullable(positionPda);
            if (!positionAccount) {
                throw new Error('No liquidity position found');
            }

            // 3. Calculate and check rewards
            const pendingRewards = await calculatePendingRewards(poolAddress);
            if (pendingRewards === 0) {
                throw new Error('No rewards to claim');
            }

            // 4. Get or create user's RUSH token account
            const rushATAResult = await getOrCreateATA(
                connection,
                wallet.publicKey,
                rushMint
            );

            let tx: string;

            if (rushATAResult.instruction) {
                // Account doesn't exist, create it in the same transaction
                const createAtaIx = rushATAResult.instruction;

                const claimIx = await program.methods
                    .claimRushRewards()
                    .accounts({
                        user: wallet.publicKey,
                        pool: poolAddress,
                        position: positionPda,
                        rushConfig: rushConfigPda,
                        rushMint,
                        userRushAccount: rushATAResult.address,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();

                const transaction = new Transaction()
                    .add(createAtaIx)
                    .add(claimIx);

                tx = await (program.provider as any).sendAndConfirm(transaction);
            } else {
                // Account exists, call instruction directly
                tx = await program.methods
                    .claimRushRewards()
                    .accounts({
                        user: wallet.publicKey,
                        pool: poolAddress,
                        position: positionPda,
                        rushConfig: rushConfigPda,
                        rushMint,
                        userRushAccount: rushATAResult.address,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .rpc();
            }

            setTxSignature(tx);
            await fetchRewardsData();

            return tx;
        } catch (err: any) {
            console.error("Claim rewards error:", err);

            let errorMsg = 'Failed to claim rewards';
            if (err.message?.includes('RUSH rewards not initialized')) {
                errorMsg = 'RUSH rewards not initialized';
            } else if (err.message?.includes('No liquidity position')) {
                errorMsg = 'No liquidity position found';
            } else if (err.message?.includes('No rewards to claim')) {
                errorMsg = 'No rewards to claim';
            } else if (err.message) {
                errorMsg = err.message;
            }

            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [connection, wallet, fetchRewardsData, fetchRushConfig, calculatePendingRewards]);

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
