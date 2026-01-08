'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries } from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';

interface TradingChartProps {
    tokenPair: string;
    inputToken?: string;
    outputToken?: string;
    className?: string;
}

// Token addresses mapping (Mainnet) - In a real app, this should come from a token list
const TOKEN_ADDRESSES: Record<string, string> = {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWaJY42sPiKrraxgS5g5Pab9BbAJtPREHtVb2nNB',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'RUSH': '3jRmy5gMAQLFxb2mD3Gi4p9N9VuwLXp9toaqEhi1QSRT', // Devnet address, might fail on mainnet API
    'BONK': 'dezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

interface OHLCV {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
}

/**
 * TradingChart Component
 * Fetches and displays real-time price data using GeckoTerminal API
 */
export function TradingChart({ tokenPair, inputToken = 'SOL', outputToken = 'USDC', className }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    const [isMounted, setIsMounted] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h' | '1d'>('1h');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
    const [retryTrigger, setRetryTrigger] = useState(0); // New state to trigger re-fetch

    useEffect(() => {
        setIsMounted(true);
        if (typeof document !== 'undefined') {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
    }, []);

    useEffect(() => {
        if (!isMounted || typeof document === 'undefined') return;

        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, [isMounted]);

    // Data fetching with race condition handling
    useEffect(() => {
        if (!isMounted || !chartContainerRef.current || !inputToken || !outputToken) return;

        const abortController = new AbortController();
        let chart: IChartApi | null = null;
        let candlestickSeries: ISeriesApi<"Candlestick"> | null = null;
        let handleResize: (() => void) | null = null; // Declare handleResize here

        const initChart = async () => {
            try {
                if (!chartContainerRef.current) return;

                // Initialize Chart
                chart = createChart(chartContainerRef.current, {
                    layout: {
                        background: { type: ColorType.Solid, color: 'transparent' },
                        textColor: isDarkMode ? '#9CA3AF' : '#475569',
                    },
                    grid: {
                        vertLines: { color: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.08)' },
                        horzLines: { color: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.08)' },
                    },
                    width: chartContainerRef.current.clientWidth,
                    height: 400,
                    timeScale: {
                        timeVisible: true,
                        secondsVisible: false,
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                    },
                    rightPriceScale: {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                    },
                });

                console.log('Chart object:', chart);
                // @ts-ignore
                console.log('Available methods:', Object.keys(chart));
                console.log('Prototype methods:', Object.getPrototypeOf(chart));

                // v5 API: use addSeries with CandlestickSeries
                candlestickSeries = chart.addSeries(CandlestickSeries, {
                    upColor: '#22c55e',
                    downColor: '#ef4444',
                    borderVisible: false,
                    wickUpColor: '#22c55e',
                    wickDownColor: '#ef4444',
                });

                chartRef.current = chart;
                seriesRef.current = candlestickSeries;

                // Handle Resize
                handleResize = () => {
                    if (chartContainerRef.current && chart) {
                        chart.applyOptions({
                            width: chartContainerRef.current.clientWidth,
                        });
                    }
                };
                window.addEventListener('resize', handleResize);

                // Fetch Data
                setIsLoading(true);
                setError(null);

                const inputAddress = TOKEN_ADDRESSES[inputToken] || TOKEN_ADDRESSES['SOL'];
                const outputAddress = TOKEN_ADDRESSES[outputToken] || TOKEN_ADDRESSES['USDC'];

                // Find pool
                const poolSearchUrl = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${inputAddress}/pools?page=1`;
                const poolRes = await fetch(poolSearchUrl, { signal: abortController.signal });
                const poolData = await poolRes.json();

                if (!poolData.data || poolData.data.length === 0) {
                    throw new Error('No liquidity pool found');
                }

                const pool = poolData.data[0];
                const poolAddress = pool.attributes.address;

                if (abortController.signal.aborted) return;

                setCurrentPrice(parseFloat(pool.attributes.base_token_price_usd));
                setPriceChange24h(parseFloat(pool.attributes.price_change_percentage.h24));

                // Fetch OHLCV
                const timeframeMap = {
                    '15m': 'minute?aggregate=15',
                    '1h': 'hour?aggregate=1',
                    '4h': 'hour?aggregate=4',
                    '1d': 'day?aggregate=1',
                };

                const ohlcvUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${timeframeMap[timeframe]}&limit=100`;
                const ohlcvRes = await fetch(ohlcvUrl, { signal: abortController.signal });
                const ohlcvData = await ohlcvRes.json();

                if (!ohlcvData.data || !ohlcvData.data.attributes || !ohlcvData.data.attributes.ohlcv_list) {
                    throw new Error('Failed to load chart data');
                }

                if (abortController.signal.aborted) return;

                const formattedData: OHLCV[] = ohlcvData.data.attributes.ohlcv_list
                    .map((item: number[]) => ({
                        time: item[0] as Time,
                        open: item[1],
                        high: item[2],
                        low: item[3],
                        close: item[4],
                    }))
                    .reverse();

                if (candlestickSeries) {
                    candlestickSeries.setData(formattedData);
                    chart.timeScale().fitContent();
                }

            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error("Chart error:", err);
                setError(err.message || "Failed to load chart");
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        initChart();

        return () => {
            abortController.abort();
            if (handleResize) {
                window.removeEventListener('resize', handleResize);
            }
            if (chart) {
                chart.remove();
            }
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, [isMounted, isDarkMode, inputToken, outputToken, timeframe, retryTrigger]); // Added retryTrigger to dependencies

    if (!isMounted) return null;

    return (
        <div className={cn("w-full bg-white dark:bg-[#121826] rounded-2xl border border-[#E2E8F0] dark:border-white/10 p-6 relative transition-colors duration-200", className)}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">{inputToken}/{outputToken}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F1F5F9] dark:bg-[#161C2D] text-[#475569] dark:text-[#9CA3AF] uppercase">
                            Live · Solana
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        {currentPrice ? (
                            <>
                                <span className="text-2xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                                    ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                </span>
                                {priceChange24h !== null && (
                                    <span className={cn(
                                        "text-sm font-medium px-2 py-0.5 rounded",
                                        priceChange24h >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                    )}>
                                        {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                                    </span>
                                )}
                            </>
                        ) : (
                            <div className="h-8 w-32 bg-[#F1F5F9] dark:bg-[#161C2D] rounded animate-pulse" />
                        )}
                    </div>
                </div>

                {/* Timeframe Selector */}
                <div className="flex bg-[#F1F5F9] dark:bg-[#161C2D] rounded-lg p-1 gap-1">
                    {(['15m', '1h', '4h', '1d'] as const).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                                timeframe === tf
                                    ? "bg-[#8B5CF6] text-white"
                                    : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-white hover:bg-white dark:hover:bg-[#0B0E14]"
                            )}
                        >
                            {tf.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Area */}
            <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-white/10 bg-[#F1F5F9] dark:bg-[#161C2D] transition-colors duration-200">
                <div ref={chartContainerRef} className="w-full h-full" />

                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#F1F5F9]/70 dark:bg-[#0B0E14]/70 backdrop-blur-sm z-10">
                        <Loader2 className="h-8 w-8 text-[#8B5CF6] animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F1F5F9]/70 dark:bg-[#0B0E14]/70 backdrop-blur-sm z-10 p-4 text-center">
                        <p className="text-red-500 mb-2">{error}</p>
                        <button
                            onClick={() => setRetryTrigger(prev => prev + 1)}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#121826] hover:bg-[#F1F5F9] dark:hover:bg-[#161C2D] rounded-lg text-sm text-[#0F172A] dark:text-[#E5E7EB] transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Retry
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
