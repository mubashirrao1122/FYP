import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { AddLiquidity } from '@/components/liquidity/AddLiquidity';
import { RemoveLiquidity } from '@/components/liquidity/RemoveLiquidity';
import { PoolCard } from '@/components/ui/pool-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Pool {
    id: string;
    name: string;
    tokens: string[];
    address: string;
    tvl: number;
    apy: number;
    fee: number;
    volume24h: number;
}

interface PoolsViewProps {
    pools: Pool[];
    loading?: boolean;
    error?: string | null;
    isUsingMockData?: boolean;
    handleAddLiquidity: (poolName: string) => void;
    onRefresh?: () => void;
}

const getTokenIcon = (symbol: string) => {
    switch (symbol) {
        case 'SOL': return <SolIcon className="w-8 h-8" />;
        case 'USDC': return <UsdcIcon className="w-8 h-8" />;
        case 'USDT': return <UsdtIcon className="w-8 h-8" />;
        default: return <span className="text-2xl">?</span>;
    }
};

export const PoolsView: React.FC<PoolsViewProps> = ({ 
    pools, 
    loading = false,
    error = null,
    isUsingMockData = false,
    handleAddLiquidity,
    onRefresh,
}) => {
    return (
        <div className="min-h-screen bg-black relative overflow-hidden selection:bg-purple-500/30">
            <Navbar />

            {/* Background Glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12">
                {/* Status Banner */}
                {isUsingMockData && (
                    <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-yellow-500">
                            Using demo data. Deploy contracts to see real pools.
                        </span>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-500">{error}</span>
                    </div>
                )}

                <div className="mb-12 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                            Liquidity Pools
                        </h1>
                        {onRefresh && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onRefresh}
                                disabled={loading}
                                className="text-white/40 hover:text-white"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        )}
                    </div>
                    <p className="text-white/40 text-lg max-w-2xl mx-auto">
                        Provide liquidity to earn from trading fees and protocol rewards
                    </p>
                </div>

                <Tabs defaultValue="browse" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10 p-1 rounded-xl">
                        <TabsTrigger value="browse" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">Browse Pools</TabsTrigger>
                        <TabsTrigger value="add" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">Add Liquidity</TabsTrigger>
                        <TabsTrigger value="remove" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">Remove Liquidity</TabsTrigger>
                    </TabsList>

                    {/* Browse Pools Tab */}
                    <TabsContent value="browse" className="space-y-6 mt-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pools.map((pool) => (
                                <PoolCard
                                    key={pool.id}
                                    token1={{
                                        symbol: pool.tokens[0],
                                        icon: getTokenIcon(pool.tokens[0]),
                                        reserve: '1,000,000',
                                    }}
                                    token2={{
                                        symbol: pool.tokens[1],
                                        icon: getTokenIcon(pool.tokens[1]),
                                        reserve: '2,000,000',
                                    }}
                                    apy={`${pool.apy}%`}
                                    tvl={`$${(pool.tvl / 1000000).toFixed(2)}M`}
                                    fee={`${pool.fee}%`}
                                    onAddLiquidity={() => handleAddLiquidity(pool.name)}
                                />
                            ))}
                        </div>
                    </TabsContent>

                    {/* Add Liquidity Tab */}
                    <TabsContent value="add" className="mt-8">
                        <div className="flex justify-center">
                            {pools.length > 0 ? (
                                <AddLiquidity poolAddress={pools[0].address} />
                            ) : (
                                <div className="text-center text-gray-400 py-12">
                                    <p className="text-lg">No pools available</p>
                                    <p className="text-sm mt-2">Create a pool first to add liquidity</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Remove Liquidity Tab */}
                    <TabsContent value="remove" className="mt-8">
                        <div className="flex justify-center">
                            {pools.length > 0 ? (
                                <RemoveLiquidity poolAddress={pools[0].address} />
                            ) : (
                                <div className="text-center text-gray-400 py-12">
                                    <p className="text-lg">No pools available</p>
                                    <p className="text-sm mt-2">No liquidity to remove</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Pool Stats Summary */}
                <div className="mt-16 p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                    <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                        <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                        Protocol Statistics
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div>
                            <div className="text-white/40 text-sm mb-2">Total Value Locked</div>
                            <div className="text-3xl font-black text-white">
                                ${pools.reduce((sum, p) => sum + p.tvl, 0).toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-white/40 text-sm mb-2">24h Volume</div>
                            <div className="text-3xl font-black text-white">
                                ${pools
                                    .reduce((sum, p) => sum + p.volume24h, 0)
                                    .toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-white/40 text-sm mb-2">Active Pools</div>
                            <div className="text-3xl font-black text-white">{pools.length}</div>
                        </div>
                        <div>
                            <div className="text-white/40 text-sm mb-2">Average APY</div>
                            <div className="text-3xl font-black text-green-400">
                                {(
                                    pools.reduce((sum, p) => sum + p.apy, 0) / pools.length
                                ).toFixed(1)}
                                %
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
