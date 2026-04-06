'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatDistanceToNow } from 'date-fns';
import {
    TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    MoreHorizontal, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
    Wallet, PieChart, Zap, Shield, ArrowRight,
    BarChart3, Layers, Activity, ExternalLink, RefreshCw, Loader2,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { TokenCard } from '@/components/ui/token-card';
import {
    usePortfolioLive,
    type LiveHolding,
    type LivePerpPosition,
    type LiveLpPosition,
    type LiveTransaction,
} from '@/lib/hooks/usePortfolioLive';
import type { NewsItem } from '@/lib/services/news';

/* ── Colors ────────────────────────────────────────────────── */
const ALLOCATION_COLORS = ['#9945FF', '#14F195', '#3B82F6', '#F59E0B', '#EC4899'];

/* ── Token display names ───────────────────────────────────── */
const TOKEN_NAMES: Record<string, string> = {
    SOL: 'Solana',
    USDC: 'USD Coin',
    USDT: 'Tether',
    WETH: 'Wrapped Ethereum',
    RUSH: 'SolRush Token',
    RAY: 'Raydium',
    JUP: 'Jupiter',
    BONK: 'Bonk',
    PYTH: 'Pyth Network',
};

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtUSD(n: number): string {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number): string {
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function timeAgo(isoOrDate: string | Date): string {
    try {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        if (isNaN(d.getTime())) return '—';
        return formatDistanceToNow(d, { addSuffix: true });
    } catch {
        return '—';
    }
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8899';

function solscanLink(txHash: string): string {
    // For localnet, link to the validator explorer
    return `${RPC_URL.replace('//', '//explorer.')}/tx/${txHash}`;
}

/* ── Animation Variants ────────────────────────────────────── */
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
    hidden: { y: 24, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 15 } },
};

/* ── Sub-Components ──────────────────────────────────────────── */
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <motion.div
            variants={itemVariants}
            className={`glass-card rounded-2xl ${className}`}
        >
            {children}
        </motion.div>
    );
}

function StatBadge({ label, value, positive }: { label: string; value: string; positive: boolean }) {
    return (
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold ${positive
            ? 'bg-neon-green/10 border-neon-green/25 text-neon-green'
            : 'bg-destructive/10 border-destructive/25 text-destructive'
            }`}>
            {positive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{label}</span>
            <span className="opacity-70">{value}</span>
        </div>
    );
}

function TokenIcon({ symbol, icon, size = 36 }: { symbol: string; icon?: string; size?: number }) {
    if (icon) {
        return (
            <img src={icon} alt={symbol} width={size} height={size}
                className="rounded-full border border-border/30 shadow-md"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        );
    }
    return (
        <div className="rounded-full bg-muted border border-border/20 flex items-center justify-center text-[10px] font-bold text-foreground/60"
            style={{ width: size, height: size }}>
            {symbol.slice(0, 2)}
        </div>
    );
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-foreground/40">
            <Icon className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-[13px]">{label}</p>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   SECTION 1 — Overview Metrics
───────────────────────────────────────────────────────────── */
function OverviewSection({ holdings, lp, perps }: { holdings: LiveHolding[]; lp: LiveLpPosition[]; perps: LivePerpPosition[] }) {
    const totalPortfolio = holdings.reduce((s, h) => s + h.valueUSD, 0)
        + lp.reduce((s, l) => s + l.valueUSD, 0);
    const totalPnL = perps.reduce((s, p) => s + p.pnl, 0) + lp.reduce((s, l) => s + l.feesEarned, 0);
    const totalReturn = totalPortfolio > 0 ? (totalPnL / totalPortfolio) * 100 : 0;
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <GlassCard className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <p className="text-[13px] text-muted-foreground font-medium uppercase tracking-widest mb-1">Total Portfolio Value</p>
                    <h2 className="text-[2.5rem] font-bold text-foreground leading-none font-data">
                        {fmtUSD(totalPortfolio)}
                    </h2>
                    <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${totalReturn >= 0 ? 'text-neon-green' : 'text-destructive'}`}>
                        {totalReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span>{pct(totalReturn)} Return</span>
                        <span className="text-muted-foreground font-normal">({totalPnL >= 0 ? '+' : ''}{fmtUSD(totalPnL)} total gain)</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <p className="text-[12px] text-muted-foreground">As of {today}</p>
                    <div className="flex gap-2">
                        <StatBadge label="Spot" value={fmtUSD(holdings.reduce((s, h) => s + h.valueUSD, 0))} positive={true} />
                        <StatBadge label="LP" value={fmtUSD(lp.reduce((s, l) => s + l.valueUSD, 0))} positive={lp.length > 0} />
                    </div>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/10 rounded-xl overflow-hidden">
                {[
                    { label: 'Open Positions', value: `${perps.length}`, icon: <Activity className="w-4 h-4" />, accent: 'text-neon-cyan' },
                    { label: 'LP Pools Active', value: `${lp.length}`, icon: <Layers className="w-4 h-4" />, accent: 'text-neon-green' },
                    { label: 'Fees Earned', value: fmtUSD(lp.reduce((s, l) => s + l.feesEarned, 0)), icon: <Zap className="w-4 h-4" />, accent: 'text-neon-amber' },
                    { label: 'Unrealized PnL', value: fmtUSD(perps.reduce((s, p) => s + p.pnl, 0)), icon: <BarChart3 className="w-4 h-4" />, accent: 'text-neon-blue' },
                ].map((stat, i) => (
                    <div key={i} className="bg-background/80 p-4 flex flex-col gap-2 hover:bg-muted/30 transition-colors">
                        <div className={`flex items-center gap-2 ${stat.accent}`}>
                            {stat.icon}
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                        </div>
                        <div className="text-xl font-bold text-foreground font-data">{stat.value}</div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}

/* ─────────────────────────────────────────────────────────────
   SECTION 2 — Holdings + Allocation (side-by-side)
───────────────────────────────────────────────────────────── */
function HoldingsSection({ holdings, lpTotal }: { holdings: LiveHolding[]; lpTotal: number }) {
    const totalValue = holdings.reduce((s, h) => s + h.valueUSD, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Holdings list */}
            <GlassCard className="lg:col-span-3 overflow-hidden">
                <div className="flex justify-between items-center px-6 py-5 border-b border-border/20">
                    <h3 className="text-base font-bold text-foreground">Token Holdings</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-[12px] text-muted-foreground font-medium">Total {fmtUSD(totalValue)}</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green/10 border border-neon-green/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-dot-pulse" />
                            <span className="text-[10px] text-neon-green font-bold">LIVE</span>
                        </div>
                    </div>
                </div>

                {holdings.length === 0 ? (
                    <EmptyState icon={Wallet} label="No tokens found in wallet" />
                ) : (
                    <div className="flex flex-col gap-2 p-3">
                        {holdings.map((h) => (
                            <TokenCard
                                key={h.symbol}
                                logoSrc={h.icon}
                                ticker={h.symbol}
                                name={TOKEN_NAMES[h.symbol] || h.symbol}
                                price={h.price}
                                allocation={h.allocation}
                                balance={h.amount}
                                valueUSD={h.valueUSD}
                                onTrade={(ticker) => {
                                    window.location.href = `/swap?token=${ticker}`;
                                }}
                            />
                        ))}
                    </div>
                )}
            </GlassCard>

            {/* Donut allocation */}
            <GlassCard className="lg:col-span-2 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base font-bold text-foreground">Allocation</h3>
                    <PieChart className="w-5 h-5 text-neon-cyan" />
                </div>

                {/* Visual donut segments as stacked bar */}
                <div className="relative w-full h-5 rounded-full overflow-hidden mb-6 flex">
                    {holdings.map((h, i) => (
                        <motion.div
                            key={h.symbol}
                            initial={{ width: 0 }}
                            animate={{ width: `${h.allocation}%` }}
                            transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                            className="h-full first:rounded-l-full last:rounded-r-full"
                            style={{ backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }}
                        />
                    ))}
                </div>

                <div className="space-y-3">
                    {holdings.map((h, i) => (
                        <div key={h.symbol} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }} />
                                <div className="flex items-center gap-2">
                                    <TokenIcon symbol={h.symbol} icon={h.icon} size={20} />
                                    <span className="text-[13px] font-semibold text-foreground/80">{h.symbol}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${h.allocation}%` }}
                                        transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }}
                                    />
                                </div>
                                <span className="text-[13px] font-bold text-foreground font-data w-8 text-right">{h.allocation}%</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Value breakdown — dynamic */}
                <div className="mt-6 pt-5 border-t border-border/20 space-y-2">
                    {[
                        { label: 'Spot Holdings', val: fmtUSD(totalValue), icon: <Wallet className="w-3.5 h-3.5 text-neon-cyan" /> },
                        { label: 'LP Positions', val: fmtUSD(lpTotal), icon: <Layers className="w-3.5 h-3.5 text-neon-green" /> },
                    ].map((row, i) => (
                        <div key={i} className="flex justify-between items-center text-[13px]">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                {row.icon}
                                {row.label}
                            </div>
                            <span className="text-foreground font-semibold">{row.val}</span>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   SECTION 3 — Perpetual Positions  (on-chain via usePerps)
───────────────────────────────────────────────────────────── */
function PerpsSection({ perps }: { perps: LivePerpPosition[] }) {
    return (
        <GlassCard className="overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border/20">
                <div>
                    <h3 className="text-base font-bold text-foreground">Open Perpetual Positions</h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Leveraged trading positions on SolRush Perps</p>
                </div>
                <span className="text-[11px] font-semibold text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/25 px-3 py-1.5 rounded-full">
                    {perps.length} Active
                </span>
            </div>

            {perps.length === 0 ? (
                <EmptyState icon={BarChart3} label="No open perpetual positions" />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/10">
                                {['Market', 'Side', 'Size / Entry', 'Mark Price', 'Liq. Price', 'PnL'].map(h => (
                                    <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            {perps.map((p, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-foreground text-[14px]">{p.market}</div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5">{p.leverage}x Leverage</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-md text-[11px] font-bold border tracking-wider ${p.side === 'LONG'
                                            ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
                                            : 'bg-destructive/10 text-destructive border-destructive/30'
                                            }`}>
                                            {p.side}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-foreground font-data">{fmtUSD(p.size)}</div>
                                        <div className="text-[12px] text-muted-foreground">@ {fmtUSD(p.entryPrice)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-foreground font-data">{fmtUSD(p.markPrice)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-destructive font-data">{fmtUSD(p.liquidationPrice)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`font-bold text-[15px] font-data ${p.pnl >= 0 ? 'text-neon-green' : 'text-destructive'}`}>
                                            {p.pnl >= 0 ? '+' : ''}{fmtUSD(p.pnl)}
                                        </div>
                                        <div className={`flex items-center gap-1 text-[12px] font-semibold ${p.pnlPct >= 0 ? 'text-neon-green' : 'text-destructive'}`}>
                                            {p.pnlPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                            {pct(p.pnlPct)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </GlassCard>
    );
}

/* ─────────────────────────────────────────────────────────────
   SECTION 4 — LP Positions  (on-chain via usePortfolioLive)
───────────────────────────────────────────────────────────── */
function LpSection({ lp, onRefresh, refreshing }: { lp: LiveLpPosition[]; onRefresh: () => void; refreshing: boolean }) {
    const tokenIcons: Record<string, string> = {
        SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
        USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
        USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
        WETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    };

    return (
        <GlassCard className="overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border/20">
                <div>
                    <h3 className="text-base font-bold text-foreground">Liquidity Positions</h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Earn fees by providing liquidity to trading pairs</p>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 text-[12px] font-semibold text-neon-cyan hover:text-foreground transition-colors border border-neon-cyan/25 hover:border-border/40 px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                    <motion.div animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : {}}>
                        <RefreshCw className="w-3.5 h-3.5" />
                    </motion.div>
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {lp.length === 0 ? (
                <EmptyState icon={Layers} label="No active liquidity positions" />
            ) : (
                <div className="divide-y divide-border/10">
                    {lp.map((lpItem, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 hover:bg-muted/20 transition-colors gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    <TokenIcon symbol={lpItem.tokenA} icon={tokenIcons[lpItem.tokenA]} size={36} />
                                    <TokenIcon symbol={lpItem.tokenB} icon={tokenIcons[lpItem.tokenB]} size={36} />
                                </div>
                                <div>
                                    <div className="font-bold text-foreground text-[15px]">{lpItem.pair}</div>
                                    <div className="text-[12px] text-muted-foreground mt-0.5">Liquidity Pool</div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-6 sm:gap-10">
                                <div>
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Value</div>
                                    <div className="font-bold text-foreground font-data">{fmtUSD(lpItem.valueUSD)}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Fees Earned</div>
                                    <div className="font-bold text-neon-green font-data">+{fmtUSD(lpItem.feesEarned)}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">APR</div>
                                    <div className="font-bold text-neon-cyan font-data">{lpItem.apr.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </GlassCard>
    );
}

/* ─────────────────────────────────────────────────────────────
   SECTION 5 — Transaction History + Market News
───────────────────────────────────────────────────────────── */
function ActivitySection({ transactions, news }: { transactions: LiveTransaction[]; news: NewsItem[] }) {
    const [newsPage, setNewsPage] = useState(0);
    const newsPerPage = 3;
    const visibleNews = news.slice(newsPage * newsPerPage, newsPage * newsPerPage + newsPerPage);

    const TYPE_STYLES: Record<string, string> = {
        SWAP: 'bg-neon-blue/10 text-neon-blue border-neon-blue/25',
        PERP: 'bg-neon-purple/10 text-neon-purple border-neon-purple/25',
        PERP_OPEN: 'bg-neon-purple/10 text-neon-purple border-neon-purple/25',
        PERP_CLOSE: 'bg-neon-purple/10 text-neon-purple border-neon-purple/25',
        LP: 'bg-neon-green/10 text-neon-green border-neon-green/25',
        LP_ADD: 'bg-neon-green/10 text-neon-green border-neon-green/25',
        LP_REMOVE: 'bg-neon-green/10 text-neon-green border-neon-green/25',
        REWARD: 'bg-neon-amber/10 text-neon-amber border-neon-amber/25',
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transaction History — from DB */}
            <GlassCard className="overflow-hidden">
                <div className="flex justify-between items-center px-6 py-5 border-b border-border/20">
                    <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
                    <button className="p-1.5 rounded-lg border border-border/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>

                {transactions.length === 0 ? (
                    <EmptyState icon={Activity} label="No recent activity" />
                ) : (
                    <div className="divide-y divide-border/10">
                        {transactions.map((tx, i) => (
                            <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border tracking-wider shrink-0 ${TYPE_STYLES[tx.type] ?? TYPE_STYLES.SWAP}`}>
                                    {tx.type}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-foreground/80 text-[13px] truncate">{tx.description}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] text-muted-foreground">{timeAgo(tx.time)}</span>
                                        <span className="text-[11px] text-foreground/20">·</span>
                                        <span className="text-[11px] font-mono text-foreground/40">
                                            {tx.txHash ? `${tx.txHash.slice(0, 4)}…${tx.txHash.slice(-4)}` : '—'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[13px] font-semibold text-foreground">{tx.amount}</div>
                                    <div className="text-[11px] text-muted-foreground font-data">{fmtUSD(tx.valueUSD)}</div>
                                </div>
                                {tx.fullTxHash && (
                                    <a
                                        href={solscanLink(tx.fullTxHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground/30 hover:text-foreground/60 transition-colors shrink-0"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            {/* Market News — external feed */}
            <GlassCard className="overflow-hidden">
                <div className="flex justify-between items-center px-6 py-5 border-b border-border/20">
                    <h3 className="text-base font-bold text-foreground">Market News</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setNewsPage(p => Math.max(0, p - 1))}
                            disabled={newsPage === 0}
                            className="p-1.5 rounded-lg border border-border/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setNewsPage(p => (p + 1) * newsPerPage < news.length ? p + 1 : p)}
                            disabled={(newsPage + 1) * newsPerPage >= news.length}
                            className="p-1.5 rounded-lg border border-border/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {news.length === 0 ? (
                    <EmptyState icon={ArrowRight} label="Loading news…" />
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={newsPage}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="divide-y divide-border/10"
                        >
                            {visibleNews.map((article, i) => (
                                <div key={i} className="px-6 py-4 hover:bg-muted/20 transition-colors group">
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                                        <span className="text-neon-cyan font-semibold">{article.category}</span>
                                        <span>·</span>
                                        <span>{timeAgo(article.publishedAt)}</span>
                                    </div>
                                    <p className="font-semibold text-[13px] text-foreground/80 leading-snug mb-3 line-clamp-2 group-hover:text-foreground transition-colors">
                                        {article.title}
                                    </p>
                                    <a
                                        href={article.url !== '#' ? article.url : undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-[12px] font-semibold text-muted-foreground hover:text-neon-green transition-colors"
                                    >
                                        {article.source} <ArrowRight className="ml-1 w-3 h-3" />
                                    </a>
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                )}
            </GlassCard>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function PortfolioPage() {
    const { publicKey } = useWallet();

    const {
        holdings,
        perpPositions,
        lpPositions,
        transactions,
        news,
        spotTotal,
        lpTotal,
        loading,
        lpLoading,
        refreshAll,
        refreshLp,
    } = usePortfolioLive();

    const hasData = holdings.length > 0 || perpPositions.length > 0 || lpPositions.length > 0;

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-200 selection:bg-neon-cyan/20">
            <Navbar />

            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
                {/* Page Header — swap-style centered */}
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-4xl sm:text-5xl font-semibold text-foreground tracking-tight">
                        My Portfolio
                    </h1>
                    <p className="text-foreground/60 text-base sm:text-lg">
                        Track assets, open positions, LP earnings, and activity across SolRush DEX.
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-2">
                        {publicKey && (
                            <button
                                onClick={refreshAll}
                                disabled={loading}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-neon-cyan border border-neon-cyan/25 px-4 py-2 rounded-xl hover:bg-neon-cyan/5 transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                                Refresh
                            </button>
                        )}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${publicKey ? 'bg-neon-green/10 border-neon-green/20' : 'bg-neon-amber/10 border-neon-amber/20'}`}>
                            <div className={`w-2 h-2 rounded-full animate-dot-pulse ${publicKey ? 'bg-neon-green' : 'bg-neon-amber'}`} />
                            <span className={`text-[11px] font-bold tracking-wider uppercase ${publicKey ? 'text-neon-green' : 'text-neon-amber'}`}>
                                {publicKey ? (loading ? 'Syncing…' : 'On-chain') : 'Not Connected'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Not connected */}
                {!publicKey ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card rounded-2xl p-16 text-center max-w-lg mx-auto"
                    >
                        <div className="w-20 h-20 rounded-2xl solana-gradient flex items-center justify-center mx-auto mb-6">
                            <Wallet className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-3">Connect Your Wallet</h2>
                        <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                            Connect your Solana wallet to view your portfolio, open positions, and trading history in real-time.
                        </p>
                        <div className="flex justify-center">
                            <button
                                onClick={() => {
                                    const walletBtn = document.querySelector<HTMLButtonElement>('.wallet-adapter-button');
                                    walletBtn?.click();
                                }}
                                className="bg-neon-blue hover:bg-[#2563EB] rounded-xl font-bold text-white px-8 py-3 transition-all animate-glow-pulse active:scale-95"
                            >
                                Connect Wallet
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                    >
                        <OverviewSection holdings={holdings} lp={lpPositions} perps={perpPositions} />
                        <HoldingsSection holdings={holdings} lpTotal={lpTotal} />
                        <PerpsSection perps={perpPositions} />
                        <LpSection lp={lpPositions} onRefresh={refreshLp} refreshing={lpLoading} />
                        <ActivitySection transactions={transactions} news={news} />
                    </motion.div>
                )}
            </main>
        </div>
    );
}
