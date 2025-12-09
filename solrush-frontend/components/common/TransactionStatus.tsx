'use client';

import { TransactionStatus as TxStatus } from '@/lib/hooks/useTransaction';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface TransactionStatusProps {
    status: TxStatus;
    signature?: string | null;
    error?: string | null;
    onRetry?: () => void;
}

export function TransactionStatus({
    status,
    signature,
    error,
    onRetry,
}: TransactionStatusProps) {
    const getExplorerUrl = (sig: string) => {
        const network = process.env.NEXT_PUBLIC_NETWORK || 'devnet';
        return `https://explorer.solana.com/tx/${sig}?cluster=${network}`;
    };

    if (status === 'idle') return null;

    return (
        <div className="mt-4 p-4 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
            {/* Pending */}
            {status === 'pending' && (
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <div>
                        <p className="font-medium text-white">Sending transaction...</p>
                        <p className="text-sm text-gray-400">Please approve in your wallet</p>
                    </div>
                </div>
            )}

            {/* Confirming */}
            {status === 'confirming' && (
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                    <div className="flex-1">
                        <p className="font-medium text-white">Confirming transaction...</p>
                        <p className="text-sm text-gray-400">Waiting for blockchain confirmation</p>
                    </div>
                    {signature && (
                        <a
                            href={getExplorerUrl(signature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            View <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            )}

            {/* Success */}
            {status === 'success' && signature && (
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                        <p className="font-medium text-white">Transaction successful!</p>
                        <p className="text-sm text-gray-400">Your transaction has been confirmed</p>
                    </div>
                    <a
                        href={getExplorerUrl(signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            )}

            {/* Error */}
            {status === 'error' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-red-400" />
                        <div className="flex-1">
                            <p className="font-medium text-white">Transaction failed</p>
                            <p className="text-sm text-red-400">{error || 'Unknown error occurred'}</p>
                        </div>
                    </div>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                            Retry Transaction
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
