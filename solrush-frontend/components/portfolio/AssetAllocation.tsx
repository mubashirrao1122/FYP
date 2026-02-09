'use client';

import { useMemo } from 'react';
import type { TokenHolding, LiquidityPosition } from '@/lib/hooks/usePortfolio';
import { PieChart } from 'lucide-react';

interface AssetAllocationProps {
    holdings: TokenHolding[];
    positions: LiquidityPosition[];
}

export function AssetAllocation({ holdings, positions }: AssetAllocationProps) {
    const allocationData = useMemo(() => {
        const data: { label: string; value: number; color: string }[] = [];

        // Add token holdings
        holdings.forEach((holding, index) => {
            if (holding.usdValue > 0) {
                data.push({
                    label: holding.symbol,
                    value: holding.usdValue,
                    color: getColor(index),
                });
            }
        });

        // Add LP positions as a group
        const totalLpValue = positions.reduce((sum, p) => sum + p.usdValue, 0);
        if (totalLpValue > 0) {
            data.push({
                label: 'LP Positions',
                value: totalLpValue,
                color: '#8B5CF6',
            });
        }

        // Sort by value descending
        data.sort((a, b) => b.value - a.value);

        // Calculate percentages
        const total = data.reduce((sum, item) => sum + item.value, 0);
        return data.map(item => ({
            ...item,
            percentage: total > 0 ? (item.value / total) * 100 : 0,
        }));
    }, [holdings, positions]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    if (allocationData.length === 0) {
        return (
            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
                <div className="flex items-center gap-2 mb-4">
                    <PieChart className="h-5 w-5 text-[#2DD4BF] dark:text-[#22C1AE]" />
                    <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">Asset Allocation</h3>
                </div>
                <div className="flex items-center justify-center h-64 text-[#475569] dark:text-[#9CA3AF]">
                    No assets to display
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 shadow-sm transition-colors duration-200">
            <div className="flex items-center gap-2 mb-6">
                <PieChart className="h-5 w-5 text-[#2DD4BF] dark:text-[#22C1AE]" />
                <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">Asset Allocation</h3>
            </div>

            <div className="space-y-3">
                {allocationData.map((item, index) => (
                    <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[#475569] dark:text-[#9CA3AF]">{formatCurrency(item.value)}</span>
                                <span className="font-medium text-[#0F172A] dark:text-[#E5E7EB] w-12 text-right">
                                    {item.percentage.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-[#F1F5F9] dark:bg-[#1F2937] rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${item.percentage}%`,
                                    backgroundColor: item.color,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function getColor(index: number): string {
    const colors = [
        '#2DD4BF', // Teal
        '#3B82F6', // Blue
        '#8B5CF6', // Purple
        '#EC4899', // Pink
        '#F59E0B', // Amber
        '#10B981', // Green
        '#EF4444', // Red
        '#6366F1', // Indigo
    ];
    return colors[index % colors.length];
}
