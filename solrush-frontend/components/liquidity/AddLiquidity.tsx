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
import { useTransaction } from '@/lib/hooks/useTransaction';
import { TransactionStatus } from '@/components/common/TransactionStatus';
import { usePool } from '@/lib/hooks/usePool';
import { useGlobalStore } from '@/components/providers/GlobalStoreProvider';
import { useTokenBalance } from '@/lib/hooks/useBalance';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Settings, Plus, Info, Loader2 } from 'lucide-react';
import { SolIcon, UsdcIcon, UsdtIcon, RushIcon, WethIcon } from '@/components/icons/TokenIcons';
import { TOKEN_DECIMALS } from '@/lib/constants';

const SLIPPAGE_PRESETS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

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

interface AddLiquidityProps {
  poolAddress: string;
  onSuccess?: () => void;
}

export function AddLiquidity({ poolAddress, onSuccess }: AddLiquidityProps) {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { pools } = useGlobalStore();

  // Get pool info from global store to determine token symbols
  const poolInfo = pools.getPoolByAddress(poolAddress);
  const tokenA = poolInfo?.tokens[0] || 'SOL';
  const tokenB = poolInfo?.tokens[1] || 'USDC';

  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [slippageBps, setSlippageBps] = useState(50); // Default 0.5%
  const [customSlippage, setCustomSlippage] = useState('');

  // Use the pool hook with token symbols
  const { pool, loading, addLiquidity, calculateLPTokens, calculatePoolShare, fetchPoolData } =
    usePool(poolAddress, tokenA, tokenB);

  const { status, signature, error, sendTransaction, reset } = useTransaction();

  // Fetch real-time balances
  const tokenABalance = useTokenBalance(tokenA);
  const tokenBBalance = useTokenBalance(tokenB);

  // Calculate LP tokens and pool share
  const lpTokensToReceive = amountA && amountB ? calculateLPTokens(parseFloat(amountA), parseFloat(amountB)) : 0;
  const poolSharePercentage = lpTokensToReceive ? calculatePoolShare(lpTokensToReceive) : 0;

  // Get token decimals for normalization
  const tokenADecimals = TOKEN_DECIMALS[tokenA] || 9;
  const tokenBDecimals = TOKEN_DECIMALS[tokenB] || 6;

  // Auto-calculate amount B based on pool ratio (normalized)
  useEffect(() => {
    if (amountA && pool && pool.reserveA > 0) {
      // Normalize reserves to human-readable values before calculating ratio
      const normalizedReserveA = pool.reserveA / Math.pow(10, tokenADecimals);
      const normalizedReserveB = pool.reserveB / Math.pow(10, tokenBDecimals);
      const ratio = normalizedReserveB / normalizedReserveA;
      const calculatedB = parseFloat(amountA) * ratio;
      setAmountB(calculatedB.toFixed(6));
    } else if (!amountA) {
      setAmountB('');
    }
  }, [amountA, pool, tokenADecimals, tokenBDecimals]);

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    if (value) {
      const bps = Math.round(parseFloat(value) * 100);
      if (bps > 0 && bps <= 5000) {
        setSlippageBps(bps);
      }
    }
  };

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
      await sendTransaction(
        () => addLiquidity({
          amountA: parseFloat(amountA),
          amountB: parseFloat(amountB),
        }),
        'add_liquidity'
      );

      toast({
        title: 'Liquidity Added Successfully!',
        description: `Received ${lpTokensToReceive.toFixed(4)} LP tokens`,
      });

      setAmountA('');
      setAmountB('');

      // Refresh pool data after adding liquidity
      await fetchPoolData();

      // Refresh global pools
      pools.refreshPools();

      // Call success callback if provided
      onSuccess?.();
    } catch (error: any) {
      console.error('Add liquidity failed:', error);
    }
  };

  // Calculate normalized exchange rate
  const exchangeRate = pool && pool.reserveA > 0
    ? (pool.reserveB / Math.pow(10, tokenBDecimals)) / (pool.reserveA / Math.pow(10, tokenADecimals))
    : 0;

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
          <p className="text-white/40">Pool not found. Make sure the pool is created first.</p>
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
              {tokenA}/{tokenB} Pool • Provide liquidity to earn trading fees
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
                      ? "bg-#22C1AE text-white"
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
            <label className="text-sm font-medium text-white/40">You Pay</label>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>Balance: {tokenABalance.loading ? '...' : tokenABalance.balance.toFixed(4)} {tokenA}</span>
              <button
                onClick={() => setAmountA(tokenABalance.balance.toString())}
                disabled={tokenABalance.loading || tokenABalance.balance === 0}
                className="text-#2DD4BF hover:text-#22C1AE font-medium transition-colors disabled:opacity-50"
              >
                Max
              </button>
            </div>
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
              {getTokenIcon(tokenA)}
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
            <label className="text-sm font-medium text-white/40">You Pay</label>
            <div className="text-xs text-white/40">
              Balance: {tokenBBalance.loading ? '...' : tokenBBalance.balance.toFixed(4)} {tokenB}
            </div>
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
              {getTokenIcon(tokenB)}
              {tokenB}
            </div>
          </div>
        </div>

        {/* Pool Details */}
        {/* Pool Details */}
        {amountA && pool && (
          <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-white">Transaction Details</h3>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>

              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/40">Rate</span>
                  <span className="text-white font-medium">
                    1 {tokenA} = {exchangeRate.toFixed(4)} {tokenB}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Price Impact</span>
                  <span className="text-white font-medium">
                    &lt; 0.01%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Share of Pool</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 line-through text-xs">
                      {/* Current share if user has any */}
                      {((pool.userLpBalance || 0) / (pool.totalLPSupply || 1) * 100).toFixed(4)}%
                    </span>
                    <span className="text-[#2DD4BF] font-medium">
                      {/* New share approx */}
                      {((pool.userLpBalance || 0) + lpTokensToReceive) / ((pool.totalLPSupply || 0) + lpTokensToReceive || 1) * 100 > 0 ? (((pool.userLpBalance || 0) + lpTokensToReceive) / ((pool.totalLPSupply || 0) + lpTokensToReceive || 1) * 100).toFixed(4) : "0.0000"}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {showDetails && (
              <div className="pt-3 border-t border-white/10 text-xs text-white/40 space-y-2">
                <div className="flex justify-between">
                  <span>Est. LP Tokens</span>
                  <span className="text-white font-mono">{lpTokensToReceive.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{tokenA} Reserve</span>
                  <span className="text-white">{pool.reserveA.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{tokenB} Reserve</span>
                  <span className="text-white">{pool.reserveB.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Liquidity Button */}
        <Button
          onClick={handleAddLiquidity}
          disabled={!publicKey || loading || status === 'pending' || status === 'confirming' || !amountA || !amountB}
          className="w-full h-14 text-lg bg-#22C1AE hover:bg-#1EB7A4 text-white font-bold rounded-xl shadow-lg shadow-#2DD4BF/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            `Add Liquidity to ${tokenA}/${tokenB}`
          )}
        </Button>

        {/* Transaction Status */}
        <TransactionStatus
          status={status}
          signature={signature}
          error={error}
          onRetry={() => {
            reset();
            handleAddLiquidity();
          }}
        />
      </CardContent>
    </Card >
  );
}
