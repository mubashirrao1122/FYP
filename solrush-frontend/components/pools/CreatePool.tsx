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

        if (amountANum <= 0 || amountBNum <= 0) {
            setError('Amounts must be greater than zero');
            return;
        }

        if (tokenA === tokenB) {
            setError('Please select different tokens');
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

            // Check balances
            if (!tokenABalance.loading && tokenABalance.balance < amountANum) {
                setError(`Insufficient ${tokenA} balance. You have ${tokenABalance.balance.toFixed(4)} but need ${amountANum}`);
                return;
            }

            if (!tokenBBalance.loading && tokenBBalance.balance < amountBNum) {
                setError(`Insufficient ${tokenB} balance. You have ${tokenBBalance.balance.toFixed(4)} but need ${amountBNum}`);
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
                description: `Pool: ${poolTx.slice(0, 8)}...${poolTx.slice(-8)} | Liquidity: ${liquidityTx.slice(0, 8)}...${liquidityTx.slice(-8)}`,
            });

            // Clear form
            setAmountA('');
            setAmountB('');

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
            <div className="bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-2xl p-8 transition-colors duration-200">
                <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-[#0F172A] dark:text-[#E5E7EB] flex items-center gap-2">
                        <Plus className="w-6 h-6 text-[#8B5CF6]" />
                        Create New Pool
                    </h2>
                    <p className="text-sm text-[#475569] dark:text-[#9CA3AF] mt-2">
                        Creating a pool initializes on-chain liquidity and defines the fee tier for all future trades.
                    </p>
                </div>

                {/* Token A Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF] mb-2">
                        Token A
                    </label>
                    <select
                        value={tokenA}
                        onChange={(e) => setTokenA(e.target.value)}
                        className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
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
                    <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF] mb-2">
                        Initial {tokenA} Amount
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amountA}
                            onChange={(e) => setAmountA(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] text-right text-2xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                            disabled={loading}
                            min="0"
                            step="any"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {getTokenIcon(tokenA)}
                            <span className="text-[#0F172A] dark:text-[#E5E7EB] font-semibold">{tokenA}</span>
                        </div>
                    </div>
                </div>

                {/* Token B Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF] mb-2">
                        Token B
                    </label>
                    <select
                        value={tokenB}
                        onChange={(e) => setTokenB(e.target.value)}
                        className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
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
                    <label className="block text-sm font-medium text-[#475569] dark:text-[#9CA3AF] mb-2">
                        Initial {tokenB} Amount
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amountB}
                            onChange={(e) => setAmountB(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl px-4 py-3 text-[#0F172A] dark:text-[#E5E7EB] text-right text-2xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                            disabled={loading}
                            min="0"
                            step="any"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {getTokenIcon(tokenB)}
                            <span className="text-[#0F172A] dark:text-[#E5E7EB] font-semibold">{tokenB}</span>
                        </div>
                    </div>
                </div>

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
                                    ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]'
                                    : 'bg-[#F1F5F9] dark:bg-[#161C2D] border-[#E2E8F0] dark:border-white/10 hover:border-[#8B5CF6]'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[#0F172A] dark:text-[#E5E7EB] font-semibold">{tier.label}</div>
                                        <div className="text-[#94A3B8] dark:text-[#6B7280] text-sm">{tier.description}</div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 ${feeTier === tier.value
                                        ? 'border-[#8B5CF6] bg-[#8B5CF6]'
                                        : 'border-[#CBD5E1] dark:border-white/20'
                                        }`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-3 bg-[#F1F5F9] dark:bg-[#161C2D] border border-[#E2E8F0] dark:border-white/10 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-[#9CA3AF]" />
                        <span className="text-sm text-[#475569] dark:text-[#9CA3AF]">{error}</span>
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="mb-6 p-4 bg-[#F1F5F9] dark:bg-[#161C2D] border border-[#E2E8F0] dark:border-white/10 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
                            <span className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">Pool created successfully</span>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[#94A3B8] dark:text-[#6B7280]">Pool Creation:</span>
                                <a
                                    href={`https://explorer.solana.com/tx/${success.poolTx}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#8B5CF6] hover:text-[#7C3AED] flex items-center gap-1"
                                >
                                    {success.poolTx.slice(0, 8)}...{success.poolTx.slice(-8)}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[#94A3B8] dark:text-[#6B7280]">Initial Liquidity:</span>
                                <a
                                    href={`https://explorer.solana.com/tx/${success.liquidityTx}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#8B5CF6] hover:text-[#7C3AED] flex items-center gap-1"
                                >
                                    {success.liquidityTx.slice(0, 8)}...{success.liquidityTx.slice(-8)}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Button */}
                <Button
                    onClick={handleCreatePool}
                    disabled={loading || !connected || tokenABalance.loading || tokenBBalance.loading}
                    className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                        You will be the first liquidity provider and receive LP tokens representing your share.
                    </p>
                </div>
            </div>
        </div>
    );
};
