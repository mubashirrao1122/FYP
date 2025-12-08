'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TokenSelect } from '@/components/ui/token-select';
import { ArrowUpDown } from 'lucide-react';
import { useSwap } from '@/lib/hooks/useSwap';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { SwapQuote } from '@/lib/types';

interface SwapTabProps {
    slippageTolerance: number;
    onTokenChange?: (inputToken: string, outputToken: string) => void;
}

export function SwapTab({ slippageTolerance, onTokenChange }: SwapTabProps) {
    const { publicKey } = useWallet();
    const { toast } = useToast();
    const { calculateQuote, executeSwap, loading } = useSwap();

    const [inputAmount, setInputAmount] = useState('');
    const [outputAmount, setOutputAmount] = useState('');
    const [inputToken, setInputToken] = useState('SOL');
    const [outputToken, setOutputToken] = useState('USDC');
    const [currentQuote, setCurrentQuote] = useState<SwapQuote | null>(null);

    useEffect(() => {
        onTokenChange?.(inputToken, outputToken);
    }, [inputToken, outputToken, onTokenChange]);

    useEffect(() => {
        const updateQuote = async () => {
            if (inputAmount && parseFloat(inputAmount) > 0) {
                try {
                    const quote = await calculateQuote(
                        parseFloat(inputAmount),
                        inputToken,
                        outputToken,
                        slippageTolerance
                    );
                    setCurrentQuote(quote);
                    setOutputAmount(quote.outputAmount.toFixed(6));
                } catch (error) {
                    console.error('Quote calculation error:', error);
                    setCurrentQuote(null);
                }
            } else {
                setOutputAmount('');
                setCurrentQuote(null);
            }
        };
        updateQuote();
    }, [inputAmount, inputToken, outputToken, slippageTolerance, calculateQuote]);

    const handleSwitchTokens = () => {
        setInputToken(outputToken);
        setOutputToken(inputToken);
        setInputAmount(outputAmount);
        setOutputAmount('');
    };

    const handleSwap = async () => {
        if (!publicKey) {
            toast({
                title: 'Wallet Not Connected',
                description: 'Please connect your wallet to continue.',
            });
            return;
        }

        if (!inputAmount || parseFloat(inputAmount) <= 0) {
            toast({
                title: 'Invalid Amount',
                description: 'Please enter a valid amount.',
            });
            return;
        }

        try {
            const quote = await calculateQuote(
                parseFloat(inputAmount),
                inputToken,
                outputToken,
                slippageTolerance
            );

            const signature = await executeSwap({
                inputToken,
                outputToken,
                inputAmount: parseFloat(inputAmount),
                minOutputAmount: quote.minReceived,
            });

            toast({
                title: 'Swap Successful!',
                description: `Swapped ${inputAmount} ${inputToken} for ${outputAmount} ${outputToken}. TX: ${signature.slice(0, 8)}...`,
            });

            setInputAmount('');
            setOutputAmount('');
        } catch (error: any) {
            toast({
                title: 'Swap Failed',
                description: error.message || 'Transaction failed. Please try again.',
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Input Section */}
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-white/40">
                        You Pay
                    </label>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                        <span>Balance: 10.5 {inputToken}</span>
                        <button
                            onClick={() => setInputAmount('10.5')}
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
                        value={inputAmount}
                        onChange={(e) => setInputAmount(e.target.value)}
                        className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
                    />
                    <div className="min-w-[80px]">
                        <TokenSelect
                            value={inputToken}
                            onChange={(token) => {
                                const symbol = typeof token === 'string' ? token : token.symbol;
                                setInputToken(symbol);
                            }}
                            exclude={[outputToken]}
                            compact={true}
                        />
                    </div>
                </div>
            </div>

            {/* Switch Button */}
            <div className="flex justify-center -my-5 z-10 relative">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSwitchTokens}
                    className="rounded-full bg-[#0a0a1a] border-4 border-[#0a0a1a] hover:bg-[#1a1a2e] hover:border-[#0a0a1a] ring-1 ring-white/10 hover:ring-purple-500/50 transition-all h-12 w-12 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] group"
                >
                    <ArrowUpDown className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
                </Button>
            </div>

            {/* Output Section */}
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-white/40">
                        You Receive
                    </label>
                    <div className="text-xs text-white/40">
                        Balance: 1000 {outputToken}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Input
                        type="number"
                        placeholder="0.0"
                        value={outputAmount}
                        readOnly
                        className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
                    />
                    <div className="min-w-[80px]">
                        <TokenSelect
                            value={outputToken}
                            onChange={(token) => {
                                const symbol = typeof token === 'string' ? token : token.symbol;
                                setOutputToken(symbol);
                            }}
                            exclude={[inputToken]}
                            compact={true}
                        />
                    </div>
                </div>
            </div>

            {/* Swap Details */}
            {inputAmount && parseFloat(inputAmount) > 0 && currentQuote && (
                <div className="space-y-1 p-3 bg-white/5 rounded-xl border border-white/10 text-sm">
                    <div className="flex justify-between">
                        <span className="text-white/40">Exchange Rate</span>
                        <span className="text-white">
                            1 {inputToken} = {currentQuote.exchangeRate.toFixed(2)} {outputToken}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-white/40">Fee (0.3%)</span>
                        <span className="text-white">
                            {currentQuote.fee.toFixed(6)} {inputToken}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-white/40">Price Impact</span>
                        <span
                            className={cn(
                                currentQuote.priceImpact > 2
                                    ? 'text-red-400'
                                    : currentQuote.priceImpact > 1
                                        ? 'text-yellow-400'
                                        : 'text-green-400'
                            )}
                        >
                            {currentQuote.priceImpact.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-white/40">Minimum Received</span>
                        <span className="text-white">
                            {currentQuote.minReceived.toFixed(6)} {outputToken}
                        </span>
                    </div>
                </div>
            )}

            {/* Swap Button */}
            <Button
                onClick={handleSwap}
                disabled={!publicKey || loading || !inputAmount}
                className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
                size="lg"
            >
                {!publicKey ? 'Connect Wallet' : loading ? 'Swapping...' : 'Swap Tokens'}
            </Button>
        </div>
    );
}
