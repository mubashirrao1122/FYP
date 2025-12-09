'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TokenSelect } from '@/components/ui/token-select';
import { ArrowUpDown } from 'lucide-react';
import { useSwap } from '@/lib/hooks/useSwap';
import { useTokenBalance } from '@/lib/hooks/useBalance';
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

    // Fetch real-time balances
    const sellBalance = useTokenBalance(sellToken);
    const receiveBalance = useTokenBalance(sellTokenReceive);

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

    const handleSwitchTokens = () => {
        setSellToken(sellTokenReceive);
        setSellTokenReceive(sellToken);
        setSellAmount(sellEstimatedAmount);
        setSellEstimatedAmount('');
    };

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
                            <span>
                                Balance: {!publicKey ? 'Connect wallet' : sellBalance.loading ? '...' : sellBalance.balance.toFixed(4)} {sellToken}
                            </span>
                            <button
                                onClick={() => setSellAmount(sellBalance.balance.toString())}
                                disabled={!publicKey || sellBalance.loading || sellBalance.balance === 0}
                                className="text-purple-400 hover:text-purple-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

                {/* Receive Section */}
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors mb-4">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-white/40">
                            Receive
                        </label>
                        <div className="text-xs text-white/40">
                            Balance: {!publicKey ? 'Connect wallet' : receiveBalance.loading ? '...' : receiveBalance.balance.toFixed(4)} {sellTokenReceive}
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
