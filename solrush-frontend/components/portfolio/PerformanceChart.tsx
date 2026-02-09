'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

export function PerformanceChart() {
    const [timeframe, setTimeframe] = useState('7d');

    // Mock data - in real implementation, this would come from historical data
    const mockPerformance = [
        { date: '2024-02-03', value: 9500 },
        { date: '2024-02-04', value: 9800 },
        { date: '2024-02-05', value: 9600 },
        { date: '2024-02-06', value: 10200 },
        { date: '2024-02-07', value: 10100 },
        { date: '2024-02-08', value: 10500 },
        { date: '2024-02-09', value: 10300 },
    ];

    const maxValue = Math.max(...mockPerformance.map(p => p.value));
    const minValue = Math.min(...mockPerformance.map(p => p.value));
    const range = maxValue - minValue;

    return (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[#2DD4BF] dark:text-[#22C1AE]" />
                    <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">Portfolio Performance</h3>
                </div>
                <div className="flex items-center gap-2">
                    {['24h', '7d', '30d', 'All'].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${timeframe === tf
                                    ? 'bg-[#2DD4BF]/10 dark:bg-[#22C1AE]/10 text-[#2DD4BF] dark:text-[#22C1AE] border border-[#2DD4BF] dark:border-[#22C1AE]'
                                    : 'text-[#475569] dark:text-[#9CA3AF] hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] border border-transparent'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            {/* Simple line chart visualization */}
            <div className="relative h-48">
                <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map((i) => (
                        <line
                            key={i}
                            x1="0"
                            y1={i * 50}
                            x2="600"
                            y2={i * 50}
                            stroke="currentColor"
                            strokeWidth="0.5"
                            className="text-[#E2E8F0] dark:text-[#1F2937]"
                        />
                    ))}

                    {/* Line path */}
                    <polyline
                        points={mockPerformance
                            .map((point, index) => {
                                const x = (index / (mockPerformance.length - 1)) * 600;
                                const y = 200 - ((point.value - minValue) / range) * 180 - 10;
                                return `${x},${y}`;
                            })
                            .join(' ')}
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="2"
                        className="drop-shadow-sm"
                    />

                    {/* Gradient fill */}
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#2DD4BF" />
                            <stop offset="100%" stopColor="#22C1AE" />
                        </linearGradient>
                    </defs>

                    {/* Data points */}
                    {mockPerformance.map((point, index) => {
                        const x = (index / (mockPerformance.length - 1)) * 600;
                        const y = 200 - ((point.value - minValue) / range) * 180 - 10;
                        return (
                            <circle
                                key={index}
                                cx={x}
                                cy={y}
                                r="3"
                                fill="#2DD4BF"
                                className="drop-shadow-sm"
                            />
                        );
                    })}
                </svg>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-[#475569] dark:text-[#9CA3AF] pr-2">
                    <span>${(maxValue / 1000).toFixed(1)}k</span>
                    <span>${(minValue / 1000).toFixed(1)}k</span>
                </div>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between mt-2 text-xs text-[#475569] dark:text-[#9CA3AF]">
                {mockPerformance.map((point, index) => {
                    if (index % 2 === 0 || index === mockPerformance.length - 1) {
                        return (
                            <span key={index}>
                                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        );
                    }
                    return <span key={index} />;
                })}
            </div>

            <div className="mt-4 pt-4 border-t border-[#E2E8F0] dark:border-[#1F2937]">
                <div className="text-sm text-[#475569] dark:text-[#9CA3AF]">
                    <span className="text-[#22C55E] font-medium">+8.42%</span> in the last 7 days
                </div>
            </div>
        </div>
    );
}
