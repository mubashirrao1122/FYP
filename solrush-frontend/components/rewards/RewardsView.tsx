import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { RushRewards } from "@/components/rewards/RushRewards";
import { ClaimRewards } from "@/components/rewards/ClaimRewards";

export const RewardsView = () => {
    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] transition-colors duration-200">
            <Navbar />

            {/* Main Content */}
            <main className="relative z-10 flex items-center justify-center min-h-screen pt-24 px-4 pb-12">
                <div className="max-w-2xl w-full space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl sm:text-5xl font-bold text-[#0F172A] dark:text-[#E5E7EB] tracking-tight mb-4">RUSH Rewards</h1>
                        <p className="text-[#475569] dark:text-[#9CA3AF] text-lg">Earn RUSH tokens by providing liquidity to our pools</p>
                    </div>

                    <RushRewards />

                    <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-2xl p-8 shadow-sm transition-colors duration-200">
                        <h3 className="text-xl font-bold text-[#0F172A] dark:text-[#E5E7EB] mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-[#2DD4BF] dark:bg-[#22C1AE] rounded-full"></span>
                            How it Works
                        </h3>
                        <ul className="space-y-4 text-[#475569] dark:text-[#9CA3AF]">
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2DD4BF]/10 dark:bg-[#22C1AE]/10 text-[#0F172A] dark:text-[#22C1AE] font-bold text-sm flex items-center justify-center mt-0.5">1</span>
                                <span>Provide liquidity to any of our pools</span>
                            </li>
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2DD4BF]/10 dark:bg-[#22C1AE]/10 text-[#0F172A] dark:text-[#22C1AE] font-bold text-sm flex items-center justify-center mt-0.5">2</span>
                                <span>Earn 80% of trading fees + RUSH rewards</span>
                            </li>
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2DD4BF]/10 dark:bg-[#22C1AE]/10 text-[#0F172A] dark:text-[#22C1AE] font-bold text-sm flex items-center justify-center mt-0.5">3</span>
                                <span>Claim your RUSH tokens anytime</span>
                            </li>
                        </ul>
                    </div>

                    <ClaimRewards />
                </div>
            </main>
        </div>
    );
};
