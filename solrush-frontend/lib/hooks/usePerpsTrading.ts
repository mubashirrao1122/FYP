'use client';

import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { getProgram } from '@/lib/anchor/setup';
import {
  findPerpsGlobalAddress,
  findPerpsUserAddress,
  findPerpsPositionAddress,
} from '@/lib/anchor/pda';

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

        // Convert size to PRICE_SCALE fixed-point (i64)
        const sizeI64 = new BN(Math.round(size * PRICE_SCALE));
        const leverageU16 = Math.min(Math.max(Math.round(leverage), 1), 200);

        // Enums as Anchor expects them (object with key)
        const sideArg = side === 'long' ? { long: {} } : { short: {} };
        const orderTypeArg = orderType === 'market' ? { market: {} } : { limit: {} };

        const tx = await program.methods
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

        setTxSignature(sig);
        setStatus('success');
        return sig;
      } catch (err: any) {
        console.error('open_perps_position failed:', err);
        const msg =
          err?.message || err?.toString() || 'Unknown error opening position';
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

        const amountBaseBN = new BN(Math.round(amountBase));

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
