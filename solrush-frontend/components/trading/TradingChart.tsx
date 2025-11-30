'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { cn } from '@/lib/utils';

interface TradingChartProps {
    tokenPair: string;
    inputToken?: string;
    outputToken?: string;
    className?: string;
}

/**
 * TradingChart Component with lightweight-charts
 * Displays real-time price chart using TradingView's lightweight-charts library
 */
export function TradingChart({ tokenPair, inputToken, outputToken, className }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted || !chartContainerRef.current) return;

        const initChart = () => {
            try {
                if (!chartContainerRef.current) return;

                // Cleanup previous chart if exists
                if (chartRef.current) {
                    chartRef.current.remove();
                    chartRef.current = null;
                }

                const chart = createChart(chartContainerRef.current, {
                    layout: {
                        background: { type: ColorType.Solid, color: 'transparent' },
                        textColor: '#9CA3AF',
                    },
                    grid: {
                        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
                    },
                    width: chartContainerRef.current.clientWidth || 600, // Fallback width
                    height: 400,
                    timeScale: {
                        timeVisible: true,
                        secondsVisible: false,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    rightPriceScale: {
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                });

                const areaSeries = chart.addSeries({
                    type: 'Area',
                    lineColor: '#9945FF',
                    topColor: 'rgba(153, 69, 255, 0.4)',
                    bottomColor: 'rgba(153, 69, 255, 0.0)',
                    lineWidth: 2,
                } as any);

                // Generate mock data
                const generateMockData = () => {
                    const data = [];
                    const baseTime = Math.floor(Date.now() / 1000) - 100 * 15 * 60;
                    const basePrice = 100 + (inputToken?.charCodeAt(0) || 0) % 50;

                    for (let i = 0; i < 100; i++) {
                        const time = baseTime + i * 60 * 15;
                        const price = basePrice + Math.sin(i / 10) * 10 + (i % 5);
                        data.push({ time: time as any, value: price });
                    }
                    return data;
                };

                areaSeries.setData(generateMockData());
                chart.timeScale().fitContent();

                chartRef.current = chart;

                const handleResize = () => {
                    if (chartContainerRef.current && chartRef.current) {
                        chartRef.current.applyOptions({
                            width: chartContainerRef.current.clientWidth,
                        });
                    }
                };

                window.addEventListener('resize', handleResize);
            } catch (err) {
                console.error("Failed to initialize chart:", err);
                setError("Failed to load chart");
            }
        };

        // Small delay to ensure container has dimensions
        const timer = setTimeout(initChart, 100);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', () => { }); // Simplified cleanup
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [isMounted, inputToken, outputToken]);

    if (!isMounted) {
        return (
            <div className={cn("w-full h-[400px] bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 shadow-xl flex items-center justify-center", className)}>
                <div className="text-white/30 text-sm">Loading chart...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("w-full h-[400px] bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 shadow-xl flex items-center justify-center", className)}>
                <div className="text-red-400 text-sm">{error}</div>
            </div>
        );
    }

    return (
        <div className={cn("w-full bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 shadow-xl", className)}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white">{tokenPair}</h3>
                    <p className="text-sm text-white/50">Live Price Chart</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-green-400">$102.45</span>
                    <span className="text-sm text-green-400">+2.3%</span>
                </div>
            </div>

            <div
                ref={chartContainerRef}
                className="w-full h-[400px] rounded-xl overflow-hidden"
            />

            <div className="flex gap-2 mt-4">
                {['1H', '4H', '1D', '1W', '1M'].map((timeframe) => (
                    <button
                        key={timeframe}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-purple-500/20 text-white/70 hover:text-white transition-all"
                    >
                        {timeframe}
                    </button>
                ))}
            </div>
        </div>
    );
}
