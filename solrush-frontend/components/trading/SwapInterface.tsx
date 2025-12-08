'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TokenSelect } from '@/components/ui/token-select';
import { Settings } from 'lucide-react';
import { useSwap } from '@/lib/hooks/useSwap';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { SwapTab } from './SwapTab';
import { BuyTab } from './BuyTab';
import { SellTab } from './SellTab';

interface LimitOrder {
  id: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  targetPrice: number;
  status: 'pending' | 'executed' | 'cancelled';
  expiresAt: Date;
  createdAt: Date;
}

interface SwapInterfaceProps {
  onTokenChange?: (inputToken: string, outputToken: string) => void;
}

/**
 * SwapInterface Component - Module 6.1, 6.2, 6.3
 * Complete trading interface with Swap, Limit, Buy, and Sell tabs
 * Features real-time quotes, slippage tolerance, and order management
 */
export function SwapInterface({ onTokenChange }: SwapInterfaceProps = {}) {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { loading } = useSwap();

  // Swap state
  const [slippageTolerance, setSlippageTolerance] = useState(1.0);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);

  // Limit order state
  const [limitTargetPrice, setLimitTargetPrice] = useState('');
  const [limitInputAmount, setLimitInputAmount] = useState('');
  const [limitInputToken, setLimitInputToken] = useState('SOL');
  const [limitOutputToken, setLimitOutputToken] = useState('USDC');
  const [limitExpiry, setLimitExpiry] = useState('1');
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([
    {
      id: '1',
      inputToken: 'SOL',
      outputToken: 'USDC',
      inputAmount: 5,
      targetPrice: 95,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    },
  ]);

  const handleCreateLimitOrder = async () => {
    if (!publicKey) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to continue.',
      });
      return;
    }

    if (
      !limitInputAmount ||
      !limitTargetPrice ||
      parseFloat(limitInputAmount) <= 0 ||
      parseFloat(limitTargetPrice) <= 0
    ) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter valid amount and price.',
      });
      return;
    }

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(limitExpiry));

      const newOrder: LimitOrder = {
        id: Date.now().toString(),
        inputToken: limitInputToken,
        outputToken: limitOutputToken,
        inputAmount: parseFloat(limitInputAmount),
        targetPrice: parseFloat(limitTargetPrice),
        status: 'pending',
        expiresAt,
        createdAt: new Date(),
      };

      setLimitOrders([...limitOrders, newOrder]);

      toast({
        title: 'Limit Order Created',
        description: `Order to sell ${limitInputAmount} ${limitInputToken} at ${limitTargetPrice} created.`,
      });

      setLimitInputAmount('');
      setLimitTargetPrice('');
    } catch (error: any) {
      toast({
        title: 'Order Creation Failed',
        description: error.message || 'Failed to create order.',
      });
    }
  };

  const handleCancelLimitOrder = (orderId: string) => {
    setLimitOrders(
      limitOrders.map((order) =>
        order.id === orderId ? { ...order, status: 'cancelled' as const } : order
      )
    );

    toast({
      title: 'Order Cancelled',
      description: 'Limit order has been cancelled.',
    });
  };

  return (
    <Card className="w-full border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-white">Swap</CardTitle>
          </div>
          <button
            onClick={() => setShowSlippageSettings(!showSlippageSettings)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            title="Slippage settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Slippage Settings */}
        {showSlippageSettings && (
          <div className="mt-4 p-4 bg-black/20 rounded-xl border border-white/5 animate-in slide-in-from-top-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-3">
              Slippage Tolerance
            </label>
            <div className="flex gap-2">
              {[0.1, 0.5, 1.0, 3.0].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippageTolerance(value)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    slippageTolerance === value
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  )}
                >
                  {value}%
                </button>
              ))}
            </div>
            <div className="relative mt-3">
              <input
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={slippageTolerance}
                onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                placeholder="Custom %"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="swap" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="swap">Swap</TabsTrigger>
            <TabsTrigger value="limit">Limit</TabsTrigger>
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>

          {/* SWAP TAB - Module 6.1 */}
          <TabsContent value="swap" className="space-y-4">
            <SwapTab
              slippageTolerance={slippageTolerance}
              onTokenChange={onTokenChange}
            />
          </TabsContent>

          {/* LIMIT ORDER TAB - Module 6.2 */}
          <TabsContent value="limit" className="space-y-4">
            {/* Limit Order Form */}
            <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
              <h3 className="text-sm font-semibold text-white">Create Order</h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">
                  Sell Token
                </label>
                <TokenSelect
                  value={limitInputToken}
                  onChange={(token) => {
                    const symbol = typeof token === 'string' ? token : token.symbol;
                    setLimitInputToken(symbol);
                  }}
                  exclude={[limitOutputToken]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">
                  Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={limitInputAmount}
                  onChange={(e) => setLimitInputAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">
                  Buy Token
                </label>
                <TokenSelect
                  value={limitOutputToken}
                  onChange={(token) => {
                    const symbol = typeof token === 'string' ? token : token.symbol;
                    setLimitOutputToken(symbol);
                  }}
                  exclude={[limitInputToken]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">
                  Target Price ({limitOutputToken} per {limitInputToken})
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={limitTargetPrice}
                  onChange={(e) => setLimitTargetPrice(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">
                  Expiry
                </label>
                <div className="flex gap-2">
                  {['1', '7', '30'].map((day) => (
                    <button
                      key={day}
                      onClick={() => setLimitExpiry(day)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded text-xs font-medium transition-all',
                        limitExpiry === day
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      )}
                    >
                      {day}d
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreateLimitOrder}
                disabled={
                  !publicKey ||
                  !limitInputAmount ||
                  !limitTargetPrice ||
                  loading
                }
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
              >
                {loading ? 'Creating...' : 'Create Limit Order'}
              </Button>
            </div>

            {/* Active Orders List */}
            {limitOrders.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  Active Orders
                </h3>
                {limitOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 bg-white/5 rounded-lg border border-white/10 text-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-white">
                          {order.inputAmount} {order.inputToken} →{' '}
                          {order.outputToken}
                        </div>
                        <div className="text-xs text-white/50">
                          Target: {order.targetPrice} {order.outputToken}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full font-medium',
                          order.status === 'pending'
                            ? 'bg-yellow-900 text-yellow-200'
                            : order.status === 'executed'
                              ? 'bg-green-900 text-green-200'
                              : 'bg-red-900 text-red-200'
                        )}
                      >
                        {order.status.charAt(0).toUpperCase() +
                          order.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-xs text-white/50 mb-2">
                      Expires:{' '}
                      {order.expiresAt.toLocaleDateString()} at{' '}
                      {order.expiresAt.toLocaleTimeString()}
                    </div>
                    {order.status === 'pending' && (
                      <Button
                        onClick={() => handleCancelLimitOrder(order.id)}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                      >
                        Cancel Order
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* BUY TAB - Module 6.3 */}
          <TabsContent value="buy" className="space-y-4">
            <BuyTab
              slippageTolerance={slippageTolerance}
              onTokenChange={onTokenChange}
            />
          </TabsContent>

          {/* SELL TAB - Module 6.3 */}
          <TabsContent value="sell" className="space-y-4">
            <SellTab
              slippageTolerance={slippageTolerance}
              onTokenChange={onTokenChange}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
