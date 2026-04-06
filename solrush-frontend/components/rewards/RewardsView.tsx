'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicKey } from '@solana/web3.js';
import {
    Zap, Wallet, Layers, ArrowRight, RefreshCw, Loader2,
    CheckCircle2, AlertCircle, Gift,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { useRewards } from '@/lib/hooks/useRewards';
import { formatTokenAmount } from '@/lib/utils/formatters';
import { RushIcon } from '@/components/icons/TokenIcons';
import Link from 'next/link';

export const RewardsView = () => {
    const { publicKey } = useWallet();
    const {
        rewards,
        poolRewards,
        loading,
        error,
        claimRewards,
        claimAllRewards,
        fetchRewardsData,
        clearError,
    } = useRewards();

    const [claimingPool, setClaimingPool] = useState<string | null>(null);
    const [claimingAll, setClaimingAll] = useState(false);
    const [claimResult, setClaimResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const hasPoolRewards = poolRewards.length > 0;
    const hasClaimable = rewards.claimable > 0;

    const handleClaimPool = async (poolAddress: string) => {
        setClaimingPool(poolAddress);
        setClaimResult(null);
        try {
            const tx = await claimRewards(new PublicKey(poolAddress));
            setClaimResult({ type: 'success', message: `Claimed! Tx: ${tx.slice(0, 8)}…` });
        } catch (err: any) {
            setClaimResult({ type: 'error', message: err.message || 'Claim failed' });
        } finally {
            setClaimingPool(null);
        }
    };

    const handleClaimAll = async () => {
        setClaimingAll(true);
        setClaimResult(null);
        try {
            const txs = await claimAllRewards();
            setClaimResult({ type: 'success', message: `Claimed from ${txs.length} pool${txs.length > 1 ? 's' : ''}!` });
        } catch (err: any) {
            setClaimResult({ type: 'error', message: err.message || 'Claim failed' });
        } finally {
            setClaimingAll(false);
        }
    };

    /** Show 4 decimals so small accruing rewards are visible */
    const fmtReward = (n: number) => formatTokenAmount(n, 4);

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-200 selection:bg-neon-cyan/20">
            <Navbar />

            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
                {/* Header — matches swap page style */}
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-4xl sm:text-5xl font-semibold text-foreground tracking-tight">
                        RUSH Rewards
                    </h1>
                    <p className="text-foreground/60 text-base sm:text-lg">
                        Earn RUSH tokens by providing liquidity to our pools.
                    </p>
                    {publicKey && (
                        <button
                            onClick={() => fetchRewardsData()}
                            disabled={loading}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-neon-cyan border border-neon-cyan/25 hover:border-neon-cyan/50 px-4 py-2 rounded-xl transition-all hover:bg-neon-cyan/5 disabled:opacity-50 mt-2"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Refresh
                        </button>
                    )}
                </div>

                {/* Not connected */}
                {!publicKey ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card rounded-2xl p-16 text-center max-w-lg mx-auto"
                    >
                        <div className="w-16 h-16 rounded-2xl solana-gradient flex items-center justify-center mx-auto mb-5">
                            <Wallet className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">Connect Your Wallet</h2>
                        <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
                            Connect your Solana wallet to view and claim your RUSH token rewards.
                        </p>
                    </motion.div>
                ) : loading && poolRewards.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto space-y-5">
                        {/* ── Overview Card ─────────────────────────── */}
                        <div className="glass-card rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <RushIcon className="w-8 h-8" />
                                <h2 className="text-lg font-bold text-foreground">RUSH Overview</h2>
                                {loading && <Loader2 className="w-4 h-4 text-neon-cyan animate-spin ml-auto" />}
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-xl bg-muted/30 border border-border/20 p-4">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Total Earned</p>
                                    <div className="flex items-center gap-2">
                                        <RushIcon className="w-5 h-5 shrink-0" />
                                        <span className="text-xl font-bold text-foreground font-data">
                                            {fmtReward(rewards.totalEarned)}
                                        </span>
                                    </div>
                                </div>
                                <div className="rounded-xl bg-muted/30 border border-border/20 p-4">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Claimable</p>
                                    <div className="flex items-center gap-2">
                                        <RushIcon className="w-5 h-5 shrink-0" />
                                        <span className={`text-xl font-bold font-data ${hasClaimable ? 'text-neon-green' : 'text-foreground'}`}>
                                            {fmtReward(rewards.claimable)}
                                        </span>
                                    </div>
                                </div>
                                <div className="rounded-xl bg-muted/30 border border-border/20 p-4">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Claimed</p>
                                    <div className="flex items-center gap-2">
                                        <RushIcon className="w-5 h-5 shrink-0" />
                                        <span className="text-xl font-bold text-muted-foreground font-data">
                                            {fmtReward(rewards.claimed)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Claim All button */}
                            {hasClaimable && (
                                <motion.button
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={handleClaimAll}
                                    disabled={claimingAll || !!claimingPool}
                                    className="w-full mt-5 flex items-center justify-center gap-2 h-11 rounded-xl bg-neon-blue hover:bg-[#2563EB] text-white font-bold text-[14px] transition-all disabled:opacity-50 animate-glow-pulse active:scale-[0.98]"
                                >
                                    {claimingAll ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Claiming…</>
                                    ) : (
                                        <><Gift className="w-4 h-4" /> Claim All — {fmtReward(rewards.claimable)} RUSH</>
                                    )}
                                </motion.button>
                            )}
                        </div>

                        {/* ── Claim Result Toast ────────────────────── */}
                        <AnimatePresence>
                            {claimResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, y: -8, height: 0 }}
                                    className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
                                        claimResult.type === 'success'
                                            ? 'border-neon-green/20 bg-neon-green/[0.04] text-neon-green'
                                            : 'border-destructive/20 bg-destructive/[0.04] text-destructive'
                                    }`}
                                >
                                    {claimResult.type === 'success'
                                        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        : <AlertCircle className="w-4 h-4 shrink-0" />
                                    }
                                    {claimResult.message}
                                    <button
                                        onClick={() => setClaimResult(null)}
                                        className="ml-auto text-muted-foreground hover:text-foreground transition-colors text-xs"
                                    >
                                        dismiss
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── Per-Pool Rewards ─────────────────────── */}
                        {hasPoolRewards ? (
                            <div className="glass-card rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
                                    <h3 className="text-sm font-bold text-foreground">Pool Rewards</h3>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green/10 border border-neon-green/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-dot-pulse" />
                                        <span className="text-[10px] text-neon-green font-bold">LIVE</span>
                                    </div>
                                </div>

                                <div className="divide-y divide-border/10">
                                    {poolRewards.map((pool) => (
                                        <div
                                            key={pool.poolAddress}
                                            className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-neon-cyan/10 border border-border/20 flex items-center justify-center">
                                                    <Layers className="w-4 h-4 text-neon-cyan" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-foreground text-[14px]">
                                                        {pool.tokenA}/{pool.tokenB}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                                        {pool.lpBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} LP tokens
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className={`text-[14px] font-bold font-data ${pool.pendingRewards > 0 ? 'text-neon-green' : 'text-muted-foreground'}`}>
                                                        +{fmtReward(pool.pendingRewards)} RUSH
                                                    </div>
                                                    <div className="text-[10px] text-foreground/40 mt-0.5">
                                                        {fmtReward(pool.earnedRewards)} lifetime
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleClaimPool(pool.poolAddress)}
                                                    disabled={pool.pendingRewards === 0 || !!claimingPool || claimingAll}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                                        pool.pendingRewards > 0
                                                            ? 'border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20'
                                                            : 'border-border/20 bg-muted/20 text-foreground/30 cursor-not-allowed'
                                                    } disabled:opacity-40`}
                                                >
                                                    {claimingPool === pool.poolAddress ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        'Claim'
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* No LP positions — guide to pools */
                            <div className="glass-card rounded-2xl p-8 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-neon-cyan/10 border border-border/20 flex items-center justify-center mx-auto mb-4">
                                    <Layers className="w-7 h-7 text-neon-cyan/60" />
                                </div>
                                <h3 className="text-base font-bold text-foreground mb-2">No Active Positions</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5 leading-relaxed">
                                    You need an active liquidity position to earn RUSH rewards. Add liquidity to any pool to start earning.
                                </p>
                                <Link
                                    href="/pools"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-blue hover:bg-[#2563EB] text-white transition-all text-[13px] font-bold animate-glow-pulse"
                                >
                                    <Layers className="w-4 h-4" />
                                    Browse Pools
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        )}

                        {/* ── How it Works ──────────────────────────── */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                <span className="w-1 h-5 bg-neon-cyan rounded-full" />
                                How it Works
                            </h3>
                            <div className="space-y-3">
                                {[
                                    'Provide liquidity to any of our pools',
                                    'Earn 80% of trading fees + RUSH rewards',
                                    'Claim your RUSH tokens anytime',
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-neon-cyan/10 text-neon-cyan text-[11px] font-bold flex items-center justify-center shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="text-[13px] text-foreground/60">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] p-4 text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                                <button onClick={clearError} className="ml-auto text-xs hover:text-foreground transition-colors">dismiss</button>
                            </div>
                        )}

                        {/* Demo note */}
                        <div className="rounded-xl border border-neon-cyan/15 bg-neon-cyan/[0.03] p-4 text-center">
                            <p className="text-foreground/60 text-[12px]">
                                <span className="text-neon-cyan font-semibold">Demo Mode</span> — Rewards accrue at 200% APY for visible real-time accrual. Production uses a sustainable rate with epoch-based halving.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
