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
import { ArrowUpDown, Info, Plus } from 'lucide-react';
import { usePool } from '@/lib/hooks/usePool';
import { useToast } from '@/components/ui/use-toast';
import { SolIcon, UsdcIcon } from '@/components/icons/TokenIcons';
import { cn } from '@/lib/utils';

/**
 * AddLiquidity Component - Module 6.4
 * Allows users to provide liquidity to pools
 * Features dual token input, auto-calculation, LP token display, and pool share percentage
 */
export function AddLiquidity({ poolAddress }: { poolAddress: string }) {
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [tokenA] = useState('SOL');
  const [tokenB] = useState('USDC');
  const [showDetails, setShowDetails] = useState(false);

  const { pool, loading, addLiquidity, calculateLPTokens, calculatePoolShare } =
    usePool(poolAddress);

  // Auto-calculate second amount based on pool ratio
  useEffect(() => {
    if (amountA && parseFloat(amountA) > 0) {
      const ratio = pool.reserveB / pool.reserveA;
      const calculated = (parseFloat(amountA) * ratio).toFixed(6);
      setAmountB(calculated);
    } else {
      setAmountB('');
    }
  }, [amountA, pool.reserveA, pool.reserveB]);

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
    }
  };

  const exchangeRate = pool.reserveB / pool.reserveA;

  return (
    <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
      <CardHeader>
        <CardTitle className="text-white">Add Liquidity</CardTitle>
        <CardDescription className="text-white/40">
          Provide liquidity to earn rewards from trading fees
        </CardDescription>
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
          disabled={!publicKey || loading || !amountA || !amountB}
          className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
        >
          {!publicKey
            ? 'Connect Wallet'
            : loading
              ? 'Adding Liquidity...'
              : 'Add Liquidity'}
        </Button>
      </CardContent>
    </Card>
  );
}
