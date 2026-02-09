'use client';

import { Navbar } from '@/components/layout/Navbar';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';

export default function HistoryPage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] transition-colors duration-200">
            <Navbar />

            <main className="relative z-10 max-w-4xl mx-auto px-6 pt-24 pb-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#0F172A] dark:text-[#E5E7EB] tracking-tight mb-2">
                        Transaction History
                    </h1>
                    <p className="text-[#475569] dark:text-[#9CA3AF] text-lg">
                        View your recent interactions with the SolRush protocol
                    </p>
                </div>

                <TransactionHistory />
            </main>
        </div>
    );
}
