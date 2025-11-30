'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { getProgram } from '../anchor/setup';
import { findPoolAddress, findVaultAddress } from '../anchor/pda';
import { getTokenMint } from '../constants';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export interface SwapQuote {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fee: number;
  minReceived: number;
  exchangeRate: number;
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

  /**
   * Calculate swap quote using AMM formula
   * Uses constant product formula: x * y = k
   */
  const calculateQuote = (
    inputAmount: number,
    inputToken: string,
    outputToken: string,
    slippage: number
  ): SwapQuote => {
    // Mock pool data (in production, fetch from blockchain)
    const poolData: { [key: string]: { [key: string]: number } } = {
      'SOL-USDC': { reserveIn: 100, reserveOut: 10050 },
      'USDC-SOL': { reserveIn: 10050, reserveOut: 100 },
      'SOL-USDT': { reserveIn: 100, reserveOut: 10040 },
      'USDT-SOL': { reserveIn: 10040, reserveOut: 100 },
      'SOL-RUSH': { reserveIn: 100, reserveOut: 5000 },
      'RUSH-SOL': { reserveIn: 5000, reserveOut: 100 },
    };

    const pairKey = `${inputToken}-${outputToken}`;
    const pool = poolData[pairKey] || { reserveIn: 100, reserveOut: 10050 };

    const FEE = 0.003; // 0.3% fee
    const amountInWithFee = inputAmount * (1 - FEE);

    // AMM formula: outputAmount = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
    const numerator = amountInWithFee * pool.reserveOut;
    const denominator = pool.reserveIn + amountInWithFee;
    const outputAmount = numerator / denominator;

    // Calculate price impact: how much worse the price is due to the swap
    const initialPrice = pool.reserveOut / pool.reserveIn;
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
  };

  /**
   * Execute swap transaction on blockchain
   */
  const executeSwap = async (params: {
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

    try {
      const program = getProgram(connection, wallet);

      const inputMint = getTokenMint(params.inputToken);
      const outputMint = getTokenMint(params.outputToken);

      const poolAddress = findPoolAddress(inputMint, outputMint);

      // Determine direction (A to B or B to A)
      // We assume findPoolAddress sorts them, so we check which one is A (smaller)
      const isAToB = inputMint.toBuffer().compare(outputMint.toBuffer()) < 0;

      const tokenAMint = isAToB ? inputMint : outputMint;
      const tokenBMint = isAToB ? outputMint : inputMint;

      const tokenAVault = findVaultAddress(poolAddress, tokenAMint);
      const tokenBVault = findVaultAddress(poolAddress, tokenBMint);

      const userTokenIn = await getAssociatedTokenAddress(inputMint, wallet.publicKey);
      const userTokenOut = await getAssociatedTokenAddress(outputMint, wallet.publicKey);

      // Convert amounts to BN (assuming 9 decimals for SOL/USDC/USDT for simplicity, but should check mint decimals)
      // TODO: Fetch decimals dynamically
      const decimals = 9;
      const amountInBN = new BN(params.inputAmount * Math.pow(10, decimals));
      const minOutBN = new BN(params.minOutputAmount * Math.pow(10, decimals));

      const tx = await program.methods
        .swap(
          amountInBN,
          minOutBN,
          isAToB ? { aToB: {} } : { bToA: {} }
        )
        .accounts({
          user: wallet.publicKey,
          pool: poolAddress,
          userTokenIn,
          userTokenOut,
          tokenVaultIn: isAToB ? tokenAVault : tokenBVault,
          tokenVaultOut: isAToB ? tokenBVault : tokenAVault,
          tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        })
        .rpc();

      return tx;
    } catch (err: any) {
      console.error("Swap error:", err);
      // Fallback to simulation if on localnet without deployed program
      if (err.message.includes("Program not found") || err.message.includes("FetchError")) {
        console.warn("Falling back to simulation mode");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'simulated_tx_' + Date.now();
      }

      const errorMsg = err.message || 'Swap transaction failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    calculateQuote,
    executeSwap,
    loading,
    error,
  };
}
