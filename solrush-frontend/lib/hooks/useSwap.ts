'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { BN } from '@project-serum/anchor';
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
      
      const poolAccount = await program.account.liquidityPool.fetch(poolAddress);
      
      // Check which direction we're swapping
      const isAToB = inputMint.toBuffer().compare(outputMint.toBuffer()) < 0;
      
      return {
        reserveA: (poolAccount.tokenAReserve as BN).toNumber(),
        reserveB: (poolAccount.tokenBReserve as BN).toNumber(),
        feeNumerator: (poolAccount.feeBasisPoints as number) || 25,
        feeDenominator: 10000,
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
      // Use real pool data
      const inputMint = getTokenMint(inputToken);
      const outputMint = getTokenMint(outputToken);
      const isAToB = inputMint.toBuffer().compare(outputMint.toBuffer()) < 0;
      
      reserveIn = isAToB ? poolData.reserveA : poolData.reserveB;
      reserveOut = isAToB ? poolData.reserveB : poolData.reserveA;
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

    const FEE = feeNumerator / feeDenominator;
    const amountInWithFee = inputAmount * (1 - FEE);

    // AMM formula: outputAmount = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    const outputAmount = numerator / denominator;

    // Calculate price impact
    const initialPrice = reserveOut / reserveIn;
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

      // Determine direction (A to B or B to A)
      const isAToB = inputMint.toBuffer().compare(outputMint.toBuffer()) < 0;

      // Fetch pool to get vault addresses
      const poolAccount = await program.account.liquidityPool.fetch(poolAddress);
      
      const tokenAVault = poolAccount.tokenAVault as PublicKey;
      const tokenBVault = poolAccount.tokenBVault as PublicKey;

      const userTokenIn = await getAssociatedTokenAddress(inputMint, wallet.publicKey);
      const userTokenOut = await getAssociatedTokenAddress(outputMint, wallet.publicKey);

      // Get decimals for proper conversion
      const inputDecimals = TOKEN_DECIMALS[params.inputToken] || 9;
      const outputDecimals = TOKEN_DECIMALS[params.outputToken] || 9;

      const amountInBN = toBN(params.inputAmount, inputDecimals);
      const minOutBN = toBN(params.minOutputAmount, outputDecimals);

      // Create deadline (5 minutes from now)
      const deadline = new BN(Math.floor(Date.now() / 1000) + 300);

      const tx = await program.methods
        .swap(
          amountInBN,
          minOutBN,
          isAToB,
          deadline
        )
        .accounts({
          user: wallet.publicKey,
          pool: poolAddress,
          userTokenIn,
          userTokenOut,
          poolVaultIn: isAToB ? tokenAVault : tokenBVault,
          poolVaultOut: isAToB ? tokenBVault : tokenAVault,
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
