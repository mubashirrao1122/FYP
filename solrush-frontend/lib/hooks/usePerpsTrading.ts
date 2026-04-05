'use client';

import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { getProgram } from '@/lib/anchor/setup';
import { findPerpsGlobalAddress, findPerpsUserAddress, findPerpsPositionAddress } from '@/lib/anchor/pda';
import { recordTrade, recordPosition, closePositionSync } from '@/lib/api';

/** On-chain PRICE_SCALE factor (1 USD = 1_000_000 in fixed-point) */
const PRICE_SCALE = 1_000_000;

export type TradingStatus = 'idle' | 'submitting' | 'success' | 'error';

interface UsePerpsTrading {
  status: TradingStatus;
  error: string | null;
  txSignature: string | null;
  openPosition: (params: {
    marketPubkey: string;
    side: 'long' | 'short';
    /** Base-asset quantity (e.g. 0.5 SOL) — will be scaled to PRICE_SCALE */
    size: number;
    leverage: number;
    orderType: 'market' | 'limit';
  }) => Promise<string | null>;
  closePosition: (params: {
    marketPubkey: string;
    /** Amount of base asset to close (in PRICE_SCALE units). Pass full size for 100% close. */
    amountBase: number;
  }) => Promise<string | null>;
  reset: () => void;
}

/**
 * Read the oracle_price_account pubkey from a market account's raw data.
 *
 * Layout: discriminator(8) + base_mint(32) + quote_mint(32) + pyth_feed_id(32)
 *         + oracle_price_account(32)
 * → offset = 8 + 32 + 32 + 32 = 104
 */
function parseOracleFromMarket(data: Buffer): PublicKey {
  const offset = 8 + 32 + 32 + 32; // 104
  return new PublicKey(data.subarray(offset, offset + 32));
}

export function usePerpsTrading(): UsePerpsTrading {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;

  const [status, setStatus] = useState<TradingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxSignature(null);
  }, []);

  // ── Open Position ──────────────────────────────────────────────────
  const openPosition = useCallback(
    async ({
      marketPubkey,
      side,
      size,
      leverage,
      orderType,
    }: {
      marketPubkey: string;
      side: 'long' | 'short';
      size: number;
      leverage: number;
      orderType: 'market' | 'limit';
    }): Promise<string | null> => {
      if (!publicKey || !wallet) return null;
      setStatus('submitting');
      setError(null);
      setTxSignature(null);

      try {
        const program = getProgram(connection, wallet);
        if (!program) throw new Error('Failed to create Anchor program');

        const marketKey = new PublicKey(marketPubkey);
        const [globalPda] = findPerpsGlobalAddress();
        const [userPda] = findPerpsUserAddress(publicKey);
        const [positionPda] = findPerpsPositionAddress(publicKey, marketKey);

        // Read market account to get oracle_price_account
        const marketInfo = await connection.getAccountInfo(marketKey);
        if (!marketInfo) throw new Error('Market account not found');
        const oraclePriceAccount = parseOracleFromMarket(marketInfo.data as Buffer);

        const tx = new Transaction();

        // Auto-initialize perps user account if it doesn't exist
        const userInfo = await connection.getAccountInfo(userPda);
        if (!userInfo || userInfo.data.length === 0) {
          console.log('Perps user account not found — adding initializePerpsUser ix');
          const initIx = await program.methods
            .initializePerpsUser()
            .accounts({
              owner: publicKey,
              user: userPda,
              systemProgram: SystemProgram.programId,
            } as any)
            .instruction();
          tx.add(initIx);
        }

        // Convert size to PRICE_SCALE fixed-point (i64)
        const sizeI64 = new BN(Math.round(size * PRICE_SCALE));
        const leverageU16 = Math.min(Math.max(Math.round(leverage), 1), 200);

        // Enums as Anchor expects them (object with key)
        const sideArg = side === 'long' ? { long: {} } : { short: {} };
        const orderTypeArg = orderType === 'market' ? { market: {} } : { limit: {} };

        const openIx = await program.methods
          .openPerpsPosition(sideArg, sizeI64, leverageU16, orderTypeArg)
          .accounts({
            owner: publicKey,
            global: globalPda,
            user: userPda,
            market: marketKey,
            oraclePriceAccount: oraclePriceAccount,
            position: positionPda,
            systemProgram: SystemProgram.programId,
          } as any)
          .instruction();
        tx.add(openIx);

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        // Simulate first to get detailed error logs
        const simResult = await connection.simulateTransaction(tx);
        if (simResult.value.err) {
          console.error('Simulation failed:', simResult.value.err);
          console.error('Simulation logs:', simResult.value.logs);
          const errMsg = simResult.value.logs?.find(
            (l: string) => l.includes('Error Number:') || l.includes('Error Message:') || l.includes('custom program error')
          );
          throw new Error(errMsg || `Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
        }

        const sig = await sendTransaction(tx, connection, {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed',
        );

        // ── Sync with PostgreSQL ──────────────────────────────────
        try {
          const marketSymbol = marketKey.toBase58().startsWith('So111') ? 'SOL/USD' : 'BTC/USD'; // Simplified for FYP
          const markPrice = Math.round(size * PRICE_SCALE) / PRICE_SCALE; // Fallback to entry size logic if needed
          
          await recordPosition({
            wallet_address: publicKey.toBase58(),
            market: marketSymbol,
            side: side.toUpperCase(),
            size_usd: size * leverage, // Notional size
            collateral_usd: size,      // Initial margin
            entry_price: markPrice,
            leverage: leverage,
            tx_hash: sig,
          });

          await recordTrade({
            wallet_address: publicKey.toBase58(),
            type: 'PERP_OPEN',
            token_in: 'USDC',
            token_out: marketSymbol,
            amount_in: size,
            amount_out: size * leverage,
            price_usd: markPrice,
            value_usd: size * leverage,
            tx_hash: sig,
            description: `Opened ${side} ${leverage}x on ${marketSymbol}`,
          });
        } catch (syncErr) {
          console.error('Failed to sync open position to DB:', syncErr);
        }

        setTxSignature(sig);
        setStatus('success');
        return sig;
      } catch (err: any) {
        console.error('open_perps_position failed:', err);
        // Try to extract the program error from logs
        const logs = err?.logs || err?.cause?.logs || [];
        if (logs.length) console.error('Transaction logs:', logs);
        const programError = logs.find((l: string) => l.includes('Error Number:') || l.includes('Error Message:'));
        const msg =
          programError || err?.message || err?.toString() || 'Unknown error opening position';
        setError(msg);
        setStatus('error');
        return null;
      }
    },
    [connection, publicKey, wallet, sendTransaction],
  );

  // ── Close Position ─────────────────────────────────────────────────
  const closePosition = useCallback(
    async ({ marketPubkey, amountBase }: { marketPubkey: string; amountBase: number }): Promise<string | null> => {
      if (!publicKey || !wallet) return null;
      setStatus('submitting');
      setError(null);
      setTxSignature(null);

      try {
        const program = getProgram(connection, wallet);
        if (!program) throw new Error('Failed to create Anchor program');

        const marketKey = new PublicKey(marketPubkey);
        const [globalPda] = findPerpsGlobalAddress();
        const [userPda] = findPerpsUserAddress(publicKey);
        const [positionPda] = findPerpsPositionAddress(publicKey, marketKey);

        // Read market account to get oracle
        const marketInfo = await connection.getAccountInfo(marketKey);
        if (!marketInfo) throw new Error('Market account not found');
        const oraclePriceAccount = parseOracleFromMarket(marketInfo.data as Buffer);

        const amountBaseBN = new BN(Math.round(amountBase * PRICE_SCALE));

        const tx = await program.methods
          .closePerpsPosition(amountBaseBN)
          .accounts({
            owner: publicKey,
            global: globalPda,
            user: userPda,
            market: marketKey,
            oraclePriceAccount: oraclePriceAccount,
            position: positionPda,
          } as any)
          .transaction();

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const sig = await sendTransaction(tx, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed',
        );

        // ── Sync with PostgreSQL ──────────────────────────────────
        try {
          const marketSymbol = marketKey.toBase58().startsWith('So111') ? 'SOL/USD' : 'BTC/USD';
          
          // We use "latest" and pass wallet/market as the backend handles the lookup
          await closePositionSync("latest", 0, sig, publicKey.toBase58(), marketSymbol);

          await recordTrade({
            wallet_address: publicKey.toBase58(),
            type: 'PERP_CLOSE',
            token_in: marketSymbol,
            token_out: 'USDC',
            value_usd: amountBase, // Close size
            tx_hash: sig,
            description: `Closed position on ${marketSymbol}`,
          });
        } catch (syncErr) {
          console.error('Failed to sync close position to DB:', syncErr);
        }

        setTxSignature(sig);
        setStatus('success');
        return sig;
      } catch (err: any) {
        console.error('close_perps_position failed:', err);
        const msg =
          err?.message || err?.toString() || 'Unknown error closing position';
        setError(msg);
        setStatus('error');
        return null;
      }
    },
    [connection, publicKey, wallet, sendTransaction],
  );

  return {
    status,
    error,
    txSignature,
    openPosition,
    closePosition,
    reset,
  };
}
