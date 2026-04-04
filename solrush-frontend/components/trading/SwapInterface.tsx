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
import { useSwap } from '@/lib/hooks/useSwap';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { SwapTab } from './SwapTab';
import { BuyTab } from './BuyTab';
import { SellTab } from './SellTab';
import { SlippageSettings } from '@/components/common/SlippageSettings';
import { GradientBorder } from '@/components/ui/gradient-border';

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
 * SwapInterface Component — Solana Cyber-Terminal aesthetic
 * Glass card with gradient border, glow active tab states, neon focus rings
 */
export function SwapInterface({ onTokenChange }: SwapInterfaceProps = {}) {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { loading } = useSwap();

  // Swap state
  const [slippageTolerance, setSlippageTolerance] = useState(1.0);

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
  const isLimitValid =
    limitInputAmount &&
    limitTargetPrice &&
    parseFloat(limitInputAmount) > 0 &&
    parseFloat(limitTargetPrice) > 0;
  const limitCtaLabel = !publicKey
    ? 'Connect Wallet'
    : !isLimitValid
      ? 'Enter Amount'
      : loading
        ? 'Confirming...'
        : 'Review Trade';

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
    <GradientBorder animated>
      <Card className="w-full border-border/30 bg-card/80 backdrop-blur-sm shadow-lg transition-colors duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">Trade</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <SlippageSettings
                slippage={slippageTolerance}
                setSlippage={setSlippageTolerance}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="swap" className="w-full">
            <TabsList className="grid w-full grid-cols-4 glass-card rounded-xl p-1">
              <TabsTrigger value="swap" className="data-[state=active]:text-neon-cyan data-[state=active]:shadow-[0_0_12px_rgba(6,182,212,0.2)] data-[state=active]:border-b-2 data-[state=active]:border-neon-cyan rounded-lg transition-all">Swap</TabsTrigger>
              <TabsTrigger value="limit" className="data-[state=active]:text-neon-cyan data-[state=active]:shadow-[0_0_12px_rgba(6,182,212,0.2)] data-[state=active]:border-b-2 data-[state=active]:border-neon-cyan rounded-lg transition-all">Limit</TabsTrigger>
              <TabsTrigger value="buy" className="data-[state=active]:text-neon-green data-[state=active]:shadow-[0_0_12px_rgba(34,197,94,0.2)] data-[state=active]:border-b-2 data-[state=active]:border-neon-green rounded-lg transition-all">Buy</TabsTrigger>
              <TabsTrigger value="sell" className="data-[state=active]:text-destructive data-[state=active]:shadow-[0_0_12px_rgba(239,68,68,0.2)] data-[state=active]:border-b-2 data-[state=active]:border-destructive rounded-lg transition-all">Sell</TabsTrigger>
            </TabsList>

            {/* SWAP TAB */}
            <TabsContent value="swap" className="space-y-4">
              <SwapTab
                slippageTolerance={slippageTolerance}
                onTokenChange={onTokenChange}
              />
            </TabsContent>

            {/* LIMIT ORDER TAB */}
            <TabsContent value="limit" className="space-y-4">
              {/* Limit Order Form */}
              <div className="space-y-4 p-4 glass-card rounded-xl">
                <h3 className="text-sm font-semibold text-foreground">Create Order</h3>

                <div className="rounded-2xl p-4 bg-muted/30 border border-border/20 neon-focus transition-colors">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-foreground">
                      You Sell
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={limitInputAmount}
                      onChange={(e) => setLimitInputAmount(e.target.value)}
                      className="bg-transparent border-none text-3xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-foreground/30"
                    />
                    <TokenSelect
                      value={limitInputToken}
                      onChange={(token) => {
                        const symbol = typeof token === 'string' ? token : token.symbol;
                        setLimitInputToken(symbol);
                      }}
                      exclude={[limitOutputToken]}
                      compact={true}
                    />
                  </div>
                  <p className="mt-2 text-xs text-foreground/40">
                    Estimated · Slippage protected
                  </p>
                </div>

                <div className="rounded-2xl p-4 bg-muted/30 border border-border/20 neon-focus transition-colors">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-foreground">
                      You Receive
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <Input
                      type="number"
                      placeholder={`Target price in ${limitOutputToken}`}
                      value={limitTargetPrice}
                      onChange={(e) => setLimitTargetPrice(e.target.value)}
                      className="bg-transparent border-none text-3xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-foreground/30"
                    />
                    <TokenSelect
                      value={limitOutputToken}
                      onChange={(token) => {
                        const symbol = typeof token === 'string' ? token : token.symbol;
                        setLimitOutputToken(symbol);
                      }}
                      exclude={[limitInputToken]}
                      compact={true}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/60">
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
                            ? 'bg-neon-blue text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                            : 'bg-muted/30 text-foreground/60 hover:bg-muted/50 border border-border/20'
                        )}
                      >
                        {day}d
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl glass-card p-3 text-sm text-foreground/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Best route</span>
                    <span className="text-foreground font-data">SolRush Aggregator</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Est. finality</span>
                    <span className="text-foreground font-data">~0.4s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Price impact</span>
                    <span className="text-foreground font-data">0.18%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Fees</span>
                    <span className="text-foreground font-data">0.30%</span>
                  </div>
                </div>

                <Button
                  onClick={handleCreateLimitOrder}
                  disabled={!publicKey || !isLimitValid || loading}
                  className="w-full h-12 text-base bg-neon-blue hover:bg-[#2563EB] text-white font-semibold rounded-xl animate-glow-pulse transition-all"
                >
                  {limitCtaLabel}
                </Button>
                <div className="text-xs text-foreground/40 space-y-1">
                  <p>Final amount may vary slightly due to on-chain execution.</p>
                  <p>You always retain custody of your assets.</p>
                </div>
              </div>

              {/* Active Orders List */}
              {limitOrders.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Active Orders
                  </h3>
                  {limitOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-3 glass-card rounded-lg text-sm transition-colors duration-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-foreground font-data">
                            {order.inputAmount} {order.inputToken} →{' '}
                            {order.outputToken}
                          </div>
                          <div className="text-xs text-foreground/40 font-data">
                            Target: {order.targetPrice} {order.outputToken}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'text-xs px-2 py-1 rounded-full font-medium',
                            order.status === 'pending'
                              ? 'bg-neon-amber/10 text-neon-amber border border-neon-amber/20'
                              : order.status === 'executed'
                                ? 'bg-neon-green/10 text-neon-green border border-neon-green/20'
                                : 'bg-destructive/10 text-destructive border border-destructive/20'
                          )}
                        >
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </span>
                      </div>
                      <div className="text-xs text-foreground/40 mb-2 font-data">
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

            {/* BUY TAB */}
            <TabsContent value="buy" className="space-y-4">
              <BuyTab
                slippageTolerance={slippageTolerance}
                onTokenChange={onTokenChange}
              />
            </TabsContent>

            {/* SELL TAB */}
            <TabsContent value="sell" className="space-y-4">
              <SellTab
                slippageTolerance={slippageTolerance}
                onTokenChange={onTokenChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </GradientBorder>
  );
}
