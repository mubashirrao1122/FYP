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
import { cn } from '@/lib/utils';
import { SwapQuote } from '@/lib/types';
import { useTransaction } from '@/lib/hooks/useTransaction';
import { TransactionStatus } from '@/components/common/TransactionStatus';
import { useGlobalStore } from '@/components/providers/GlobalStoreProvider';

interface SwapTabProps {
    slippageTolerance: number;
    onTokenChange?: (inputToken: string, outputToken: string) => void;
}

export function SwapTab({ slippageTolerance, onTokenChange }: SwapTabProps) {
    const { publicKey } = useWallet();
    const { toast } = useToast();
    const { calculateQuote, executeSwap, loading: swapLoading } = useSwap();
    const { status, signature, error, sendTransaction, reset } = useTransaction();
    const { pools } = useGlobalStore();

    const [inputAmount, setInputAmount] = useState('');
    const [outputAmount, setOutputAmount] = useState('');
    const [inputToken, setInputToken] = useState('SOL');
    const [outputToken, setOutputToken] = useState('USDC');
    const [currentQuote, setCurrentQuote] = useState<SwapQuote | null>(null);

    // Fetch real-time balances
    const inputBalance = useTokenBalance(inputToken);
    const outputBalance = useTokenBalance(outputToken);

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

            await sendTransaction(
                () => executeSwap({
                    inputToken,
                    outputToken,
                    inputAmount: parseFloat(inputAmount),
                    minOutputAmount: quote.minReceived,
                }),
                'swap'
            );

            toast({
                title: 'Swap Successful!',
                description: `Swapped ${inputAmount} ${inputToken} for ${outputAmount} ${outputToken}`,
            });

            setInputAmount('');
            setOutputAmount('');
            
            // Refresh global pools to update reserves
            pools.refreshPools();
        } catch (error: any) {
            // Error is handled by TransactionStatus component
            console.error('Swap failed:', error);
        }
    };

    const isAmountValid = inputAmount && parseFloat(inputAmount) > 0;
    const isBusy = swapLoading || status === 'pending' || status === 'confirming';
    const isSuccess = status === 'success' && signature;
    const ctaLabel = isSuccess
        ? 'View Transaction'
        : !publicKey
            ? 'Connect Wallet'
            : !isAmountValid
                ? 'Enter Amount'
                : isBusy
                    ? 'Confirming...'
                    : 'Review Trade';

    return (
        <div className="space-y-4">
            {/* Input Section */}
            <div className="bg-[#F1F5F9] dark:bg-[#161C2D] rounded-2xl p-4 border border-[#E2E8F0] dark:border-white/10 transition-colors duration-200">
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                        You Pay
                    </label>
                    <div className="flex items-center gap-2 text-xs text-[#94A3B8] dark:text-[#6B7280]">
                        <span>
                            Balance: {!publicKey ? 'Connect wallet' : inputBalance.loading ? '...' : inputBalance.balance.toFixed(4)} {inputToken}
                        </span>
                        <button
                            onClick={() => setInputAmount(inputBalance.balance.toString())}
                            disabled={!publicKey || inputBalance.loading || inputBalance.balance === 0}
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
                        value={inputAmount}
                        onChange={(e) => setInputAmount(e.target.value)}
                        className="bg-transparent border-none text-3xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280] w-full text-[#0F172A] dark:text-white"
                    />
                    <div className="min-w-[88px]">
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

            {/* Output Section */}
            <div className="bg-[#F1F5F9] dark:bg-[#161C2D] rounded-2xl p-4 border border-[#E2E8F0] dark:border-white/10 transition-colors duration-200">
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                        You Receive
                    </label>
                    <div className="text-xs text-[#94A3B8] dark:text-[#6B7280]">
                        Balance: {!publicKey ? 'Connect wallet' : outputBalance.loading ? '...' : outputBalance.balance.toFixed(4)} {outputToken}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Input
                        type="number"
                        placeholder="0.0"
                        value={outputAmount}
                        readOnly
                        className="bg-transparent border-none text-3xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280] w-full text-[#0F172A] dark:text-white"
                    />
                    <div className="min-w-[88px]">
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

            <div className="rounded-xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826] p-3 text-sm text-[#475569] dark:text-[#9CA3AF] space-y-2">
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

            {/* Swap Details */}
            {isAmountValid && currentQuote && (
                <div className="space-y-1 p-3 bg-white dark:bg-[#121826] rounded-xl border border-[#E2E8F0] dark:border-white/10 text-sm text-[#475569] dark:text-[#9CA3AF]">
                    <div className="flex justify-between">
                        <span>Exchange Rate</span>
                        <span className="text-[#0F172A] dark:text-[#E5E7EB]">
                            1 {inputToken} = {currentQuote.exchangeRate.toFixed(2)} {outputToken}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Fee (0.3%)</span>
                        <span className="text-[#0F172A] dark:text-[#E5E7EB]">
                            {currentQuote.fee.toFixed(6)} {inputToken}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Price Impact</span>
                        <span
                            className={cn(
                                currentQuote.priceImpact > 2
                                    ? 'text-[#EF4444]'
                                    : currentQuote.priceImpact > 1
                                        ? 'text-[#F59E0B]'
                                        : 'text-[#22C55E]'
                            )}
                        >
                            {currentQuote.priceImpact.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Minimum Received</span>
                        <span className="text-[#0F172A] dark:text-[#E5E7EB]">
                            {currentQuote.minReceived.toFixed(6)} {outputToken}
                        </span>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <Button
                    onClick={() => {
                        if (isSuccess && signature) {
                            const network = process.env.NEXT_PUBLIC_NETWORK || 'devnet';
                            window.open(`https://explorer.solana.com/tx/${signature}?cluster=${network}`, '_blank');
                            return;
                        }
                        handleSwap();
                    }}
                    disabled={(!publicKey || !isAmountValid || isBusy) && !isSuccess}
                    className="w-full h-12 text-base bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-xl transition-all"
                    size="lg"
                >
                    {ctaLabel}
                </Button>
                <div className="text-xs text-[#94A3B8] dark:text-[#6B7280] space-y-1">
                    <p>Final amount may vary slightly due to on-chain execution.</p>
                    <p>You always retain custody of your assets.</p>
                </div>
            </div>

            {/* Transaction Status */}
            <TransactionStatus
                status={status}
                signature={signature}
                error={error}
                onRetry={() => {
                    reset();
                    handleSwap();
                }}
            />
        </div>
    );
}
