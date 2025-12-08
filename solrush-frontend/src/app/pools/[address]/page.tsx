'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePools } from '@/lib/hooks/usePools';
import { Navbar } from '@/components/layout/Navbar';
import { AddLiquidity } from '@/components/liquidity/AddLiquidity';
import { RemoveLiquidity } from '@/components/liquidity/RemoveLiquidity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

const getTokenIcon = (symbol: string) => {
    switch (symbol) {
        case 'SOL': return <SolIcon className="w-12 h-12" />;
        case 'USDC': return <UsdcIcon className="w-12 h-12" />;
        case 'USDT': return <UsdtIcon className="w-12 h-12" />;
        default: return <span className="text-4xl">?</span>;
    }
};

/**
 * Individual Pool Page
 * Dynamic route: /pools/[address]
 * Shows detailed information about a specific pool
 */
export default function PoolDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { pools, loading, refreshPools } = usePools();

    const poolAddress = params?.address as string;
    const pool = pools.find(p => p.address === poolAddress || p.id === poolAddress);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="ml-3 text-white/60">Loading pool...</span>
            </div>
        );
    }

    if (!pool) {
        return (
            <div className="min-h-screen bg-black relative overflow-hidden">
                <Navbar />
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <h1 className="text-4xl font-bold text-white mb-4">Pool Not Found</h1>
                    <p className="text-white/40 mb-8">The pool you're looking for doesn't exist</p>
                    <Button onClick={() => router.push('/pools')} variant="default">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Pools
                    </Button>
                </div>
            </div>
        );
    }

    const priceChange24h = Math.random() * 10 - 5; // Mock data - replace with real price change
    const isPositive = priceChange24h >= 0;

    return (
        <div className="min-h-screen bg-black relative overflow-hidden selection:bg-purple-500/30">
            <Navbar />

            {/* Background Glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    onClick={() => router.push('/pools')}
                    className="mb-6 text-white/60 hover:text-white"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Pools
                </Button>

                {/* Pool Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center -space-x-4">
                                {getTokenIcon(pool.tokens[0])}
                                {getTokenIcon(pool.tokens[1])}
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight">
                                    {pool.tokens[0]}/{pool.tokens[1]} Pool
                                </h1>
                                <p className="text-white/40 text-sm mt-1">
                                    {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshPools}
                            disabled={loading}
                            className="text-white/40 hover:text-white"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {/* Pool Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                            <div className="text-white/40 text-sm mb-2">Total Value Locked</div>
                            <div className="text-3xl font-black text-white">
                                ${pool.tvl >= 1000000
                                    ? `${(pool.tvl / 1000000).toFixed(2)}M`
                                    : pool.tvl >= 1000
                                        ? `${(pool.tvl / 1000).toFixed(2)}K`
                                        : pool.tvl.toFixed(2)}
                            </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                            <div className="text-white/40 text-sm mb-2">APY</div>
                            <div className="text-3xl font-black text-green-400 flex items-center gap-2">
                                {pool.apy.toFixed(2)}%
                                <TrendingUp className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                            <div className="text-white/40 text-sm mb-2">24h Volume</div>
                            <div className="text-2xl font-black text-white">
                                ${pool.volume24h >= 1000000
                                    ? `${(pool.volume24h / 1000000).toFixed(2)}M`
                                    : pool.volume24h >= 1000
                                        ? `${(pool.volume24h / 1000).toFixed(2)}K`
                                        : pool.volume24h.toFixed(2)}
                            </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                            <div className="text-white/40 text-sm mb-2">Trading Fee</div>
                            <div className="text-2xl font-black text-white flex items-center gap-2">
                                {pool.fee}%
                                <Activity className="w-5 h-5 text-purple-400" />
                            </div>
                        </div>
                    </div>

                    {/* Pool Reserves */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {getTokenIcon(pool.tokens[0])}
                                    <span className="text-xl font-bold text-white">{pool.tokens[0]}</span>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-white">
                                {pool.formattedReserveA || pool.reserveA.toLocaleString()}
                            </div>
                            <div className="text-white/40 text-sm mt-1">Pool Reserve</div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {getTokenIcon(pool.tokens[1])}
                                    <span className="text-xl font-bold text-white">{pool.tokens[1]}</span>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-white">
                                {pool.formattedReserveB || pool.reserveB.toLocaleString()}
                            </div>
                            <div className="text-white/40 text-sm mt-1">Pool Reserve</div>
                        </div>
                    </div>
                </div>

                {/* Add/Remove Liquidity Tabs */}
                <Tabs defaultValue="add" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                        <TabsTrigger value="add" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
                            Add Liquidity
                        </TabsTrigger>
                        <TabsTrigger value="remove" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
                            Remove Liquidity
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="add" className="mt-8">
                        <div className="flex justify-center">
                            <AddLiquidity poolAddress={pool.address} />
                        </div>
                    </TabsContent>

                    <TabsContent value="remove" className="mt-8">
                        <div className="flex justify-center">
                            <RemoveLiquidity poolAddress={pool.address} />
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
