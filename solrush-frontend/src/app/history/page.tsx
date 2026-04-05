'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeftRight, TrendingUp, TrendingDown, Layers,
    Zap, ExternalLink, RefreshCw, Wallet, Clock,
    ChevronDown, Filter, BarChart3, DollarSign, Receipt, Activity,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { HealthStatCard } from '@/components/ui/health-stat-card';

const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://127.0.0.1:8001';

type Trade = {
    id: string;
    type: string;
    token_in: string | null;
    token_out: string | null;
    amount_in: number | null;
    amount_out: number | null;
    value_usd: number | null;
    fee_usd: number | null;
    description: string | null;
    tx_hash: string | null;
    status: string;
    created_at: string;
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
    SWAP:       { label: 'Swap',       icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
    PERP_OPEN:  { label: 'Perp Open',  icon: <TrendingUp className="w-3.5 h-3.5" />   },
    PERP_CLOSE: { label: 'Perp Close', icon: <TrendingDown className="w-3.5 h-3.5" />  },
    LP_ADD:     { label: 'LP Add',     icon: <Layers className="w-3.5 h-3.5" />        },
    LP_REMOVE:  { label: 'LP Remove',  icon: <Layers className="w-3.5 h-3.5" />        },
    REWARD:     { label: 'Reward',     icon: <Zap className="w-3.5 h-3.5" />           },
};

function fmtUSD(n: number | null): string {
    if (n == null) return '—';
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function HistoryPage() {
    const { publicKey } = useWallet();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('ALL');

    const fetchHistory = async (wallet: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${CHAT_API}/api/history/${wallet}?limit=100`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setTrades(data.trades || []);
        } catch (e: any) {
            setError(`Could not load history: ${e.message}. Make sure the backend is running.`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (publicKey) fetchHistory(publicKey.toString());
    }, [publicKey]);

    const filtered = filter === 'ALL' ? trades : trades.filter(t => t.type === filter);
    const allTypes = ['ALL', ...Array.from(new Set(trades.map(t => t.type)))];

    /* ── Derived stats for cards ───────────────────────────── */
    const totalVolume = useMemo(() => trades.reduce((s, t) => s + (t.value_usd || 0), 0), [trades]);
    const totalFees = useMemo(() => trades.reduce((s, t) => s + (t.fee_usd || 0), 0), [trades]);

    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        trades.forEach(t => { counts[t.type] = (counts[t.type] || 0) + 1; });
        return counts;
    }, [trades]);

    const typeVolumes = useMemo(() => {
        const vols: Record<string, number> = {};
        trades.forEach(t => { vols[t.type] = (vols[t.type] || 0) + (t.value_usd || 0); });
        return vols;
    }, [trades]);

    const tradeDistribution = useMemo(() => {
        const total = trades.length || 1;
        return Object.entries(typeCounts).map(([type, count]) => ({
            label: TYPE_CONFIG[type]?.label || type,
            value: (count / total) * 100,
            tooltip: `${count} trades (${((count / total) * 100).toFixed(1)}%)`,
        }));
    }, [typeCounts, trades.length]);

    const volumeDistribution = useMemo(() => {
        const total = totalVolume || 1;
        return Object.entries(typeVolumes).map(([type, vol]) => ({
            label: TYPE_CONFIG[type]?.label || type,
            value: (vol / total) * 100,
            tooltip: `${fmtUSD(vol)} (${((vol / total) * 100).toFixed(1)}%)`,
        }));
    }, [typeVolumes, totalVolume]);

    return (
        <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
            {/* Ambient glows */}
            <div className="fixed top-0 left-[-10%] w-[40%] h-[50%] rounded-full bg-[#9945FF]/5 blur-[140px] pointer-events-none" />
            <div className="fixed bottom-0 right-[-10%] w-[35%] h-[45%] rounded-full bg-[#14F195]/5 blur-[140px] pointer-events-none" />

            <Navbar />

            <main className="relative z-10 max-w-5xl mx-auto px-5 pt-24 pb-16">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg">
                                <Clock className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-[12px] font-semibold text-[#9945FF] uppercase tracking-widest">Activity</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Transaction History</h1>
                        <p className="text-[#6B7280] text-sm mt-1.5">
                            All your swaps, perpetual trades, LP actions, and rewards on SolRush
                        </p>
                    </div>

                    {publicKey && (
                        <button
                            onClick={() => fetchHistory(publicKey.toString())}
                            className="flex items-center gap-2 text-[12px] font-semibold text-[#14F195] border border-[#14F195]/25 hover:border-[#14F195]/50 px-4 py-2 rounded-xl transition-all hover:bg-[#14F195]/5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                    )}
                </motion.div>

                {/* Not connected */}
                {!publicKey ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl border border-white/8 bg-[#0F172A]/70 backdrop-blur-md p-16 text-center"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center mx-auto mb-5 shadow-2xl">
                            <Wallet className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
                        <p className="text-[#6B7280] max-w-sm mx-auto text-sm leading-relaxed">
                            Connect your Solana wallet to view your complete transaction history on SolRush.
                        </p>
                    </motion.div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-[#F87171]/20 bg-[#F87171]/5 p-6 text-[#F87171] text-sm">{error}</div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {/* Stat cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <HealthStatCard
                                title="Trade Activity"
                                description="Breakdown by trade type"
                                icon={<Activity className="w-4 h-4" />}
                                accent="#9945FF"
                                stats={[
                                    { label: 'Total Trades', value: trades.length, icon: <BarChart3 className="w-3.5 h-3.5" /> },
                                    { label: 'Swaps', value: typeCounts['SWAP'] || 0, icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
                                    { label: 'Perps', value: (typeCounts['PERP_OPEN'] || 0) + (typeCounts['PERP_CLOSE'] || 0), icon: <TrendingUp className="w-3.5 h-3.5" /> },
                                    { label: 'LP Actions', value: (typeCounts['LP_ADD'] || 0) + (typeCounts['LP_REMOVE'] || 0), icon: <Layers className="w-3.5 h-3.5" /> },
                                ]}
                                graphData={tradeDistribution}
                            />
                            <HealthStatCard
                                title="Volume & Fees"
                                description="Financial breakdown"
                                icon={<DollarSign className="w-4 h-4" />}
                                accent="#14F195"
                                stats={[
                                    { label: 'Total Volume', value: fmtUSD(totalVolume), icon: <DollarSign className="w-3.5 h-3.5" /> },
                                    { label: 'Fees Paid', value: fmtUSD(totalFees), icon: <Receipt className="w-3.5 h-3.5" /> },
                                    { label: 'Avg Trade', value: fmtUSD(trades.length ? totalVolume / trades.length : 0), icon: <BarChart3 className="w-3.5 h-3.5" /> },
                                    { label: 'Rewards', value: typeCounts['REWARD'] || 0, icon: <Zap className="w-3.5 h-3.5" /> },
                                ]}
                                graphData={volumeDistribution}
                            />
                        </div>

                        {/* Filter pills */}
                        <div className="flex gap-2 flex-wrap mb-5">
                            {allTypes.map(type => {
                                const cfg = type === 'ALL' ? null : TYPE_CONFIG[type];
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setFilter(type)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                            filter === type
                                                ? 'bg-[#9945FF] border-[#9945FF] text-white shadow-[0_0_12px_rgba(153,69,255,0.4)]'
                                                : 'border-white/10 text-[#6B7280] hover:text-white hover:border-white/20'
                                        }`}
                                    >
                                        {cfg?.label || 'All'}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Trades table */}
                        {filtered.length === 0 ? (
                            <div className="rounded-2xl border border-white/8 bg-[#0F172A]/70 p-12 text-center text-[#6B7280]">
                                No trades found. Make your first trade on SolRush!
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/8 bg-[#0F172A]/70 backdrop-blur-md overflow-hidden">
                                <div className="divide-y divide-white/[0.04]">
                                    <AnimatePresence>
                                        {filtered.map((trade, i) => {
                                            const cfg = TYPE_CONFIG[trade.type] || TYPE_CONFIG.SWAP;
                                            return (
                                                <motion.div
                                                    key={trade.id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.025] transition-colors"
                                                >
                                                    {/* Type badge — monochrome with subtle left accent */}
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border border-white/[0.06] bg-white/[0.03] text-[#9CA3AF] tracking-wider shrink-0">
                                                        <span className="text-[#9945FF]/70">{cfg.icon}</span>
                                                        {cfg.label}
                                                    </span>

                                                    {/* Description */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-[13px] text-[#D1D5DB] truncate">
                                                            {trade.description || `${trade.token_in || ''} → ${trade.token_out || ''}`}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[11px] text-[#6B7280]">{timeAgo(trade.created_at)}</span>
                                                            {trade.tx_hash && (
                                                                <>
                                                                    <span className="text-[11px] text-[#374151]">·</span>
                                                                    <span className="text-[11px] font-mono text-[#4B5563]">{trade.tx_hash.slice(0, 8)}...{trade.tx_hash.slice(-4)}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Amount info */}
                                                    <div className="text-right shrink-0">
                                                        {trade.value_usd != null && (
                                                            <div className="text-[13px] font-bold text-white tabular-nums">{fmtUSD(trade.value_usd)}</div>
                                                        )}
                                                        {trade.fee_usd != null && trade.fee_usd > 0 && (
                                                            <div className="text-[11px] text-[#6B7280]">Fee: {fmtUSD(trade.fee_usd)}</div>
                                                        )}
                                                    </div>

                                                    {/* Status badge — subdued */}
                                                    <div className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                        trade.status === 'SUCCESS'
                                                            ? 'text-[#14F195]/80 border-[#14F195]/15 bg-[#14F195]/[0.04]'
                                                            : trade.status === 'PENDING'
                                                            ? 'text-[#6B7280] border-white/[0.06] bg-white/[0.02]'
                                                            : 'text-[#F87171]/70 border-[#F87171]/15 bg-[#F87171]/[0.04]'
                                                    }`}>
                                                        {trade.status}
                                                    </div>

                                                    {/* Explorer link */}
                                                    {trade.tx_hash && (
                                                        <a
                                                            href={`https://explorer.solana.com/tx/${trade.tx_hash}?cluster=custom&customUrl=http://localhost:8899`}
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="shrink-0 text-[#4B5563] hover:text-[#9CA3AF] transition-colors"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </main>
        </div>
    );
}
