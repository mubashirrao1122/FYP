'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TokenSelect } from '@/components/ui/token-select';
import { useSwap } from '@/lib/hooks/useSwap';
import { useToast } from '@/components/ui/use-toast';

interface BuyTabProps {
    slippageTolerance: number;
    onTokenChange?: (inputToken: string, outputToken: string) => void;
}

export function BuyTab({ slippageTolerance, onTokenChange }: BuyTabProps) {
    const { publicKey } = useWallet();
    const { toast } = useToast();
    const { calculateQuote, executeSwap, loading } = useSwap();

    const [buyAmount, setBuyAmount] = useState('');
    const [buyTokenSpend, setBuyTokenSpend] = useState('USDC');
    const [buyTokenReceive, setBuyTokenReceive] = useState('SOL');
    const [buyEstimatedAmount, setBuyEstimatedAmount] = useState('');

    useEffect(() => {
        onTokenChange?.(buyTokenSpend, buyTokenReceive);
    }, [buyTokenSpend, buyTokenReceive, onTokenChange]);

    useEffect(() => {
        if (buyAmount && parseFloat(buyAmount) > 0) {
            try {
                const quote = calculateQuote(
                    parseFloat(buyAmount),
                    buyTokenSpend,
                    buyTokenReceive,
                    slippageTolerance
                );
                setBuyEstimatedAmount(quote.outputAmount.toFixed(6));
            } catch (error) {
                console.error('Buy quote error:', error);
            }
        } else {
            setBuyEstimatedAmount('');
        }
    }, [buyAmount, buyTokenSpend, buyTokenReceive, slippageTolerance, calculateQuote]);

    const handleBuy = async () => {
        if (!publicKey) {
            toast({
                title: 'Wallet Not Connected',
                description: 'Please connect your wallet to continue.',
            });
            return;
        }

        try {
            const quote = calculateQuote(
                parseFloat(buyAmount),
                buyTokenSpend,
                buyTokenReceive,
                slippageTolerance
            );

            const signature = await executeSwap({
                inputToken: buyTokenSpend,
                outputToken: buyTokenReceive,
                inputAmount: parseFloat(buyAmount),
                minOutputAmount: quote.minReceived,
            });

            toast({
                title: 'Purchase Successful!',
                description: `Bought ${buyEstimatedAmount} ${buyTokenReceive} for ${buyAmount} ${buyTokenSpend}. TX: ${signature.slice(0, 8)}...`,
            });

            setBuyAmount('');
            setBuyEstimatedAmount('');
        } catch (error: any) {
            toast({
                title: 'Purchase Failed',
                description: error.message || 'Transaction failed.',
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 shadow-xl">
                {/* Spend Section */}
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors mb-4">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-white/40">
                            Spend
                        </label>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                            <span>Balance: 250 {buyTokenSpend}</span>
                            <button
                                onClick={() => setBuyAmount('250')}
                                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                            >
                                Max
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={buyAmount}
                            onChange={(e) => setBuyAmount(e.target.value)}
                            className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
                        />
                        <div className="min-w-[80px]">
                            <TokenSelect
                                value={buyTokenSpend}
                                onChange={(token) => {
                                    const symbol = typeof token === 'string' ? token : token.symbol;
                                    setBuyTokenSpend(symbol);
                                }}
                                exclude={[buyTokenReceive]}
                                compact={true}
                            />
                        </div>
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center mb-4 -mt-2 relative z-10">
                    <div className="text-white/50 bg-[#1a1a2e] border border-white/10 rounded-full p-2 shadow-lg">
                        <div className="w-4 h-4 flex items-center justify-center">↓</div>
                    </div>
                </div>

                {/* Receive Section */}
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors mb-4">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-white/40">
                            Receive
                        </label>
                        <div className="text-xs text-white/40">
                            Balance: 2.5 {buyTokenReceive}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={buyEstimatedAmount}
                            readOnly
                            className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
                        />
                        <div className="min-w-[80px]">
                            <TokenSelect
                                value={buyTokenReceive}
                                onChange={(token) => {
                                    const symbol = typeof token === 'string' ? token : token.symbol;
                                    setBuyTokenReceive(symbol);
                                }}
                                exclude={[buyTokenSpend]}
                                compact={true}
                            />
                        </div>
                    </div>
                </div>

                {buyAmount && buyEstimatedAmount && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-4 text-xs text-white/40 space-y-2">
                        <div className="flex justify-between">
                            <span>Rate:</span>
                            <span className="text-white">
                                1 {buyTokenSpend} ={' '}
                                {(
                                    parseFloat(buyEstimatedAmount) / parseFloat(buyAmount)
                                ).toFixed(4)}{' '}
                                {buyTokenReceive}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Min. Received:</span>
                            <span className="text-white">
                                {(parseFloat(buyEstimatedAmount) * 0.99).toFixed(6)} {buyTokenReceive}
                            </span>
                        </div>
                    </div>
                )}

                <Button
                    onClick={handleBuy}
                    disabled={!publicKey || loading || !buyAmount}
                    className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all"
                    size="lg"
                >
                    {!publicKey ? 'Connect Wallet' : loading ? 'Buying...' : `Buy ${buyTokenReceive}`}
                </Button>
            </div>
        </div>
    );
}
