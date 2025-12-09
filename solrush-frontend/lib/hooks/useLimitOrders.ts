'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getProgram, getReadOnlyProgram, toBN, fromBN } from '../anchor/setup';
import { findPoolAddress, findLimitOrderAddress } from '../anchor/pda';
import { getTokenMint, TOKEN_DECIMALS, getTokenSymbol } from '../constants';
import { LimitOrder, OrderStatus, LimitOrderDisplay } from '../types';

export interface CreateLimitOrderParams {
    tokenA: string;       // Token to sell
    tokenB: string;       // Token to receive
    amount: number;       // Amount to sell
    targetPrice: number;  // Price per unit (tokenB per tokenA)
    expiryDays: number;   // Days until expiry
}

/**
 * Custom hook for limit order management on blockchain
 */
export const useLimitOrders = () => {
    const { connection } = useConnection();
    const wallet = useWallet();

    const [orders, setOrders] = useState<LimitOrderDisplay[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);

    /**
     * Fetch user's limit orders from blockchain
     */
    const fetchOrders = useCallback(async () => {
        if (!wallet.publicKey) {
            setOrders([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const program = getReadOnlyProgram(connection);
            if (!program) {
                throw new Error('Failed to initialize program');
            }

            // Fetch all limit orders owned by the user
            // Using memcmp filter on the owner field
            const orderAccounts = await program.account.limitOrder.all([
                {
                    memcmp: {
                        offset: 8, // After discriminator
                        bytes: wallet.publicKey.toBase58(),
                    },
                },
            ]);

            const displayOrders: LimitOrderDisplay[] = orderAccounts.map((account) => {
                const order = account.account;
                const sellMint = (order.sellToken as PublicKey).toBase58();
                const buyMint = (order.buyToken as PublicKey).toBase58();

                return {
                    id: account.publicKey.toBase58(),
                    inputToken: getTokenSymbol(sellMint) || 'UNKNOWN',
                    outputToken: getTokenSymbol(buyMint) || 'UNKNOWN',
                    inputAmount: fromBN(order.sellAmount as BN, TOKEN_DECIMALS[getTokenSymbol(sellMint) || ''] || 9),
                    targetPrice: fromBN(order.targetPrice as BN, 6),
                    minReceive: fromBN(order.minimumReceive as BN, TOKEN_DECIMALS[getTokenSymbol(buyMint) || ''] || 6),
                    status: parseOrderStatus(order.status),
                    expiresAt: new Date((order.expiresAt as BN).toNumber() * 1000),
                    createdAt: new Date((order.createdAt as BN).toNumber() * 1000),
                };
            });

            // Sort by creation date, newest first
            displayOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            setOrders(displayOrders);
        } catch (err: any) {
            console.error('Failed to fetch limit orders:', err);
            // Don't set error for account not found - just empty orders
            if (!err.message?.includes('Account does not exist')) {
                setError(err.message || 'Failed to fetch orders');
            }
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [connection, wallet.publicKey]);

    /**
     * Create a new limit order
     */
    const createOrder = useCallback(async (params: CreateLimitOrderParams): Promise<string> => {
        if (!wallet.publicKey) {
            throw new Error('Wallet not connected');
        }

        setLoading(true);
        setError(null);
        setTxSignature(null);

        try {
            const program = getProgram(connection, wallet);
            if (!program) {
                throw new Error('Failed to initialize program');
            }

            const sellMint = getTokenMint(params.tokenA);
            const buyMint = getTokenMint(params.tokenB);
            const [poolPda] = findPoolAddress(sellMint, buyMint);

            // Generate order ID (timestamp based)
            const orderId = Date.now();
            const [orderPda] = findLimitOrderAddress(poolPda, wallet.publicKey, orderId);

            // Get user's token account
            const userSellAccount = await getAssociatedTokenAddress(sellMint, wallet.publicKey);

            // Calculate amounts
            const sellDecimals = TOKEN_DECIMALS[params.tokenA] || 9;
            const buyDecimals = TOKEN_DECIMALS[params.tokenB] || 6;

            const sellAmountBN = toBN(params.amount, sellDecimals);
            const targetPriceBN = toBN(params.targetPrice, 6); // Price in 6 decimals
            const minimumReceiveBN = toBN(params.amount * params.targetPrice * 0.99, buyDecimals); // 1% slippage

            // Calculate expiry timestamp
            const expiresAt = new BN(
                Math.floor(Date.now() / 1000) + (params.expiryDays * 24 * 60 * 60)
            );

            const tx = await program.methods
                .createLimitOrder(
                    new BN(orderId),
                    sellAmountBN,
                    targetPriceBN,
                    minimumReceiveBN,
                    expiresAt
                )
                .accounts({
                    user: wallet.publicKey,
                    pool: poolPda,
                    limitOrder: orderPda,
                    sellToken: sellMint,
                    buyToken: buyMint,
                    userSellAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setTxSignature(tx);

            // Refresh orders list
            await fetchOrders();

            return tx;
        } catch (err: any) {
            console.error('Create limit order error:', err);
            const errorMsg = err.message || 'Failed to create limit order';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [connection, wallet, fetchOrders]);

    /**
     * Cancel a limit order
     */
    const cancelOrder = useCallback(async (orderId: string): Promise<string> => {
        if (!wallet.publicKey) {
            throw new Error('Wallet not connected');
        }

        setLoading(true);
        setError(null);
        setTxSignature(null);

        try {
            const program = getProgram(connection, wallet);
            if (!program) {
                throw new Error('Failed to initialize program');
            }

            const orderPda = new PublicKey(orderId);

            // Fetch order to get details
            const orderAccount = await program.account.limitOrder.fetch(orderPda);
            const sellMint = orderAccount.sellToken as PublicKey;
            const poolPda = orderAccount.pool as PublicKey;

            // Get user's token account for refund
            const userSellAccount = await getAssociatedTokenAddress(sellMint, wallet.publicKey);

            const tx = await program.methods
                .cancelLimitOrder()
                .accounts({
                    user: wallet.publicKey,
                    pool: poolPda,
                    limitOrder: orderPda,
                    userSellAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            setTxSignature(tx);

            // Refresh orders list
            await fetchOrders();

            return tx;
        } catch (err: any) {
            console.error('Cancel limit order error:', err);
            const errorMsg = err.message || 'Failed to cancel order';
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [connection, wallet, fetchOrders]);

    /**
     * Clear error state
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Fetch orders on mount and when wallet changes
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchOrders();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchOrders]);

    // Get orders by status
    const pendingOrders = orders.filter(o => o.status === OrderStatus.Pending);
    const executedOrders = orders.filter(o => o.status === OrderStatus.Executed);
    const cancelledOrders = orders.filter(o => o.status === OrderStatus.Cancelled);

    return {
        orders,
        pendingOrders,
        executedOrders,
        cancelledOrders,
        loading,
        error,
        txSignature,
        createOrder,
        cancelOrder,
        fetchOrders,
        clearError,
    };
};

/**
 * Parse order status from blockchain enum
 */
function parseOrderStatus(status: any): OrderStatus {
    if (status.pending) return OrderStatus.Pending;
    if (status.executed) return OrderStatus.Executed;
    if (status.cancelled) return OrderStatus.Cancelled;
    if (status.expired) return OrderStatus.Expired;
    return OrderStatus.Pending;
}
