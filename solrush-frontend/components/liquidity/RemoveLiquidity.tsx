'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTransaction } from '@/lib/hooks/useTransaction';
import { TransactionStatus } from '@/components/common/TransactionStatus';
import { usePool } from '@/lib/hooks/usePool';
import { useGlobalStore } from '@/components/providers/GlobalStoreProvider';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Minus, Info, Loader2, AlertTriangle, ArrowDown } from 'lucide-react';
import { SolIcon, UsdcIcon, UsdtIcon, RushIcon, WethIcon } from '@/components/icons/TokenIcons';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const getTokenIcon = (symbol: string) => {
  switch (symbol) {
    case 'SOL': return <SolIcon className="w-5 h-5" />;
    case 'USDC': return <UsdcIcon className="w-5 h-5" />;
    case 'USDT': return <UsdtIcon className="w-5 h-5" />;
    case 'RUSH': return <RushIcon className="w-5 h-5" />;
    case 'WETH': return <WethIcon className="w-5 h-5" />;
    default: return <span className="text-sm">?</span>;
  }
};

interface RemoveLiquidityProps {
  poolAddress: string;
  onSuccess?: () => void;
}

export function RemoveLiquidity({ poolAddress, onSuccess }: RemoveLiquidityProps) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  const { pools } = useGlobalStore();

  // Get pool info from global store to determine token symbols
  const poolInfo = pools.getPoolByAddress(poolAddress);
  const tokenA = poolInfo?.tokens[0] || 'SOL';
  const tokenB = poolInfo?.tokens[1] || 'USDC';

  const [lpTokenAmount, setLpTokenAmount] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [userLpBalance, setUserLpBalance] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Use the pool hook with token symbols
  const { pool, loading, removeLiquidity, calculateRemoveAmounts, fetchPoolData } =
    usePool(poolAddress, tokenA, tokenB);

  const { status, signature, error, sendTransaction, reset } = useTransaction();

  // Fetch user's LP token balance
  useEffect(() => {
    const fetchLpBalance = async () => {
      if (!publicKey || !poolInfo?.lpMint) return;

      setLoadingBalance(true);
      try {
        const lpMintPubkey = new PublicKey(poolInfo.lpMint);
        const userLpAccount = await getAssociatedTokenAddress(lpMintPubkey, publicKey);
        const balance = await connection.getTokenAccountBalance(userLpAccount);
        setUserLpBalance(parseFloat(balance.value.uiAmountString || '0'));
      } catch (err) {
        console.log('No LP tokens found');
        setUserLpBalance(0);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchLpBalance();
  }, [publicKey, poolInfo?.lpMint, connection]);

  // Calculate amounts to receive based on LP tokens
  const { amountA: receivedAmountA, amountB: receivedAmountB } = lpTokenAmount && pool
    ? calculateRemoveAmounts(parseFloat(lpTokenAmount))
    : { amountA: 0, amountB: 0 };

  // Update LP amount when percentage slider changes
  useEffect(() => {
    if (userLpBalance > 0) {
      const amount = (userLpBalance * percentage) / 100;
      setLpTokenAmount(amount > 0 ? amount.toFixed(6) : '');
    }
  }, [percentage, userLpBalance]);

  // Update percentage when LP amount input changes
  const handleLpAmountChange = (value: string) => {
    setLpTokenAmount(value);
    if (value && userLpBalance > 0) {
      const pct = (parseFloat(value) / userLpBalance) * 100;
      setPercentage(Math.min(100, Math.max(0, pct)));
    } else {
      setPercentage(0);
    }
  };

  const handlePercentagePreset = (pct: number) => {
    setPercentage(pct);
  };

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

    if (parseFloat(lpTokenAmount) > userLpBalance) {
      toast({
        title: 'Insufficient Balance',
        description: 'You don\'t have enough LP tokens.',
      });
      return;
    }

    try {
      // Use 1% slippage
      const minAmountA = receivedAmountA * 0.99;
      const minAmountB = receivedAmountB * 0.99;

      await sendTransaction(
        () => removeLiquidity({
          lpTokenAmount: parseFloat(lpTokenAmount),
          minAmountA,
          minAmountB,
        }),
        'remove_liquidity'
      );

      toast({
        title: 'Liquidity Removed Successfully!',
        description: `Received ${receivedAmountA.toFixed(4)} ${tokenA} and ${receivedAmountB.toFixed(4)} ${tokenB}`,
      });

      setLpTokenAmount('');
      setPercentage(0);

      // Refresh pool data
      await fetchPoolData();
      
      // Refresh global pools
      pools.refreshPools();

      // Refresh LP balance
      if (publicKey && poolInfo?.lpMint) {
        try {
          const lpMintPubkey = new PublicKey(poolInfo.lpMint);
          const userLpAccount = await getAssociatedTokenAddress(lpMintPubkey, publicKey);
          const balance = await connection.getTokenAccountBalance(userLpAccount);
          setUserLpBalance(parseFloat(balance.value.uiAmountString || '0'));
        } catch {
          setUserLpBalance(0);
        }
      }
      
      onSuccess?.();
    } catch (error: any) {
      console.error('Remove liquidity failed:', error);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-#2DD4BF animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading pool data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!pool) {
    return (
      <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
        <CardContent className="p-8 text-center">
          <p className="text-white/40">Pool not found. Make sure the pool exists.</p>
        </CardContent>
      </Card>
    );
  }

  const hasPosition = userLpBalance > 0;

  return (
    <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
      <CardHeader>
        <CardTitle className="text-white">Remove Liquidity</CardTitle>
        <CardDescription className="text-white/40">
          {tokenA}/{tokenB} Pool • Withdraw your tokens from the pool
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!publicKey ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-yellow-500/50 mx-auto mb-4" />
            <p className="text-white/60">Connect your wallet to remove liquidity</p>
          </div>
        ) : loadingBalance ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-#2DD4BF animate-spin mx-auto mb-4" />
            <p className="text-white/40">Loading your position...</p>
          </div>
        ) : !hasPosition ? (
          <div className="text-center py-8">
            <Info className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 mb-2">No liquidity position found</p>
            <p className="text-white/40 text-sm">Add liquidity to this pool first to have LP tokens to remove.</p>
          </div>
        ) : (
          <>
            {/* Your Position Summary */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/40 mb-2">Your Position</div>
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-lg">
                  {userLpBalance.toFixed(6)} LP Tokens
                </span>
                <span className="text-white/40 text-sm">
                  ≈ ${((poolInfo?.tvl || 0) * (userLpBalance / (poolInfo?.totalLPSupply || 1))).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Percentage Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white/60">Amount to Remove</span>
                <span className="text-2xl font-bold text-white">{percentage.toFixed(0)}%</span>
              </div>
              
              <Slider
                value={[percentage]}
                onValueChange={([value]) => setPercentage(value)}
                max={100}
                step={1}
                className="w-full"
              />
              
              {/* Percentage Presets */}
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePercentagePreset(pct)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                      percentage === pct
                        ? "bg-#22C1AE text-white"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* LP Token Input */}
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-white/40">LP Tokens to Remove</label>
                <div className="text-xs text-white/40">
                  Balance: {userLpBalance.toFixed(6)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={lpTokenAmount}
                  onChange={(e) => handleLpAmountChange(e.target.value)}
                  className="bg-transparent border-none text-2xl font-bold h-auto focus:ring-0 px-0 placeholder:text-white/20 w-full text-white"
                />
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white font-bold min-w-[80px] justify-center text-sm">
                  LP
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center -my-2">
              <div className="bg-[#1a1a1a] p-2 rounded-full border border-white/10 text-white/40">
                <ArrowDown className="w-4 h-4" />
              </div>
            </div>

            {/* Receive Section */}
            <div className="space-y-3">
              <div className="text-sm text-white/40">You Will Receive</div>
              
              {/* Token A */}
              <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {getTokenIcon(tokenA)}
                  <span className="text-white font-medium">{tokenA}</span>
                </div>
                <span className="text-xl font-bold text-white">
                  {receivedAmountA.toFixed(6)}
                </span>
              </div>

              {/* Token B */}
              <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {getTokenIcon(tokenB)}
                  <span className="text-white font-medium">{tokenB}</span>
                </div>
                <span className="text-xl font-bold text-white">
                  {receivedAmountB.toFixed(6)}
                </span>
              </div>
            </div>

            {/* Pool Details */}
            {lpTokenAmount && parseFloat(lpTokenAmount) > 0 && (
              <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-white">Withdrawal Details</h3>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/40">LP Tokens to Burn</span>
                    <span className="text-white font-medium">{parseFloat(lpTokenAmount).toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Slippage Tolerance</span>
                    <span className="text-white font-medium">1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Min {tokenA} Received</span>
                    <span className="text-white font-medium">{(receivedAmountA * 0.99).toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Min {tokenB} Received</span>
                    <span className="text-white font-medium">{(receivedAmountB * 0.99).toFixed(6)}</span>
                  </div>
                </div>

                {showDetails && (
                  <div className="pt-3 border-t border-white/10 text-xs text-white/40 space-y-2">
                    <div><strong className="text-white/70">Current Pool Reserves:</strong></div>
                    <div className="flex justify-between">
                      <span>{tokenA} Reserve:</span>
                      <span className="text-white">{pool.reserveA.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tokenB} Reserve:</span>
                      <span className="text-white">{pool.reserveB.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total LP Supply:</span>
                      <span className="text-white">{pool.totalLPSupply.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warning */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-200/80">
              <strong>Note:</strong> Removing liquidity will burn your LP tokens. You will receive the underlying tokens based on the current pool ratio.
            </div>

            {/* Remove Liquidity Button */}
            <Button
              onClick={handleRemoveLiquidity}
              disabled={!publicKey || loading || status === 'pending' || status === 'confirming' || !lpTokenAmount || parseFloat(lpTokenAmount) <= 0}
              className="w-full h-14 text-lg bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!publicKey ? (
                'Connect Wallet'
              ) : status === 'pending' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Approving...
                </span>
              ) : status === 'confirming' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Confirming...
                </span>
              ) : loading ? (
                'Loading Pool...'
              ) : (
                `Remove Liquidity from ${tokenA}/${tokenB}`
              )}
            </Button>

            {/* Transaction Status */}
            <TransactionStatus
              status={status}
              signature={signature}
              error={error}
              onRetry={() => {
                reset();
                handleRemoveLiquidity();
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
