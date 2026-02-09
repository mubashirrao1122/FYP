'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { getBalance } from '@/lib/perps/mockPositions';

export function MockBalance() {
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number>(0);

    useEffect(() => {
        if (!publicKey) {
            setBalance(0);
            return;
        }

        const updateBalance = () => {
            const currentBalance = getBalance(publicKey.toBase58());
            setBalance(currentBalance);
        };

        updateBalance();
        const interval = setInterval(updateBalance, 1000);

        return () => clearInterval(interval);
    }, [publicKey]);

    if (!publicKey) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-xl p-4 shadow-lg z-50">
            <div className="text-sm text-[#94A3B8] dark:text-[#6B7280] mb-1">Mock Balance</div>
            <div className="text-2xl font-bold text-[#0F172A] dark:text-[#E5E7EB]">
                ${balance.toFixed(2)}
            </div>
            <div className="text-xs text-[#94A3B8] dark:text-[#6B7280] mt-1">
                Simulated Trading
            </div>
        </div>
    );
}
