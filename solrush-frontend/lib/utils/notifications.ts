'use client';

import { getExplorerTxUrl } from '../solana/constants';

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    txSignature?: string;
    duration?: number;
    dismissible?: boolean;
}

// Create a simple notification store using a pub/sub pattern
type NotificationCallback = (notification: Notification) => void;
type DismissCallback = (id: string) => void;

const subscribers: NotificationCallback[] = [];
const dismissSubscribers: DismissCallback[] = [];

/**
 * Subscribe to notifications
 */
export const subscribeToNotifications = (callback: NotificationCallback): (() => void) => {
    subscribers.push(callback);
    return () => {
        const index = subscribers.indexOf(callback);
        if (index > -1) subscribers.splice(index, 1);
    };
};

/**
 * Subscribe to dismiss events
 */
export const subscribeToDismiss = (callback: DismissCallback): (() => void) => {
    dismissSubscribers.push(callback);
    return () => {
        const index = dismissSubscribers.indexOf(callback);
        if (index > -1) dismissSubscribers.splice(index, 1);
    };
};

/**
 * Show a notification
 */
export const notify = (notification: Omit<Notification, 'id'>): string => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullNotification: Notification = {
        ...notification,
        id,
        dismissible: notification.dismissible ?? true,
        duration: notification.duration ?? (notification.type === 'loading' ? 0 : 5000),
    };
    
    subscribers.forEach(callback => callback(fullNotification));
    return id;
};

/**
 * Dismiss a notification
 */
export const dismissNotification = (id: string): void => {
    dismissSubscribers.forEach(callback => callback(id));
};

// Convenience methods
export const notifySuccess = (title: string, message?: string, txSignature?: string): string => {
    return notify({
        type: 'success',
        title,
        message,
        txSignature,
    });
};

export const notifyError = (title: string, message?: string): string => {
    return notify({
        type: 'error',
        title,
        message,
        duration: 8000, // Errors stay longer
    });
};

export const notifyWarning = (title: string, message?: string): string => {
    return notify({
        type: 'warning',
        title,
        message,
    });
};

export const notifyInfo = (title: string, message?: string): string => {
    return notify({
        type: 'info',
        title,
        message,
    });
};

export const notifyLoading = (title: string, message?: string): string => {
    return notify({
        type: 'loading',
        title,
        message,
        dismissible: false,
        duration: 0, // Loading notifications don't auto-dismiss
    });
};

/**
 * Transaction notification helpers
 */
export const notifyTxSending = (): string => {
    return notifyLoading('Sending Transaction', 'Please approve in your wallet...');
};

export const notifyTxConfirming = (signature: string): string => {
    return notifyLoading('Confirming Transaction', 'Waiting for confirmation...');
};

export const notifyTxSuccess = (signature: string, message: string = 'Transaction confirmed!'): string => {
    return notifySuccess(message, 'Click to view on explorer', signature);
};

export const notifyTxError = (error: any): string => {
    let message = 'Transaction failed';
    
    if (typeof error === 'string') {
        message = error;
    } else if (error?.message) {
        message = error.message;
        
        // Parse common Solana errors
        if (message.includes('User rejected')) {
            message = 'Transaction cancelled by user';
        } else if (message.includes('insufficient funds')) {
            message = 'Insufficient funds for transaction';
        } else if (message.includes('Slippage')) {
            message = 'Price changed too much. Try increasing slippage tolerance.';
        } else if (message.includes('InsufficientLiquidity')) {
            message = 'Insufficient liquidity in pool';
        }
    }
    
    return notifyError('Transaction Failed', message);
};

/**
 * Format error message for display
 */
export const formatError = (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    return 'An unknown error occurred';
};

/**
 * Get explorer link for transaction
 */
export const getExplorerLink = (signature: string): string => {
    return getExplorerTxUrl(signature);
};
