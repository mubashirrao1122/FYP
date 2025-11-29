'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Zap, Coins, Gift, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { StatCard } from '@/components/ui/stat-card';
import { PoolCard } from '@/components/ui/pool-card';
import { Button } from '@/components/ui/button';

/**
 * Module 5.3: Landing Page
 * 
 * Sleek, modern homepage with hero section, features, stats, and pools
 */
export default function HomePage() {
  const router = useRouter();
  const { publicKey } = useWallet();

  const handleLaunchApp = () => {
    router.push('/swap');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0a0a1a] to-black text-white overflow-hidden">
      {/* Navbar */}
      <Navbar />

      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Purple gradient blob */}
        <div className="absolute top-40 -right-32 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        {/* Green gradient blob */}
        <div className="absolute bottom-40 -left-32 w-96 h-96 bg-green-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative">
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center space-y-8">
            {/* Main Heading */}
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black bg-gradient-to-r from-purple-400 via-purple-300 to-green-400 bg-clip-text text-transparent leading-tight">
                Trade on Solana at Lightning Speed
              </h1>
              <p className="text-lg sm:text-xl text-white/70 max-w-3xl mx-auto">
                Swap tokens, provide liquidity, and earn RUSH rewards all in one place. Fast, secure, and rewarding.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={handleLaunchApp}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all gap-2"
              >
                Launch App
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="px-8 py-3 border-white/20 hover:bg-white/10 font-bold rounded-xl"
              >
                Learn More
              </Button>
            </div>

            {/* Wallet Connection */}
            {!publicKey && (
              <div className="pt-4">
                <p className="text-white/60 text-sm mb-3">Connect your wallet to get started</p>
                <div className="flex justify-center">
                  <WalletMultiButton className="!bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-700 hover:to-green-700" />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-y border-white/10 bg-white/5 backdrop-blur-lg py-12 px-4 sm:px-6 lg:px-8">
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
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Why SolRush?</h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Experience the best decentralized exchange on Solana
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1: Fast */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur" />
              <div className="relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 h-full">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Lightning Fast</h3>
                <p className="text-white/60">
                  Sub-second transactions on Solana's high-speed blockchain. Trade without delays.
                </p>
              </div>
            </div>

            {/* Feature 2: Cheap */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur" />
              <div className="relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 h-full">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
                  <Coins className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Low Fees</h3>
                <p className="text-white/60">
                  Trading fees less than $0.01 per transaction. Save more on every trade.
                </p>
              </div>
            </div>

            {/* Feature 3: Rewards */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur" />
              <div className="relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 h-full">
                <div className="bg-gradient-to-br from-yellow-500 to-orange-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/30">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Earn Rewards</h3>
                <p className="text-white/60">
                  Earn up to 50% APY in RUSH tokens by providing liquidity to pools.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">How It Works</h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Get started with SolRush in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: 1, title: 'Connect Wallet', desc: 'Link your Phantom or Solflare wallet' },
              { step: 2, title: 'Swap or Add Liquidity', desc: 'Trade tokens or provide liquidity to earn' },
              { step: 3, title: 'Earn RUSH Rewards', desc: 'Collect rewards daily at 50% APY' },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-green-500 flex items-center justify-center mb-4 font-bold text-2xl shadow-lg shadow-purple-500/30">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-white/60 text-center">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Pools */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Featured Pools</h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Explore our most popular liquidity pools with high APY
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <PoolCard
              token1={{ symbol: 'SOL', icon: '◎', reserve: '125,000' }}
              token2={{ symbol: 'USDC', icon: '💵', reserve: '2.5M' }}
              apy="45%"
              fee="0.3%"
              tvl="$5.2M"
              onAddLiquidity={() => router.push('/swap')}
              onRemoveLiquidity={() => router.push('/swap')}
            />
            <PoolCard
              token1={{ symbol: 'SOL', icon: '◎', reserve: '95,000' }}
              token2={{ symbol: 'USDT', icon: '💴', reserve: '2.1M' }}
              apy="40%"
              fee="0.3%"
              tvl="$4.8M"
              onAddLiquidity={() => router.push('/swap')}
              onRemoveLiquidity={() => router.push('/swap')}
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-purple-600/20 to-green-600/20 border border-white/10 rounded-2xl p-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-white/70 mb-8 max-w-2xl mx-auto">
              Join thousands of traders and liquidity providers earning rewards on SolRush
            </p>
            <Button
              onClick={handleLaunchApp}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30"
            >
              Launch SolRush
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-black/40 backdrop-blur-lg py-12 px-4 sm:px-6 lg:px-8 mt-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-400" />
                  SolRush
                </h3>
                <p className="text-white/60 text-sm">
                  The fastest DEX on Solana
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Protocol</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="#" className="hover:text-white transition">Swap</a></li>
                  <li><a href="#" className="hover:text-white transition">Pools</a></li>
                  <li><a href="#" className="hover:text-white transition">Rewards</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Community</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="#" className="hover:text-white transition">Discord</a></li>
                  <li><a href="#" className="hover:text-white transition">Twitter</a></li>
                  <li><a href="#" className="hover:text-white transition">GitHub</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Legal</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="#" className="hover:text-white transition">Terms</a></li>
                  <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                  <li><a href="#" className="hover:text-white transition">Security</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 pt-8">
              <p className="text-center text-white/50 text-sm">
                © 2025 SolRush DEX. All rights reserved. Built on Solana.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
