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
        <div className="mt-4 p-4 rounded-lg border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826] transition-colors duration-200">
            {/* Pending */}
            {status === 'pending' && (
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6]" />
                    <div>
                        <p className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">Sending transaction</p>
                        <p className="text-sm text-[#94A3B8] dark:text-[#6B7280]">Please approve in your wallet</p>
                    </div>
                </div>
            )}

            {/* Confirming */}
            {status === 'confirming' && (
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6]" />
                    <div className="flex-1">
                        <p className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">Confirming transaction</p>
                        <p className="text-sm text-[#94A3B8] dark:text-[#6B7280]">Waiting for finality</p>
                    </div>
                    {signature && (
                        <a
                            href={getExplorerUrl(signature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
                        >
                            View <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            )}

            {/* Success */}
            {status === 'success' && signature && (
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
                    <div className="flex-1">
                        <p className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">Transaction confirmed</p>
                        <p className="text-sm text-[#94A3B8] dark:text-[#6B7280]">Execution finalized on-chain</p>
                    </div>
                    <a
                        href={getExplorerUrl(signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
                    >
                        Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            )}

            {/* Error */}
            {status === 'error' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-[#F59E0B]" />
                        <div className="flex-1">
                            <p className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">Execution unavailable</p>
                            <p className="text-sm text-[#94A3B8] dark:text-[#6B7280]">
                                {error || 'No available route at this time. Try adjusting amount or pair.'}
                            </p>
                        </div>
                    </div>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="w-full px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg text-white text-sm font-medium transition-colors"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
