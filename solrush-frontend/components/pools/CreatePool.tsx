'use client';

import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';
import { TOKEN_LIST, getTokenMint } from '@/lib/constants';
import { useCreatePool, usePool } from '@/lib/hooks/usePool';
import { useTokenBalance } from '@/lib/hooks/useBalance';
import { useToast } from '@/components/ui/use-toast';

const getTokenIcon = (symbol: string) => {
    switch (symbol) {
        case 'SOL': return <SolIcon className="w-6 h-6" />;
        case 'USDC': return <UsdcIcon className="w-6 h-6" />;
        case 'USDT': return <UsdtIcon className="w-6 h-6" />;
        default: return <span className="text-2xl">?</span>;
    }
};

export const CreatePool: React.FC = () => {
    const { connection } = useConnection();
    const { publicKey, connected } = useWallet();
    const { toast } = useToast();

    const [tokenA, setTokenA] = useState('SOL');
    const [tokenB, setTokenB] = useState('USDC');
    const [amountA, setAmountA] = useState('');
    const [amountB, setAmountB] = useState('');
    const [feeTier, setFeeTier] = useState('0.3');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ poolTx: string; liquidityTx: string } | null>(null);

    // Hooks for pool creation and liquidity
    const { createPool, checkPoolExists, loading: createLoading } = useCreatePool();
    const { addLiquidity, loading: liquidityLoading } = usePool(undefined, tokenA, tokenB);

    // Get token balances
    const tokenABalance = useTokenBalance(tokenA);
    const tokenBBalance = useTokenBalance(tokenB);

    const loading = createLoading || liquidityLoading;

    const feeTiers = [
        { value: '0.1', label: '0.1% - Stable Pairs', description: 'Best for stable pairs like USDC/USDT' },
        { value: '0.3', label: '0.3% - Standard', description: 'Most common fee tier' },
        { value: '1.0', label: '1.0% - Volatile Pairs', description: 'For volatile or exotic pairs' },
    ];

    // Use TOKEN_LIST directly to avoid duplicates
    const availableTokens = TOKEN_LIST.map(t => ({ symbol: t.symbol, name: t.name }));

    // Calculate initial price and share
    const initialPrice = amountA && amountB && parseFloat(amountA) > 0 ? parseFloat(amountB) / parseFloat(amountA) : 0;

    // Close success modal
    const closeSuccessModal = () => {
        setSuccess(null);
        setAmountA('');
        setAmountB('');
    };

    const handleMaxA = () => {
        if (!tokenABalance.loading && tokenABalance.balance > 0) {
            setAmountA(tokenABalance.balance.toString());
        }
    };

    const handleMaxB = () => {
        if (!tokenBBalance.loading && tokenBBalance.balance > 0) {
            setAmountB(tokenBBalance.balance.toString());
        }
    };

    const handleCreatePool = async () => {
        if (!connected || !publicKey) {
            setError('Please connect your wallet');
            return;
        }

        if (!amountA || !amountB) {
            setError('Please enter initial liquidity amounts');
            return;
        }

        const amountANum = parseFloat(amountA);
        const amountBNum = parseFloat(amountB);

        if (isNaN(amountANum) || amountANum <= 0 || isNaN(amountBNum) || amountBNum <= 0) {
            setError('Amounts must be greater than zero');
            return;
        }

        if (tokenA === tokenB) {
            setError('Please select different tokens');
            return;
        }

        // Check balances
        if (!tokenABalance.loading && tokenABalance.balance < amountANum) {
            setError(`Insufficient ${tokenA} balance. You have ${tokenABalance.balance.toFixed(4)} but need ${amountANum}`);
            return;
        }

        if (!tokenBBalance.loading && tokenBBalance.balance < amountBNum) {
            setError(`Insufficient ${tokenB} balance. You have ${tokenBBalance.balance.toFixed(4)} but need ${amountBNum}`);
            return;
        }

        setError(null);
        setSuccess(null);

        try {
            // Get token mints
            const tokenAMint = getTokenMint(tokenA);
            const tokenBMint = getTokenMint(tokenB);

            // Check if pool already exists
            const poolExists = await checkPoolExists(tokenAMint, tokenBMint);
            if (poolExists) {
                setError(`Pool for ${tokenA}-${tokenB} already exists`);
                return;
            }

            // Step 1: Create the pool
            toast({
                title: 'Creating Pool',
                description: `Initializing ${tokenA}-${tokenB} pool...`,
            });

            const poolTx = await createPool(tokenAMint, tokenBMint);
            console.log('Pool created:', poolTx);

            // Step 2: Add initial liquidity
            toast({
                title: 'Adding Initial Liquidity',
                description: `Adding ${amountA} ${tokenA} and ${amountB} ${tokenB}...`,
            });

            const liquidityTx = await addLiquidity({
                amountA: amountANum,
                amountB: amountBNum,
                minLpTokens: 0, // First liquidity provider doesn't need slippage protection
            });
            console.log('Liquidity added:', liquidityTx);

            // Success!
            setSuccess({ poolTx, liquidityTx });

            toast({
                title: 'Pool Created Successfully!',
                description: `Pool initialized & liquidity added.`,
            });

        } catch (err: any) {
            console.error('Failed to create pool:', err);

            // Parse error message
            let errorMessage = 'Failed to create pool';
            if (err.message) {
                if (err.message.includes('User rejected')) {
                    errorMessage = 'Transaction was rejected';
                } else if (err.message.includes('insufficient')) {
                    errorMessage = 'Insufficient balance for transaction';
                } else if (err.message.includes('already exists')) {
                    errorMessage = 'Pool already exists';
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
            toast({
                title: 'Pool Creation Failed',
                description: errorMessage,
            });
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-2xl p-8 transition-colors duration-200 relative">
                <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-[#0F172A] dark:text-[#E5E7EB] flex items-center gap-2">
                        <Plus className="w-6 h-6 text-[#2DD4BF]" />
                        Create New Pool
                    </h2>
                    <p className="text-sm text-[#475569] dark:text-[#9CA3AF] mt-2">
                        Initialize a new liquidity pool and earn trading fees.
                    </p>
                </div>

                {/* Token A Selection */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">
                            Token A
                        </label>
                        <div className="text-xs text-[#94A3B8] dark:text-[#6B7280]">
                            Balance: {tokenABalance.loading ? '...' : tokenABalance.balance.toFixed(4)}
                        </div>
                    </div>
                    <select
                        value={tokenA}
                        onChange={(e) => setTokenA(e.target.value)}
                        className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                        disabled={loading}
                    >
                        {availableTokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-white dark:bg-[#121826]">
                                {token.symbol} - {token.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Token A Amount */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">
                            Initial {tokenA} Liquidity
                        </label>
                        <button
                            onClick={handleMaxA}
                            className="text-xs text-[#2DD4BF] hover:text-[#22C1AE] font-semibold"
                            disabled={loading || tokenABalance.loading}
                        >
                            MAX
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            value={amountA}
                            onChange={(e) => setAmountA(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] text-right text-2xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                            disabled={loading}
                            min="0"
                            step="any"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                            {getTokenIcon(tokenA)}
                            <span className="text-[#0F172A] dark:text-[#E5E7EB] font-semibold">{tokenA}</span>
                        </div>
                    </div>
                </div>

                {/* Plus Icon */}
                <div className="flex justify-center -my-3 relative z-10">
                    <div className="bg-[#F1F5F9] dark:bg-[#1e293b] p-2 rounded-full border border-[#E2E8F0] dark:border-white/10 text-[#94A3B8] dark:text-[#6B7280]">
                        <Plus className="w-4 h-4" />
                    </div>
                </div>

                {/* Token B Selection */}
                <div className="mb-6 pt-3">
                    <div className="flex justify-between mb-2">
                        <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">
                            Token B
                        </label>
                        <div className="text-xs text-[#94A3B8] dark:text-[#6B7280]">
                            Balance: {tokenBBalance.loading ? '...' : tokenBBalance.balance.toFixed(4)}
                        </div>
                    </div>
                    <select
                        value={tokenB}
                        onChange={(e) => setTokenB(e.target.value)}
                        className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                        disabled={loading}
                    >
                        {availableTokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-white dark:bg-[#121826]">
                                {token.symbol} - {token.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Token B Amount */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">
                            Initial {tokenB} Liquidity
                        </label>
                        <button
                            onClick={handleMaxB}
                            className="text-xs text-[#2DD4BF] hover:text-[#22C1AE] font-semibold"
                            disabled={loading || tokenBBalance.loading}
                        >
                            MAX
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            value={amountB}
                            onChange={(e) => setAmountB(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] text-right text-2xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                            disabled={loading}
                            min="0"
                            step="any"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                            {getTokenIcon(tokenB)}
                            <span className="text-[#0F172A] dark:text-[#E5E7EB] font-semibold">{tokenB}</span>
                        </div>
                    </div>
                </div>

                {/* Info Card: Price and Share */}
                {(amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0) && (
                    <div className="mb-6 p-4 bg-[#F8FAFC] dark:bg-[#1e293b]/50 border border-[#E2E8F0] dark:border-white/5 rounded-xl space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-[#64748B] dark:text-[#94A3B8]">Initial Price:</span>
                            <span className="text-[#0F172A] dark:text-[#E5E7EB] font-medium">1 {tokenA} = {initialPrice.toFixed(4)} {tokenB}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-[#64748B] dark:text-[#94A3B8]">Your Pool Share:</span>
                            <span className="text-[#2DD4BF] font-medium">100%</span>
                        </div>
                    </div>
                )}

                {/* Fee Tier Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF] mb-2">
                        Fee Tier
                    </label>
                    <div className="space-y-2">
                        {feeTiers.map((tier) => (
                            <div
                                key={tier.value}
                                onClick={() => !loading && setFeeTier(tier.value)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${feeTier === tier.value
                                    ? 'bg-[#2DD4BF]/10 border-[#2DD4BF]'
                                    : 'bg-[#F1F5F9] dark:bg-[#161C2D] border-[#E2E8F0] dark:border-white/10 hover:border-[#2DD4BF]'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[#0F172A] dark:text-[#E5E7EB] font-semibold">{tier.label}</div>
                                        <div className="text-[#94A3B8] dark:text-[#6B7280] text-sm">{tier.description}</div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 ${feeTier === tier.value
                                        ? 'border-[#2DD4BF] bg-[#2DD4BF]'
                                        : 'border-[#CBD5E1] dark:border-white/20'
                                        }`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-500">{error}</span>
                    </div>
                )}

                {/* Success Modal Overlay */}
                {success && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-2xl">
                        <div className="bg-white dark:bg-[#1e293b] border border-[#E2E8F0] dark:border-white/10 rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                                </div>
                                <h3 className="text-xl font-bold text-[#0F172A] dark:text-white">Pool Created!</h3>
                                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                                    You have successfully initialized the {tokenA}/{tokenB} liquidity pool.
                                </p>

                                <div className="w-full space-y-2 text-sm bg-[#F8FAFC] dark:bg-[#0F172A]/50 p-4 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[#64748B] dark:text-[#64748B]">Pool:</span>
                                        <a href={`https://explorer.solana.com/tx/${success.poolTx}?cluster=custom&customUrl=http://127.0.0.1:8899`} target="_blank" rel="noreferrer" className="text-[#2DD4BF] flex items-center gap-1 hover:underline">
                                            View TX <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[#64748B] dark:text-[#64748B]">Liquidity:</span>
                                        <a href={`https://explorer.solana.com/tx/${success.liquidityTx}?cluster=custom&customUrl=http://127.0.0.1:8899`} target="_blank" rel="noreferrer" className="text-[#2DD4BF] flex items-center gap-1 hover:underline">
                                            View TX <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>

                                <Button
                                    onClick={closeSuccessModal}
                                    className="w-full bg-[#2DD4BF] hover:bg-[#22C1AE] text-white"
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Button */}
                <Button
                    onClick={handleCreatePool}
                    disabled={loading || !connected || tokenABalance.loading || tokenBBalance.loading}
                    className="w-full bg-[#2DD4BF] hover:bg-[#22C1AE] text-white disabled:opacity-50 disabled:cursor-not-allowed h-12 text-lg"
                >
                    {loading
                        ? (createLoading ? 'Creating Pool...' : 'Adding Liquidity...')
                        : connected
                            ? 'Create Pool & Add Liquidity'
                            : 'Connect Wallet'
                    }
                </Button>

                {/* Information */}
                <div className="mt-6 p-4 bg-[#F1F5F9] dark:bg-[#161C2D] border border-[#E2E8F0] dark:border-white/10 rounded-xl">
                    <p className="text-sm text-[#475569] dark:text-[#9CA3AF]">
                        By creating this pool, you are setting the initial price. Ensure your ratio is correct to avoid arbitrage.
                    </p>
                </div>
            </div>
        </div>
    );
};
