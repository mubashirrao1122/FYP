'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getProgram, getReadOnlyProgram, toBN, fromBN } from '../anchor/setup';
import { findPoolAddress } from '../anchor/pda';
import { getTokenMint, TOKEN_DECIMALS } from '../constants';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface SwapQuote {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fee: number;
  minReceived: number;
  exchangeRate: number;
}

export interface PoolReserves {
  reserveA: number;
  reserveB: number;
  feeNumerator: number;
  feeDenominator: number;
}

/**
 * Custom hook for token swap logic and execution
 * Handles AMM calculations, quote generation, and transaction execution
 */
export function useSwap() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  /**
   * Fetch real pool data from blockchain
   */
  const fetchPoolData = useCallback(async (
    inputToken: string,
    outputToken: string
  ): Promise<PoolReserves | null> => {
    try {
      const program = getReadOnlyProgram(connection);
      if (!program) {
        console.warn("Program not available");
        return null;
      }

      const inputMint = getTokenMint(inputToken);
      const outputMint = getTokenMint(outputToken);

      const [poolAddress] = findPoolAddress(inputMint, outputMint);

      const poolAccount = await (program.account as any).liquidityPool.fetch(poolAddress);
      
      // Get the pool's stored mint order
      const poolTokenAMint = poolAccount.tokenAMint as PublicKey;

      // Determine direction based on pool's stored mint order
      const isAToB = inputMint.equals(poolTokenAMint);

      return {
        reserveA: (poolAccount.reserveA as BN).toNumber(),
        reserveB: (poolAccount.reserveB as BN).toNumber(),
        feeNumerator: poolAccount.feeNumerator as number,
        feeDenominator: poolAccount.feeDenominator as number,
      };
    } catch (err) {
      console.error("Failed to fetch pool data:", err);
      return null;
    }
  }, [connection]);

  /**
   * Calculate swap quote using AMM formula (with real pool data)
   * Uses constant product formula: x * y = k
   */
  const calculateQuote = useCallback(async (
    inputAmount: number,
    inputToken: string,
    outputToken: string,
    slippage: number
  ): Promise<SwapQuote> => {
    // Try to fetch real pool data first
    const poolData = await fetchPoolData(inputToken, outputToken);

    let reserveIn: number;
    let reserveOut: number;
    let feeNumerator: number;
    let feeDenominator: number;

    if (poolData) {
      // Use real pool data - determine direction properly
      const program = getReadOnlyProgram(connection);
      const inputMint = getTokenMint(inputToken);
      const outputMint = getTokenMint(outputToken);
      const [poolAddress] = findPoolAddress(inputMint, outputMint);
      
      try {
        const poolAccount = await (program!.account as any).liquidityPool.fetch(poolAddress);
        const poolTokenAMint = poolAccount.tokenAMint as PublicKey;
        const isAToB = inputMint.equals(poolTokenAMint);
        
        reserveIn = isAToB ? poolData.reserveA : poolData.reserveB;
        reserveOut = isAToB ? poolData.reserveB : poolData.reserveA;
      } catch {
        // Fallback if fetch fails
        reserveIn = poolData.reserveA;
        reserveOut = poolData.reserveB;
      }
      
      feeNumerator = poolData.feeNumerator;
      feeDenominator = poolData.feeDenominator;
    } else {
      // Fallback to mock data if pool doesn't exist yet
      console.warn("Using mock pool data - pool not found on chain");
      const mockPoolData: { [key: string]: { reserveIn: number; reserveOut: number } } = {
        'SOL-USDC': { reserveIn: 1000, reserveOut: 100000 },
        'USDC-SOL': { reserveIn: 100000, reserveOut: 1000 },
        'SOL-USDT': { reserveIn: 1000, reserveOut: 100000 },
        'USDT-SOL': { reserveIn: 100000, reserveOut: 1000 },
        'SOL-RUSH': { reserveIn: 1000, reserveOut: 50000 },
        'RUSH-SOL': { reserveIn: 50000, reserveOut: 1000 },
      };

      const pairKey = `${inputToken}-${outputToken}`;
      const pool = mockPoolData[pairKey] || { reserveIn: 1000, reserveOut: 100000 };
      reserveIn = pool.reserveIn;
      reserveOut = pool.reserveOut;
      feeNumerator = 25; // 0.25%
      feeDenominator = 10000;
    }

    // Get decimals for proper conversion
    const inputDecimals = TOKEN_DECIMALS[inputToken] || 9;
    const outputDecimals = TOKEN_DECIMALS[outputToken] || 9;
    
    // Convert reserves from raw to human-readable for calculation
    const reserveInNormalized = reserveIn / Math.pow(10, inputDecimals);
    const reserveOutNormalized = reserveOut / Math.pow(10, outputDecimals);

    const FEE = feeNumerator / feeDenominator;
    const amountInWithFee = inputAmount * (1 - FEE);

    // AMM formula: outputAmount = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
    // Using normalized (human-readable) values
    const numerator = amountInWithFee * reserveOutNormalized;
    const denominator = reserveInNormalized + amountInWithFee;
    const outputAmount = numerator / denominator;

    // Calculate price impact using normalized reserves
    const initialPrice = reserveOutNormalized / reserveInNormalized;
    const executionPrice = outputAmount / inputAmount;
    const priceImpact = ((initialPrice - executionPrice) / initialPrice) * 100;

    const fee = inputAmount * FEE;
    const minReceived = outputAmount * (1 - slippage / 100);
    const exchangeRate = outputAmount / inputAmount;

    return {
      inputAmount,
      outputAmount,
      priceImpact: Math.max(0, priceImpact),
      fee,
      minReceived,
      exchangeRate,
    };
  }, [fetchPoolData]);

  /**
   * Execute swap transaction on blockchain
   */
  const executeSwap = useCallback(async (params: {
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    minOutputAmount: number;
  }): Promise<string> => {
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

      const inputMint = getTokenMint(params.inputToken);
      const outputMint = getTokenMint(params.outputToken);

      const [poolAddress] = findPoolAddress(inputMint, outputMint);

      // Fetch pool to get vault addresses and actual mint order
      const poolAccount = await (program.account as any).liquidityPool.fetch(poolAddress);

      const tokenAVault = poolAccount.tokenAVault as PublicKey;
      const tokenBVault = poolAccount.tokenBVault as PublicKey;
      const poolTokenAMint = poolAccount.tokenAMint as PublicKey;
      const poolTokenBMint = poolAccount.tokenBMint as PublicKey;

      // Determine direction based on pool's stored mint order
      // isAToB = true when input is pool's token A, false when input is pool's token B
      const isAToB = inputMint.equals(poolTokenAMint);

      // User token accounts for their selected input/output
      const userTokenIn = await getAssociatedTokenAddress(inputMint, wallet.publicKey);
      const userTokenOut = await getAssociatedTokenAddress(outputMint, wallet.publicKey);

      // Get decimals for proper conversion
      const inputDecimals = TOKEN_DECIMALS[params.inputToken] || 9;
      const outputDecimals = TOKEN_DECIMALS[params.outputToken] || 9;

      const amountInBN = toBN(params.inputAmount, inputDecimals);
      const minOutBN = toBN(params.minOutputAmount, outputDecimals);

      // Create deadline (5 minutes from now)
      const deadline = new BN(Math.floor(Date.now() / 1000) + 300);

      console.log('Swap with:', {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        poolTokenAMint: poolTokenAMint.toBase58(),
        poolTokenBMint: poolTokenBMint.toBase58(),
        isAToB,
        amountIn: amountInBN.toString(),
        minOut: minOutBN.toString(),
      });

      // Use camelCase account names (Anchor SDK converts snake_case IDL to camelCase)
      const tx = await program.methods
        .swap(
          amountInBN,
          minOutBN,
          isAToB,
          deadline
        )
        .accounts({
          pool: poolAddress,
          userTokenIn: userTokenIn,
          userTokenOut: userTokenOut,
          poolVaultIn: isAToB ? tokenAVault : tokenBVault,
          poolVaultOut: isAToB ? tokenBVault : tokenAVault,
          user: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxSignature(tx);
      console.log("Swap successful! TX:", tx);
      return tx;
    } catch (err: any) {
      console.error("Swap error:", err);
      const errorMsg = err.message || 'Swap transaction failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  /**
   * Check user's token balance
   */
  const checkBalance = useCallback(async (
    token: string
  ): Promise<number> => {
    if (!wallet.publicKey) return 0;

    try {
      const mint = getTokenMint(token);
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
      const balance = await connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.uiAmountString || '0');
    } catch (err) {
      console.error("Failed to fetch balance:", err);
      return 0;
    }
  }, [connection, wallet.publicKey]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    calculateQuote,
    executeSwap,
    fetchPoolData,
    checkBalance,
    clearError,
    loading,
    error,
    txSignature,
  };
}
