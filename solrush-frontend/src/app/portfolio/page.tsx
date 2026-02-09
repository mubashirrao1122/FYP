'use client';

import { Navbar } from '@/components/layout/Navbar';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { AssetAllocation } from '@/components/portfolio/AssetAllocation';
import { PerformanceChart } from '@/components/portfolio/PerformanceChart';
import { AssetDetails } from '@/components/portfolio/AssetDetails';
import { TradeTable } from '@/components/portfolio/TradeTable';
import { usePortfolio } from '@/lib/hooks/usePortfolio';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2 } from 'lucide-react';

export default function PortfolioPage() {
    const { publicKey } = useWallet();
    const { portfolio, loading, error } = usePortfolio();

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] transition-colors duration-200">
            <Navbar />

            <main className="relative z-10 max-w-[1320px] mx-auto px-6 pt-24 pb-12">
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] dark:text-[#E5E7EB] tracking-tight mb-2">
                        Portfolio
                    </h1>
                    <p className="text-[#475569] dark:text-[#9CA3AF] text-sm sm:text-base">
                        Track your assets, trades, and performance across SolRush DEX
                    </p>
                </div>

                {!publicKey ? (
                    <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-12 text-center">
                        <p className="text-[#475569] dark:text-[#9CA3AF] text-lg">
                            Connect your wallet to view your portfolio
                        </p>
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-[#2DD4BF] dark:text-[#22C1AE]" />
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10 p-6">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Overview Metrics */}
                        <PortfolioOverview portfolio={portfolio} />

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <AssetAllocation holdings={portfolio.tokenHoldings} positions={portfolio.liquidityPositions} />
                            <PerformanceChart />
                        </div>

                        {/* Asset Details */}
                        <AssetDetails
                            tokenHoldings={portfolio.tokenHoldings}
                            liquidityPositions={portfolio.liquidityPositions}
                        />

                        {/* Trade History */}
                        <TradeTable transactions={portfolio.transactions} />
                    </div>
                )}
            </main>
        </div>
    );
}
