'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_INFO, SUPPORTED_TOKENS, PROGRAM_ID, FEE_NUMERATOR, FEE_DENOMINATOR, MINTS } from '@/lib/solana/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PoolState {
  reserveA: bigint;
  reserveB: bigint;
  tokenAMint: string;
  tokenBMint: string;
  tokenAVault: string;
  tokenBVault: string;
  bump: number;
}

interface SwapInterfaceProps {
  onTokenChange?: (inputToken: string, outputToken: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// AMM Math — mirrors utils.rs calculate_output_amount exactly
// All intermediate values use BigInt to match u128 on-chain precision.
// ─────────────────────────────────────────────────────────────────────────────

function calculateOutputAmount(
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
  feeNumerator: bigint = BigInt(FEE_NUMERATOR),
  feeDenominator: bigint = BigInt(FEE_DENOMINATOR),
): bigint {
  if (inputAmount === 0n || inputReserve === 0n || outputReserve === 0n) return 0n;

  // input * (feeDenominator - feeNumerator)  — mirrors u128 in Rust
  const amountInWithFee = inputAmount * (feeDenominator - feeNumerator);

  // numerator = amountInWithFee * outputReserve
  const numerator = amountInWithFee * outputReserve;

  // denominator = inputReserve * feeDenominator + amountInWithFee
  const denominator = inputReserve * feeDenominator + amountInWithFee;

  return denominator === 0n ? 0n : numerator / denominator;
}

function toDecimals(amount: number, symbol: string): bigint {
  const decimals = TOKEN_INFO[symbol]?.decimals ?? 9;
  return BigInt(Math.floor(amount * 10 ** decimals));
}

function fromDecimals(raw: bigint, symbol: string): number {
  const decimals = TOKEN_INFO[symbol]?.decimals ?? 9;
  return Number(raw) / 10 ** decimals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool PDA derivation — mirrors Anchor seeds in swap.rs
// ─────────────────────────────────────────────────────────────────────────────

function derivePoolPda(mintA: PublicKey, mintB: PublicKey, programId: PublicKey): PublicKey | null {
  if (!programId || programId.toString() === '') return null;
  try {
    // Canonical order: lexicographic sort (same as init-pool.ts)
    const [m1, m2] =
      mintA.toBase58() < mintB.toBase58() ? [mintA, mintB] : [mintB, mintA];

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), m1.toBuffer(), m2.toBuffer()],
      programId,
    );
    return pda;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SwapInterface({ onTokenChange }: SwapInterfaceProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [inputToken, setInputToken] = useState('SOL');
  const [outputToken, setOutputToken] = useState('USDC');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [pool, setPool] = useState<PoolState | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  // ── Resolve mint PublicKeys ────────────────────────────────────────────────

  const getMintPubkey = useCallback(
    (symbol: string): PublicKey | null => {
      if (symbol === 'SOL') return null; // native SOL doesn't have a mint in this context
      const addr = MINTS[symbol];
      if (!addr) return null;
      try { return new PublicKey(addr); } catch { return null; }
    },
    [],
  );

  // ── Fetch on-chain pool reserves ──────────────────────────────────────────

  const fetchPool = useCallback(async () => {
    if (!PROGRAM_ID) return;
    const programId = (() => { try { return new PublicKey(PROGRAM_ID); } catch { return null; } })();
    if (!programId) return;

    const mintA = getMintPubkey(inputToken);
    const mintB = getMintPubkey(outputToken);
    if (!mintA || !mintB) {
      setPool(null);
      setPoolError('Native SOL swaps require WSOL wrapping (coming soon)');
      return;
    }

    setPoolLoading(true);
    setPoolError(null);

    try {
      const poolPda = derivePoolPda(mintA, mintB, programId);
      if (!poolPda) throw new Error('Could not derive pool address');

      const accountInfo = await connection.getAccountInfo(poolPda);
      if (!accountInfo) {
        setPool(null);
        setPoolError(`No pool found for ${inputToken}/${outputToken}. Run init-pool.ts first.`);
        return;
      }

      // Pool account layout (matches state/pool.rs LiquidityPool struct):
      // Anchor discriminator: 8 bytes
      // token_a_mint: 32 | token_b_mint: 32 | lp_token_mint: 32
      // token_a_vault: 32 | token_b_vault: 32
      // reserve_a: 8 (u64 le) | reserve_b: 8 (u64 le)
      // total_lp_supply: 8 | fee_numerator: 8 | fee_denominator: 8 | bump: 1
      const data = accountInfo.data;
      const off = 8; // skip discriminator
      const tokenAMint   = new PublicKey(data.slice(off,       off + 32)).toBase58();
      const tokenBMint   = new PublicKey(data.slice(off + 32,  off + 64)).toBase58();
      //skip lp_token_mint (32 bytes)
      const tokenAVault  = new PublicKey(data.slice(off + 96,  off + 128)).toBase58();
      const tokenBVault  = new PublicKey(data.slice(off + 128, off + 160)).toBase58();
      const reserveA     = data.readBigUInt64LE(off + 160);
      const reserveB     = data.readBigUInt64LE(off + 168);
      const bump         = data[off + 192] ?? 0;

      setPool({ reserveA, reserveB, tokenAMint, tokenBMint, tokenAVault, tokenBVault, bump });
    } catch (e: any) {
      setPoolError(e.message ?? 'Failed to fetch pool');
      setPool(null);
    } finally {
      setPoolLoading(false);
    }
  }, [connection, inputToken, outputToken, getMintPubkey]);

  // Fetch pool whenever tokens change
  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // Notify parent of token changes
  useEffect(() => {
    onTokenChange?.(inputToken, outputToken);
  }, [inputToken, outputToken, onTokenChange]);

  // ── Recalculate output whenever input or pool changes ─────────────────────

  useEffect(() => {
    if (!pool || !inputAmount || isNaN(Number(inputAmount))) {
      setOutputAmount('');
      return;
    }

    const amount = Number(inputAmount);
    if (amount <= 0) { setOutputAmount(''); return; }

    // Determine which direction we're swapping relative to pool's canonical order
    const inputMint  = getMintPubkey(inputToken)?.toBase58()  ?? '';
    const outputMint = getMintPubkey(outputToken)?.toBase58() ?? '';

    const isAtoB = inputMint === pool.tokenAMint;
    const inputReserve  = isAtoB ? pool.reserveA : pool.reserveB;
    const outputReserve = isAtoB ? pool.reserveB : pool.reserveA;

    const rawIn  = toDecimals(amount, inputToken);
    const rawOut = calculateOutputAmount(rawIn, inputReserve, outputReserve);
    const humanOut = fromDecimals(rawOut, outputToken);

    setOutputAmount(humanOut > 0 ? humanOut.toFixed(6) : '0');
  }, [pool, inputAmount, inputToken, outputToken, getMintPubkey]);

  // ── UI Handlers ───────────────────────────────────────────────────────────

  const handleFlip = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount(outputAmount);
    setOutputAmount('');
  };

  const spotPrice = (() => {
    if (!pool) return null;
    const inputMint = getMintPubkey(inputToken)?.toBase58() ?? '';
    const isAtoB = inputMint === pool.tokenAMint;
    const inRes  = isAtoB ? pool.reserveA : pool.reserveB;
    const outRes = isAtoB ? pool.reserveB : pool.reserveA;
    if (inRes === 0n) return null;
    const sampleIn  = toDecimals(1, inputToken);
    const sampleOut = calculateOutputAmount(sampleIn, inRes, outRes);
    return fromDecimals(sampleOut, outputToken);
  })();

  // Minimum received after slippage
  const minReceived = (() => {
    const out = Number(outputAmount);
    if (!out) return null;
    return (out * (1 - slippage / 100)).toFixed(6);
  })();

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4 max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Swap</h2>
        <button
          className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors px-2 py-1 rounded border border-white/10"
          onClick={() => setSlippage(slippage === 0.5 ? 1.0 : 0.5)}
        >
          Slippage: {slippage}%
        </button>
      </div>

      {/* Pool status banner */}
      {poolLoading && (
        <div className="text-xs text-foreground/40 text-center py-1 animate-pulse">
          Fetching pool reserves…
        </div>
      )}
      {poolError && !poolLoading && (
        <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          ⚠️ {poolError}
        </div>
      )}
      {pool && !poolLoading && (
        <div className="text-xs text-green-400/70 bg-green-400/5 rounded-lg px-3 py-2 flex justify-between">
          <span>Pool live ✓</span>
          {spotPrice !== null && (
            <span>1 {inputToken} ≈ {spotPrice.toFixed(4)} {outputToken}</span>
          )}
        </div>
      )}

      {/* Input token */}
      <div className="bg-white/5 rounded-xl p-4 space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-foreground/50 uppercase tracking-wider">You Pay</label>
          {publicKey && (
            <span className="text-xs text-foreground/40">Balance: —</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="0.00"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            className="flex-1 bg-transparent text-2xl font-mono text-foreground outline-none placeholder-foreground/20"
            min="0"
          />
          <select
            value={inputToken}
            onChange={(e) => { setInputToken(e.target.value); setOutputAmount(''); }}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none cursor-pointer"
          >
            {SUPPORTED_TOKENS.filter((t) => t !== outputToken).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Flip button */}
      <div className="flex justify-center -my-1">
        <button
          onClick={handleFlip}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-foreground/60 hover:text-foreground transition-all duration-150 active:scale-95"
          title="Flip tokens"
        >
          ↕
        </button>
      </div>

      {/* Output token */}
      <div className="bg-white/5 rounded-xl p-4 space-y-2">
        <label className="text-xs text-foreground/50 uppercase tracking-wider">You Receive</label>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-2xl font-mono text-foreground/80">
            {outputAmount || '0.00'}
          </div>
          <select
            value={outputToken}
            onChange={(e) => { setOutputToken(e.target.value); setOutputAmount(''); }}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none cursor-pointer"
          >
            {SUPPORTED_TOKENS.filter((t) => t !== inputToken).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price details */}
      {minReceived && (
        <div className="space-y-1.5 px-1 text-xs text-foreground/50">
          <div className="flex justify-between">
            <span>Min. received ({slippage}% slippage)</span>
            <span className="text-foreground/70">{minReceived} {outputToken}</span>
          </div>
          <div className="flex justify-between">
            <span>Fee (0.3%)</span>
            <span className="text-foreground/70">
              {(Number(inputAmount) * 0.003).toFixed(4)} {inputToken}
            </span>
          </div>
        </div>
      )}

      {/* Swap button */}
      <button
        disabled={!publicKey || !outputAmount || swapping || !!poolError || !pool}
        className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-200
          bg-gradient-to-r from-violet-600 to-cyan-500
          hover:from-violet-500 hover:to-cyan-400
          disabled:opacity-40 disabled:cursor-not-allowed
          active:scale-[0.98]"
        onClick={() => {
          setTxError(null);
          setTxSig(null);
          alert('Swap signing via Anchor program — wire up program.methods.swap() here');
        }}
      >
        {!publicKey
          ? 'Connect Wallet'
          : swapping
          ? 'Swapping…'
          : !pool
          ? 'Pool Unavailable'
          : 'Swap'}
      </button>

      {/* Tx feedback */}
      {txSig && (
        <p className="text-xs text-green-400 text-center break-all">
          ✅ TX: {txSig.slice(0, 20)}…
        </p>
      )}
      {txError && (
        <p className="text-xs text-red-400 text-center">{txError}</p>
      )}
    </div>
  );
}
