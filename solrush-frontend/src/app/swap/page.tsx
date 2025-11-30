'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/layout/Navbar';
import { SwapInterface } from '@/components/trading/SwapInterface';

// Import TradingChart dynamically with SSR disabled to prevent hydration errors
const TradingChart = dynamic(
  () => import('@/components/trading/TradingChart').then(mod => ({ default: mod.TradingChart })),
  { ssr: false }
);

/**
 * Swap Page - Main trading interface
 * Features: Token swapping, limit orders, buy/sell tabs, price chart
 */
export default function SwapPage() {
  const [selectedInputToken, setSelectedInputToken] = useState('SOL');
  const [selectedOutputToken, setSelectedOutputToken] = useState('USDC');
  const [isMounted, setIsMounted] = useState(false);

  // Ensure client-side only rendering for chart
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden selection:bg-purple-500/30">
      <Navbar />

      {/* Background Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content - Added pt-24 to prevent navbar overlap */}
      <main className="relative z-10 min-h-screen pt-24 px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              Trade
            </h1>
            <p className="text-white/40 text-lg">
              Swap, limit orders, buy, or sell tokens
            </p>
          </div>

          {/* Two-column layout - Chart first (left), Swap second (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Trading Chart - Left Side */}
            <div className="w-full lg:order-1">
              {isMounted ? (
                <TradingChart
                  tokenPair={`${selectedInputToken}/${selectedOutputToken}`}
                  inputToken={selectedInputToken}
                  outputToken={selectedOutputToken}
                />
              ) : (
                <div className="w-full h-[400px] bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 shadow-xl flex items-center justify-center">
                  <div className="text-white/30">Loading chart...</div>
                </div>
              )}
            </div>

            {/* Swap Interface - Right Side */}
            <div className="w-full max-w-lg mx-auto lg:mx-0 lg:ml-auto lg:order-2">
              <SwapInterface
                onTokenChange={(input, output) => {
                  setSelectedInputToken(input);
                  setSelectedOutputToken(output);
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
