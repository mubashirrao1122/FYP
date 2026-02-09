'use client';

import { useState } from 'react';
import type { TokenHolding, LiquidityPosition } from '@/lib/hooks/usePortfolio';
import { Coins, Droplets, ChevronDown, ChevronUp } from 'lucide-react';

interface AssetDetailsProps {
    tokenHoldings: TokenHolding[];
    liquidityPositions: LiquidityPosition[];
}

export function AssetDetails({ tokenHoldings, liquidityPositions }: AssetDetailsProps) {
    const [showTokens, setShowTokens] = useState(true);
    const [showLp, setShowLp] = useState(true);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatNumber = (value: number, decimals: number = 4) => {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: decimals,
        });
    };

    return (
        <div className="space-y-6">
            {/* Token Holdings */}
            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] shadow-sm transition-colors duration-200">
                <button
                    onClick={() => setShowTokens(!showTokens)}
                    className="w-full flex items-center justify-between p-6 hover:bg-[#F8FAFC] dark:hover:bg-[#111827] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Coins className="h-5 w-5 text-[#2DD4BF] dark:text-[#22C1AE]" />
                        <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Token Holdings ({tokenHoldings.length})
                        </h3>
                    </div>
                    {showTokens ? (
                        <ChevronUp className="h-5 w-5 text-[#475569] dark:text-[#9CA3AF]" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-[#475569] dark:text-[#9CA3AF]" />
                    )}
                </button>

                {showTokens && (
                    <div className="border-t border-[#E2E8F0] dark:border-[#1F2937]">
                        {tokenHoldings.length === 0 ? (
                            <div className="p-6 text-center text-[#475569] dark:text-[#9CA3AF]">
                                No token holdings
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[#E2E8F0] dark:border-[#1F2937]">
                                            <th className="text-left p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Asset</th>
                                            <th className="text-right p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Balance</th>
                                            <th className="text-right p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tokenHoldings.map((holding, index) => (
                                            <tr
                                                key={index}
                                                className="border-b border-[#E2E8F0] dark:border-[#1F2937] last:border-0 hover:bg-[#F8FAFC] dark:hover:bg-[#111827] transition-colors"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2DD4BF] to-[#22C1AE] flex items-center justify-center text-white font-semibold text-sm">
                                                            {holding.symbol.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">{holding.symbol}</div>
                                                            <div className="text-xs text-[#475569] dark:text-[#9CA3AF]">{holding.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">
                                                        {formatNumber(holding.balance, holding.decimals)}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">
                                                        {formatCurrency(holding.usdValue)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Liquidity Positions */}
            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] shadow-sm transition-colors duration-200">
                <button
                    onClick={() => setShowLp(!showLp)}
                    className="w-full flex items-center justify-between p-6 hover:bg-[#F8FAFC] dark:hover:bg-[#111827] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Droplets className="h-5 w-5 text-[#2DD4BF] dark:text-[#22C1AE]" />
                        <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Liquidity Positions ({liquidityPositions.length})
                        </h3>
                    </div>
                    {showLp ? (
                        <ChevronUp className="h-5 w-5 text-[#475569] dark:text-[#9CA3AF]" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-[#475569] dark:text-[#9CA3AF]" />
                    )}
                </button>

                {showLp && (
                    <div className="border-t border-[#E2E8F0] dark:border-[#1F2937]">
                        {liquidityPositions.length === 0 ? (
                            <div className="p-6 text-center text-[#475569] dark:text-[#9CA3AF]">
                                No liquidity positions
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[#E2E8F0] dark:border-[#1F2937]">
                                            <th className="text-left p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Pool</th>
                                            <th className="text-right p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">LP Tokens</th>
                                            <th className="text-right p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Share</th>
                                            <th className="text-right p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {liquidityPositions.map((position, index) => (
                                            <tr
                                                key={index}
                                                className="border-b border-[#E2E8F0] dark:border-[#1F2937] last:border-0 hover:bg-[#F8FAFC] dark:hover:bg-[#111827] transition-colors"
                                            >
                                                <td className="p-4">
                                                    <div className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">{position.poolName}</div>
                                                    <div className="text-xs text-[#475569] dark:text-[#9CA3AF]">
                                                        {position.tokenASymbol}/{position.tokenBSymbol}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">
                                                        {formatNumber(position.lpBalance)}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">
                                                        {position.sharePercent.toFixed(2)}%
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">
                                                        {formatCurrency(position.usdValue)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
