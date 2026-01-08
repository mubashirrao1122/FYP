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
    const themeKey = 'solrush-theme';
    const stored = window.localStorage.getItem(themeKey);
    if (!stored) {
      window.localStorage.setItem(themeKey, 'dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0E14] transition-colors duration-200 selection:bg-[#8B5CF6]/20">
      <Navbar />

      {/* Main Content - Added pt-24 to prevent navbar overlap */}
      <main className="relative z-10 min-h-screen pt-24 px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl sm:text-5xl font-semibold text-[#0F172A] dark:text-[#E5E7EB] tracking-tight">
              Trade
            </h1>
            <p className="text-[#475569] dark:text-[#9CA3AF] text-base sm:text-lg">
              Swap, place limit orders, or execute routed trades with predictable pricing.
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
                <div className="w-full h-[400px] bg-white dark:bg-[#121826] rounded-2xl border border-[#E2E8F0] dark:border-white/10 p-6 flex items-center justify-center transition-colors duration-200">
                  <div className="text-[#94A3B8] dark:text-[#6B7280]">Loading chart...</div>
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
