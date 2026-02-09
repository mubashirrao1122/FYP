'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';

interface DepositAmountsProps {
    tokenA: string;
    tokenB: string;
    amountA: string;
    amountB: string;
    onAmountAChange: (amount: string) => void;
    onAmountBChange: (amount: string) => void;
}

const getTokenIcon = (symbol: string) => {
    switch (symbol) {
        case 'SOL': return <SolIcon className="w-6 h-6" />;
        case 'USDC': return <UsdcIcon className="w-6 h-6" />;
        case 'USDT': return <UsdtIcon className="w-6 h-6" />;
        default: return <span className="w-6 h-6">?</span>;
    }
};

// Mock balances - in real app, fetch from blockchain
const mockBalances: Record<string, number> = {
    'SOL': 10.5,
    'USDC': 1000,
    'USDT': 500,
};

export const DepositAmounts: React.FC<DepositAmountsProps> = ({
    tokenA,
    tokenB,
    amountA,
    amountB,
    onAmountAChange,
    onAmountBChange,
}) => {
    const { connected } = useWallet();

    const balanceA = mockBalances[tokenA] || 0;
    const balanceB = mockBalances[tokenB] || 0;

    const insufficientBalanceA = parseFloat(amountA || '0') > balanceA;
    const insufficientBalanceB = parseFloat(amountB || '0') > balanceB;

    const handleMaxA = () => {
        onAmountAChange(balanceA.toString());
    };

    const handleMaxB = () => {
        onAmountBChange(balanceB.toString());
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-white mb-2">Deposit balance</h3>
                <p className="text-sm text-white/60 mb-4">
                    Specify the token amounts  for your liquidity contribution.
                </p>
            </div>

            {/* Token A Input */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">{tokenA}</label>
                    <div className="text-xs text-white/40">
                        Balance: {balanceA.toLocaleString()} {tokenA}
                    </div>
                </div>
                <div className={`relative bg-white/5 border rounded-xl transition-colors ${insufficientBalanceA
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : amountA
                            ? 'border-green-500/50 ring-2 ring-green-500/10'
                            : 'border-white/10'
                    }`}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {getTokenIcon(tokenA)}
                        <span className="font-semibold text-white">{tokenA}</span>
                    </div>
                    <input
                        type="number"
                        value={amountA}
                        onChange={(e) => onAmountAChange(e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent px-4 py-4 pl-32 pr-24 text-right text-2xl font-semibold text-white focus:outline-none"
                        step="any"
                        min="0"
                    />
                    <Button
                        onClick={handleMaxA}
                        size="sm"
                        variant="ghost"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-#2DD4BF hover:text-#22C1AE text-xs font-semibold"
                    >
                        MAX
                    </Button>
                </div>
                {insufficientBalanceA && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        Insufficient balance
                    </div>
                )}
                {amountA && !insufficientBalanceA && (
                    <div className="text-xs text-white/40 mt-2">
                        ≈ ${parseFloat(amountA).toLocaleString()}
                    </div>
                )}
            </div>

            {/* Token B Input */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">{tokenB}</label>
                    <div className="text-xs text-white/40">
                        Balance: {balanceB.toLocaleString()} {tokenB}
                    </div>
                </div>
                <div className={`relative bg-white/5 border rounded-xl transition-colors ${insufficientBalanceB
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : amountB
                            ? 'border-green-500/50 ring-2 ring-green-500/10'
                            : 'border-white/10'
                    }`}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {getTokenIcon(tokenB)}
                        <span className="font-semibold text-white">{tokenB}</span>
                    </div>
                    <input
                        type="number"
                        value={amountB}
                        onChange={(e) => onAmountBChange(e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent px-4 py-4 pl-32 pr-24 text-right text-2xl font-semibold text-white focus:outline-none"
                        step="any"
                        min="0"
                    />
                    <Button
                        onClick={handleMaxB}
                        size="sm"
                        variant="ghost"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-#2DD4BF hover:text-#22C1AE text-xs font-semibold"
                    >
                        MAX
                    </Button>
                </div>
                {insufficientBalanceB && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        Insufficient balance
                    </div>
                )}
                {amountB && !insufficientBalanceB && (
                    <div className="text-xs text-white/40 mt-2">
                        ≈ ${parseFloat(amountB).toLocaleString()}
                    </div>
                )}
            </div>

            {/* Summary */}
            {amountA && amountB && !insufficientBalanceA && !insufficientBalanceB && (
                <div className="bg-#2DD4BF/10 border border-#2DD4BF/20 rounded-xl p-4">
                    <div className="text-sm font-semibold text-#22C1AE mb-2">Position Summary</div>
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Total deposit value</span>
                        <span className="text-white font-semibold">
                            ≈ ${(parseFloat(amountA) + parseFloat(amountB)).toLocaleString()}
                        </span>
                    </div>
                </div>
            )}

            {!connected && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-500">
                        Connect your wallet to see your balances and add liquidity
                    </div>
                </div>
            )}
        </div>
    );
};
