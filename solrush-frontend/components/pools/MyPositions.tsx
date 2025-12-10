'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PoolCard } from '@/components/ui/pool-card';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';

interface Pool {
    id: string;
    name: string;
    address: string;
    tokens: [string, string];
    reserveA?: number;
    reserveB?: number;
    formattedReserveA?: string;
    formattedReserveB?: string;
    tvl: number;
    apy: number;
    fee: number;
    lpBalance?: number;
    userShare?: number;
    positionValue?: number;
    volume24h?: number;
}

interface MyPositionsProps {
    pools: Pool[];
    loading?: boolean;
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

export const MyPositions: React.FC<MyPositionsProps> = ({ pools, loading, onRefresh }) => {
    const { connection } = useConnection();
    const { publicKey, connected } = useWallet();
    const router = useRouter();

    const [userPositions, setUserPositions] = useState<Pool[]>([]);
    const [fetchingPositions, setFetchingPositions] = useState(false);

    useEffect(() => {
        if (connected && publicKey) {
            fetchUserPositions();
        } else {
            setUserPositions([]);
        }
    }, [connected, publicKey, pools]);

    const fetchUserPositions = async () => {
        if (!publicKey || pools.length === 0) return;

        setFetchingPositions(true);
        try {
            // Fetch real LP balances from blockchain for each pool
            const { getAssociatedTokenAddress } = await import('@solana/spl-token');
            const { PublicKey } = await import('@solana/web3.js');
            
            const positionsWithBalances: Pool[] = [];
            
            for (const pool of pools) {
                try {
                    if (!pool.lpMint) continue;
                    
                    const lpMintPubkey = new PublicKey(pool.lpMint);
                    const userLpAccount = await getAssociatedTokenAddress(lpMintPubkey, publicKey);
                    
                    const balance = await connection.getTokenAccountBalance(userLpAccount);
                    const lpBalance = parseFloat(balance.value.uiAmountString || '0');
                    
                    if (lpBalance > 0) {
                        // Calculate user's share of the pool
                        const totalLpSupply = pool.totalLPSupply || 1;
                        const userShare = (lpBalance / totalLpSupply) * 100;
                        
                        // Calculate position value based on user's share
                        const positionValue = pool.tvl * (userShare / 100);
                        
                        positionsWithBalances.push({
                            ...pool,
                            lpBalance,
                            userShare,
                            positionValue,
                        });
                    }
                } catch (err) {
                    // User doesn't have LP tokens for this pool
                    console.log(`No LP tokens for pool ${pool.name}`);
                }
            }

            setUserPositions(positionsWithBalances);
        } catch (error) {
            console.error('Failed to fetch user positions:', error);
            setUserPositions([]);
        } finally {
            setFetchingPositions(false);
        }
    };

    const totalPositionValue = userPositions.reduce((sum, p) => sum + (p.positionValue || 0), 0);
    const totalEarnings = userPositions.reduce((sum, p) => {
        // Estimated earnings based on APY and position value
        const dailyEarnings = p.positionValue ? (p.positionValue * (p.apy / 100) / 365) : 0;
        return sum + dailyEarnings;
    }, 0);

    if (!connected) {
        return (
            <div className="text-center py-12">
                <Wallet className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
                <p className="text-white/40">
                    Connect your wallet to view your liquidity positions
                </p>
            </div>
        );
    }

    if (loading || fetchingPositions) {
        return (
            <div className="flex justify-center items-center py-12">
                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="ml-3 text-white/60">Loading positions...</span>
            </div>
        );
    }

    if (userPositions.length === 0) {
        return (
            <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Positions Yet</h3>
                <p className="text-white/40 mb-6">
                    You don't have any liquidity positions. Add liquidity to a pool to start earning!
                </p>
                <Button
                    onClick={() => router.push('/pools')}
                    variant="default"
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                >
                    Browse Pools
                </Button>
            </div>
        );
    }

    return (
        <div>
            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="text-white/40 text-sm mb-2">Total Position Value</div>
                    <div className="text-3xl font-black text-white">
                        ${totalPositionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="text-white/40 text-sm mb-2">Daily Earnings (Est.)</div>
                    <div className="text-3xl font-black text-green-400">
                        ${totalEarnings.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <div className="text-white/40 text-sm mb-2">Active Positions</div>
                    <div className="text-3xl font-black text-white">
                        {userPositions.length}
                    </div>
                </div>
            </div>

            {/* Positions Grid */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Your Positions</h3>
                {onRefresh && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            onRefresh();
                            fetchUserPositions();
                        }}
                        className="text-white/40 hover:text-white"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userPositions.map((pool) => (
                    <div key={pool.id} className="relative">
                        {/* Position Badge */}
                        <div className="absolute top-4 right-4 z-10 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                            {pool.userShare?.toFixed(2)}% Share
                        </div>

                        <PoolCard
                            poolAddress={pool.address}
                            token1={{
                                symbol: pool.tokens[0],
                                icon: getTokenIcon(pool.tokens[0]),
                                reserve: pool.formattedReserveA || (pool.reserveA ?? 0).toLocaleString(),
                            }}
                            token2={{
                                symbol: pool.tokens[1],
                                icon: getTokenIcon(pool.tokens[1]),
                                reserve: pool.formattedReserveB || (pool.reserveB ?? 0).toLocaleString(),
                            }}
                            apy={`${pool.apy.toFixed(2)}%`}
                            tvl={pool.positionValue
                                ? `$${pool.positionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                : `$${pool.tvl.toFixed(2)}`
                            }
                            fee={`${pool.fee}%`}
                            onViewDetails={() => router.push(`/pools/${pool.address}`)}
                            onAddLiquidity={() => router.push(`/pools?tab=add&pool=${pool.address}`)}
                            onRemoveLiquidity={() => router.push(`/pools?tab=remove&pool=${pool.address}`)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
