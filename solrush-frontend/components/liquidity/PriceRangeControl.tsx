'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';
import { Infinity } from 'lucide-react';

interface PriceRangeControlProps {
    tokenA: string;
    tokenB: string;
    rangeType: 'full' | 'custom';
    onRangeTypeChange: (type: 'full' | 'custom') => void;
    minPrice: string;
    maxPrice: string;
    onMinPriceChange: (price: string) => void;
    onMaxPriceChange: (price: string) => void;
}

const getTokenIcon = (symbol: string) => {
    switch (symbol) {
        case 'SOL': return <SolIcon className="w-5 h-5" />;
        case 'USDC': return <UsdcIcon className="w-5 h-5" />;
        case 'USDT': return <UsdtIcon className="w-5 h-5" />;
        default: return <span className="w-5 h-5">?</span>;
    }
};

const priceStrategies = [
    { label: '+/- 3 Ticks', description: 'Good for stable or low-vol pairs', min: 0.997, max: 1.003 },
    { label: '+/- 50% Wide', description: 'Good for volatile pairs', min: 0.5, max: 1.5 },
    { label: '-50% Goes Down', description: 'Supply if price goes down', min: 0, max: 1.0 },
    { label: '+100% Goes Up', description: 'Supply if price goes up', min: 1.0, max: Number.POSITIVE_INFINITY },
];

export const PriceRangeControl: React.FC<PriceRangeControlProps> = ({
    tokenA,
    tokenB,
    rangeType,
    onRangeTypeChange,
    minPrice,
    maxPrice,
    onMinPriceChange,
    onMaxPriceChange,
}) => {
    const currentPrice = 0.9979; // Mock current price

    const applyStrategy = (strategy: typeof priceStrategies[0]) => {
        onRangeTypeChange('custom');
        onMinPriceChange(strategy.min.toString());
        onMaxPriceChange(strategy.max === Number.POSITIVE_INFINITY ? '∞' : strategy.max.toString());
    };

    return (
        <div className="space-y-6">
            {/* Range Type Toggle */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-3">Set price range</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => onRangeTypeChange('full')}
                        className={`p-4 rounded-xl border text-left transition-all ${rangeType === 'full'
                            ? 'bg-white/10 border-white/30'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                    >
                        <div className="font-semibold text-white mb-1">Full range</div>
                        <div className="text-xs text-white/60">
                            Providing full liquidity for enhanced impermanent loss, market participation across all prices
                        </div>
                    </button>

                    <button
                        onClick={() => onRangeTypeChange('custom')}
                        className={`p-4 rounded-xl border text-left transition-all ${rangeType === 'custom'
                            ? 'bg-white/10 border-white/30'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                    >
                        <div className="font-semibold text-white mb-1">Custom range</div>
                        <div className="text-xs text-white/60">
                            Select a specific price range to concentrate liquidity and earn more fees
                        </div>
                    </button>
                </div>
            </div>

            {/* Current Price */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-sm text-white/60 mb-2">Current price</div>
                <div className="flex items-center gap-2 text-xl font-bold text-white">
                    {getTokenIcon(tokenA)}
                    <span>{currentPrice} {tokenA}/{tokenB}</span>
                    <span className="text-white/40 text-sm">($1.00)</span>
                </div>
            </div>

            {/* Price Strategies (only for custom range) */}
            {rangeType === 'custom' && (
                <div>
                    <div className="text-sm font-semibold text-white mb-3">Price strategies</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {priceStrategies.map((strategy) => (
                            <button
                                key={strategy.label}
                                onClick={() => applyStrategy(strategy)}
                                className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-left"
                            >
                                <div className="text-sm font-semibold text-white mb-1">{strategy.label}</div>
                                <div className="text-xs text-white/60">{strategy.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Price Range Inputs (only for custom range) */}
            {rangeType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                    {/* Min Price */}
                    <div>
                        <label className="text-sm font-semibold text-white mb-2 block">Min price</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={minPrice}
                                onChange={(e) => onMinPriceChange(e.target.value)}
                                placeholder="0"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-28 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40 pointer-events-none">
                                {tokenB}/{tokenA}
                            </div>
                        </div>
                    </div>

                    {/* Max Price */}
                    <div>
                        <label className="text-sm font-semibold text-white mb-2 block">Max price</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={maxPrice}
                                onChange={(e) => onMaxPriceChange(e.target.value)}
                                placeholder="∞"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-28 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40 pointer-events-none">
                                {tokenB}/{tokenA}
                            </div>
                            {maxPrice === '∞' && (
                                <Infinity className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Visual Price Range Indicator */}
            {rangeType === 'custom' && minPrice && maxPrice && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-sm text-white/60 mb-3">Price range visualization</div>
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-400" style={{
                            left: minPrice === '0' ? '0%' : '20%',
                            right: maxPrice === '∞' ? '0%' : '20%',
                        }} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-white/40">
                        <span>{minPrice === '0' ? 'Min' : minPrice}</span>
                        <span className="text-white">Current: {currentPrice}</span>
                        <span>{maxPrice === '∞' ? 'Max' : maxPrice}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
