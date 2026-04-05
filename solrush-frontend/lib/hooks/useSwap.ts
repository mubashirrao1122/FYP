'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { BN } from '@coral-xyz/anchor';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getProgram, getReadOnlyProgram, toBN, fromBN } from '../anchor/setup';
import { findPoolAddress } from '../anchor/pda';
import { getTokenMint, TOKEN_DECIMALS, TOKENS } from '../constants';
import { recordTrade } from '@/lib/api';
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID, 
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  getAccount,
} from '@solana/spl-token';

export interface SwapQuote {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fee: number;
  minReceived: number;
  exchangeRate: number;
  poolExists: boolean;
}

export interface PoolReserves {
  reserveA: bigint;
  reserveB: bigint;
  feeNumerator: number;
  feeDenominator: number;
}

/**
 * Check if token is native SOL (needs WSOL wrapping for SPL operations)
 */
const isNativeSOL = (tokenSymbol: string): boolean => {
  return tokenSymbol.toUpperCase() === 'SOL';
};

/**
 * Calculate swap output using BigInt for precision
 * Formula: AmountOut = (ReserveOut * AmountIn * (feeDenom - feeNum)) / (ReserveIn * feeDenom + AmountIn * (feeDenom - feeNum))
 */
const calculateOutputBigInt = (
  amountInRaw: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeNumerator: bigint,
  feeDenominator: bigint
): bigint => {
  if (amountInRaw <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    return 0n;
  }

  // Calculate amount after fee
  const amountInWithFee = amountInRaw * (feeDenominator - feeNumerator);
  
  // Numerator: amountInWithFee * reserveOut
  const numerator = amountInWithFee * reserveOut;
  
  // Denominator: reserveIn * feeDenominator + amountInWithFee
  const denominator = reserveIn * feeDenominator + amountInWithFee;
  
  return numerator / denominator;
};

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
  ): Promise<PoolReserves & { isAToB: boolean; tokenADecimals: number; tokenBDecimals: number } | null> => {
    try {
      const program = getReadOnlyProgram(connection);
      if (!program) {
        console.warn("Program not available");
        return null;
      }

      const inputMint = getTokenMint(inputToken);
      const outputMint = getTokenMint(outputToken);

      const [poolAddress] = findPoolAddress(inputMint, outputMint);

      const poolAccount = await (program.account as any).liquidityPool.fetchNullable(poolAddress);
      if (!poolAccount) {
        // Pool not found on chain
        console.warn(`Pool ${inputToken}-${outputToken} not found at ${poolAddress.toBase58()}`);
        return null;
      }

      // Get the pool's stored mint order
      const poolTokenAMint = poolAccount.tokenAMint as PublicKey;

      // Determine direction based on pool's stored mint order
      const isAToB = inputMint.equals(poolTokenAMint);

      // Use BigInt for reserves to avoid precision loss
      const reserveA = BigInt((poolAccount.reserveA as BN).toString());
      const reserveB = BigInt((poolAccount.reserveB as BN).toString());

      return {
        reserveA,
        reserveB,
        feeNumerator: poolAccount.feeNumerator as number,
        feeDenominator: poolAccount.feeDenominator as number,
        isAToB,
        tokenADecimals: poolAccount.tokenADecimals as number,
        tokenBDecimals: poolAccount.tokenBDecimals as number,
      };
    } catch (err) {
      console.error("Failed to fetch pool data:", err);
      return null;
    }
  }, [connection]);

  /**
   * Calculate swap quote using AMM formula with BigInt precision
   * Uses constant product formula: x * y = k
   * Formula: AmountOut = (ReserveOut * AmountIn) / (ReserveIn + AmountIn) after fee
   */
  const calculateQuote = useCallback(async (
    inputAmount: number,
    inputToken: string,
    outputToken: string,
    slippage: number
  ): Promise<SwapQuote> => {
    // Try to fetch real pool data first
    const poolData = await fetchPoolData(inputToken, outputToken);

    if (!poolData) {
      // Pool not found on chain
      console.warn(`Pool ${inputToken}-${outputToken} not found on chain. Initialize the pool first.`);
      return {
        inputAmount,
        outputAmount: 0,
        priceImpact: 0,
        fee: 0,
        minReceived: 0,
        exchangeRate: 0,
        poolExists: false,
      };
    }

    // Determine reserves based on swap direction
    const reserveIn = poolData.isAToB ? poolData.reserveA : poolData.reserveB;
    const reserveOut = poolData.isAToB ? poolData.reserveB : poolData.reserveA;

    // Get decimals - use pool's stored decimals for accuracy
    const inputDecimals = poolData.isAToB ? poolData.tokenADecimals : poolData.tokenBDecimals;
    const outputDecimals = poolData.isAToB ? poolData.tokenBDecimals : poolData.tokenADecimals;

    // Convert input amount to raw (BigInt)
    const inputAmountRaw = BigInt(Math.floor(inputAmount * Math.pow(10, inputDecimals)));

    // Calculate output using BigInt
    const outputAmountRaw = calculateOutputBigInt(
      inputAmountRaw,
      reserveIn,
      reserveOut,
      BigInt(poolData.feeNumerator),
      BigInt(poolData.feeDenominator)
    );

    // Convert back to human-readable numbers
    const outputAmount = Number(outputAmountRaw) / Math.pow(10, outputDecimals);

    // Calculate price impact
    // Initial price = reserveOut / reserveIn (in normalized terms)
    const reserveInNormalized = Number(reserveIn) / Math.pow(10, inputDecimals);
    const reserveOutNormalized = Number(reserveOut) / Math.pow(10, outputDecimals);
    const initialPrice = reserveOutNormalized / reserveInNormalized;
    const executionPrice = inputAmount > 0 ? outputAmount / inputAmount : 0;
    const priceImpact = initialPrice > 0 
      ? Math.max(0, ((initialPrice - executionPrice) / initialPrice) * 100)
      : 0;

    // Calculate fee
    const fee = inputAmount * (poolData.feeNumerator / poolData.feeDenominator);
    
    // Calculate minimum received with slippage
    const minReceived = outputAmount * (1 - slippage / 100);
    
    // Exchange rate
    const exchangeRate = inputAmount > 0 ? outputAmount / inputAmount : 0;

    return {
      inputAmount,
      outputAmount,
      priceImpact,
      fee,
      minReceived,
      exchangeRate,
      poolExists: true,
    };
  }, [fetchPoolData]);

  /**
   * Execute swap transaction on blockchain
   * Automatically handles WSOL wrapping/unwrapping for native SOL
   */
  const executeSwap = useCallback(async (params: {
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    minOutputAmount: number;
  }): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
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

      const inputIsNativeSOL = isNativeSOL(params.inputToken);
      const outputIsNativeSOL = isNativeSOL(params.outputToken);

      // For native SOL, use WSOL (wrapped SOL) mint
      const inputMint = inputIsNativeSOL ? TOKENS.SOL : getTokenMint(params.inputToken);
      const outputMint = outputIsNativeSOL ? TOKENS.SOL : getTokenMint(params.outputToken);

      const [poolAddress] = findPoolAddress(inputMint, outputMint);

      // Fetch pool to get vault addresses and actual mint order
      const poolAccount = await (program.account as any).liquidityPool.fetchNullable(poolAddress);
      if (!poolAccount) {
        throw new Error(`Liquidity pool for ${params.inputToken}-${params.outputToken} has not been initialized. Run the init-pool script first.`);
      }

      const tokenAVault = poolAccount.tokenAVault as PublicKey;
      const tokenBVault = poolAccount.tokenBVault as PublicKey;
      const poolTokenAMint = poolAccount.tokenAMint as PublicKey;

      // Determine direction based on pool's stored mint order
      const isAToB = inputMint.equals(poolTokenAMint);

      // Get decimals from pool account for accuracy
      const inputDecimals = isAToB ? poolAccount.tokenADecimals : poolAccount.tokenBDecimals;
      const outputDecimals = isAToB ? poolAccount.tokenBDecimals : poolAccount.tokenADecimals;

      const amountInBN = toBN(params.inputAmount, inputDecimals);
      const minOutBN = toBN(params.minOutputAmount, outputDecimals);

      // Create deadline (5 minutes from now)
      const deadline = new BN(Math.floor(Date.now() / 1000) + 300);

      // Build transaction
      const tx = new Transaction();

      // Handle WSOL wrapping if input is native SOL
      let userTokenIn: PublicKey;

      if (inputIsNativeSOL) {
        const wsolAta = await getAssociatedTokenAddress(TOKENS.SOL, wallet.publicKey);
        
        // Check if ATA exists
        let ataExists = false;
        try {
          await getAccount(connection, wsolAta);
          ataExists = true;
        } catch {
          ataExists = false;
        }

        if (!ataExists) {
          // Create the associated token account for WSOL
          tx.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              wsolAta,
              wallet.publicKey,
              TOKENS.SOL
            )
          );
        }

        // Transfer SOL to WSOL account
        const lamports = Math.ceil(params.inputAmount * LAMPORTS_PER_SOL);
        tx.add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: wsolAta,
            lamports,
          })
        );

        // Sync native (makes the SOL appear as WSOL tokens)
        tx.add(createSyncNativeInstruction(wsolAta));

        userTokenIn = wsolAta;
      } else {
        userTokenIn = await getAssociatedTokenAddress(inputMint, wallet.publicKey);
      }

      // Handle output token account
      let userTokenOut: PublicKey;
      if (outputIsNativeSOL) {
        userTokenOut = await getAssociatedTokenAddress(TOKENS.SOL, wallet.publicKey);
        
        // Ensure WSOL ATA exists for output
        try {
          await getAccount(connection, userTokenOut);
        } catch {
          tx.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              userTokenOut,
              wallet.publicKey,
              TOKENS.SOL
            )
          );
        }
      } else {
        userTokenOut = await getAssociatedTokenAddress(outputMint, wallet.publicKey);
      }

      console.log('Swap with:', {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        poolTokenAMint: poolTokenAMint.toBase58(),
        isAToB,
        amountIn: amountInBN.toString(),
        minOut: minOutBN.toString(),
        inputIsNativeSOL,
        outputIsNativeSOL,
      });

      // Build swap instruction
      const swapIx = await program.methods
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
        .instruction();

      tx.add(swapIx);

      // If output is native SOL, close the WSOL account to unwrap
      if (outputIsNativeSOL) {
        tx.add(
          createCloseAccountInstruction(
            userTokenOut,
            wallet.publicKey,
            wallet.publicKey
          )
        );
      }

      // Send transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction(tx);
      const txSig = await connection.sendRawTransaction(signedTx.serialize());
      
      await connection.confirmTransaction({
        signature: txSig,
        blockhash,
        lastValidBlockHeight,
      });

      // ── Sync with PostgreSQL ──────────────────────────────────
      try {
        await recordTrade({
          wallet_address: wallet.publicKey.toBase58(),
          type: 'SWAP',
          token_in: params.inputToken,
          token_out: params.outputToken,
          amount_in: params.inputAmount,
          amount_out: params.minOutputAmount,
          tx_hash: txSig,
          description: `Swapped ${params.inputAmount} ${params.inputToken} for ${params.outputToken}`,
        });
      } catch (syncErr) {
        console.error('Failed to sync swap to DB:', syncErr);
      }

      setTxSignature(txSig);
      console.log("Swap successful! TX:", txSig);
      return txSig;
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
