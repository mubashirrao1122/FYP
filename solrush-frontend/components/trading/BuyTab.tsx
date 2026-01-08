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
    const [lastSignature, setLastSignature] = useState<string | null>(null);

    // Fetch real-time balances
    const spendBalance = useTokenBalance(buyTokenSpend);
    const receiveBalance = useTokenBalance(buyTokenReceive);

    useEffect(() => {
        onTokenChange?.(buyTokenSpend, buyTokenReceive);
    }, [buyTokenSpend, buyTokenReceive, onTokenChange]);

    useEffect(() => {
        const updateQuote = async () => {
            if (buyAmount && parseFloat(buyAmount) > 0) {
                try {
                    const quote = await calculateQuote(
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
        };
        updateQuote();
    }, [buyAmount, buyTokenSpend, buyTokenReceive, slippageTolerance, calculateQuote]);

    useEffect(() => {
        setLastSignature(null);
    }, [buyAmount, buyTokenSpend, buyTokenReceive]);

    const handleSwitchTokens = () => {
        setBuyTokenSpend(buyTokenReceive);
        setBuyTokenReceive(buyTokenSpend);
        setBuyAmount(buyEstimatedAmount);
        setBuyEstimatedAmount('');
    };

    const handleBuy = async () => {
        if (!publicKey) {
            toast({
                title: 'Wallet Not Connected',
                description: 'Please connect your wallet to continue.',
            });
            return;
        }

        try {
            const quote = await calculateQuote(
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
            setLastSignature(signature);

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

    const isAmountValid = buyAmount && parseFloat(buyAmount) > 0;
    const isSuccess = Boolean(lastSignature);
    const ctaLabel = !publicKey
        ? 'Connect Wallet'
        : isSuccess
            ? 'View Transaction'
            : !isAmountValid
                ? 'Enter Amount'
                : loading
                    ? 'Confirming...'
                    : 'Review Trade';

    return (
        <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-[#121826] rounded-xl border border-[#E2E8F0] dark:border-white/10 transition-colors duration-200">
                {/* Spend Section */}
                <div className="bg-[#F1F5F9] dark:bg-[#161C2D] rounded-2xl p-4 border border-[#E2E8F0] dark:border-white/10 transition-colors mb-4">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Spend
                        </label>
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8] dark:text-[#6B7280]">
                            <span>
                                Balance: {!publicKey ? 'Connect wallet' : spendBalance.loading ? '...' : spendBalance.balance.toFixed(4)} {buyTokenSpend}
                            </span>
                            <button
                                onClick={() => setBuyAmount(spendBalance.balance.toString())}
                                disabled={!publicKey || spendBalance.loading || spendBalance.balance === 0}
                                className="text-[#8B5CF6] hover:text-[#7C3AED] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="bg-transparent border-none text-3xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280] w-full text-[#0F172A] dark:text-white"
                        />
                        <div className="min-w-[88px]">
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
                    <p className="mt-2 text-xs text-[#94A3B8] dark:text-[#6B7280]">
                        Estimated · Slippage protected
                    </p>
                </div>

                {/* Switch Button */}
                <div className="flex justify-center -my-5 z-10 relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSwitchTokens}
                        className="rounded-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 hover:bg-[#F1F5F9] dark:hover:bg-[#1B2234] transition-all h-11 w-11"
                    >
                        <ArrowUpDown className="h-5 w-5 text-[#8B5CF6]" />
                    </Button>
                </div>

                {/* Receive Section */}
                <div className="bg-[#F1F5F9] dark:bg-[#161C2D] rounded-2xl p-4 border border-[#E2E8F0] dark:border-white/10 transition-colors mb-4">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Receive
                        </label>
                        <div className="text-xs text-[#94A3B8] dark:text-[#6B7280]">
                            Balance: {!publicKey ? 'Connect wallet' : receiveBalance.loading ? '...' : receiveBalance.balance.toFixed(4)} {buyTokenReceive}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={buyEstimatedAmount}
                            readOnly
                            className="bg-transparent border-none text-3xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280] w-full text-[#0F172A] dark:text-white"
                        />
                        <div className="min-w-[88px]">
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

                <div className="rounded-xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826] p-3 text-sm text-[#475569] dark:text-[#9CA3AF] space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                        <span>Best route</span>
                        <span className="text-[#0F172A] dark:text-[#E5E7EB]">SolRush Aggregator</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Est. finality</span>
                        <span className="text-[#0F172A] dark:text-[#E5E7EB]">~0.4s</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Price impact</span>
                        <span className="text-[#0F172A] dark:text-[#E5E7EB]">0.18%</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Fees</span>
                        <span className="text-[#0F172A] dark:text-[#E5E7EB]">0.30%</span>
                    </div>
                </div>

                {isAmountValid && buyEstimatedAmount && (
                    <div className="p-3 bg-white dark:bg-[#121826] rounded-xl border border-[#E2E8F0] dark:border-white/10 mb-4 text-sm text-[#475569] dark:text-[#9CA3AF] space-y-2">
                        <div className="flex justify-between">
                            <span>Rate</span>
                            <span className="text-[#0F172A] dark:text-[#E5E7EB]">
                                1 {buyTokenSpend} ={' '}
                                {(
                                    parseFloat(buyEstimatedAmount) / parseFloat(buyAmount)
                                ).toFixed(4)}{' '}
                                {buyTokenReceive}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Min. Received</span>
                            <span className="text-[#0F172A] dark:text-[#E5E7EB]">
                                {(parseFloat(buyEstimatedAmount) * 0.99).toFixed(6)} {buyTokenReceive}
                            </span>
                        </div>
                    </div>
                )}

                <Button
                    onClick={() => {
                        if (isSuccess && lastSignature) {
                            const network = process.env.NEXT_PUBLIC_NETWORK || 'devnet';
                            window.open(`https://explorer.solana.com/tx/${lastSignature}?cluster=${network}`, '_blank');
                            return;
                        }
                        handleBuy();
                    }}
                    disabled={(!publicKey || loading || !isAmountValid) && !isSuccess}
                    className="w-full h-12 text-base bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-xl transition-all"
                    size="lg"
                >
                    {ctaLabel}
                </Button>
                <div className="text-xs text-[#94A3B8] dark:text-[#6B7280] space-y-1 mt-3">
                    <p>Final amount may vary slightly due to on-chain execution.</p>
                    <p>You always retain custody of your assets.</p>
                </div>
            </div>
        </div>
    );
}
