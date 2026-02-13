'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { getProgram, toBN } from '@/lib/anchor/setup';
import { findPerpsGlobalAddress, findPerpsUserAddress, findPerpsMarketAddress } from '@/lib/anchor/pda';
import { TOKENS, TOKEN_DECIMALS } from '@/lib/constants';
import { parseSolanaError, isAccountNotInitialized } from '@/lib/utils/solanaErrors';

export interface PerpsCollateralState {
  /** USDC balance in the user's wallet ATA (UI amount, e.g. 100.50) */
  walletBalance: number;
  /** Collateral already deposited on-chain (UI amount) */
  onChainCollateral: number;
  /** Whether the perps user account exists on-chain */
  userAccountExists: boolean;
  /** Whether the USDC ATA exists */
  ataExists: boolean;
  /** Loading state */
  loading: boolean;
  /** Human-readable error (null = no error) */
  error: string | null;
  /** Pending tx signature */
  txSignature: string | null;
  /** Deposit step for UI: idle | creating-ata | initializing-user | depositing | success */
  depositStep: DepositStep;
}

export type DepositStep =
  | 'idle'
  | 'creating-ata'
  | 'initializing-user'
  | 'depositing'
  | 'confirming'
  | 'success'
  | 'error';

export interface UsePerpsCollateralReturn extends PerpsCollateralState {
  /** Refresh wallet balance + on-chain collateral */
  refresh: () => Promise<void>;
  /**
   * Full deposit flow:
   * 1. Create USDC ATA if missing
   * 2. Initialize perps user account if missing
   * 3. Deposit `amount` USDC into the collateral vault
   *
   * @param amount UI amount of USDC (e.g. 50.0 = 50 USDC)
   * @param marketId On-chain pubkey of the perps_market to deposit against
   */
  deposit: (amount: number, marketId: string) => Promise<string | null>;
  /** True if user has enough collateral for a given margin requirement (UI amount) */
  hasEnoughCollateral: (requiredMarginUsd: number) => boolean;
}

const USDC_DECIMALS = TOKEN_DECIMALS.USDC ?? 6;

export function usePerpsCollateral(): UsePerpsCollateralReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, wallet } = useWallet();

  const [walletBalance, setWalletBalance] = useState(0);
  const [onChainCollateral, setOnChainCollateral] = useState(0);
  const [userAccountExists, setUserAccountExists] = useState(false);
  const [ataExists, setAtaExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [depositStep, setDepositStep] = useState<DepositStep>('idle');

  const usdcMint = useMemo(() => TOKENS.USDC, []);

  // ── Refresh balances ────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!publicKey) {
      setWalletBalance(0);
      setOnChainCollateral(0);
      setUserAccountExists(false);
      setAtaExists(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Check USDC ATA balance
      const ata = await getAssociatedTokenAddress(usdcMint, publicKey);
      try {
        const acct = await getAccount(connection, ata);
        setAtaExists(true);
        setWalletBalance(Number(acct.amount) / 10 ** USDC_DECIMALS);
      } catch {
        setAtaExists(false);
        setWalletBalance(0);
      }

      // 2. Check perps_user account on-chain
      const [userPda] = findPerpsUserAddress(publicKey);
      try {
        const info = await connection.getAccountInfo(userPda);
        if (info && info.data.length > 0) {
          setUserAccountExists(true);
          // Parse collateral_quote_u64: offset 8 (discriminator) + 32 (owner) = 40, u64 = 8 bytes LE
          const collateralRaw = info.data.readBigUInt64LE(40);
          setOnChainCollateral(Number(collateralRaw) / 10 ** USDC_DECIMALS);
        } else {
          setUserAccountExists(false);
          setOnChainCollateral(0);
        }
      } catch {
        setUserAccountExists(false);
        setOnChainCollateral(0);
      }
    } catch (err) {
      setError(parseSolanaError(err));
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, usdcMint]);

  // Auto-refresh on mount / wallet change
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Periodic refresh every 15 seconds
  useEffect(() => {
    if (!publicKey) return;
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [publicKey, refresh]);

  // ── Deposit flow ───────────────────────────────────────────────────
  const deposit = useCallback(
    async (amount: number, marketId: string): Promise<string | null> => {
      if (!publicKey || !sendTransaction || !wallet) {
        setError('Please connect your wallet first.');
        return null;
      }
      if (amount <= 0) {
        setError('Amount must be greater than zero.');
        return null;
      }

      setError(null);
      setTxSignature(null);

      const program = getProgram(connection, wallet.adapter);
      if (!program) {
        setError('Failed to load program. Please refresh the page.');
        return null;
      }

      try {
        const tx = new Transaction();
        const ata = await getAssociatedTokenAddress(usdcMint, publicKey);

        // Step 1: Create USDC ATA if it doesn't exist
        let needsATA = false;
        try {
          await getAccount(connection, ata);
        } catch {
          needsATA = true;
        }

        if (needsATA) {
          setDepositStep('creating-ata');
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer
              ata,       // associated token address
              publicKey, // owner
              usdcMint   // mint
            )
          );
        }

        // Step 2: Initialize perps user account if it doesn't exist
        const [userPda] = findPerpsUserAddress(publicKey);
        let needsInit = false;
        try {
          const info = await connection.getAccountInfo(userPda);
          needsInit = !info || info.data.length === 0;
        } catch {
          needsInit = true;
        }

        if (needsInit) {
          setDepositStep('initializing-user');
          const ix = await program.methods
            .initializePerpsUser()
            .accounts({
              owner: publicKey,
              user: userPda,
              systemProgram: SystemProgram.programId,
            } as any)
            .instruction();
          tx.add(ix);
        }

        // Step 3: Build deposit instruction
        setDepositStep('depositing');

        const marketPubkey = new PublicKey(marketId);
        const [globalPda] = findPerpsGlobalAddress();

        // Read market account to find collateral_vault
        const marketInfo = await connection.getAccountInfo(marketPubkey);
        if (!marketInfo) {
          throw new Error('Market account not found. Please select a valid market.');
        }

        // Parse collateral_vault: discriminator(8) + base_mint(32) + quote_mint(32) + pyth_feed_id(32)
        // + oracle_price_account(32) + max_leverage(2) + maintenance_margin_bps(2)
        // + funding_rate_i64(8) + open_interest_i128(16) + cumulative_funding_i128(16)
        // + last_funding_ts(8) + collateral_vault(32) = offset 220
        const collateralVaultOffset = 8 + 32 + 32 + 32 + 32 + 2 + 2 + 8 + 16 + 16 + 8;
        const vaultPubkeyBytes = marketInfo.data.subarray(
          collateralVaultOffset,
          collateralVaultOffset + 32
        );
        const collateralVault = new PublicKey(vaultPubkeyBytes);

        const depositAmount = toBN(amount, USDC_DECIMALS);

        const depositIx = await program.methods
          .depositPerpsCollateral(depositAmount)
          .accounts({
            owner: publicKey,
            global: globalPda,
            user: userPda,
            market: marketPubkey,
            userQuoteAta: ata,
            collateralVault: collateralVault,
            tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .instruction();
        tx.add(depositIx);

        // Send the combined transaction
        setDepositStep('confirming');
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const sig = await sendTransaction(tx, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        // Wait for confirmation
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        setTxSignature(sig);
        setDepositStep('success');

        // Refresh balances after confirmed deposit
        await refresh();

        return sig;
      } catch (err) {
        const msg = parseSolanaError(err);
        setError(msg);
        setDepositStep('error');
        return null;
      }
    },
    [connection, publicKey, sendTransaction, wallet, usdcMint, refresh]
  );

  // ── Collateral check ───────────────────────────────────────────────
  const hasEnoughCollateral = useCallback(
    (requiredMarginUsd: number) => {
      return onChainCollateral >= requiredMarginUsd;
    },
    [onChainCollateral]
  );

  return {
    walletBalance,
    onChainCollateral,
    userAccountExists,
    ataExists,
    loading,
    error,
    txSignature,
    depositStep,
    refresh,
    deposit,
    hasEnoughCollateral,
  };
}
