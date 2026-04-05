'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeeTierSelectorProps {
    selected: number;
    onSelect: (fee: number) => void;
}

const feeTiers = [
    {
        fee: 0.01,
        label: '0.01%',
        description: 'Best for very stable pairs',
        hint: 'e.g. USDC/USDT',
    },
    {
        fee: 0.05,
        label: '0.05%',
        description: 'Best for stable pairs',
        hint: 'e.g. correlated assets',
    },
    {
        fee: 0.3,
        label: '0.3%',
        description: 'Best for most pairs',
        hint: 'Recommended default',
    },
    {
        fee: 1.0,
        label: '1%',
        description: 'Best for exotic pairs',
        hint: 'e.g. volatile tokens',
    },
];

export const FeeTierSelector: React.FC<FeeTierSelectorProps> = ({
    selected,
    onSelect,
}) => {
    const [showAll, setShowAll] = useState(true);

    return (
        <div>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB] mb-1">Fee tier</h3>
                    <p className="text-sm text-[#475569] dark:text-[#9CA3AF]">
                        The amount earned providing liquidity. Choose an amount that suits your risk tolerance and strategy.
                        The % you will earn in fees.
                    </p>
                </div>
                {!showAll && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAll(true)}
                        className="text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB] flex items-center gap-1"
                    >
                        More
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {!showAll ? (
                // Collapsed view - show only selected
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAll(true)}
                        className="text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB]"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Less
                    </Button>
                    <div className="flex-1">
                        {feeTiers
                            .filter(tier => tier.fee === selected)
                            .map(tier => (
                                <div
                                    key={tier.fee}
                                    className="bg-[#F1F5F9] dark:bg-white/10 border border-[#CBD5E1] dark:border-white/20 rounded-xl p-4 cursor-pointer"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-lg font-bold text-[#0F172A] dark:text-[#E5E7EB]">{tier.label}</div>
                                        <div className="text-sm text-[#475569] dark:text-[#9CA3AF]">Selected</div>
                                    </div>
                                    <div className="text-sm text-[#475569] dark:text-[#9CA3AF]">{tier.description}</div>
                                </div>
                            ))}
                    </div>
                </div>
            ) : (
                // Expanded view - show all tiers
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {feeTiers.map((tier) => (
                        <div
                            key={tier.fee}
                            onClick={() => {
                                onSelect(tier.fee);
                                setShowAll(false);
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${selected === tier.fee
                                    ? 'bg-[#EFF6FF] dark:bg-[#3B82F6]/10 border-[#3B82F6] ring-2 ring-[#3B82F6]'
                                    : 'bg-[#F8FAFC] dark:bg-white/5 border-[#E2E8F0] dark:border-white/10 hover:border-[#CBD5E1] dark:hover:border-white/20'
                                }`}
                        >
                            <div className={`text-lg font-bold mb-1 ${selected === tier.fee ? 'text-[#0F172A] dark:text-[#E5E7EB]' : 'text-[#334155] dark:text-white/80'
                                }`}>
                                {tier.label}
                            </div>
                            <div className="text-xs text-[#475569] dark:text-white/60 mb-3 min-h-[32px]">
                                {tier.description}
                            </div>
                            <div className="text-xs text-[#94A3B8] dark:text-white/40">
                                {tier.hint}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showAll && (
                <div className="mt-4 p-3 bg-[#EFF6FF] dark:bg-blue-500/10 border border-[#BFDBFE] dark:border-blue-500/20 rounded-xl">
                    <p className="text-sm text-[#1D4ED8] dark:text-blue-300">
                        <strong>Tip:</strong> Higher fees are better for volatile pairs where arbitrageurs are more likely to trade.
                        Lower fees are better for stable pairs.
                    </p>
                </div>
            )}
        </div>
    );
};
