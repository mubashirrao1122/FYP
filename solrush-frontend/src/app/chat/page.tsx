'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Sparkles, TrendingUp, PieChart, BarChart3,
    Loader2, AlertCircle, ArrowUpRight, ArrowDownRight,
    ChevronRight, Shield, Zap, Search, Bot,
    Wallet, RefreshCw, Layers, BarChart2, HelpCircle,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
interface ToolCall { tool: string; output: unknown; }

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: ToolCall[];
    isStreaming?: boolean;
    timestamp?: number;
}

type PriceData = {
    token?: string; name?: string; current_price?: number;
    price_change_24h_pct?: number; price_change_7d_pct?: number;
    price_change_30d_pct?: number;
    market_cap?: number; total_volume_24h?: number;
    market_cap_rank?: number; source?: string; error?: string;
};

type AnalysisData = {
    token?: string; current_price?: number;
    indicators?: {
        rsi_14?: number; sma_7?: number; sma_30?: number;
        volatility_pct?: number; support?: number; resistance?: number;
    };
    analysis?: {
        trend?: string; signal?: string; confidence?: string;
        reasoning?: string[];
    };
    source?: string; error?: string;
};

type PortfolioData = {
    total_investment?: number; risk_tolerance?: string;
    allocations?: Array<{
        token: string; name: string; allocation_pct: number;
        usd_amount: number; current_price?: number;
        signal?: string; trend?: string; reasoning?: string;
    }>;
    risk_assessment?: string; disclaimer?: string;
    source?: string; error?: string;
};

type PriceHistoryData = {
    token?: string; days?: number;
    summary?: {
        start_price?: number; end_price?: number;
        high?: number; low?: number; change_pct?: number;
    };
    source?: string; error?: string;
};

/* ── Constants ─────────────────────────────────────────────── */
const TOKEN_ICONS: Record<string, string> = {
    SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
    AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    UNI: 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg',
    ATOM: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
    NEAR: 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
    SUI: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg',
    ARB: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
};

function getTokenIcon(symbol: string): string | null {
    return TOKEN_ICONS[symbol.toUpperCase()] || null;
}

const QUICK_ACTIONS = [
    { icon: <Search className="w-4 h-4" />, label: "SOL price", prompt: "What's the current price of SOL?" },
    { icon: <BarChart2 className="w-4 h-4" />, label: "Analyze BTC", prompt: "Analyze Bitcoin for me with technical indicators" },
    { icon: <PieChart className="w-4 h-4" />, label: "Build Portfolio", prompt: "Build me a $1000 crypto portfolio with balanced risk" },
    { icon: <Wallet className="w-4 h-4" />, label: "Connect Wallet", prompt: "How do I connect my Phantom wallet to SolRush?" },
    { icon: <RefreshCw className="w-4 h-4" />, label: "How to Swap", prompt: "How do I swap tokens on SolRush?" },
    { icon: <TrendingUp className="w-4 h-4" />, label: "Perpetual Trade", prompt: "How do I open a perpetual trade on SolRush?" },
    { icon: <Layers className="w-4 h-4" />, label: "Add Liquidity", prompt: "How do I add liquidity to a pool on SolRush?" },
    { icon: <HelpCircle className="w-4 h-4" />, label: "Check Portfolio", prompt: "How do I check my portfolio on SolRush?" },
];

/* ── Helpers ─────────────────────────────────────────────────── */
function fmt(n: number | undefined | null): string {
    if (n == null) return '—';
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    return `$${n.toFixed(4)}`;
}

function pct(n: number | undefined | null): string {
    if (n == null) return '—';
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function pctCls(n: number | undefined | null): string {
    if (n == null) return 'text-[#9CA3AF]';
    return n >= 0 ? 'text-[#14F195]' : 'text-[#F87171]';
}

function signalStyle(signal: string | undefined): string {
    switch (signal) {
        case 'BUY': return 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/30 shadow-[0_0_10px_rgba(20,241,149,0.1)]';
        case 'WEAK BUY': return 'bg-[#14F195]/5 text-[#14F195]/80 border-[#14F195]/15';
        case 'SELL': return 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/30 shadow-[0_0_10px_rgba(248,113,113,0.1)]';
        case 'WEAK SELL': return 'bg-[#F87171]/5 text-[#F87171]/80 border-[#F87171]/15';
        default: return 'bg-white/5 text-[#9CA3AF] border-white/10';
    }
}

/* ── Sub-Components ──────────────────────────────────────────── */
function TokenIcon({ symbol, size = 32 }: { symbol: string; size?: number }) {
    const src = getTokenIcon(symbol);
    if (!src) {
        return (
            <div
                className="rounded-full bg-[#1A1F2E] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/60"
                style={{ width: size, height: size }}
            >
                {symbol.slice(0, 3)}
            </div>
        );
    }
    return (
        <img
            src={src} alt={symbol} width={size} height={size}
            className="rounded-full shadow-md border border-white/5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
    );
}

function StatCell({ label, value, className = 'text-white' }: { label: string; value: string; className?: string }) {
    return (
        <div className="p-4 bg-[#0F172A]/90 hover:bg-[#1E293B]/80 transition-colors">
            <div className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wider mb-1.5">{label}</div>
            <div className={`text-[13px] font-bold tabular-nums ${className}`}>{value}</div>
        </div>
    );
}

function IndicatorCell({ label, value, tag }: { label: string; value: string; tag?: string }) {
    return (
        <div className="p-3 bg-[#0F172A]/90 hover:bg-[#1E293B]/80 transition-colors flex flex-col justify-between">
            <div className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wider mb-1.5">{label}</div>
            <div className="text-[13px] font-bold text-white tabular-nums">{value}</div>
            {tag && <div className="text-[10px] font-bold text-[#FBBF24] mt-1.5">{tag}</div>}
        </div>
    );
}

function DataSource({ source }: { source?: string }) {
    if (!source) return null;
    return (
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-2 bg-[#0B1220]/50">
            <Zap className="w-3.5 h-3.5 text-[#14F195]" />
            <span className="text-[11px] text-[#6B7280] font-medium tracking-wide">Data: {source}</span>
        </div>
    );
}

function ErrorCard({ message }: { message: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="my-3 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 backdrop-blur-md p-4 max-w-sm flex items-start gap-3"
        >
            <AlertCircle className="w-5 h-5 text-[#F87171] mt-0.5 shrink-0" />
            <p className="text-[13px] font-medium text-[#FCA5A5] leading-relaxed">{message}</p>
        </motion.div>
    );
}

function TokenPriceCard({ data }: { data: PriceData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    const isUp = (data.price_change_24h_pct ?? 0) >= 0;
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="my-4 rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-md overflow-hidden max-w-sm hover:border-white/20 transition-all duration-300 shadow-xl shadow-black/20"
        >
            <div className="flex items-center gap-3 p-4 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent">
                <div className="relative">
                    <TokenIcon symbol={data.token || ''} size={40} />
                    {isUp && <div className="absolute inset-0 rounded-full shadow-[0_0_15px_rgba(20,241,149,0.3)] pointer-events-none" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base tracking-wide">{data.token}</span>
                        {data.market_cap_rank && (
                            <span className="text-[10px] font-medium text-[#9945FF] bg-[#9945FF]/10 border border-[#9945FF]/20 px-1.5 py-0.5 rounded">
                                #{data.market_cap_rank}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-[#9CA3AF] font-medium">{data.name}</span>
                </div>
                <div className="text-right">
                    <div className="text-[1.3rem] font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70 tabular-nums">
                        {fmt(data.current_price)}
                    </div>
                    <div className={`flex items-center justify-end gap-1 text-[13px] font-semibold mt-0.5 ${pctCls(data.price_change_24h_pct)}`}>
                        {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {pct(data.price_change_24h_pct)}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/[0.06] bg-black/20">
                <StatCell label="7d Change" value={pct(data.price_change_7d_pct)} className={pctCls(data.price_change_7d_pct)} />
                <StatCell label="Market Cap" value={fmt(data.market_cap)} />
                <StatCell label="Volume 24h" value={fmt(data.total_volume_24h)} />
            </div>
            <DataSource source={data.source} />
        </motion.div>
    );
}

function AnalysisCard({ data }: { data: AnalysisData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    const ind = data.indicators;
    const an = data.analysis;
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="my-4 rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-md overflow-hidden max-w-md hover:border-white/20 transition-all duration-300 shadow-xl shadow-black/20"
        >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06] bg-gradient-to-r from-[#9945FF]/10 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                    <TokenIcon symbol={data.token || ''} size={40} />
                    <div>
                        <div className="text-base font-bold text-white tracking-wide">{data.token} Analysis</div>
                        <div className="text-xs text-[#9CA3AF] font-medium mt-0.5">{fmt(data.current_price)}</div>
                    </div>
                </div>
                <span className={`px-3 py-1.5 rounded-md text-[11px] font-bold border tracking-wider ${signalStyle(an?.signal)}`}>
                    {an?.signal}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-white/[0.03]">
                <IndicatorCell label="RSI (14)" value={ind?.rsi_14?.toFixed(1) ?? '—'}
                    tag={ind?.rsi_14 != null ? (ind.rsi_14 > 70 ? 'Overbought' : ind.rsi_14 < 30 ? 'Oversold' : '') : ''} />
                <IndicatorCell label="SMA 7d" value={ind?.sma_7 ? fmt(ind.sma_7) : '—'} />
                <IndicatorCell label="SMA 30d" value={ind?.sma_30 ? fmt(ind.sma_30) : '—'} />
                <IndicatorCell label="Volatility" value={ind?.volatility_pct != null ? `${ind.volatility_pct}%` : '—'} />
                <IndicatorCell label="Support" value={ind?.support ? fmt(ind.support) : '—'} />
                <IndicatorCell label="Resistance" value={ind?.resistance ? fmt(ind.resistance) : '—'} />
            </div>
            {an?.reasoning && an.reasoning.length > 0 && (
                <div className="p-5 space-y-2.5 border-t border-white/[0.06] bg-black/20">
                    {an.reasoning.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 text-[13px] text-[#D1D5DB] leading-relaxed">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-[#9945FF] shrink-0" />
                            <span>{r}</span>
                        </div>
                    ))}
                </div>
            )}
            <DataSource source={data.source} />
        </motion.div>
    );
}

function PortfolioCard({ data }: { data: PortfolioData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="my-4 rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-md overflow-hidden max-w-md hover:border-white/20 transition-all duration-300 shadow-xl shadow-black/20"
        >
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06] bg-gradient-to-r from-transparent via-[#9945FF]/5 to-[#14F195]/5">
                <div>
                    <div className="text-base font-bold text-white tracking-wide">AI Portfolio Builder</div>
                    <div className="text-xs text-[#9945FF] font-medium capitalize mt-1 border border-[#9945FF]/30 bg-[#9945FF]/10 inline-block px-2 py-0.5 rounded-full">{data.risk_tolerance} Risk • {fmt(data.total_investment)}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <PieChart className="w-5 h-5 text-[#14F195]" />
                </div>
            </div>
            <div className="divide-y divide-white/[0.04] bg-black/20">
                {data.allocations?.map((a, i) => (
                    <div key={i} className="flex flex-col p-4 hover:bg-white/[0.03] transition-colors gap-3">
                        <div className="flex items-center gap-3">
                            <TokenIcon symbol={a.token} size={32} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[15px] font-bold text-white">{a.token}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${signalStyle(a.signal)}`}>{a.signal}</span>
                                </div>
                                <span className="text-xs text-[#9CA3AF] truncate block">{a.name}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-[15px] font-bold text-white tabular-nums">{a.allocation_pct}%</div>
                                <div className="text-xs text-[#14F195] font-medium tabular-nums">{fmt(a.usd_amount)}</div>
                            </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] shadow-[0_0_10px_rgba(20,241,149,0.5)]"
                                style={{ width: `${a.allocation_pct}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {data.risk_assessment && (
                <div className="p-4 border-t border-white/[0.06] flex items-start gap-3 bg-[#9945FF]/5">
                    <Shield className="w-4 h-4 text-[#9945FF] mt-0.5 shrink-0" />
                    <span className="text-[12px] text-[#D1D5DB] leading-relaxed font-medium">{data.risk_assessment}</span>
                </div>
            )}
            <DataSource source={data.source} />
        </motion.div>
    );
}

function PriceHistoryCard({ data }: { data: PriceHistoryData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    const s = data.summary;
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="my-4 rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-md overflow-hidden max-w-sm hover:border-white/20 transition-all duration-300 shadow-xl shadow-black/20"
        >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06] bg-gradient-to-r from-transparent to-[#14F195]/5">
                <div className="flex items-center gap-3">
                    <TokenIcon symbol={data.token || ''} size={32} />
                    <div className="text-base font-bold text-white tracking-wide">{data.token} <span className="text-[#9CA3AF] font-normal text-sm">— {data.days}d</span></div>
                </div>
                <div className={`text-[15px] font-bold ${pctCls(s?.change_pct)}`}>{pct(s?.change_pct)}</div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/[0.03]">
                <StatCell label="Open" value={fmt(s?.start_price)} />
                <StatCell label="Close" value={fmt(s?.end_price)} />
                <StatCell label="Period High" value={fmt(s?.high)} />
                <StatCell label="Period Low" value={fmt(s?.low)} />
            </div>
            <DataSource source={data.source} />
        </motion.div>
    );
}

function ToolOutput({ toolCall }: { toolCall: ToolCall }) {
    const { tool, output } = toolCall;
    let data: Record<string, unknown>;
    try {
        data = typeof output === 'string' ? JSON.parse(output) : (output as Record<string, unknown>);
    } catch {
        return null;
    }
    switch (tool) {
        case 'get_token_price': return <TokenPriceCard data={data as unknown as PriceData} />;
        case 'analyze_token': return <AnalysisCard data={data as unknown as AnalysisData} />;
        case 'suggest_portfolio': return <PortfolioCard data={data as unknown as PortfolioData} />;
        case 'get_price_history': return <PriceHistoryCard data={data as unknown as PriceHistoryData} />;
        default: return null;
    }
}

function TypingDots() {
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 px-4 py-3 bg-[#1E293B]/50 backdrop-blur border border-white/5 rounded-2xl w-fit"
        >
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#14F195]"
                    animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
            ))}
        </motion.div>
    );
}

function ToolActivity({ toolName }: { toolName: string }) {
    const labels: Record<string, string> = {
        get_token_price: 'Fetching live market data...',
        get_price_history: 'Loading price history charts...',
        analyze_token: 'Running technical analysis...',
        suggest_portfolio: 'Building portfolio allocations...',
        get_solrush_platform_help: 'Fetching platform guide...',
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#14F195] bg-[#14F195]/10 border border-[#14F195]/20 rounded-lg w-fit mt-2"
        >
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>{labels[toolName] || 'Processing...'}</span>
        </motion.div>
    );
}

/* ── Markdown renderer ─────────────────────────────────────── */
function inlineMD(text: string): React.ReactNode {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        return part.split(/(`[^`]+`)/g).map((cp, j) => {
            if (cp.startsWith('`') && cp.endsWith('`'))
                return <code key={`${i}-${j}`} className="px-1.5 py-0.5 rounded-md bg-[#9945FF]/15 text-[#14F195] border border-[#9945FF]/30 text-[13px] font-mono">{cp.slice(1, -1)}</code>;
            return <span key={`${i}-${j}`}>{cp}</span>;
        });
    });
}

function renderMD(text: string): React.ReactNode {
    const lines = text.split('\n');
    return lines.map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="text-[15px] font-bold text-white mt-4 mb-2">{line.slice(4)}</h4>;
        if (line.startsWith('## ')) return <h3 key={i} className="text-[17px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-[#D1D5DB] mt-5 mb-2">{line.slice(3)}</h3>;
        if (line.startsWith('# ')) return <h2 key={i} className="text-[19px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[#9CA3AF] mt-6 mb-3">{line.slice(2)}</h2>;
        if (line.startsWith('- ') || line.startsWith('* '))
            return <div key={i} className="flex items-start gap-2.5 ml-1 my-1.5"><span className="text-[#14F195] mt-[3px] text-sm leading-none shrink-0">✦</span><span className="text-[#D1D5DB] leading-relaxed">{inlineMD(line.slice(2))}</span></div>;
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="leading-[1.7] text-[14px] text-[#D1D5DB] my-2">{inlineMD(line)}</p>;
    });
}

/* ── Chat Bubble ───────────────────────────────────────────── */
function ChatBubble({ message }: { message: Message }) {
    const isUser = message.role === 'user';
    return (
        <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`flex gap-4 max-w-[88%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
        >
            <div className={`w-9 h-9 rounded-xl shrink-0 mt-1 flex items-center justify-center shadow-lg ${isUser
                ? 'bg-gradient-to-br from-[#1F2937] to-[#111827] border border-white/10'
                : 'solana-gradient shadow-[0_0_15px_rgba(153,69,255,0.4)]'
                }`}>
                {isUser
                    ? <span className="text-[11px] font-bold text-white/80">You</span>
                    : <Sparkles className="w-4 h-4 text-white" />
                }
            </div>
            <div className={`min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`inline-block px-5 py-3.5 text-[14px] ${isUser
                    ? 'bg-[#1E293B]/80 backdrop-blur-md text-white border border-white/10 rounded-2xl rounded-tr-sm shadow-lg'
                    : 'text-[#D1D5DB] w-full'
                    }`}>
                    {isUser ? (
                        <p className="leading-relaxed font-medium">{message.content}</p>
                    ) : (
                        <div className="space-y-2">
                            {message.toolCalls?.map((tc, i) => <ToolOutput key={i} toolCall={tc} />)}
                            {message.content && renderMD(message.content)}
                            {message.isStreaming && (
                                <span className="inline-block w-[3px] h-4 bg-[#14F195] ml-1 align-middle animate-pulse rounded-full" />
                            )}
                        </div>
                    )}
                </div>
                {message.timestamp && (
                    <div className="text-[10px] text-[#6B7280] font-medium mt-1.5 px-1">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════════════
   MAIN CHAT PAGE — Ruixen Moon-style Immersive Layout
   ═══════════════════════════════════════════════════════ */
const API_BASE = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:8000';

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const hasMessages = messages.length > 0;

    const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);
    useEffect(() => { scroll(); }, [messages, scroll]);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = '48px';
        ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
    }, [input]);

    const send = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;
        const uid = `u-${Date.now()}`;
        const aid = `a-${Date.now()}`;

        setMessages(p => [...p, { id: uid, role: 'user', content: text.trim(), timestamp: Date.now() }]);
        setInput('');
        setIsLoading(true);
        setActiveTool(null);
        setMessages(p => [...p, { id: aid, role: 'assistant', content: '', toolCalls: [], isStreaming: true, timestamp: Date.now() }]);

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }));
            const res = await fetch(`${API_BASE}/api/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text.trim(), history }),
            });

            if (!res.ok) throw new Error(`${res.status}`);
            if (!res.body) throw new Error('No body');

            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
                    try {
                        const ev = JSON.parse(line.slice(6));
                        if (ev.type === 'token') {
                            setMessages(p => p.map(m => m.id === aid ? { ...m, content: m.content + ev.content } : m));
                        } else if (ev.type === 'tool_start') {
                            setActiveTool(ev.tool);
                        } else if (ev.type === 'tool_end') {
                            setActiveTool(null);
                            setMessages(p => p.map(m => m.id === aid ? { ...m, toolCalls: [...(m.toolCalls || []), { tool: ev.tool, output: ev.output }] } : m));
                        } else if (ev.type === 'error') {
                            setMessages(p => p.map(m => m.id === aid ? { ...m, content: ev.content, isStreaming: false } : m));
                        } else if (ev.type === 'done') {
                            setMessages(p => p.map(m => m.id === aid ? { ...m, isStreaming: false } : m));
                        }
                    } catch { /* skip */ }
                }
            }
            setMessages(p => p.map(m => m.id === aid ? { ...m, isStreaming: false } : m));
        } catch (err) {
            setMessages(p => p.map(m =>
                m.id === aid
                    ? { ...m, content: `Failed to connect to AI backend.\n\nMake sure the Python backend is running on port 8000.\n\nError: ${err instanceof Error ? err.message : 'Unknown'}`, isStreaming: false }
                    : m
            ));
        } finally {
            setIsLoading(false);
            setActiveTool(null);
        }
    }, [isLoading, messages]);

    const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
        }
    };

    return (
        <div
            className="relative w-full h-screen flex flex-col items-center overflow-hidden"
            style={{
                backgroundImage: "url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
            }}
        >
            {/* Dark overlay with Solana tint */}
            <div className="absolute inset-0 bg-[#030b1a]/75 backdrop-blur-[2px]" />
            {/* Purple/green ambient glows */}
            <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#9945FF]/8 blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#14F195]/8 blur-[150px] pointer-events-none" />

            {/* ── Hero / Empty State ── */}
            <AnimatePresence>
                {!hasMessages && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                        className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-6"
                    >
                        {/* Logo */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                            className="mb-6 relative"
                        >
                            <div className="absolute inset-0 bg-[#9945FF] blur-[40px] opacity-25 rounded-full" />
                            <div className="w-20 h-20 rounded-2xl solana-gradient flex items-center justify-center relative shadow-2xl border border-white/10">
                                <Bot className="w-10 h-10 text-white" />
                            </div>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-4xl font-bold text-white drop-shadow-sm text-center"
                        >
                            SolRush AI
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-3 text-[#9CA3AF] text-[15px] text-center max-w-md leading-relaxed"
                        >
                            Your intelligent Solana trading assistant — get prices, analysis, portfolio advice, and platform guidance.
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Conversation Area (slides in) ── */}
            <AnimatePresence>
                {hasMessages && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="relative z-10 flex-1 w-full overflow-y-auto custom-scrollbar"
                    >
                        {/* Top header bar (only visible after messages) */}
                        <div className="sticky top-0 z-20 h-14 border-b border-white/5 bg-[#030b1a]/80 backdrop-blur-xl flex items-center px-6 gap-3">
                            <div className="w-8 h-8 rounded-lg solana-gradient flex items-center justify-center shadow-lg">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white leading-none">SolRush AI Trading Desk</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
                                    <span className="text-[10px] text-[#14F195] font-semibold tracking-widest uppercase">Live</span>
                                </div>
                            </div>
                        </div>

                        <div className="max-w-4xl mx-auto space-y-6 px-5 py-8 pb-4">
                            {messages.map(m => <ChatBubble key={m.id} message={m} />)}

                            <AnimatePresence>
                                {isLoading && activeTool && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <ToolActivity toolName={activeTool} />
                                    </motion.div>
                                )}
                                {isLoading && !activeTool && messages[messages.length - 1]?.content === '' && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <TypingDots />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div ref={endRef} className="h-4" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating Input Section ── */}
            <div className={`relative z-10 w-full max-w-3xl px-5 ${hasMessages ? 'mb-4' : 'mb-[8vh]'}`}>
                {/* Input box */}
                <div className="relative group">
                    {/* Animated glow border */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-2xl opacity-20 group-focus-within:opacity-60 blur-[8px] transition-all duration-500" />

                    <div className="relative bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 focus-within:border-transparent overflow-hidden transition-all">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder={hasMessages
                                ? "Ask a follow-up question..."
                                : "Ask about prices, analysis, how to swap, perpetuals — anything on SolRush..."
                            }
                            rows={1}
                            style={{ minHeight: '48px', maxHeight: '150px', overflow: 'hidden', resize: 'none' }}
                            className="w-full px-5 py-4 bg-transparent text-white text-[14px] placeholder-[#6B7280] outline-none"
                            disabled={isLoading}
                        />

                        <div className="flex items-center justify-between px-4 pb-3">
                            <p className="text-[11px] text-[#4B5563] flex items-center gap-1.5">
                                <Shield className="w-3 h-3" /> Encrypted & Secure
                            </p>
                            <button
                                onClick={() => send(input)}
                                disabled={!input.trim() || isLoading}
                                className="w-9 h-9 rounded-xl solana-gradient flex items-center justify-center shrink-0 disabled:opacity-25 disabled:saturate-0 hover:scale-105 active:scale-95 hover:shadow-[0_0_15px_rgba(20,241,149,0.5)] transition-all duration-200"
                            >
                                {isLoading
                                    ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                                    : <Send className="w-4 h-4 text-white" />
                                }
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Actions — shown only on empty state */}
                <AnimatePresence>
                    {!hasMessages && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center justify-center flex-wrap gap-2.5 mt-5"
                        >
                            {QUICK_ACTIONS.map((action, i) => (
                                <motion.button
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + i * 0.05 }}
                                    onClick={() => send(action.prompt)}
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-[#9CA3AF] hover:text-white hover:bg-[#9945FF]/20 hover:border-[#9945FF]/40 hover:shadow-[0_0_15px_rgba(153,69,255,0.15)] px-4 py-2 text-xs font-medium transition-all duration-200"
                                >
                                    <span className="opacity-70">{action.icon}</span>
                                    {action.label}
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Hint text after messages */}
                {hasMessages && (
                    <p className="text-center text-[11px] text-[#4B5563] mt-2">
                        Press <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">Enter</kbd> to send · <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">Shift+Enter</kbd> for new line
                    </p>
                )}
            </div>
        </div>
    );
}
