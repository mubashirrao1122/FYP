'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Notification, 
    subscribeToNotifications, 
    subscribeToDismiss, 
    dismissNotification,
    getExplorerLink 
} from '@/lib/utils/notifications';

const ToastIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
    switch (type) {
        case 'success':
            return (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            );
        case 'error':
            return (
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            );
        case 'warning':
            return (
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            );
        case 'info':
            return (
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        case 'loading':
            return (
                <svg className="w-5 h-5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            );
        default:
            return null;
    }
};

const Toast: React.FC<{ notification: Notification; onDismiss: () => void }> = ({ 
    notification, 
    onDismiss 
}) => {
    const bgColors = {
        success: 'bg-green-900/90 border-green-500',
        error: 'bg-red-900/90 border-red-500',
        warning: 'bg-yellow-900/90 border-yellow-500',
        info: 'bg-blue-900/90 border-blue-500',
        loading: 'bg-purple-900/90 border-purple-500',
    };

    return (
        <div 
            className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg ${bgColors[notification.type]} animate-slide-in`}
            style={{ minWidth: '320px', maxWidth: '400px' }}
        >
            <div className="flex-shrink-0 mt-0.5">
                <ToastIcon type={notification.type} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{notification.title}</p>
                {notification.message && (
                    <p className="mt-1 text-sm text-gray-300">{notification.message}</p>
                )}
                {notification.txSignature && (
                    <a
                        href={getExplorerLink(notification.txSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        View on Explorer
                        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                )}
            </div>
            {notification.dismissible && (
                <button
                    onClick={onDismiss}
                    className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export const ToastContainer: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    useEffect(() => {
        // Subscribe to new notifications
        const unsubscribeNotifications = subscribeToNotifications((notification) => {
            setNotifications(prev => [...prev, notification]);

            // Auto-dismiss after duration
            if (notification.duration && notification.duration > 0) {
                setTimeout(() => {
                    removeNotification(notification.id);
                }, notification.duration);
            }
        });

        // Subscribe to dismiss events
        const unsubscribeDismiss = subscribeToDismiss((id) => {
            removeNotification(id);
        });

        return () => {
            unsubscribeNotifications();
            unsubscribeDismiss();
        };
    }, [removeNotification]);

    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {notifications.map(notification => (
                <Toast
                    key={notification.id}
                    notification={notification}
                    onDismiss={() => removeNotification(notification.id)}
                />
            ))}
        </div>
    );
};

export default ToastContainer;
