'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import useSWR from 'swr';
import {
    TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    MoreHorizontal, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
    Wallet, PieChart, Zap, Shield, ArrowRight,
    BarChart3, Layers, Activity, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';

/* ── Types ─────────────────────────────────────────────────── */
type TokenHolding = {
    symbol: string;
    name: string;
    amount: number;
    valueUSD: number;
    price: number;
    change24h: number;
    allocation: number;
    icon: string;
};

type PerpPosition = {
    market: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    markPrice: number;
    pnl: number;
    pnlPct: number;
    leverage: number;
    liquidationPrice: number;
};

type LpPosition = {
    pair: string;
    tokenA: string;
    tokenB: string;
    valueUSD: number;
    feesEarned: number;
    apr: number;
};

type Transaction = {
    type: 'SWAP' | 'PERP' | 'LP' | 'REWARD';
    description: string;
    amount: string;
    valueUSD: number;
    time: string;
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
    txHash: string;
};

type NewsItem = {
    category: string;
    time: string;
    title: string;
    source: string;
};

/* ── Mock Data ─────────────────────────────────────────────── */
const MOCK_HOLDINGS: TokenHolding[] = [
    { symbol: 'SOL', name: 'Solana', amount: 24.5, valueUSD: 3675.0, price: 150.0, change24h: 4.2, allocation: 45, icon: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
    { symbol: 'USDC', name: 'USD Coin', amount: 2000, valueUSD: 2000.0, price: 1.0, change24h: 0.01, allocation: 25, icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
    { symbol: 'ETH', name: 'Ethereum', amount: 0.8, valueUSD: 1520.0, price: 1900.0, change24h: -1.8, allocation: 19, icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
    { symbol: 'BTC', name: 'Bitcoin', amount: 0.025, valueUSD: 915.0, price: 36600.0, change24h: 2.1, allocation: 11, icon: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
];

const MOCK_PERPS: PerpPosition[] = [
    { market: 'SOL/USD', side: 'LONG', size: 500, entryPrice: 138.5, markPrice: 150.0, pnl: 57.5, pnlPct: 8.3, leverage: 5, liquidationPrice: 110.8 },
    { market: 'BTC/USD', side: 'SHORT', size: 200, entryPrice: 38200, markPrice: 36600, pnl: 8.38, pnlPct: 4.2, leverage: 3, liquidationPrice: 42000 },
];

const MOCK_LP: LpPosition[] = [
    { pair: 'SOL/USDC', tokenA: 'SOL', tokenB: 'USDC', valueUSD: 1200, feesEarned: 48.5, apr: 24.8 },
    { pair: 'ETH/SOL', tokenA: 'ETH', tokenB: 'SOL', valueUSD: 850, feesEarned: 21.2, apr: 18.3 },
];

const MOCK_TRANSACTIONS: Transaction[] = [
    { type: 'SWAP', description: 'SOL → USDC', amount: '5 SOL', valueUSD: 750, time: '2 min ago', status: 'SUCCESS', txHash: '3xKp...9fQr' },
    { type: 'PERP', description: 'Opened LONG SOL/USD 5x', amount: '$500', valueUSD: 500, time: '1 hr ago', status: 'SUCCESS', txHash: '7mNt...2hJk' },
    { type: 'LP', description: 'Added SOL/USDC Liquidity', amount: '$600', valueUSD: 600, time: '3 hrs ago', status: 'SUCCESS', txHash: '9pLq...4wXz' },
    { type: 'REWARD', description: 'RUSH Rewards Claimed', amount: '125 RUSH', valueUSD: 31.25, time: '1 day ago', status: 'SUCCESS', txHash: '2cRa...8vBn' },
    { type: 'SWAP', description: 'USDC → ETH', amount: '500 USDC', valueUSD: 500, time: '2 days ago', status: 'SUCCESS', txHash: '6kFw...1mPo' },
];

const MOCK_NEWS: NewsItem[] = [
    { category: 'Solana', time: '5 min ago', title: 'Solana DeFi TVL Surpasses $8B as Network Activity Hits All-Time High', source: 'CoinDesk' },
    { category: 'Markets', time: '32 min ago', title: 'BTC Reclaims $37K Support as Institutional Inflows Accelerate', source: 'The Block' },
    { category: 'DeFi', time: '1 hr ago', title: 'Perpetual DEX Volume Hits Record $45B in November, Led by Solana Protocols', source: 'DeFiLlama' },
    { category: 'Regulation', time: '3 hrs ago', title: 'SEC Signals New Framework for Token Classifications in 2025', source: 'Reuters' },
    { category: 'Solana', time: '5 hrs ago', title: 'Firedancer Validator Client Reaches Beta Milestone on Mainnet Preparations', source: 'Decrypt' },
];

/* ── Colors & Token Icons ──────────────────────────────────── */
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

const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://127.0.0.1:8001';

/* ── SWR fetcher ────────────────────────────────────────────── */
const swrFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

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

/* ─────────────────────────────────────────────────────────────
   SECTION 1 — Overview Metrics
───────────────────────────────────────────────────────────── */
function OverviewSection({ holdings, lp, perps }: { holdings: TokenHolding[]; lp: LpPosition[]; perps: PerpPosition[] }) {
    const totalPortfolio = holdings.reduce((s, h) => s + h.valueUSD, 0)
        + lp.reduce((s, l) => s + l.valueUSD, 0);
    const totalPnL = perps.reduce((s, p) => s + p.pnl, 0) + lp.reduce((s, l) => s + l.feesEarned, 0);
    const totalReturn = (totalPnL / totalPortfolio) * 100;
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
                        <span className="text-[#6B7280] font-normal">(+{fmtUSD(totalPnL)} total gain)</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <p className="text-[12px] text-[#6B7280]">As of {today}</p>
                    <div className="flex gap-2">
                        <StatBadge label="Spot" value={fmtUSD(holdings.reduce((s, h) => s + h.valueUSD, 0))} positive={true} />
                        <StatBadge label="LP" value={fmtUSD(lp.reduce((s, l) => s + l.valueUSD, 0))} positive={true} />
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
function HoldingsSection({ holdings, lp }: { holdings: TokenHolding[]; lp: LpPosition[] }) {
    const totalValue = holdings.reduce((s, h) => s + h.valueUSD, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Holdings list */}
            <GlassCard className="lg:col-span-3 overflow-hidden">
                <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                    <h3 className="text-base font-bold text-white">Token Holdings</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-[12px] text-[#6B7280] font-medium">Total {fmtUSD(totalValue)}</span>
                        <button className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-[#6B7280] hover:text-white">
                            <MoreHorizontal className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-white/[0.04]">
                    {holdings.map((h) => (
                        <div key={h.symbol} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.025] transition-colors group">
                            <div className="flex items-center gap-3">
                                <TokenIcon symbol={h.symbol} icon={h.icon} size={40} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-[15px]">{h.symbol}</span>
                                    </div>
                                    <span className="text-[12px] text-[#6B7280]">{h.amount.toLocaleString()} tokens</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-white text-[15px] tabular-nums">{fmtUSD(h.price)}</p>
                                <div className={`flex items-center justify-end gap-1 text-[12px] font-semibold ${h.change24h >= 0 ? 'text-[#14F195]' : 'text-[#F87171]'}`}>
                                    {h.change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                    {pct(h.change24h)} today
                                </div>
                            </div>
                            <div className="ml-6 text-right min-w-[80px]">
                                <p className="font-bold text-white tabular-nums">{fmtUSD(h.valueUSD)}</p>
                                <p className="text-[12px] text-[#6B7280]">{h.allocation}%</p>
                            </div>
                        </div>
                    ))}
                </div>
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
                            style={{ backgroundColor: ALLOCATION_COLORS[i] }}
                        />
                    ))}
                </div>

                <div className="space-y-3">
                    {holdings.map((h, i) => (
                        <div key={h.symbol} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[i] }} />
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
                                        style={{ backgroundColor: ALLOCATION_COLORS[i] }}
                                    />
                                </div>
                                <span className="text-[13px] font-bold text-white tabular-nums w-8 text-right">{h.allocation}%</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Value breakdown */}
                <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-2">
                    {[
                        { label: 'Spot Holdings', val: fmtUSD(holdings.reduce((s, h) => s + h.valueUSD, 0)), icon: <Wallet className="w-3.5 h-3.5 text-[#9945FF]" /> },
                        { label: 'LP Positions', val: fmtUSD(lp.reduce((s, l) => s + l.valueUSD, 0)), icon: <Layers className="w-3.5 h-3.5 text-[#14F195]" /> },
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
   SECTION 3 — Perpetual Positions
───────────────────────────────────────────────────────────── */
function PerpsSection({ perps }: { perps: PerpPosition[] }) {
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
                                    <div className="font-semibold text-white tabular-nums">${p.size.toLocaleString()}</div>
                                    <div className="text-[12px] text-[#6B7280]">@ ${p.entryPrice.toLocaleString()}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-white tabular-nums">${p.markPrice.toLocaleString()}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-[#F87171] tabular-nums">${p.liquidationPrice.toLocaleString()}</div>
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
        </GlassCard>
    );
}

/* ─────────────────────────────────────────────────────────────
   SECTION 4 — LP Positions
───────────────────────────────────────────────────────────── */
function LpSection({ lp }: { lp: LpPosition[] }) {
    const tokenIcons: Record<string, string> = {
        SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
        USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
        ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    };

    return (
        <GlassCard className="overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                <div>
                    <h3 className="text-base font-bold text-white">Liquidity Positions</h3>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">Earn fees by providing liquidity to trading pairs</p>
                </div>
                <button className="flex items-center gap-2 text-[12px] font-semibold text-[#14F195] hover:text-white transition-colors border border-[#14F195]/25 hover:border-white/20 px-3 py-1.5 rounded-lg">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
            </div>

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
                                <div className="font-bold text-[#9945FF] tabular-nums">{lpItem.apr}%</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}

/* ─────────────────────────────────────────────────────────────
   SECTION 5 — Transaction History + Related News
───────────────────────────────────────────────────────────── */
function ActivitySection({ transactions }: { transactions: Transaction[] }) {
    const [newsPage, setNewsPage] = useState(0);
    const newsPerPage = 3;
    const visibleNews = MOCK_NEWS.slice(newsPage * newsPerPage, newsPage * newsPerPage + newsPerPage);

    const TYPE_STYLES: Record<string, string> = {
        SWAP: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/25',
        PERP: 'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/25',
        LP: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/25',
        REWARD: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/25',
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transaction History */}
            <GlassCard className="overflow-hidden">
                <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
                    <h3 className="text-base font-bold text-white">Recent Activity</h3>
                    <button className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[#6B7280] hover:text-white transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>

                <div className="divide-y divide-white/[0.04]">
                    {transactions.map((tx, i) => (
                        <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.025] transition-colors">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border tracking-wider shrink-0 ${TYPE_STYLES[tx.type]}`}>
                                {tx.type}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[#D1D5DB] text-[13px] truncate">{tx.description}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-[#6B7280]">{tx.time}</span>
                                    <span className="text-[11px] text-[#4B5563]">·</span>
                                    <span className="text-[11px] font-mono text-[#4B5563]">{tx.txHash}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[13px] font-semibold text-white">{tx.amount}</div>
                                <div className="text-[11px] text-[#6B7280] tabular-nums">{fmtUSD(tx.valueUSD)}</div>
                            </div>
                            <button className="text-[#4B5563] hover:text-[#9CA3AF] transition-colors shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {/* Related News */}
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
                            onClick={() => setNewsPage(p => (p + 1) * newsPerPage < MOCK_NEWS.length ? p + 1 : p)}
                            disabled={(newsPage + 1) * newsPerPage >= MOCK_NEWS.length}
                            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[#6B7280] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

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
                                    <span>{article.time}</span>
                                </div>
                                <p className="font-semibold text-[13px] text-[#D1D5DB] leading-snug mb-3 line-clamp-2 group-hover:text-white transition-colors">
                                    {article.title}
                                </p>
                                <a href="#" className="flex items-center text-[12px] font-semibold text-[#6B7280] hover:text-[#14F195] transition-colors">
                                    {article.source} <ArrowRight className="ml-1 w-3 h-3" />
                                </a>
                            </div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </GlassCard>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function PortfolioPage() {
    const { publicKey } = useWallet();
    const walletStr = publicKey?.toString() ?? null;

    const swrKey = walletStr ? `${CHAT_API}/api/portfolio/${walletStr}` : null;
    const { data: apiData, error: swrError, isLoading: apiLoading, mutate: refetch } = useSWR(swrKey, swrFetcher, {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    });
    const apiError = swrError ? `Backend offline or DB not running: ${swrError.message}` : null;

    // ── Derive display data from API response, falling back to mocks ──
    const holdings = useMemo<TokenHolding[]>(() => {
        // The backend doesn't return token holdings (those come from on-chain).
        // Keep mock for now; a future enhancement can merge on-chain balances.
        return MOCK_HOLDINGS;
    }, []);

    const perps = useMemo<PerpPosition[]>(() => {
        if (!apiData?.open_positions?.length) return MOCK_PERPS;
        return apiData.open_positions.map((p: any) => ({
            market: p.market ?? 'SOL/USD',
            side: (p.side ?? 'LONG').toUpperCase() as 'LONG' | 'SHORT',
            size: p.size_usd ?? 0,
            entryPrice: p.entry_price ?? 0,
            markPrice: p.entry_price ?? 0, // mark price not stored in DB; use entry as placeholder
            pnl: p.realized_pnl ?? 0,
            pnlPct: p.entry_price ? ((p.realized_pnl ?? 0) / (p.size_usd ?? 1)) * 100 : 0,
            leverage: p.leverage ?? 1,
            liquidationPrice: p.liquidation_price ?? 0,
        }));
    }, [apiData]);

    const lpPositions = useMemo<LpPosition[]>(() => {
        if (!apiData?.active_lp_positions?.length) return MOCK_LP;
        return apiData.active_lp_positions.map((lp: any) => ({
            pair: lp.pool_pair ?? '',
            tokenA: lp.token_a ?? '',
            tokenB: lp.token_b ?? '',
            valueUSD: lp.value_usd ?? 0,
            feesEarned: lp.fees_earned_usd ?? 0,
            apr: lp.apr ?? 0,
        }));
    }, [apiData]);

    const transactions = useMemo<Transaction[]>(() => {
        if (!apiData?.recent_trades?.length) return MOCK_TRANSACTIONS;
        return apiData.recent_trades.map((t: any) => ({
            type: (t.type ?? 'SWAP') as Transaction['type'],
            description: t.description ?? `${t.token_in ?? ''} → ${t.token_out ?? ''}`,
            amount: t.amount_in ? `${t.amount_in} ${t.token_in ?? ''}` : `$${t.value_usd ?? 0}`,
            valueUSD: t.value_usd ?? 0,
            time: t.created_at ? new Date(t.created_at).toLocaleString() : '—',
            status: (t.status ?? 'SUCCESS') as Transaction['status'],
            txHash: t.tx_hash ? `${String(t.tx_hash).slice(0, 4)}...${String(t.tx_hash).slice(-4)}` : '—',
        }));
    }, [apiData]);

    const isLive = !!apiData && !swrError;

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
                        {isLive && (
                            <button
                                onClick={() => refetch()}
                                className="flex items-center gap-2 text-[12px] font-semibold text-[#14F195] border border-[#14F195]/25 px-3 py-1.5 rounded-xl hover:bg-[#14F195]/5 transition-all"
                            >
                                <Activity className="w-3.5 h-3.5" /> Refresh
                            </button>
                        )}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isLive ? 'bg-[#14F195]/10 border-[#14F195]/20' : 'bg-[#F59E0B]/10 border-[#F59E0B]/20'}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${isLive ? 'bg-[#14F195] shadow-[0_0_8px_rgba(20,241,149,0.8)]' : 'bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`} />
                            <span className={`text-[11px] font-bold tracking-wider uppercase ${isLive ? 'text-[#14F195]' : 'text-[#F59E0B]'}`}>
                                {isLive ? 'DB Live' : apiLoading ? 'Connecting…' : 'Mock Data'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280] border border-white/10 px-3 py-1.5 rounded-full">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Non-custodial</span>
                        </div>
                    </div>
                </motion.div>

                {/* API error banner (non-blocking — still shows mock data) */}
                {apiError && publicKey && (
                    <div className="mb-4 px-4 py-3 rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/5 text-[#F59E0B] text-[12px] flex items-center gap-2">
                        <span className="font-bold">⚠ DB Warning:</span> {apiError} — showing demo data.
                    </div>
                )}

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
                                    // Trigger the wallet button in the Navbar
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
                        <OverviewSection holdings={holdings} lp={lpPositions} perps={perps} />
                        <HoldingsSection holdings={holdings} lp={lpPositions} />
                        <PerpsSection perps={perps} />
                        <LpSection lp={lpPositions} />
                        <ActivitySection transactions={transactions} />
                    </motion.div>
                )}
            </main>
        </div>
    );
}
