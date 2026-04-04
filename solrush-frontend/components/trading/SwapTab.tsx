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
            <div className="rounded-2xl p-4 bg-muted/30 border border-border/20 neon-focus transition-colors duration-200">
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-foreground">
                        You Pay
                    </label>
                    <div className="flex items-center gap-2 text-xs text-foreground/40">
                        <span className="font-data">
                            Balance: {!publicKey ? 'Connect wallet' : inputBalance.loading ? '...' : inputBalance.balance.toFixed(4)} {inputToken}
                        </span>
                        <button
                            onClick={() => setInputAmount(inputBalance.balance.toString())}
                            disabled={!publicKey || inputBalance.loading || inputBalance.balance === 0}
                            className="text-neon-cyan hover:text-neon-cyan/80 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="bg-transparent border-none text-3xl font-semibold font-data h-auto focus:ring-0 px-0 placeholder:text-foreground/25 w-full text-foreground"
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
                <p className="mt-2 text-xs text-foreground/40">
                    Estimated · Slippage protected
                </p>
            </div>

            {/* Switch Button — magnetic hover effect */}
            <div className="flex justify-center -my-5 z-10 relative">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSwitchTokens}
                    className="rounded-full bg-card border border-border/30 hover:bg-accent/50 hover:border-neon-cyan/30 hover:shadow-[0_0_16px_rgba(6,182,212,0.15)] transition-all h-11 w-11"
                >
                    <ArrowUpDown className="h-5 w-5 text-neon-cyan" />
                </Button>
            </div>

            {/* Output Section */}
            <div className="rounded-2xl p-4 bg-muted/30 border border-border/20 neon-focus transition-colors duration-200">
                <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-foreground">
                        You Receive
                    </label>
                    <div className="text-xs text-foreground/40 font-data">
                        Balance: {!publicKey ? 'Connect wallet' : outputBalance.loading ? '...' : outputBalance.balance.toFixed(4)} {outputToken}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Input
                        type="number"
                        placeholder="0.0"
                        value={outputAmount}
                        readOnly
                        className="bg-transparent border-none text-3xl font-semibold font-data h-auto focus:ring-0 px-0 placeholder:text-foreground/25 w-full text-foreground"
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

            <div className="rounded-xl glass-card p-3 text-sm text-foreground/60 space-y-2">
                <div className="flex items-center justify-between">
                    <span>Best route</span>
                    <span className="text-foreground font-data">SolRush Aggregator</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Est. finality</span>
                    <span className="text-foreground font-data">~0.4s</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Price impact</span>
                    <span className="text-foreground font-data">0.18%</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Fees</span>
                    <span className="text-foreground font-data">0.30%</span>
                </div>
            </div>

            {/* Swap Details */}
            {isAmountValid && currentQuote && (
                <div className="space-y-1 p-3 glass-card rounded-xl text-sm text-foreground/60">
                    <div className="flex justify-between">
                        <span>Exchange Rate</span>
                        <span className="text-foreground font-data">
                            1 {inputToken} = {currentQuote.exchangeRate.toFixed(2)} {outputToken}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Fee (0.3%)</span>
                        <span className="text-foreground font-data">
                            {currentQuote.fee.toFixed(6)} {inputToken}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Price Impact</span>
                        <span
                            className={cn(
                                'font-data',
                                currentQuote.priceImpact > 2
                                    ? 'text-destructive'
                                    : currentQuote.priceImpact > 1
                                        ? 'text-neon-amber'
                                        : 'text-neon-green'
                            )}
                        >
                            {currentQuote.priceImpact.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Minimum Received</span>
                        <span className="text-foreground font-data">
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
                    className="w-full h-12 text-base bg-neon-blue hover:bg-[#2563EB] text-white font-semibold rounded-xl animate-glow-pulse transition-all"
                    size="lg"
                >
                    {ctaLabel}
                </Button>
                <div className="text-xs text-foreground/40 space-y-1">
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
