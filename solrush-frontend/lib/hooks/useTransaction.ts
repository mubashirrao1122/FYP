'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { TransactionSignature } from '@solana/web3.js';

export type TransactionStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export interface TransactionState {
    status: TransactionStatus;
    signature: TransactionSignature | null;
    error: string | null;
}

export interface TransactionHistory {
    signature: string;
    timestamp: number;
    type: string;
    status: 'success' | 'error';
}

const STORAGE_KEY = 'solrush_tx_history';

/**
 * Hook for managing transaction state with automatic polling and history
 */
export function useTransaction() {
    const { connection } = useConnection();
    const [state, setState] = useState<TransactionState>({
        status: 'idle',
        signature: null,
        error: null,
    });

    /**
     * Save transaction to localStorage history
     */
    const saveToHistory = useCallback((tx: TransactionHistory) => {
        try {
            const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            history.unshift(tx);
            // Keep last 50 transactions
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
        } catch (err) {
            console.error('Failed to save transaction history:', err);
        }
    }, []);

    /**
     * Poll for transaction confirmation
     */
    const pollConfirmation = useCallback(async (signature: TransactionSignature) => {
        const startTime = Date.now();
        const timeout = 60000; // 60 seconds

        while (Date.now() - startTime < timeout) {
            try {
                const status = await connection.getSignatureStatus(signature);

                // Check if confirmed or finalized
                if (status.value?.confirmationStatus === 'confirmed' ||
                    status.value?.confirmationStatus === 'finalized') {
                    return true;
                }

                // Check for on-chain error
                if (status.value?.err) {
                    throw new Error('Transaction failed on-chain');
                }

                // Wait 1 second before next poll
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                console.error('Polling error:', err);
                // Continue polling unless it's a fatal error
            }
        }

        throw new Error('Transaction confirmation timeout');
    }, [connection]);

    /**
     * Send transaction and handle all states
     */
    const sendTransaction = useCallback(async (
        txFunction: () => Promise<TransactionSignature>,
        type: string = 'transaction'
    ): Promise<TransactionSignature> => {
        setState({ status: 'pending', signature: null, error: null });

        try {
            // Send transaction
            const signature = await txFunction();
            setState({ status: 'confirming', signature, error: null });

            // Poll for confirmation
            await pollConfirmation(signature);

            setState({ status: 'success', signature, error: null });

            // Save to history
            saveToHistory({
                signature,
                timestamp: Date.now(),
                type,
                status: 'success',
            });

            return signature;
        } catch (err: any) {
            const errorMsg = err.message || 'Transaction failed';
            setState({ status: 'error', signature: null, error: errorMsg });

            // Save failed transaction to history if we have a signature
            if (state.signature) {
                saveToHistory({
                    signature: state.signature,
                    timestamp: Date.now(),
                    type,
                    status: 'error',
                });
            }

            throw err;
        }
    }, [pollConfirmation, saveToHistory, state.signature]);

    /**
     * Reset transaction state
     */
    const reset = useCallback(() => {
        setState({ status: 'idle', signature: null, error: null });
    }, []);

    /**
     * Get transaction history from localStorage
     */
    const getHistory = useCallback((): TransactionHistory[] => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (err) {
            return [];
        }
    }, []);

    return {
        ...state,
        sendTransaction,
        reset,
        getHistory,
    };
}
