import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Zap, Coins, Gift, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { StatCard } from '@/components/ui/stat-card';
import { PoolCard } from '@/components/ui/pool-card';
import { Button } from '@/components/ui/button';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';

interface HomeViewProps {
    publicKey: any;
    handleLaunchApp: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ publicKey, handleLaunchApp }) => {
    return (
        <div className="min-h-screen bg-black relative overflow-hidden selection:bg-purple-500/30">
            {/* Navbar */}
            <Navbar />

            {/* Background Glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 pt-24">
                {/* Hero Section */}
                <section className="pt-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="text-center space-y-8">
                        {/* Main Heading */}
                        <div className="space-y-4">
                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight">
                                Trade on Solana at <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-green-400">Lightning Speed</span>
                            </h1>
                            <p className="text-lg sm:text-xl text-white/40 max-w-3xl mx-auto">
                                Swap tokens, provide liquidity, and earn RUSH rewards all in one place. Fast, secure, and rewarding.
                            </p>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button
                                onClick={handleLaunchApp}
                                className="px-8 py-6 text-lg bg-white text-black hover:bg-white/90 font-bold rounded-xl shadow-xl shadow-white/10 transition-all gap-2"
                            >
                                Launch App
                                <ArrowRight className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="outline"
                                className="px-8 py-6 text-lg border-white/10 hover:bg-white/5 text-white font-bold rounded-xl backdrop-blur-sm"
                            >
                                Learn More
                            </Button>
                        </div>

                        {/* Wallet Connection */}
                        {!publicKey && (
                            <div className="pt-8">
                                <p className="text-white/40 text-sm mb-4">Connect your wallet to get started</p>
                                <div className="flex justify-center">
                                    <WalletMultiButton className="!bg-[#512da8] hover:!bg-[#4527a0] !h-12 !rounded-xl !font-bold" />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Stats Bar */}
                <section className="border-y border-white/5 bg-white/5 backdrop-blur-sm py-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
                            <StatCard label="Total Value Locked" value="$2.5M" />
                            <StatCard label="24h Volume" value="$450K" trend="up" trendValue="+12.5%" />
                            <StatCard label="Active Pools" value="342" />
                            <StatCard label="RUSH Distributed" value="1.2M" />
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Why SolRush?</h2>
                        <p className="text-white/40 text-lg max-w-2xl mx-auto">
                            Experience the best decentralized exchange on Solana
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1: Fast */}
                        <div className="group relative">
                            <div className="absolute inset-0 bg-purple-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300 h-full">
                                <div className="bg-purple-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
                                    <Zap className="h-7 w-7 text-purple-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Lightning Fast</h3>
                                <p className="text-white/40 leading-relaxed">
                                    Sub-second transactions on Solana's high-speed blockchain. Trade without delays.
                                </p>
                            </div>
                        </div>

                        {/* Feature 2: Cheap */}
                        <div className="group relative">
                            <div className="absolute inset-0 bg-green-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300 h-full">
                                <div className="bg-green-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-green-500/20">
                                    <Coins className="h-7 w-7 text-green-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Low Fees</h3>
                                <p className="text-white/40 leading-relaxed">
                                    Trading fees less than $0.01 per transaction. Save more on every trade.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3: Rewards */}
                        <div className="group relative">
                            <div className="absolute inset-0 bg-yellow-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300 h-full">
                                <div className="bg-yellow-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-yellow-500/20">
                                    <Gift className="h-7 w-7 text-yellow-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Earn Rewards</h3>
                                <p className="text-white/40 leading-relaxed">
                                    Earn up to 50% APY in RUSH tokens by providing liquidity to pools.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">How It Works</h2>
                        <p className="text-white/40 text-lg max-w-2xl mx-auto">
                            Get started with SolRush in three simple steps
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: 1, title: 'Connect Wallet', desc: 'Link your Phantom or Solflare wallet' },
                            { step: 2, title: 'Swap or Add Liquidity', desc: 'Trade tokens or provide liquidity to earn' },
                            { step: 3, title: 'Earn RUSH Rewards', desc: 'Collect rewards daily at 50% APY' },
                        ].map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center group">
                                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 font-black text-3xl text-white group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-purple-500/5">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                <p className="text-white/40 text-center max-w-xs">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Featured Pools */}
                <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Featured Pools</h2>
                        <p className="text-white/40 text-lg max-w-2xl mx-auto">
                            Explore our most popular liquidity pools with high APY
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <PoolCard
                            token1={{ symbol: 'SOL', icon: <SolIcon className="w-6 h-6" />, reserve: '125,000' }}
                            token2={{ symbol: 'USDC', icon: <UsdcIcon className="w-6 h-6" />, reserve: '2.5M' }}
                            apy="45%"
                            fee="0.3%"
                            tvl="$5.2M"
                            onAddLiquidity={handleLaunchApp}
                            onRemoveLiquidity={handleLaunchApp}
                        />
                        <PoolCard
                            token1={{ symbol: 'SOL', icon: <SolIcon className="w-6 h-6" />, reserve: '95,000' }}
                            token2={{ symbol: 'USDT', icon: <UsdtIcon className="w-6 h-6" />, reserve: '2.1M' }}
                            apy="40%"
                            fee="0.3%"
                            tvl="$4.8M"
                            onAddLiquidity={handleLaunchApp}
                            onRemoveLiquidity={handleLaunchApp}
                        />
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="bg-gradient-to-r from-purple-900/20 to-green-900/20 border border-white/10 rounded-3xl p-12 text-center backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
                        <div className="relative z-10">
                            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6 tracking-tight">Ready to get started?</h2>
                            <p className="text-white/40 mb-10 max-w-2xl mx-auto text-lg">
                                Join thousands of traders and liquidity providers earning rewards on SolRush
                            </p>
                            <Button
                                onClick={handleLaunchApp}
                                className="px-10 py-6 text-lg bg-white text-black hover:bg-white/90 font-bold rounded-xl shadow-xl shadow-white/10 transition-all"
                            >
                                Launch SolRush
                                <ArrowRight className="h-5 w-5 ml-2" />
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-white/5 bg-black py-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-4 gap-12 mb-12">
                            <div>
                                <h3 className="font-black text-xl mb-6 flex items-center gap-2 text-white">
                                    <Zap className="h-6 w-6 text-purple-400" />
                                    SolRush
                                </h3>
                                <p className="text-white/40 text-sm leading-relaxed">
                                    The fastest DEX on Solana. Built for speed, designed for liquidity.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-6">Protocol</h4>
                                <ul className="space-y-4 text-sm text-white/40">
                                    <li><a href="#" className="hover:text-white transition-colors">Swap</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Pools</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Rewards</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-6">Community</h4>
                                <ul className="space-y-4 text-sm text-white/40">
                                    <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-6">Legal</h4>
                                <ul className="space-y-4 text-sm text-white/40">
                                    <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-t border-white/5 pt-8">
                            <p className="text-center text-white/20 text-sm">
                                © 2025 SolRush DEX. All rights reserved. Built on Solana.
                            </p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

