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
import { Info } from 'lucide-react';
import { usePool } from '@/lib/hooks/usePool';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface UserPosition {
  id: string;
  lpTokenAmount: number;
  amountA: number;
  amountB: number;
  liquidityUSD: number;
  feesEarned: number;
}

/**
 * RemoveLiquidity Component - Module 6.4
 * Allows users to remove liquidity from pools
 * Features LP token percentage selector, withdraw previews, and position management
 */
export function RemoveLiquidity({ poolAddress }: { poolAddress: string }) {
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const [lpTokenAmount, setLpTokenAmount] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [slippage, setSlippage] = useState(1.0);
  const [showDetails, setShowDetails] = useState(false);

  const { pool, loading, removeLiquidity } =
    usePool(poolAddress);

  // Mock user position
  const userPosition: UserPosition = {
    id: '1',
    lpTokenAmount: 100,
    amountA: 10,
    amountB: 10050,
    liquidityUSD: 20100,
    feesEarned: 250,
  };

  // Update LP token amount when percentage changes
  useEffect(() => {
    const amount = (userPosition.lpTokenAmount * percentage) / 100;
    setLpTokenAmount(amount.toFixed(6));
  }, [percentage, userPosition.lpTokenAmount]);

  // Calculate amounts to receive
  const withdrawPercentage = parseFloat(lpTokenAmount) / userPosition.lpTokenAmount || 0;
  const receivedAmountA = userPosition.amountA * withdrawPercentage;
  const receivedAmountB = userPosition.amountB * withdrawPercentage;
  const receivedUSD = userPosition.liquidityUSD * withdrawPercentage;

  const handleRemoveLiquidity = async () => {
    if (!publicKey) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to continue.',
      });
      return;
    }

    if (!lpTokenAmount || parseFloat(lpTokenAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid LP token amount.',
      });
      return;
    }

    try {
      const minAmountA = receivedAmountA * (1 - slippage / 100);
      const minAmountB = receivedAmountB * (1 - slippage / 100);

      const signature = await removeLiquidity({
        lpTokenAmount: parseFloat(lpTokenAmount),
        minAmountA,
        minAmountB,
      });

      toast({
        title: 'Liquidity Removed Successfully!',
        description: `Received ${receivedAmountA.toFixed(4)} SOL and ${receivedAmountB.toFixed(2)} USDC. TX: ${signature.slice(0, 8)}...`,
      });

      setLpTokenAmount('');
      setPercentage(0);
    } catch (error: any) {
      toast({
        title: 'Failed to Remove Liquidity',
        description: error.message || 'Transaction failed.',
      });
    }
  };

  return (
    <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
      <CardHeader>
        <CardTitle className="text-white">Remove Liquidity</CardTitle>
        <CardDescription className="text-white/40">
          Withdraw your tokens and close your liquidity position
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Your Position Summary */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-3">
            Your Position
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-white/40">LP Tokens</span>
              <div className="text-white font-medium text-lg">
                {userPosition.lpTokenAmount.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-white/40">Liquidity Value</span>
              <div className="text-white font-medium text-lg">
                ${userPosition.liquidityUSD.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-white/40">Fees Earned</span>
              <div className="text-green-400 font-medium text-lg">
                +${userPosition.feesEarned.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-white/40">Pool Share</span>
              <div className="text-white font-medium text-lg">0.50%</div>
            </div>
          </div>
        </div>

        {/* Percentage Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/40">
            Percentage to Withdraw
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((value) => (
              <button
                key={value}
                onClick={() => setPercentage(value)}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-bold transition-all border',
                  percentage === value
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                )}
              >
                {value}%
              </button>
            ))}
          </div>
        </div>

        {/* LP Token Amount */}
        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-white/40">
              LP Tokens to Burn
            </label>
            <div className="text-xs text-white/40">Available: {userPosition.lpTokenAmount}</div>
          </div>
          <Input
            type="number"
            placeholder="0.0"
            value={lpTokenAmount}
            onChange={(e) => {
              setLpTokenAmount(e.target.value);
              const perc = (parseFloat(e.target.value) / userPosition.lpTokenAmount) * 100 || 0;
              setPercentage(Math.min(perc, 100));
            }}
            className="bg-transparent border-none text-3xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
          />
        </div>

        {/* Slippage Tolerance */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/40">
            Slippage Tolerance
          </label>
          <div className="flex gap-2">
            {[0.5, 1.0, 2.0].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border',
                  slippage === value
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                )}
              >
                {value}%
              </button>
            ))}
          </div>
        </div>

        {/* Withdrawal Preview */}
        {lpTokenAmount && parseFloat(lpTokenAmount) > 0 && (
          <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-white">You Receive</h3>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">SOL</span>
                <span className="text-white font-medium">
                  {receivedAmountA.toFixed(6)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">USDC</span>
                <span className="text-white font-medium">
                  {receivedAmountB.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-white/40">Total Value</span>
                <span className="text-white font-medium">
                  ${receivedUSD.toLocaleString()}
                </span>
              </div>
            </div>

            {showDetails && (
              <div className="pt-2 border-t border-white/10 text-xs text-white/40 space-y-1">
                <div className="flex justify-between">
                  <span>Min. Received (SOL):</span>
                  <span className="text-white">
                    {(receivedAmountA * (1 - slippage / 100)).toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Min. Received (USDC):</span>
                  <span className="text-white">
                    {(receivedAmountB * (1 - slippage / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warning */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-200/80">
          <strong>Note:</strong> Removing liquidity will close your position and
          permanently claim your earned fees.
        </div>

        {/* Remove Button */}
        <Button
          onClick={handleRemoveLiquidity}
          disabled={!publicKey || loading || !lpTokenAmount}
          className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
        >
          {!publicKey
            ? 'Connect Wallet'
            : loading
              ? 'Removing Liquidity...'
              : 'Remove Liquidity'}
        </Button>
      </CardContent>
    </Card>
  );
}
