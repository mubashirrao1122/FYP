import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { RushRewards } from "@/components/rewards/RushRewards";
import { ClaimRewards } from "@/components/rewards/ClaimRewards";

export const RewardsView = () => {
    return (
        <div className="min-h-screen bg-black relative overflow-hidden selection:bg-purple-500/30">
            <Navbar />

            {/* Background Glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            {/* Main Content */}
            <main className="relative z-10 flex items-center justify-center min-h-screen pt-24 px-4 pb-12">
                <div className="max-w-2xl w-full space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">RUSH Rewards</h1>
                        <p className="text-white/40 text-lg">Earn RUSH tokens by providing liquidity to our pools</p>
                    </div>

                    <RushRewards />

                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                            How it Works
                        </h3>
                        <ul className="space-y-4 text-white/60">
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold text-sm flex items-center justify-center mt-0.5">1</span>
                                <span>Provide liquidity to any of our pools</span>
                            </li>
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold text-sm flex items-center justify-center mt-0.5">2</span>
                                <span>Earn 80% of trading fees + RUSH rewards</span>
                            </li>
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold text-sm flex items-center justify-center mt-0.5">3</span>
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
