'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TokenSelect } from '@/components/ui/token-select';
import { useSwap } from '@/lib/hooks/useSwap';
import { useToast } from '@/components/ui/use-toast';

interface SellTabProps {
    slippageTolerance: number;
    onTokenChange?: (inputToken: string, outputToken: string) => void;
}

export function SellTab({ slippageTolerance, onTokenChange }: SellTabProps) {
    const { publicKey } = useWallet();
    const { toast } = useToast();
    const { calculateQuote, executeSwap, loading } = useSwap();

    const [sellAmount, setSellAmount] = useState('');
    const [sellToken, setSellToken] = useState('SOL');
    const [sellTokenReceive, setSellTokenReceive] = useState('USDC');
    const [sellEstimatedAmount, setSellEstimatedAmount] = useState('');

    useEffect(() => {
        onTokenChange?.(sellToken, sellTokenReceive);
    }, [sellToken, sellTokenReceive, onTokenChange]);

    useEffect(() => {
        const updateQuote = async () => {
            if (sellAmount && parseFloat(sellAmount) > 0) {
                try {
                    const quote = await calculateQuote(
                        parseFloat(sellAmount),
                        sellToken,
                        sellTokenReceive,
                        slippageTolerance
                    );
                    setSellEstimatedAmount(quote.outputAmount.toFixed(6));
                } catch (error) {
                    console.error('Sell quote error:', error);
                }
            } else {
                setSellEstimatedAmount('');
            }
        };
        updateQuote();
    }, [sellAmount, sellToken, sellTokenReceive, slippageTolerance, calculateQuote]);

    const handleSell = async () => {
        if (!publicKey) {
            toast({
                title: 'Wallet Not Connected',
                description: 'Please connect your wallet to continue.',
            });
            return;
        }

        try {
            const quote = await calculateQuote(
                parseFloat(sellAmount),
                sellToken,
                sellTokenReceive,
                slippageTolerance
            );

            const signature = await executeSwap({
                inputToken: sellToken,
                outputToken: sellTokenReceive,
                inputAmount: parseFloat(sellAmount),
                minOutputAmount: quote.minReceived,
            });

            toast({
                title: 'Sale Successful!',
                description: `Sold ${sellAmount} ${sellToken} for ${sellEstimatedAmount} ${sellTokenReceive}. TX: ${signature.slice(0, 8)}...`,
            });

            setSellAmount('');
            setSellEstimatedAmount('');
        } catch (error: any) {
            toast({
                title: 'Sale Failed',
                description: error.message || 'Transaction failed.',
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 shadow-xl">
                {/* Sell Section */}
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors mb-4">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-white/40">
                            Sell
                        </label>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                            <span>Balance: 10.5 {sellToken}</span>
                            <button
                                onClick={() => setSellAmount('10.5')}
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
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
                        />
                        <div className="min-w-[80px]">
                            <TokenSelect
                                value={sellToken}
                                onChange={(token) => {
                                    const symbol = typeof token === 'string' ? token : token.symbol;
                                    setSellToken(symbol);
                                }}
                                exclude={[sellTokenReceive]}
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
                            Balance: 1000 {sellTokenReceive}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={sellEstimatedAmount}
                            readOnly
                            className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
                        />
                        <div className="min-w-[80px]">
                            <TokenSelect
                                value={sellTokenReceive}
                                onChange={(token) => {
                                    const symbol = typeof token === 'string' ? token : token.symbol;
                                    setSellTokenReceive(symbol);
                                }}
                                exclude={[sellToken]}
                                compact={true}
                            />
                        </div>
                    </div>
                </div>

                {sellAmount && sellEstimatedAmount && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-4 text-xs text-white/40 space-y-2">
                        <div className="flex justify-between">
                            <span>Rate:</span>
                            <span className="text-white">
                                1 {sellToken} ={' '}
                                {(
                                    parseFloat(sellEstimatedAmount) / parseFloat(sellAmount)
                                ).toFixed(4)}{' '}
                                {sellTokenReceive}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Min. Received:</span>
                            <span className="text-white">
                                {(parseFloat(sellEstimatedAmount) * 0.99).toFixed(6)} {sellTokenReceive}
                            </span>
                        </div>
                    </div>
                )}

                <Button
                    onClick={handleSell}
                    disabled={!publicKey || loading || !sellAmount}
                    className="w-full h-14 text-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all"
                    size="lg"
                >
                    {!publicKey ? 'Connect Wallet' : loading ? 'Selling...' : `Sell ${sellToken}`}
                </Button>
            </div>
        </div>
    );
}
