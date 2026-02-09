'use client';

import { useState, useMemo } from 'react';
import type { Transaction } from '@/lib/hooks/usePortfolio';
import { History, Search, Download, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface TradeTableProps {
    transactions: Transaction[];
}

export function TradeTable({ transactions }: TradeTableProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            // Search filter
            if (searchTerm && !tx.signature.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }

            // Type filter
            if (filterType !== 'all' && tx.type !== filterType) {
                return false;
            }

            // Status filter
            if (filterStatus !== 'all' && tx.status !== filterStatus) {
                return false;
            }

            return true;
        });
    }, [transactions, searchTerm, filterType, filterStatus]);

    const exportToCSV = () => {
        const headers = ['Signature', 'Type', 'Status', 'Timestamp'];
        const rows = filteredTransactions.map((tx) => [
            tx.signature,
            tx.type,
            tx.status,
            new Date(tx.timestamp * 1000).toISOString(),
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `solrush-transactions-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-[#EF4444]" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-[#F59E0B]" />;
            default:
                return null;
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            swap: 'Swap',
            add_liquidity: 'Add Liquidity',
            remove_liquidity: 'Remove Liquidity',
            claim_rewards: 'Claim Rewards',
            transfer: 'Transfer',
        };
        return labels[type] || type;
    };

    return (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] shadow-sm transition-colors duration-200">
            <div className="p-6 border-b border-[#E2E8F0] dark:border-[#1F2937]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <History className="h-5 w-5 text-[#2DD4BF] dark:text-[#22C1AE]" />
                        <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
                            Transaction History
                        </h3>
                    </div>
                    <button
                        onClick={exportToCSV}
                        disabled={filteredTransactions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2DD4BF]/10 dark:bg-[#22C1AE]/10 text-[#2DD4BF] dark:text-[#22C1AE] hover:bg-[#2DD4BF]/20 dark:hover:bg-[#22C1AE]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] dark:text-[#9CA3AF]" />
                        <input
                            type="text"
                            placeholder="Search by signature..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#E5E7EB] placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] dark:focus:ring-[#22C1AE] text-sm"
                        />
                    </div>

                    {/* Type Filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] dark:focus:ring-[#22C1AE] text-sm"
                    >
                        <option value="all">All Types</option>
                        <option value="swap">Swap</option>
                        <option value="add_liquidity">Add Liquidity</option>
                        <option value="remove_liquidity">Remove Liquidity</option>
                        <option value="claim_rewards">Claim Rewards</option>
                        <option value="transfer">Transfer</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] dark:focus:ring-[#22C1AE] text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                {filteredTransactions.length === 0 ? (
                    <div className="p-12 text-center text-[#475569] dark:text-[#9CA3AF]">
                        {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#E2E8F0] dark:border-[#1F2937]">
                                <th className="text-left p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Type</th>
                                <th className="text-left p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Signature</th>
                                <th className="text-left p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Time</th>
                                <th className="text-center p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Status</th>
                                <th className="text-center p-4 text-sm font-medium text-[#475569] dark:text-[#9CA3AF]">Explorer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map((tx, index) => (
                                <tr
                                    key={index}
                                    className="border-b border-[#E2E8F0] dark:border-[#1F2937] last:border-0 hover:bg-[#F8FAFC] dark:hover:bg-[#111827] transition-colors"
                                >
                                    <td className="p-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#F1F5F9] dark:bg-[#1F2937] text-[#475569] dark:text-[#9CA3AF]">
                                            {getTypeLabel(tx.type)}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <code className="text-sm font-mono text-[#0F172A] dark:text-[#E5E7EB]">
                                            {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                                        </code>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm text-[#475569] dark:text-[#9CA3AF]">
                                            {new Date(tx.timestamp * 1000).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-center">
                                            {getStatusIcon(tx.status)}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-center">
                                            <a
                                                href={`https://explorer.solana.com/tx/${tx.signature}?cluster=custom&customUrl=http://localhost:8899`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[#2DD4BF] dark:text-[#22C1AE] hover:text-[#26C8B4] dark:hover:text-[#1EB7A4] transition-colors"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {filteredTransactions.length > 0 && (
                <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1F2937] text-sm text-[#475569] dark:text-[#9CA3AF] text-center">
                    Showing {filteredTransactions.length} of {transactions.length} transactions
                </div>
            )}
        </div>
    );
}
