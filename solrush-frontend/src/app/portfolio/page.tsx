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
            className={`rounded-2xl border border-white/8 bg-[#0F172A]/70 backdrop-blur-md shadow-xl shadow-black/30 ${className}`}
        >
            {children}
        </motion.div>
    );
}

function StatBadge({ label, value, positive }: { label: string; value: string; positive: boolean }) {
    return (
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold ${positive
            ? 'bg-[#14F195]/10 border-[#14F195]/25 text-[#14F195]'
            : 'bg-[#F87171]/10 border-[#F87171]/25 text-[#F87171]'
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
                className="rounded-full border border-white/10 shadow-md"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        );
    }
    return (
        <div className="rounded-full bg-[#1E293B] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/60"
            style={{ width: size, height: size }}>
            {symbol.slice(0, 2)}
        </div>
    );
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-[#4B5563]">
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
                    <p className="text-[13px] text-[#6B7280] font-medium uppercase tracking-widest mb-1">Total Portfolio Value</p>
                    <h2 className="text-[2.5rem] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 leading-none tabular-nums">
                        {fmtUSD(totalPortfolio)}
                    </h2>
                    <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${totalReturn >= 0 ? 'text-[#14F195]' : 'text-[#F87171]'}`}>
                        {totalReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span>{pct(totalReturn)} Return</span>
                        <span className="text-[#6B7280] font-normal">({totalPnL >= 0 ? '+' : ''}{fmtUSD(totalPnL)} total gain)</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <p className="text-[12px] text-[#6B7280]">As of {today}</p>
                    <div className="flex gap-2">
                        <StatBadge label="Spot" value={fmtUSD(holdings.reduce((s, h) => s + h.valueUSD, 0))} positive={true} />
                        <StatBadge label="LP" value={fmtUSD(lp.reduce((s, l) => s + l.valueUSD, 0))} positive={lp.length > 0} />
                    </div>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04] rounded-xl overflow-hidden">
                {[
                    { label: 'Open Positions', value: `${perps.length}`, icon: <Activity className="w-4 h-4" />, accent: '#9945FF' },
                    { label: 'LP Pools Active', value: `${lp.length}`, icon: <Layers className="w-4 h-4" />, accent: '#14F195' },
                    { label: 'Fees Earned', value: fmtUSD(lp.reduce((s, l) => s + l.feesEarned, 0)), icon: <Zap className="w-4 h-4" />, accent: '#F59E0B' },
                    { label: 'Unrealized PnL', value: fmtUSD(perps.reduce((s, p) => s + p.pnl, 0)), icon: <BarChart3 className="w-4 h-4" />, accent: '#3B82F6' },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#0B1220]/80 p-4 flex flex-col gap-2 hover:bg-[#1E293B]/50 transition-colors">
                        <div className="flex items-center gap-2" style={{ color: stat.accent }}>
                            {stat.icon}
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">{stat.label}</span>
                        </div>
                        <div className="text-xl font-bold text-white tabular-nums">{stat.value}</div>
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
                <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                    <h3 className="text-base font-bold text-white">Token Holdings</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-[12px] text-[#6B7280] font-medium">Total {fmtUSD(totalValue)}</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#14F195]/10 border border-[#14F195]/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
                            <span className="text-[10px] text-[#14F195] font-bold">LIVE</span>
                        </div>
                    </div>
                </div>

                {holdings.length === 0 ? (
                    <EmptyState icon={Wallet} label="No tokens found in wallet" />
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {holdings.map((h) => (
                            <div key={h.symbol} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.025] transition-colors group">
                                <div className="flex items-center gap-3">
                                    <TokenIcon symbol={h.symbol} icon={h.icon} size={40} />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-[15px]">{h.symbol}</span>
                                        </div>
                                        <span className="text-[12px] text-[#6B7280]">{h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-white text-[15px] tabular-nums">{fmtUSD(h.price)}</p>
                                    <span className="text-[12px] text-[#6B7280]">mark price</span>
                                </div>
                                <div className="ml-6 text-right min-w-[80px]">
                                    <p className="font-bold text-white tabular-nums">{fmtUSD(h.valueUSD)}</p>
                                    <p className="text-[12px] text-[#6B7280]">{h.allocation}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            {/* Donut allocation */}
            <GlassCard className="lg:col-span-2 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base font-bold text-white">Allocation</h3>
                    <PieChart className="w-5 h-5 text-[#9945FF]" />
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
                                    <span className="text-[13px] font-semibold text-[#D1D5DB]">{h.symbol}</span>
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
                                <span className="text-[13px] font-bold text-white tabular-nums w-8 text-right">{h.allocation}%</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Value breakdown — dynamic */}
                <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-2">
                    {[
                        { label: 'Spot Holdings', val: fmtUSD(totalValue), icon: <Wallet className="w-3.5 h-3.5 text-[#9945FF]" /> },
                        { label: 'LP Positions', val: fmtUSD(lpTotal), icon: <Layers className="w-3.5 h-3.5 text-[#14F195]" /> },
                    ].map((row, i) => (
                        <div key={i} className="flex justify-between items-center text-[13px]">
                            <div className="flex items-center gap-2 text-[#6B7280]">
                                {row.icon}
                                {row.label}
                            </div>
                            <span className="text-white font-semibold">{row.val}</span>
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
            <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                <div>
                    <h3 className="text-base font-bold text-white">Open Perpetual Positions</h3>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">Leveraged trading positions on SolRush Perps</p>
                </div>
                <span className="text-[11px] font-semibold text-[#9945FF] bg-[#9945FF]/10 border border-[#9945FF]/25 px-3 py-1.5 rounded-full">
                    {perps.length} Active
                </span>
            </div>

            {perps.length === 0 ? (
                <EmptyState icon={BarChart3} label="No open perpetual positions" />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/[0.04]">
                                {['Market', 'Side', 'Size / Entry', 'Mark Price', 'Liq. Price', 'PnL'].map(h => (
                                    <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {perps.map((p, i) => (
                                <tr key={i} className="hover:bg-white/[0.025] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white text-[14px]">{p.market}</div>
                                        <div className="text-[11px] text-[#6B7280] mt-0.5">{p.leverage}x Leverage</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-md text-[11px] font-bold border tracking-wider ${p.side === 'LONG'
                                            ? 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/30'
                                            : 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/30'
                                            }`}>
                                            {p.side}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-white tabular-nums">{fmtUSD(p.size)}</div>
                                        <div className="text-[12px] text-[#6B7280]">@ {fmtUSD(p.entryPrice)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-white tabular-nums">{fmtUSD(p.markPrice)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-[#F87171] tabular-nums">{fmtUSD(p.liquidationPrice)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`font-bold text-[15px] tabular-nums ${p.pnl >= 0 ? 'text-[#14F195]' : 'text-[#F87171]'}`}>
                                            {p.pnl >= 0 ? '+' : ''}{fmtUSD(p.pnl)}
                                        </div>
                                        <div className={`flex items-center gap-1 text-[12px] font-semibold ${p.pnlPct >= 0 ? 'text-[#14F195]' : 'text-[#F87171]'}`}>
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
            <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                <div>
                    <h3 className="text-base font-bold text-white">Liquidity Positions</h3>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">Earn fees by providing liquidity to trading pairs</p>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 text-[12px] font-semibold text-[#14F195] hover:text-white transition-colors border border-[#14F195]/25 hover:border-white/20 px-3 py-1.5 rounded-lg disabled:opacity-50"
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
                <div className="divide-y divide-white/[0.04]">
                    {lp.map((lpItem, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 hover:bg-white/[0.025] transition-colors gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    <TokenIcon symbol={lpItem.tokenA} icon={tokenIcons[lpItem.tokenA]} size={36} />
                                    <TokenIcon symbol={lpItem.tokenB} icon={tokenIcons[lpItem.tokenB]} size={36} />
                                </div>
                                <div>
                                    <div className="font-bold text-white text-[15px]">{lpItem.pair}</div>
                                    <div className="text-[12px] text-[#6B7280] mt-0.5">Liquidity Pool</div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-6 sm:gap-10">
                                <div>
                                    <div className="text-[11px] text-[#6B7280] uppercase tracking-wider mb-1">Value</div>
                                    <div className="font-bold text-white tabular-nums">{fmtUSD(lpItem.valueUSD)}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-[#6B7280] uppercase tracking-wider mb-1">Fees Earned</div>
                                    <div className="font-bold text-[#14F195] tabular-nums">+{fmtUSD(lpItem.feesEarned)}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-[#6B7280] uppercase tracking-wider mb-1">APR</div>
                                    <div className="font-bold text-[#9945FF] tabular-nums">{lpItem.apr.toFixed(1)}%</div>
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
        SWAP: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/25',
        PERP: 'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/25',
        PERP_OPEN: 'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/25',
        PERP_CLOSE: 'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/25',
        LP: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/25',
        LP_ADD: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/25',
        LP_REMOVE: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/25',
        REWARD: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/25',
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transaction History — from DB */}
            <GlassCard className="overflow-hidden">
                <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                    <h3 className="text-base font-bold text-white">Recent Activity</h3>
                    <button className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[#6B7280] hover:text-white transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>

                {transactions.length === 0 ? (
                    <EmptyState icon={Activity} label="No recent activity" />
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {transactions.map((tx, i) => (
                            <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.025] transition-colors">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border tracking-wider shrink-0 ${TYPE_STYLES[tx.type] ?? TYPE_STYLES.SWAP}`}>
                                    {tx.type}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-[#D1D5DB] text-[13px] truncate">{tx.description}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] text-[#6B7280]">{timeAgo(tx.time)}</span>
                                        <span className="text-[11px] text-[#4B5563]">·</span>
                                        <span className="text-[11px] font-mono text-[#4B5563]">
                                            {tx.txHash ? `${tx.txHash.slice(0, 4)}…${tx.txHash.slice(-4)}` : '—'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[13px] font-semibold text-white">{tx.amount}</div>
                                    <div className="text-[11px] text-[#6B7280] tabular-nums">{fmtUSD(tx.valueUSD)}</div>
                                </div>
                                {tx.fullTxHash && (
                                    <a
                                        href={solscanLink(tx.fullTxHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#4B5563] hover:text-[#9CA3AF] transition-colors shrink-0"
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
                <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                    <h3 className="text-base font-bold text-white">Market News</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setNewsPage(p => Math.max(0, p - 1))}
                            disabled={newsPage === 0}
                            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[#6B7280] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setNewsPage(p => (p + 1) * newsPerPage < news.length ? p + 1 : p)}
                            disabled={(newsPage + 1) * newsPerPage >= news.length}
                            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[#6B7280] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                            className="divide-y divide-white/[0.04]"
                        >
                            {visibleNews.map((article, i) => (
                                <div key={i} className="px-6 py-4 hover:bg-white/[0.025] transition-colors group">
                                    <div className="flex items-center gap-2 text-[11px] text-[#6B7280] mb-2">
                                        <span className="text-[#9945FF] font-semibold">{article.category}</span>
                                        <span>·</span>
                                        <span>{timeAgo(article.publishedAt)}</span>
                                    </div>
                                    <p className="font-semibold text-[13px] text-[#D1D5DB] leading-snug mb-3 line-clamp-2 group-hover:text-white transition-colors">
                                        {article.title}
                                    </p>
                                    <a
                                        href={article.url !== '#' ? article.url : undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-[12px] font-semibold text-[#6B7280] hover:text-[#14F195] transition-colors"
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
        <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
            {/* Ambient glows */}
            <div className="fixed top-0 left-[-10%] w-[50%] h-[60%] rounded-full bg-[#9945FF]/6 blur-[160px] pointer-events-none" />
            <div className="fixed bottom-0 right-[-10%] w-[40%] h-[50%] rounded-full bg-[#14F195]/6 blur-[160px] pointer-events-none" />

            <Navbar />

            <main className="relative z-10 max-w-[1320px] mx-auto px-5 pt-24 pb-16">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
                >
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg">
                                <Wallet className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-[12px] font-semibold text-[#9945FF] uppercase tracking-widest">Dashboard</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-tight">
                            My Portfolio
                        </h1>
                        <p className="text-[#6B7280] text-sm mt-1.5">
                            Track assets, open positions, LP earnings, and activity across SolRush DEX
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {publicKey && (
                            <button
                                onClick={refreshAll}
                                disabled={loading}
                                className="flex items-center gap-2 text-[12px] font-semibold text-[#14F195] border border-[#14F195]/25 px-3 py-1.5 rounded-xl hover:bg-[#14F195]/5 transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                                Refresh
                            </button>
                        )}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${publicKey ? 'bg-[#14F195]/10 border-[#14F195]/20' : 'bg-[#F59E0B]/10 border-[#F59E0B]/20'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${publicKey ? 'bg-[#14F195] shadow-[0_0_8px_rgba(20,241,149,0.8)]' : 'bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`} />
                            <span className={`text-[11px] font-bold tracking-wider uppercase ${publicKey ? 'text-[#14F195]' : 'text-[#F59E0B]'}`}>
                                {publicKey ? (loading ? 'Syncing…' : 'On-chain') : 'Not Connected'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280] border border-white/10 px-3 py-1.5 rounded-full">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Non-custodial</span>
                        </div>
                    </div>
                </motion.div>

                {/* Not connected */}
                {!publicKey ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl border border-white/8 bg-[#0F172A]/70 backdrop-blur-md p-16 text-center"
                    >
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center mx-auto mb-6 shadow-2xl">
                            <Wallet className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h2>
                        <p className="text-[#6B7280] max-w-md mx-auto mb-8 leading-relaxed">
                            Connect your Solana wallet to view your portfolio, open positions, and trading history in real-time.
                        </p>
                        <div className="flex justify-center">
                            <button
                                onClick={() => {
                                    const walletBtn = document.querySelector<HTMLButtonElement>('.wallet-adapter-button');
                                    walletBtn?.click();
                                }}
                                className="bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-xl font-bold text-white px-8 py-3 hover:opacity-90 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(153,69,255,0.4)] active:scale-95"
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
