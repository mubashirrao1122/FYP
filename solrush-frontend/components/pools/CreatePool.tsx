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
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6 text-purple-400" />
                    Create New Pool
                </h2>

                {/* Token A Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-white/60 mb-2">
                        Token A
                    </label>
                    <select
                        value={tokenA}
                        onChange={(e) => setTokenA(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={loading}
                    >
                        {availableTokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-gray-900">
                                {token.symbol} - {token.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Token A Amount */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-white/60 mb-2">
                        Initial {tokenA} Amount
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amountA}
                            onChange={(e) => setAmountA(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-right text-2xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                            disabled={loading}
                            min="0"
                            step="any"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {getTokenIcon(tokenA)}
                            <span className="text-white font-semibold">{tokenA}</span>
                        </div>
                    </div>
                </div>

                {/* Token B Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-white/60 mb-2">
                        Token B
                    </label>
                    <select
                        value={tokenB}
                        onChange={(e) => setTokenB(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={loading}
                    >
                        {availableTokens.map((token) => (
                            <option key={token.symbol} value={token.symbol} className="bg-gray-900">
                                {token.symbol} - {token.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Token B Amount */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-white/60 mb-2">
                        Initial {tokenB} Amount
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amountB}
                            onChange={(e) => setAmountB(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-right text-2xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                            disabled={loading}
                            min="0"
                            step="any"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {getTokenIcon(tokenB)}
                            <span className="text-white font-semibold">{tokenB}</span>
                        </div>
                    </div>
                </div>

                {/* Fee Tier Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-white/60 mb-2">
                        Fee Tier
                    </label>
                    <div className="space-y-2">
                        {feeTiers.map((tier) => (
                            <div
                                key={tier.value}
                                onClick={() => !loading && setFeeTier(tier.value)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${feeTier === tier.value
                                    ? 'bg-purple-500/20 border-purple-500'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-white font-semibold">{tier.label}</div>
                                        <div className="text-white/40 text-sm">{tier.description}</div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 ${feeTier === tier.value
                                        ? 'border-purple-500 bg-purple-500'
                                        : 'border-white/20'
                                        }`}>
                                        {feeTier === tier.value && (
                                            <div className="w-full h-full rounded-full bg-white scale-50" />
                                        )}
                                    </div>
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

                {/* Success Message */}
                {success && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-semibold text-green-500">Pool Created Successfully!</span>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-white/60">Pool Creation:</span>
                                <a
                                    href={`https://explorer.solana.com/tx/${success.poolTx}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                >
                                    {success.poolTx.slice(0, 8)}...{success.poolTx.slice(-8)}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/60">Initial Liquidity:</span>
                                <a
                                    href={`https://explorer.solana.com/tx/${success.liquidityTx}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
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
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading
                        ? (createLoading ? 'Creating Pool...' : 'Adding Liquidity...')
                        : connected
                            ? 'Create Pool & Add Liquidity'
                            : 'Connect Wallet'
                    }
                </Button>

                {/* Information */}
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <p className="text-sm text-blue-300">
                        <strong>Note:</strong> Creating a pool requires initial liquidity for both tokens.
                        You'll be the first liquidity provider and will receive LP tokens representing your share.
                    </p>
                </div>
            </div>
        </div>
    );
};
