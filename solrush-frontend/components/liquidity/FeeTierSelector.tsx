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
        tvl: '$21.6M',
        mlv: '94.27%',
    },
    {
        fee: 0.05,
        label: '0.05%',
        description: 'Best for stable pairs',
        tvl: '$8.7M',
        mlv: '85.73%',
    },
    {
        fee: 0.3,
        label: '0.3%',
        description: 'Best for most pairs',
        tvl: '$45.5M',
        mlv: '95.7%',
    },
    {
        fee: 1.0,
        label: '1%',
        description: 'Best for exotic pairs',
        tvl: '$29.4M',
        mlv: '0.00%',
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
                    <h3 className="text-lg font-semibold text-white mb-1">Fee tier</h3>
                    <p className="text-sm text-white/60">
                        The amount earned providing liquidity. Choose an amount that suits your risk tolerance and strategy.
                        The % you will earn in fees.
                    </p>
                </div>
                {!showAll && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAll(true)}
                        className="text-white/60 hover:text-white flex items-center gap-1"
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
                        className="text-white/60 hover:text-white"
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
                                    className="bg-white/10 border border-white/20 rounded-xl p-4 cursor-pointer"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-lg font-bold text-white">{tier.label}</div>
                                        <div className="text-sm text-white/60">Selected</div>
                                    </div>
                                    <div className="text-sm text-white/60 mb-2">{tier.description}</div>
                                    <div className="flex items-center gap-4 text-xs text-white/40">
                                        <span>{tier.tvl} TVL</span>
                                        <span>{tier.mlv} MLV</span>
                                    </div>
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
                            className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-105 ${selected === tier.fee
                                    ? 'bg-white/10 border-white/30 ring-2 ring-purple-500'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                }`}
                        >
                            <div className={`text-lg font-bold mb-1 ${selected === tier.fee ? 'text-white' : 'text-white/80'
                                }`}>
                                {tier.label}
                            </div>
                            <div className="text-xs text-white/60 mb-3 min-h-[32px]">
                                {tier.description}
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-white/40">
                                    <span className="text-white/80">{tier.tvl}</span> TVL
                                </div>
                                <div className="text-xs text-white/40">
                                    <span className="text-white/80">{tier.mlv}</span> MLV
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showAll && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <p className="text-sm text-blue-300">
                        <strong>Tip:</strong> Higher fees are better for volatile pairs where arbitrageurs are more likely to trade.
                        Lower fees are better for stable pairs.
                    </p>
                </div>
            )}
        </div>
    );
};
