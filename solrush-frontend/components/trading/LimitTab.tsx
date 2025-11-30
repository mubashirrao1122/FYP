'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TokenSelect } from '@/components/ui/token-select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { LimitOrder } from '@/lib/types';

export function LimitTab() {
    const { publicKey } = useWallet();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

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

        setLoading(true);
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));

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
        } finally {
            setLoading(false);
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
        <div className="space-y-4">
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
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                    {loading ? 'Creating...' : 'Create Limit Order'}
                </Button>
            </div>

            {/* Active Orders List */}
            {limitOrders.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">Active Orders</h3>
                    {limitOrders.map((order) => (
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
                    ))}
                </div>
            )}
        </div>
    );
}
