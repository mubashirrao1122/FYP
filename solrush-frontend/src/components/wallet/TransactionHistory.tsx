'use client';

import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface Transaction {
    signature: string;
    slot: number;
    err: any;
    memo?: string;
    blockTime?: number | null;
}

export function TransactionHistory() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!publicKey) return;

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const signatures = await connection.getSignaturesForAddress(
                    publicKey,
                    { limit: 20 }
                );

                const formattedTxs = signatures.map((sig) => ({
                    signature: sig.signature,
                    slot: sig.slot,
                    err: sig.err,
                    memo: sig.memo,
                    blockTime: sig.blockTime,
                }));

                setTransactions(formattedTxs);
            } catch (error) {
                console.error('Error fetching transaction history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();

        // Set up polling for new transactions
        const interval = setInterval(fetchHistory, 10000);
        return () => clearInterval(interval);
    }, [publicKey, connection]);

    if (!publicKey) {
        return (
            <Card className="w-full bg-white/5 border-white/10">
                <CardContent className="p-6 text-center text-white/60">
                    Connect your wallet to view transaction history
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full bg-white/5 border-white/10 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-white">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
                {loading && transactions.length === 0 ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center text-white/40 py-4">
                        No transactions found
                    </div>
                ) : (
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                            {transactions.map((tx) => (
                                <div
                                    key={tx.signature}
                                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        {tx.err ? (
                                            <XCircle className="h-5 w-5 text-red-500" />
                                        ) : (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-white">
                                                {tx.err ? 'Failed' : 'Success'}
                                            </span>
                                            <span className="text-xs text-white/40">
                                                {tx.blockTime
                                                    ? new Date(tx.blockTime * 1000).toLocaleString()
                                                    : 'Unknown date'}
                                            </span>
                                        </div>
                                    </div>

                                    <a
                                        href={`https://explorer.solana.com/tx/${tx.signature}?cluster=custom&customUrl=http://localhost:8899`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        {tx.signature.slice(0, 4)}...{tx.signature.slice(-4)}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
