'use client';

import { Navbar } from '@/components/layout/Navbar';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';

export default function HistoryPage() {
    return (
        <div className="min-h-screen bg-black relative overflow-hidden selection:bg-purple-500/30">
            <Navbar />

            {/* Background Glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 max-w-4xl mx-auto px-6 pt-24 pb-12">
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                        Transaction History
                    </h1>
                    <p className="text-white/40 text-lg">
                        View your recent interactions with the SolRush protocol
                    </p>
                </div>

                <TransactionHistory />
            </main>
        </div>
    );
}
