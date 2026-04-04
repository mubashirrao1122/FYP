'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Send, Sparkles, TrendingUp, PieChart, BarChart3,
    Loader2, AlertCircle, ArrowUpRight, ArrowDownRight,
    ChevronRight, Shield, Zap, Search,
} from 'lucide-react';


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

const SUGGESTIONS = [
    { icon: Search, label: "What's the price of SOL?", desc: 'Live market data' },
    { icon: BarChart3, label: 'Analyze BTC for me', desc: 'RSI, SMA & signals' },
    { icon: PieChart, label: 'Build me a $1000 portfolio', desc: 'Smart allocation' },
    { icon: TrendingUp, label: 'Compare ETH vs SOL', desc: 'Side-by-side analysis' },
];

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
        case 'BUY': return 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20';
        case 'WEAK BUY': return 'bg-[#14F195]/5 text-[#14F195]/70 border-[#14F195]/10';
        case 'SELL': return 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20';
        case 'WEAK SELL': return 'bg-[#F87171]/5 text-[#F87171]/70 border-[#F87171]/10';
        default: return 'bg-white/5 text-[#9CA3AF] border-white/10';
    }
}


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
            src={src}
            alt={symbol}
            width={size}
            height={size}
            className="rounded-full"
            onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
            }}
        />
    );
}

function TokenPriceCard({ data }: { data: PriceData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    const isUp = (data.price_change_24h_pct ?? 0) >= 0;
    return (
        <div className="my-3 rounded-lg border border-white/[0.06] bg-[#111827] overflow-hidden max-w-sm">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
                <TokenIcon symbol={data.token || ''} size={36} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{data.token}</span>
                        {data.market_cap_rank && (
                            <span className="text-[10px] text-[#6B7280] bg-white/5 px-1.5 py-0.5 rounded">#{data.market_cap_rank}</span>
                        )}
                    </div>
                    <span className="text-xs text-[#6B7280]">{data.name}</span>
                </div>
                <div className="text-right">
                    <div className="text-lg font-semibold text-white tabular-nums">{fmt(data.current_price)}</div>
                    <div className={`flex items-center justify-end gap-0.5 text-xs font-medium ${pctCls(data.price_change_24h_pct)}`}>
                        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {pct(data.price_change_24h_pct)}
                    </div>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                <StatCell label="7d" value={pct(data.price_change_7d_pct)} className={pctCls(data.price_change_7d_pct)} />
                <StatCell label="Mkt Cap" value={fmt(data.market_cap)} />
                <StatCell label="Vol 24h" value={fmt(data.total_volume_24h)} />
            </div>

            <DataSource source={data.source} />
        </div>
    );
}


function AnalysisCard({ data }: { data: AnalysisData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    const ind = data.indicators;
    const an = data.analysis;

    return (
        <div className="my-3 rounded-lg border border-white/[0.06] bg-[#111827] overflow-hidden max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <TokenIcon symbol={data.token || ''} size={36} />
                    <div>
                        <div className="text-sm font-semibold text-white">{data.token} Analysis</div>
                        <div className="text-xs text-[#6B7280]">{fmt(data.current_price)}</div>
                    </div>
                </div>
                <span className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${signalStyle(an?.signal)}`}>
                    {an?.signal}
                </span>
            </div>

            {/* Indicators */}
            <div className="grid grid-cols-3 gap-px bg-white/[0.03]">
                <IndicatorCell label="RSI (14)" value={ind?.rsi_14?.toFixed(1) ?? '—'}
                    tag={ind?.rsi_14 != null ? (ind.rsi_14 > 70 ? 'Overbought' : ind.rsi_14 < 30 ? 'Oversold' : '') : ''} />
                <IndicatorCell label="SMA 7d" value={ind?.sma_7 ? fmt(ind.sma_7) : '—'} />
                <IndicatorCell label="SMA 30d" value={ind?.sma_30 ? fmt(ind.sma_30) : '—'} />
                <IndicatorCell label="Volatility" value={ind?.volatility_pct != null ? `${ind.volatility_pct}%` : '—'} />
                <IndicatorCell label="Support" value={ind?.support ? fmt(ind.support) : '—'} />
                <IndicatorCell label="Resistance" value={ind?.resistance ? fmt(ind.resistance) : '—'} />
            </div>

            {/* Reasoning */}
            {an?.reasoning && an.reasoning.length > 0 && (
                <div className="p-4 space-y-1.5 border-t border-white/[0.06]">
                    {an.reasoning.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-[#9CA3AF]">
                            <ChevronRight className="w-3 h-3 mt-0.5 text-[#9945FF] shrink-0" />
                            <span>{r}</span>
                        </div>
                    ))}
                </div>
            )}

            <DataSource source={data.source} />
        </div>
    );
}


function PortfolioCard({ data }: { data: PortfolioData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    return (
        <div className="my-3 rounded-lg border border-white/[0.06] bg-[#111827] overflow-hidden max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <div>
                    <div className="text-sm font-semibold text-white">Portfolio Recommendation</div>
                    <div className="text-xs text-[#6B7280] capitalize">{data.risk_tolerance} risk • {fmt(data.total_investment)}</div>
                </div>
                <PieChart className="w-5 h-5 text-[#9945FF]" />
            </div>

            {/* Allocations */}
            <div className="divide-y divide-white/[0.04]">
                {data.allocations?.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors">
                        <TokenIcon symbol={a.token} size={28} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{a.token}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${signalStyle(a.signal)}`}>{a.signal}</span>
                            </div>
                            <span className="text-[11px] text-[#6B7280] truncate block">{a.name}</span>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-semibold text-white tabular-nums">{a.allocation_pct}%</div>
                            <div className="text-[11px] text-[#6B7280] tabular-nums">{fmt(a.usd_amount)}</div>
                        </div>
                        {/* Allocation bar */}
                        <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195]"
                                style={{ width: `${a.allocation_pct}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Risk note */}
            {data.risk_assessment && (
                <div className="p-3 border-t border-white/[0.06] flex items-start gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#9945FF] mt-0.5 shrink-0" />
                    <span className="text-[11px] text-[#6B7280] leading-relaxed">{data.risk_assessment}</span>
                </div>
            )}

            <DataSource source={data.source} />
        </div>
    );
}



function PriceHistoryCard({ data }: { data: PriceHistoryData }) {
    if (data.error) return <ErrorCard message={data.error} />;
    const s = data.summary;
    return (
        <div className="my-3 rounded-lg border border-white/[0.06] bg-[#111827] overflow-hidden max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <TokenIcon symbol={data.token || ''} size={28} />
                    <div className="text-sm font-semibold text-white">{data.token} — {data.days}d</div>
                </div>
                <div className={`text-sm font-semibold ${pctCls(s?.change_pct)}`}>{pct(s?.change_pct)}</div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/[0.03]">
                <StatCell label="Open" value={fmt(s?.start_price)} />
                <StatCell label="Close" value={fmt(s?.end_price)} />
                <StatCell label="High" value={fmt(s?.high)} />
                <StatCell label="Low" value={fmt(s?.low)} />
            </div>
            <DataSource source={data.source} />
        </div>
    );
}



function StatCell({ label, value, className = 'text-white' }: { label: string; value: string; className?: string }) {
    return (
        <div className="p-3 bg-[#111827]">
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">{label}</div>
            <div className={`text-xs font-medium tabular-nums ${className}`}>{value}</div>
        </div>
    );
}

function IndicatorCell({ label, value, tag }: { label: string; value: string; tag?: string }) {
    return (
        <div className="p-3 bg-[#111827]">
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">{label}</div>
            <div className="text-xs font-medium text-white tabular-nums">{value}</div>
            {tag && <div className="text-[9px] text-[#FBBF24] mt-0.5">{tag}</div>}
        </div>
    );
}

function DataSource({ source }: { source?: string }) {
    if (!source) return null;
    return (
        <div className="px-3 py-2 border-t border-white/[0.04] flex items-center gap-1.5">
            <Zap className="w-2.5 h-2.5 text-[#14F195]" />
            <span className="text-[10px] text-[#4B5563]">{source}</span>
        </div>
    );
}

function ErrorCard({ message }: { message: string }) {
    return (
        <div className="my-3 rounded-lg border border-[#F87171]/20 bg-[#F87171]/5 p-3 max-w-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#F87171] mt-0.5 shrink-0" />
            <p className="text-xs text-[#FCA5A5]">{message}</p>
        </div>
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
        <div className="flex items-center gap-1.5 px-3 py-2">
            {[0, 1, 2].map(i => (
                <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#9945FF]"
                    style={{
                        animation: 'pulse 1.4s ease-in-out infinite',
                        animationDelay: `${i * 0.2}s`,
                    }}
                />
            ))}
        </div>
    );
}

function ToolActivity({ toolName }: { toolName: string }) {
    const labels: Record<string, string> = {
        get_token_price: 'Fetching live market data',
        get_price_history: 'Loading price history',
        analyze_token: 'Running technical analysis',
        suggest_portfolio: 'Building portfolio',
    };
    return (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#9CA3AF]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9945FF]" />
            <span>{labels[toolName] || `Processing...`}</span>
        </div>
    );
}


function renderMD(text: string): React.ReactNode {
    const lines = text.split('\n');
    return lines.map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="text-sm font-semibold text-white mt-3 mb-1">{line.slice(4)}</h4>;
        if (line.startsWith('## ')) return <h3 key={i} className="text-[15px] font-semibold text-white mt-4 mb-1">{line.slice(3)}</h3>;
        if (line.startsWith('# ')) return <h2 key={i} className="text-base font-semibold text-white mt-4 mb-2">{line.slice(2)}</h2>;
        if (line.startsWith('- ') || line.startsWith('* '))
            return <div key={i} className="flex items-start gap-2 ml-1"><span className="text-[#9945FF] mt-1">▸</span><span>{inlineMD(line.slice(2))}</span></div>;
        if (line.trim() === '') return <div key={i} className="h-1.5" />;
        return <p key={i} className="leading-[1.7]">{inlineMD(line)}</p>;
    });
}

function inlineMD(text: string): React.ReactNode {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        return part.split(/(`[^`]+`)/g).map((cp, j) => {
            if (cp.startsWith('`') && cp.endsWith('`'))
                return <code key={`${i}-${j}`} className="px-1 py-0.5 rounded bg-[#1F2937] text-[#14F195] text-[12px] font-mono">{cp.slice(1, -1)}</code>;
            return <span key={`${i}-${j}`}>{cp}</span>;
        });
    });
}


function ChatBubble({ message }: { message: Message }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-md shrink-0 mt-1 flex items-center justify-center ${isUser
                ? 'bg-[#1F2937] border border-white/10'
                : 'solana-gradient'
                }`}>
                {isUser
                    ? <span className="text-[10px] font-bold text-white/60">You</span>
                    : <Sparkles className="w-3.5 h-3.5 text-white" />
                }
            </div>

            {/* Content */}
            <div className={`min-w-0 ${isUser ? 'text-right' : ''}`}>
                <div className={`inline-block rounded-lg px-4 py-2.5 text-[13px] ${isUser
                    ? 'bg-[#1F2937] text-white border border-white/[0.06] text-left'
                    : 'text-[#D1D5DB] text-left'
                    }`}>
                    {isUser ? (
                        <p>{message.content}</p>
                    ) : (
                        <>
                            {message.toolCalls?.map((tc, i) => <ToolOutput key={i} toolCall={tc} />)}
                            {message.content && renderMD(message.content)}
                            {message.isStreaming && (
                                <span className="inline-block w-[2px] h-3.5 bg-[#14F195] ml-0.5 animate-pulse" />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   MAIN CHAT PAGE
   ═══════════════════════════════════════════════════════ */

const API_BASE = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:8000';

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);
    useEffect(() => { scroll(); }, [messages, scroll]);

    /* ── send message ── */
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
                    ? { ...m, content: `Failed to connect to AI backend at ${API_BASE}.\n\nMake sure the Python server is running:\n\`cd solrush-chatbot && source venv/bin/activate && python main.py\`\n\nError: ${err instanceof Error ? err.message : 'Unknown'}`, isStreaming: false }
                    : m
            ));
        } finally {
            setIsLoading(false);
            setActiveTool(null);
        }
    }, [isLoading, messages]);

    const empty = messages.length === 0;

    return (
        <div className="flex flex-col h-screen bg-[#0B1220]">
            {/* ── Top bar ── */}
            <header className="h-14 border-b border-white/[0.06] bg-[#0B1220] flex items-center px-5 gap-3 shrink-0">
                <div className="w-8 h-8 rounded-lg solana-gradient flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                    <h1 className="text-sm font-semibold text-white leading-none">SolRush AI</h1>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">Investment advisor • Real-time data</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#14F195]" />
                    <span className="text-[11px] text-[#14F195] font-medium">Live</span>
                </div>
            </header>

            {/* ── Message area ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6">
                <div className="max-w-3xl mx-auto space-y-5">
                    {/* Empty state */}
                    {empty && (
                        <div className="flex flex-col items-center pt-[12vh]">
                            <div className="w-16 h-16 rounded-xl solana-gradient flex items-center justify-center mb-5">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-1">SolRush AI Assistant</h2>
                            <p className="text-sm text-[#6B7280] text-center max-w-sm mb-8">
                                Real-time token analysis, portfolio advice, and market intelligence powered by AI.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                                {SUGGESTIONS.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => send(s.label)}
                                        className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#111827] hover:bg-[#1F2937] px-4 py-3 text-left transition-colors"
                                    >
                                        <s.icon className="w-4 h-4 text-[#9945FF] shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-[13px] text-[#D1D5DB] group-hover:text-white transition-colors truncate">{s.label}</div>
                                            <div className="text-[10px] text-[#4B5563]">{s.desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    {messages.map(m => <ChatBubble key={m.id} message={m} />)}

                    {/* Activity indicators */}
                    {isLoading && activeTool && <ToolActivity toolName={activeTool} />}
                    {isLoading && !activeTool && messages[messages.length - 1]?.content === '' && <TypingDots />}

                    <div ref={endRef} />
                </div>
            </div>

            {/* ── Input bar ── */}
            <div className="border-t border-white/[0.06] bg-[#0B1220] px-5 py-3 shrink-0">
                <form onSubmit={e => { e.preventDefault(); send(input); }} className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111827] focus-within:border-[#9945FF]/40 transition-colors px-3 py-2">
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Ask about prices, analysis, portfolio..."
                            className="flex-1 bg-transparent text-sm text-white placeholder-[#4B5563] outline-none"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="w-8 h-8 rounded-md solana-gradient flex items-center justify-center shrink-0 disabled:opacity-20 transition-opacity"
                        >
                            {isLoading
                                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                : <Send className="w-3.5 h-3.5 text-white" />
                            }
                        </button>
                    </div>
                    <p className="text-[10px] text-[#374151] text-center mt-1.5">
                        Real-time market data • Not financial advice • DYOR
                    </p>
                </form>
            </div>
        </div>
    );
}
