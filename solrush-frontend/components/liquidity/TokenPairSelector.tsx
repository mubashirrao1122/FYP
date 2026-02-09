'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';

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
];

const getTokenIcon = (symbol: string) => {
    const token = tokens.find(t => t.symbol === symbol);
    return token?.icon || <span className="w-5 h-5 flex items-center justify-center text-white">?</span>;
};

export const TokenPairSelector: React.FC<TokenPairSelectorProps> = ({
    tokenA,
    tokenB,
    onTokenAChange,
    onTokenBChange,
}) => {
    return (
        <div>
            <h3 className="text-lg font-semibold text-white mb-2">Select pair</h3>
            <p className="text-sm text-white/60 mb-4">
                Choose the tokens you want to provide liquidity for. You can select tokens on all supported networks.
            </p>

            <div className="grid grid-cols-2 gap-3">
                {/* Token A Selector */}
                <div className="relative">
                    <select
                        value={tokenA}
                        onChange={(e) => onTokenAChange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-16 text-white appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-#2DD4BF"
                    >
                        {tokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-gray-900">
                                {token.symbol}
                            </option>
                        ))}
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        {getTokenIcon(tokenA)}
                        <span className="font-semibold">{tokenA}</span>
                    </div>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                </div>

                {/* Token B Selector */}
                <div className="relative">
                    <select
                        value={tokenB}
                        onChange={(e) => onTokenBChange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-16 text-white appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-#2DD4BF"
                    >
                        {tokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-gray-900">
                                {token.symbol}
                            </option>
                        ))}
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        {getTokenIcon(tokenB)}
                        <span className="font-semibold">{tokenB}</span>
                    </div>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                </div>
            </div>

            {tokenA === tokenB && (
                <p className="text-sm text-red-400 mt-2">Please select different tokens</p>
            )}
        </div>
    );
};
