'use client';

import { useMemo } from 'react';
import type { PortfolioData } from '@/lib/hooks/usePortfolio';
import { TrendingUp, TrendingDown, Activity, Target, Award } from 'lucide-react';

interface PortfolioOverviewProps {
    portfolio: PortfolioData;
}

export function PortfolioOverview({ portfolio }: PortfolioOverviewProps) {
    const metrics = useMemo(() => {
        const totalValue = portfolio.totalValue;
        const tokenCount = portfolio.tokenHoldings.length;
        const lpCount = portfolio.liquidityPositions.length;
        const totalAssets = tokenCount + lpCount;

        // Use calculated P&L data
        const realizedPnL = portfolio.pnl.realizedPnL;
        const winRate = portfolio.pnl.winRate;
        const totalTrades = portfolio.pnl.winCount + portfolio.pnl.lossCount;

        // Find best performing asset
        const bestAsset = portfolio.tokenHoldings.reduce((best, current) => {
            return current.usdValue > (best?.usdValue || 0) ? current : best;
        }, portfolio.tokenHoldings[0]);

        return {
            totalValue,
            realizedPnL,
            winRate,
            totalAssets,
            tokenCount,
            lpCount,
            totalTrades,
            bestAsset: bestAsset?.symbol || 'N/A',
        };
    }, [portfolio]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };



    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Value & PnL */}
            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Net Worth</span>
                    <Activity className="h-4 w-4 text-[#2DD4BF] dark:text-[#22C1AE]" />
                </div>
                <div className="text-2xl font-bold text-[#0F172A] dark:text-[#E5E7EB] mb-1">
                    {formatCurrency(metrics.totalValue)}
                </div>
                <div className={`flex items-center gap-1 text-sm ${metrics.realizedPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {metrics.realizedPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{formatCurrency(metrics.realizedPnL)} (Realized PnL)</span>
                </div>
            </div>

            {/* Total Assets */}
            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Total Assets</span>
                    <Target className="h-4 w-4 text-[#2DD4BF] dark:text-[#22C1AE]" />
                </div>
                <div className="text-2xl font-bold text-[#0F172A] dark:text-[#E5E7EB] mb-1">
                    {metrics.totalAssets}
                </div>
                <div className="text-sm text-[#475569] dark:text-[#9CA3AF]">
                    {metrics.tokenCount} tokens · {metrics.lpCount} LP positions
                </div>
            </div>

            {/* Best Asset */}
            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Top Holding</span>
                    <Award className="h-4 w-4 text-[#2DD4BF] dark:text-[#22C1AE]" />
                </div>
                <div className="text-2xl font-bold text-[#0F172A] dark:text-[#E5E7EB] mb-1">
                    {metrics.bestAsset}
                </div>
                <div className="text-sm text-[#475569] dark:text-[#9CA3AF]">
                    Largest position by value
                </div>
            </div>

            {/* Trading Performance */}
            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Win Rate</span>
                    <Activity className="h-4 w-4 text-[#2DD4BF] dark:text-[#22C1AE]" />
                </div>
                <div className="text-2xl font-bold text-[#0F172A] dark:text-[#E5E7EB] mb-1">
                    {metrics.winRate.toFixed(1)}%
                </div>
                <div className="text-sm text-[#475569] dark:text-[#9CA3AF]">
                    {metrics.totalTrades} total trades
                </div>
            </div>
        </div>
    );
}
