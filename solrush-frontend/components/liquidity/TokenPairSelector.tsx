'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SolIcon, UsdcIcon, UsdtIcon, WethIcon, RushIcon } from '@/components/icons/TokenIcons';

interface TokenPairSelectorProps {
    tokenA: string;
    tokenB: string;
    onTokenAChange: (token: string) => void;
    onTokenBChange: (token: string) => void;
}

const tokens = [
    { symbol: 'SOL', name: 'Solana', icon: <SolIcon className="w-5 h-5" /> },
    { symbol: 'USDC', name: 'USD Coin', icon: <UsdcIcon className="w-5 h-5" /> },
    { symbol: 'USDT', name: 'Tether', icon: <UsdtIcon className="w-5 h-5" /> },
    { symbol: 'WETH', name: 'Wrapped ETH', icon: <WethIcon className="w-5 h-5" /> },
    { symbol: 'RUSH', name: 'Rush Token', icon: <RushIcon className="w-5 h-5" /> },
];

const getTokenIcon = (symbol: string) => {
    const token = tokens.find(t => t.symbol === symbol);
    return token?.icon || <span className="w-5 h-5 flex items-center justify-center">?</span>;
};

export const TokenPairSelector: React.FC<TokenPairSelectorProps> = ({
    tokenA,
    tokenB,
    onTokenAChange,
    onTokenBChange,
}) => {
    return (
        <div>
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB] mb-2">Select pair</h3>
            <p className="text-sm text-[#475569] dark:text-[#9CA3AF] mb-4">
                Choose the tokens you want to provide liquidity for. You can select tokens on all supported networks.
            </p>

            <div className="grid grid-cols-2 gap-3">
                {/* Token A Selector */}
                <div className="relative">
                    <select
                        value={tokenA}
                        onChange={(e) => onTokenAChange(e.target.value)}
                        className="w-full bg-[#F1F5F9] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3.5 text-transparent appearance-none cursor-pointer hover:bg-[#E2E8F0] dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                        {tokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-white dark:bg-[#121826] text-[#0F172A] dark:text-[#E5E7EB]">
                                {token.symbol}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                        <div className="flex items-center gap-2">
                            {getTokenIcon(tokenA)}
                            <span className="font-semibold text-[#0F172A] dark:text-[#E5E7EB]">{tokenA}</span>
                        </div>
                        <ChevronDown className="ml-auto w-5 h-5 text-[#94A3B8] dark:text-white/40" />
                    </div>
                </div>

                {/* Token B Selector */}
                <div className="relative">
                    <select
                        value={tokenB}
                        onChange={(e) => onTokenBChange(e.target.value)}
                        className="w-full bg-[#F1F5F9] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3.5 text-transparent appearance-none cursor-pointer hover:bg-[#E2E8F0] dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                        {tokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-white dark:bg-[#121826] text-[#0F172A] dark:text-[#E5E7EB]">
                                {token.symbol}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                        <div className="flex items-center gap-2">
                            {getTokenIcon(tokenB)}
                            <span className="font-semibold text-[#0F172A] dark:text-[#E5E7EB]">{tokenB}</span>
                        </div>
                        <ChevronDown className="ml-auto w-5 h-5 text-[#94A3B8] dark:text-white/40" />
                    </div>
                </div>
            </div>

            {tokenA === tokenB && (
                <p className="text-sm text-red-500 dark:text-red-400 mt-2">Please select different tokens</p>
            )}
        </div>
    );
};
