'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Info, Plus, Settings, Loader2 } from 'lucide-react';
import { usePool } from '@/lib/hooks/usePool';
import { useToast } from '@/components/ui/use-toast';
import { SolIcon, UsdcIcon, UsdtIcon } from '@/components/icons/TokenIcons';
import { cn } from '@/lib/utils';

// Slippage presets in basis points
const SLIPPAGE_PRESETS = [
    { label: '0.1%', value: 10 },
    { label: '0.5%', value: 50 },
    { label: '1%', value: 100 },
    { label: '5%', value: 500 },
];

/**
 * AddLiquidity Component - Module 6.4
 * Allows users to provide liquidity to pools
 * Features dual token input, auto-calculation, LP token display, pool share percentage, and slippage settings
 */
export function AddLiquidity({ poolAddress }: { poolAddress: string }) {
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [tokenA] = useState('SOL');
  const [tokenB] = useState('USDC');
  const [showDetails, setShowDetails] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [slippageBps, setSlippageBps] = useState(50); // Default 0.5%
  const [customSlippage, setCustomSlippage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { pool, loading, addLiquidity, calculateLPTokens, calculatePoolShare } =
    usePool(poolAddress);

  // Auto-calculate second amount based on pool ratio (proportional amounts)
  useEffect(() => {
    if (amountA && parseFloat(amountA) > 0 && pool && pool.reserveA > 0) {
      const ratio = pool.reserveB / pool.reserveA;
      const calculated = (parseFloat(amountA) * ratio).toFixed(6);
      setAmountB(calculated);
    } else {
      setAmountB('');
    }
  }, [amountA, pool]);

  // Handle custom slippage input
  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setSlippageBps(Math.floor(parsed * 100));
    }
  };

  const lpTokensToReceive =
    amountA && amountB
      ? calculateLPTokens(parseFloat(amountA), parseFloat(amountB))
      : 0;

  const poolSharePercentage =
    lpTokensToReceive > 0
      ? calculatePoolShare(lpTokensToReceive)
      : 0;

  const handleAddLiquidity = async () => {
    if (!publicKey) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to continue.',
      });
      return;
    }

    if (!amountA || !amountB) {
      toast({
        title: 'Invalid Amounts',
        description: 'Please enter amounts for both tokens.',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const signature = await addLiquidity({
        amountA: parseFloat(amountA),
        amountB: parseFloat(amountB),
      });

      toast({
        title: 'Liquidity Added Successfully!',
        description: `Received ${lpTokensToReceive.toFixed(2)} LP tokens. TX: ${signature.slice(0, 8)}...`,
      });

      setAmountA('');
      setAmountB('');
    } catch (error: any) {
      toast({
        title: 'Failed to Add Liquidity',
        description: error.message || 'Transaction failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const exchangeRate = pool ? pool.reserveB / pool.reserveA : 0;

  if (loading) {
    return (
      <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
        <CardContent className="p-8 text-center">
          <p className="text-white/40">Loading pool data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!pool) {
    return (
      <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
        <CardContent className="p-8 text-center">
          <p className="text-white/40">Pool not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Add Liquidity</CardTitle>
            <CardDescription className="text-white/40">
              Provide liquidity to earn rewards from trading fees
            </CardDescription>
          </div>
          <button
            onClick={() => setShowSlippageSettings(!showSlippageSettings)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            title="Slippage Settings"
          >
            <Settings className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Slippage Settings Panel */}
        {showSlippageSettings && (
          <div className="mt-4 p-4 bg-black/20 rounded-xl border border-white/10">
            <div className="text-sm font-medium text-white/60 mb-3">Slippage Tolerance</div>
            <div className="flex gap-2 mb-3">
              {SLIPPAGE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setSlippageBps(preset.value);
                    setCustomSlippage('');
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    slippageBps === preset.value && !customSlippage
                      ? "bg-purple-600 text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Custom"
                value={customSlippage}
                onChange={(e) => handleCustomSlippage(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-24"
              />
              <span className="text-white/40 text-sm">%</span>
            </div>
            <p className="text-xs text-white/40 mt-2">
              Current: {(slippageBps / 100).toFixed(2)}% • Higher slippage = more likely to succeed
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Token A Input */}
        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-white/40">
              You Pay
            </label>
            <div className="text-xs text-white/40">Balance: 10.5 {tokenA}</div>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              placeholder="0.0"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
            />
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white font-bold min-w-[100px] justify-center">
              <SolIcon className="w-5 h-5" />
              {tokenA}
            </div>
          </div>
        </div>

        {/* Plus Icon */}
        <div className="flex justify-center -my-3 relative z-10">
          <div className="bg-[#1a1a1a] p-2 rounded-full border border-white/10 text-white/40">
            <Plus className="w-4 h-4" />
          </div>
        </div>

        {/* Token B Input */}
        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-white/40">
              You Pay
            </label>
            <div className="text-xs text-white/40">Balance: 250 {tokenB}</div>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              placeholder="0.0"
              value={amountB}
              readOnly
              className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
            />
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white font-bold min-w-[100px] justify-center">
              <UsdcIcon className="w-5 h-5" />
              {tokenB}
            </div>
          </div>
        </div>

        {/* Pool Details */}
        {amountA && (
          <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-white">
                  Liquidity Details
                </h3>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>

              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/40">Exchange Rate</span>
                  <span className="text-white font-medium">
                    1 {tokenA} = {exchangeRate.toFixed(2)} {tokenB}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">LP Tokens to Receive</span>
                  <span className="text-white font-medium">
                    {lpTokensToReceive.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Your Pool Share</span>
                  <span className="text-green-400 font-medium">
                    {poolSharePercentage.toFixed(4)}%
                  </span>
                </div>
              </div>
            </div>

            {showDetails && (
              <div className="pt-3 border-t border-white/10 text-xs text-white/40 space-y-2">
                <div>
                  <strong className="text-white/70">Pool Info:</strong>
                </div>
                <div className="flex justify-between">
                  <span>{tokenA} Reserve:</span>
                  <span className="text-white">
                    {pool.reserveA.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{tokenB} Reserve:</span>
                  <span className="text-white">
                    {pool.reserveB.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total LP Supply:</span>
                  <span className="text-white">
                    {pool.totalLPSupply.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>APY:</span>
                  <span className="text-green-400">{pool.apy}%</span>
                </div>
                <div className="flex justify-between">
                  <span>TVL:</span>
                  <span className="text-white">
                    ${pool.tvl.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warning about price range */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-200/80">
          <strong>Note:</strong> Your liquidity is concentrated at the current
          pool ratio. Consider adding liquidity at different price ranges for
          better returns.
        </div>

        {/* Add Liquidity Button */}
        <Button
          onClick={handleAddLiquidity}
          disabled={!publicKey || loading || isSubmitting || !amountA || !amountB}
          className="w-full h-14 text-lg bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!publicKey ? (
            'Connect Wallet'
          ) : isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Adding Liquidity...
            </span>
          ) : loading ? (
            'Loading Pool...'
          ) : (
            'Add Liquidity'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
