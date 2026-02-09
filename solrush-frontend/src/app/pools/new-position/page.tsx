'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Settings, RotateCcw, ArrowLeft, RefreshCw } from 'lucide-react';
import { TokenPairSelector } from '@/components/liquidity/TokenPairSelector';
import { FeeTierSelector } from '@/components/liquidity/FeeTierSelector';
import { PriceRangeControl } from '@/components/liquidity/PriceRangeControl';
import { DepositAmounts } from '@/components/liquidity/DepositAmounts';

export default function NewPositionPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 1 state
    const [tokenA, setTokenA] = useState('USDC');
    const [tokenB, setTokenB] = useState('USDT');
    const [selectedFeeTier, setSelectedFeeTier] = useState(0.3);

    // Step 2 state
    const [rangeType, setRangeType] = useState<'full' | 'custom'>('custom');
    const [minPrice, setMinPrice] = useState('0');
    const [maxPrice, setMaxPrice] = useState('∞');
    const [amountA, setAmountA] = useState('');
    const [amountB, setAmountB] = useState('');

    const handleReset = () => {
        setCurrentStep(1);
        setTokenA('USDC');
        setTokenB('USDT');
        setSelectedFeeTier(0.3);
        setRangeType('custom');
        setMinPrice('0');
        setMaxPrice('∞');
        setAmountA('');
        setAmountB('');
        setIsSubmitting(false);
    };

    const handleCreatePosition = async () => {
        setIsSubmitting(true);
        try {
            // TODO: Implement actual position creation with Anchor program
            console.log('Creating position...', {
                tokenA, tokenB, selectedFeeTier,
                rangeType, minPrice, maxPrice,
                amountA, amountB
            });

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Success - redirect to pools
            router.push('/pools');
        } catch (error) {
            console.error('Failed to create position:', error);
            setIsSubmitting(false);
        }
    };

    const canContinueStep1 = tokenA && tokenB && selectedFeeTier && tokenA !== tokenB;
    const canContinueStep2 = (rangeType === 'full' || (minPrice && maxPrice)) && amountA && amountB && !isSubmitting;

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] transition-colors duration-200">
            <Navbar />

            {/* Main Content */}
            <main className="relative z-10 max-w-4xl mx-auto px-6 pt-24 pb-12">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    onClick={() => router.push('/pools')}
                    className="mb-6 text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB]"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Pools
                </Button>

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="text-sm text-[#94A3B8] dark:text-[#6B7280] mb-1">Your positions › New position</div>
                        <h1 className="text-4xl font-semibold text-[#0F172A] dark:text-[#E5E7EB] tracking-tight">New position</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-[#475569] dark:text-[#9CA3AF] border-[#E2E8F0] dark:border-[#1F2937]"
                        >
                            v3 position
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB]"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB]"
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Step Navigation */}
                <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-2xl p-8 mb-6 shadow-sm transition-colors duration-200">
                    <div className="flex items-center gap-8 mb-8">
                        {/* Step 1 */}
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep === 1 ? 'bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A]' : 'bg-[#F1F5F9] dark:bg-[#161C2D] text-[#94A3B8] dark:text-[#6B7280]'
                                }`}>
                                1
                            </div>
                            <div>
                                <div className={`text-sm font-semibold ${currentStep === 1 ? 'text-[#0F172A] dark:text-[#E5E7EB]' : 'text-[#94A3B8] dark:text-[#6B7280]'}`}>
                                    Select token pair and fees
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="flex-1 h-px bg-[#E2E8F0] dark:bg-[#1F2937]" />

                        {/* Step 2 */}
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep === 2 ? 'bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A]' : 'bg-[#F1F5F9] dark:bg-[#161C2D] text-[#94A3B8] dark:text-[#6B7280]'
                                }`}>
                                2
                            </div>
                            <div>
                                <div className={`text-sm font-semibold ${currentStep === 2 ? 'text-[#0F172A] dark:text-[#E5E7EB]' : 'text-[#94A3B8] dark:text-[#6B7280]'}`}>
                                    Set price range and deposit amounts
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step Content */}
                    {currentStep === 1 ? (
                        <div className="space-y-6">
                            <TokenPairSelector
                                tokenA={tokenA}
                                tokenB={tokenB}
                                onTokenAChange={setTokenA}
                                onTokenBChange={setTokenB}
                            />

                            <FeeTierSelector
                                selected={selectedFeeTier}
                                onSelect={setSelectedFeeTier}
                            />

                            <Button
                                onClick={() => setCurrentStep(2)}
                                disabled={!canContinueStep1}
                                className="w-full h-14 bg-[#2DD4BF] dark:bg-[#22C1AE] hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4] text-[#0F172A] font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <PriceRangeControl
                                tokenA={tokenA}
                                tokenB={tokenB}
                                rangeType={rangeType}
                                onRangeTypeChange={setRangeType}
                                minPrice={minPrice}
                                maxPrice={maxPrice}
                                onMinPriceChange={setMinPrice}
                                onMaxPriceChange={setMaxPrice}
                            />

                            <DepositAmounts
                                tokenA={tokenA}
                                tokenB={tokenB}
                                amountA={amountA}
                                amountB={amountB}
                                onAmountAChange={setAmountA}
                                onAmountBChange={setAmountB}
                            />

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setCurrentStep(1)}
                                    variant="outline"
                                    disabled={isSubmitting}
                                    className="flex-1 h-14 text-[#0F172A] dark:text-[#E5E7EB] border-[#E2E8F0] dark:border-[#1F2937] font-medium"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleCreatePosition}
                                    disabled={!canContinueStep2}
                                    className="flex-1 h-14 bg-[#2DD4BF] dark:bg-[#22C1AE] hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4] text-[#0F172A] font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Creating Position...</>
                                    ) : (
                                        'Create Position'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats Panel */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-xl p-4 shadow-sm transition-colors duration-200">
                        <div className="text-[#94A3B8] dark:text-[#6B7280] text-sm mb-1">Total Value Locked</div>
                        <div className="text-xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">$0</div>
                    </div>
                    <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-xl p-4 shadow-sm transition-colors duration-200">
                        <div className="text-[#94A3B8] dark:text-[#6B7280] text-sm mb-1">24h Volume</div>
                        <div className="text-xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">$0</div>
                    </div>
                    <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-xl p-4 shadow-sm transition-colors duration-200">
                        <div className="text-[#94A3B8] dark:text-[#6B7280] text-sm mb-1">Active Pools</div>
                        <div className="text-xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">0</div>
                    </div>
                    <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-xl p-4 shadow-sm transition-colors duration-200">
                        <div className="text-[#94A3B8] dark:text-[#6B7280] text-sm mb-1">Average APY</div>
                        <div className="text-xl font-semibold text-[#22C55E]">0.0%</div>
                    </div>
                </div>
            </main>
        </div>
    );
}
