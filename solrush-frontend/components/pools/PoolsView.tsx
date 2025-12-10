import React, { useState } from 'react';
import { formatTokenAmount } from '@/lib/utils/formatters';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { AddLiquidity } from '@/components/liquidity/AddLiquidity';
import { RemoveLiquidity } from '@/components/liquidity/RemoveLiquidity';
import { CreatePool } from './CreatePool';
import { MyPositions } from './MyPositions';
import { PoolCard } from '@/components/ui/pool-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SolIcon, UsdcIcon, UsdtIcon, RushIcon, WethIcon } from '@/components/icons/TokenIcons';
import { RefreshCw, AlertCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Pool {
    id: string;
    name: string;
    tokens: [string, string]; // Fixed: changed from string[] to tuple
    address: string;
    tvl: number;
    apy: number;
    fee: number;
    volume24h: number;
    reserveA?: number;
    reserveB?: number;
    formattedReserveA?: string;
    formattedReserveB?: string;
    tokenADecimals?: number;
    tokenBDecimals?: number;
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
        case 'RUSH': return <RushIcon className="w-8 h-8" />;
        case 'WETH': return <WethIcon className="w-8 h-8" />;
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
    const router = useRouter();
    // FIXED: Add pool selector state for Add/Remove Liquidity tabs
    const [selectedPoolIndex, setSelectedPoolIndex] = useState(0);

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'tvl' | 'apy' | 'volume' | 'fee'>('tvl');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');



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
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-5xl font-black text-white tracking-tight">
                            Liquidity Pools
                        </h1>
                        <Button
                            onClick={() => router.push('/pools/new-position')}
                            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            New Position
                        </Button>
                    </div>
                    <p className="text-white/40 text-lg max-w-2xl mx-auto">
                        Provide liquidity to earn from trading fees and protocol rewards
                    </p>
                </div>

               
                <Tabs defaultValue="browse" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-white/5 border border-white/10 p-1 rounded-xl">
                        <TabsTrigger value="browse" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">Browse Pools</TabsTrigger>
                        <TabsTrigger value="create" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">Create Pool</TabsTrigger>
                        <TabsTrigger value="positions" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">My Positions</TabsTrigger>
                        <TabsTrigger value="add" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">Add Liquidity</TabsTrigger>
                        <TabsTrigger value="remove" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">Remove Liquidity</TabsTrigger>
                    </TabsList>

                    {/* Browse Pools Tab */}
                    <TabsContent value="browse" className="space-y-6 mt-8">
                        {/* Search and Filter Bar */}
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search Input */}
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="text"
                                    placeholder="Search pools by token symbol..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* Sort Dropdown */}
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="tvl" className="bg-gray-900">Sort by TVL</option>
                                <option value="apy" className="bg-gray-900">Sort by APY</option>
                                <option value="volume" className="bg-gray-900">Sort by Volume</option>
                                <option value="fee" className="bg-gray-900">Sort by Fee</option>
                            </select>

                            {/* Sort Direction Button */}
                            <Button
                                variant="outline"
                                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                                className="px-4"
                            >
                                {sortDirection === 'desc' ? '↓' : '↑'}
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                                <span className="ml-3 text-white/60">Loading pools...</span>
                            </div>
                        ) : pools.length === 0 ? (
                            <div className="text-center py-12">
                                <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <p className="text-white/40 text-lg">No pools available</p>
                                <p className="text-white/20 text-sm mt-2">Initialize pools on-chain to see them here</p>
                            </div>
                        ) : (() => {
                            console.log('[PoolsView Browse Tab] Entering render function, pools.length:', pools.length);
                            // Filter and sort pools
                            let filteredPools = pools.filter(pool => {
                                if (!searchQuery) return true;
                                const query = searchQuery.toLowerCase();
                                return pool.tokens[0].toLowerCase().includes(query) ||
                                    pool.tokens[1].toLowerCase().includes(query) ||
                                    pool.name.toLowerCase().includes(query);
                            });
                            console.log('[PoolsView Browse Tab] filteredPools:', filteredPools);

                            // Sort pools
                            filteredPools = [...filteredPools].sort((a, b) => {
                                let aVal = 0, bVal = 0;
                                switch (sortBy) {
                                    case 'tvl':
                                        aVal = a.tvl;
                                        bVal = b.tvl;
                                        break;
                                    case 'apy':
                                        aVal = a.apy;
                                        bVal = b.apy;
                                        break;
                                    case 'volume':
                                        aVal = a.volume24h;
                                        bVal = b.volume24h;
                                        break;
                                    case 'fee':
                                        aVal = a.fee;
                                        bVal = b.fee;
                                        break;
                                }
                                return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
                            });

                            if (filteredPools.length === 0) {
                                return (
                                    <div className="text-center py-12">
                                        <Search className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                        <p className="text-white/40 text-lg">No pools match your search</p>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setSearchQuery('')}
                                            className="mt-4 text-purple-400"
                                        >
                                            Clear search
                                        </Button>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    <div className="text-sm text-white/40 mb-4">
                                        Showing {filteredPools.length} of {pools.length} pools
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredPools.map((pool) => (
                                            <PoolCard
                                                key={pool.id}
                                                poolAddress={pool.address}
                                                token1={{
                                                    symbol: pool.tokens[0],
                                                    icon: getTokenIcon(pool.tokens[0]),
                                                    reserve: formatTokenAmount(pool.reserveA || 0, 2, true),
                                                }}
                                                token2={{
                                                    symbol: pool.tokens[1],
                                                    icon: getTokenIcon(pool.tokens[1]),
                                                    reserve: formatTokenAmount(pool.reserveB || 0, 2, true),
                                                }}
                                                apy={`${pool.apy.toFixed(2)}%`}
                                                tvl={pool.tvl >= 1000000
                                                    ? `$${(pool.tvl / 1000000).toFixed(2)}M`
                                                    : pool.tvl >= 1000
                                                        ? `$${(pool.tvl / 1000).toFixed(2)}K`
                                                        : `$${pool.tvl.toFixed(2)}`
                                                }
                                                fee={`${pool.fee}%`}
                                                onViewDetails={() => router.push(`/pools/${pool.address}`)}
                                                onAddLiquidity={() => handleAddLiquidity(pool.name)}
                                            />
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </TabsContent>

                    {/* Create Pool Tab */}
                    <TabsContent value="create" className="mt-8">
                        <CreatePool />
                    </TabsContent>

                    {/* My Positions Tab */}
                    <TabsContent value="positions" className="mt-8">
                        <MyPositions pools={pools} loading={loading} onRefresh={onRefresh} />
                    </TabsContent>

                    {/* Add Liquidity Tab */}
                    <TabsContent value="add" className="mt-8">
                        <div className="flex flex-col items-center">
                            {/* Pool Selector */}
                            {pools.length > 1 && (
                                <div className="w-full max-w-lg mb-6">
                                    <label className="block text-sm font-medium text-white/60 mb-2">
                                        Select Pool
                                    </label>
                                    <select
                                        value={selectedPoolIndex}
                                        onChange={(e) => setSelectedPoolIndex(Number(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        {pools.map((pool, index) => (
                                            <option key={pool.address} value={index} className="bg-gray-900">
                                                {pool.tokens[0]}/{pool.tokens[1]} - TVL: ${pool.tvl.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {pools.length > 0 ? (
                                <AddLiquidity 
                                    poolAddress={pools[selectedPoolIndex]?.address || pools[0]?.address || ''} 
                                    onSuccess={onRefresh}
                                />
                            ) : (
                                <div className="text-center text-gray-400 py-12">
                                    <Plus className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                    <p className="text-lg">No pools available</p>
                                    <p className="text-sm mt-2">Create a pool first to add liquidity</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Remove Liquidity Tab */}
                    <TabsContent value="remove" className="mt-8">
                        <div className="flex flex-col items-center">
                            {/* Pool Selector */}
                            {pools.length > 1 && (
                                <div className="w-full max-w-lg mb-6">
                                    <label className="block text-sm font-medium text-white/60 mb-2">
                                        Select Pool
                                    </label>
                                    <select
                                        value={selectedPoolIndex}
                                        onChange={(e) => setSelectedPoolIndex(Number(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        {pools.map((pool, index) => (
                                            <option key={pool.address} value={index} className="bg-gray-900">
                                                {pool.tokens[0]}/{pool.tokens[1]} - TVL: ${pool.tvl.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {pools.length > 0 ? (
                                <RemoveLiquidity 
                                    poolAddress={pools[selectedPoolIndex]?.address || pools[0]?.address || ''} 
                                    onSuccess={onRefresh}
                                />
                            ) : (
                                <div className="text-center text-gray-400 py-12">
                                    <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
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
                                {pools.length > 0
                                    ? (pools.reduce((sum, p) => sum + p.apy, 0) / pools.length).toFixed(1)
                                    : '0.0'
                                }
                                %
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
