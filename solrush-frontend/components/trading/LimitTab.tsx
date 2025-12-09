'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TokenSelect } from '@/components/ui/token-select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@/lib/types';
import { useLimitOrders } from '@/lib/hooks/useLimitOrders';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

export function LimitTab() {
    const { publicKey } = useWallet();
    const { toast } = useToast();

    const [limitTargetPrice, setLimitTargetPrice] = useState('');
    const [limitInputAmount, setLimitInputAmount] = useState('');
    const [limitInputToken, setLimitInputToken] = useState('SOL');
    const [limitOutputToken, setLimitOutputToken] = useState('USDC');
    const [limitExpiry, setLimitExpiry] = useState('1');

    // Use blockchain limit orders hook
    const {
        orders: limitOrders,
        pendingOrders,
        loading,
        error,
        txSignature,
        createOrder,
        cancelOrder,
        clearError,
    } = useLimitOrders();

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
            const tx = await createOrder({
                tokenA: limitInputToken,
                tokenB: limitOutputToken,
                amount: parseFloat(limitInputAmount),
                targetPrice: parseFloat(limitTargetPrice),
                expiryDays: parseInt(limitExpiry),
            });

            toast({
                title: 'Limit Order Created!',
                description: `Order to sell ${limitInputAmount} ${limitInputToken} at ${limitTargetPrice}. TX: ${tx.slice(0, 8)}...`,
            });

            // Clear form
            setLimitInputAmount('');
            setLimitTargetPrice('');
        } catch (error: any) {
            console.error('Create limit order error:', error);
            toast({
                title: 'Order Creation Failed',
                description: error.message || 'Failed to create order.',
            });
        }
    };

    const handleCancelLimitOrder = async (orderId: string) => {
        try {
            const tx = await cancelOrder(orderId);

            toast({
                title: 'Order Cancelled!',
                description: `Limit order cancelled. TX: ${tx.slice(0, 8)}...`,
            });
        } catch (error: any) {
            console.error('Cancel order error:', error);
            toast({
                title: 'Cancellation Failed',
                description: error.message || 'Failed to cancel order.',
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Error Display */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">{error}</span>
                    <button onClick={clearError} className="ml-auto text-red-500 hover:text-red-400">
                        ✕
                    </button>
                </div>
            )}

            {/* Transaction Success */}
            {txSignature && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-500">
                        <span>Transaction successful!</span>
                        <a
                            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline"
                        >
                            View on Explorer <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            )}

            {/* Limit Order Form */}
            <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-sm font-semibold text-white">Create Order</h3>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-white/70">Sell Token</label>
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
                    <label className="text-xs font-medium text-white/70">Amount</label>
                    <Input
                        type="number"
                        placeholder="0.0"
                        value={limitInputAmount}
                        onChange={(e) => setLimitInputAmount(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-white/70">Buy Token</label>
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
                    <label className="text-xs font-medium text-white/70">Expiry</label>
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
                    disabled={!publicKey || !limitInputAmount || !limitTargetPrice || loading}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                        </span>
                    ) : (
                        'Create Limit Order'
                    )}
                </Button>
            </div>

            {/* Active Orders List */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                        Your Orders {loading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin" />}
                    </h3>
                    <span className="text-xs text-white/50">
                        {limitOrders.length} total · {pendingOrders.length} pending
                    </span>
                </div>
                {limitOrders.length > 0 ? (
                    limitOrders.map((order) => (
                        <div
                            key={order.id}
                            className="p-3 bg-white/5 rounded-lg border border-white/10 text-sm"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <div className="font-medium text-white">
                                        {order.inputAmount} {order.inputToken} → {order.outputToken}
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
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </span>
                            </div>
                            <div className="text-xs text-white/50 mb-2">
                                Expires: {order.expiresAt.toLocaleDateString()} at{' '}
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
                    ))
                ) : (
                    <div className="p-8 text-center text-white/40">
                        <p className="text-sm">No limit orders yet</p>
                        <p className="text-xs mt-1">Create your first order above</p>
                    </div>
                )}
            </div>
        </div>
    );
}
