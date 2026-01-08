import React from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { ShieldCheck, Lock, FileCheck, Route, Zap, Coins, Gift, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

interface HomeViewProps {
    handleLaunchApp: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ handleLaunchApp }) => {
    const { publicKey } = useWallet();
    const { setVisible } = useWalletModal();
    const shortAddress = publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : null;
    const [isScrolled, setIsScrolled] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 8);
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0B1220] dark:text-[#E5E7EB] selection:bg-[#2DD4BF]/20 transition-colors duration-200">
            <header
                className={`sticky top-0 z-40 bg-[#F8FAFC]/90 dark:bg-[#0B1220]/90 transition-colors duration-200 ${isScrolled ? 'backdrop-blur-sm border-b border-[#E2E8F0] dark:border-[#1F2937]' : 'border-b border-transparent'}`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between border-b border-transparent">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A]">
                                <img src="/logo.png" alt="SolRush Logo" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-[16px] font-semibold tracking-tight text-[#0F172A] dark:text-[#E5E7EB]">SolRush</span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-6 text-[14px] text-[#475569] dark:text-[#9CA3AF]">
                            <Link href="#" className="hover:text-[#0F172A] dark:hover:text-[#E5E7EB] transition-colors duration-200 ease-out">
                                Product
                            </Link>
                            <Link href="#" className="hover:text-[#0F172A] dark:hover:text-[#E5E7EB] transition-colors duration-200 ease-out">
                                Docs
                            </Link>
                            <Link href="#" className="hover:text-[#0F172A] dark:hover:text-[#E5E7EB] transition-colors duration-200 ease-out">
                                Rewards
                            </Link>
                            <Link href="#" className="hover:text-[#0F172A] dark:hover:text-[#E5E7EB] transition-colors duration-200 ease-out">
                                Security
                            </Link>
                        </nav>

                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <button
                                type="button"
                                onClick={() => setVisible(true)}
                                className="flex items-center h-10 px-4 rounded-full border border-[#E2E8F0] dark:border-[#1F2937] text-[13px] text-[#475569] dark:text-[#9CA3AF] bg-white dark:bg-[#0F172A] transition-colors duration-200 hover:bg-[#F1F5F9] dark:hover:bg-[#111827]"
                            >
                                {shortAddress ? shortAddress : 'Connect Wallet'}
                            </button>
                            <button
                                onClick={handleLaunchApp}
                                className="h-10 px-4 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-[14px] font-medium transition-colors duration-200 ease-out hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4]"
                            >
                                Launch App
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main>
                <section className="pt-16 pb-14 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
                        <div>
                            <p className="text-[12px] uppercase tracking-[0.2em] text-[#94A3B8] dark:text-[#6B7280] mb-4">
                                Built on Solana · Non-custodial · Audited
                            </p>
                            <h1 className="text-[44px] sm:text-[56px] lg:text-[64px] leading-[1.05] font-semibold tracking-tight">
                                Trade digital assets with institutional speed and consumer simplicity.
                            </h1>
                            <p className="mt-5 text-[15px] sm:text-[16px] text-[#475569] dark:text-[#9CA3AF] max-w-[520px]">
                                A calm, precise trading experience built on transparent liquidity. Real-time execution,
                                predictable fees, and non-custodial control for every participant.
                            </p>
                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={handleLaunchApp}
                                    className="h-11 px-5 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-[15px] font-medium transition-colors duration-200 ease-out hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4]"
                                >
                                    Launch App
                                </button>
                                <Link
                                    href="#"
                                    className="h-11 px-5 rounded-lg border border-[#E2E8F0] dark:border-[#1F2937] text-[15px] font-medium text-[#0F172A] dark:text-[#E5E7EB] transition-colors duration-200 ease-out hover:bg-[#F1F5F9] dark:hover:bg-[#111827]"
                                >
                                    Read Docs
                                </Link>
                            </div>
                            <div className="mt-8 grid gap-3 sm:grid-cols-3 text-[13px] text-[#475569] dark:text-[#9CA3AF]">
                                {['Predictable fees', 'Transparent routing', 'No hidden incentives'].map((item) => (
                                    <div key={item} className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-[#94A3B8] dark:text-[#6B7280]" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1F2937] rounded-2xl p-6 transition-colors duration-200">
                            <div className="flex items-center justify-between text-[13px] text-[#94A3B8] dark:text-[#6B7280]">
                                <span>Execution Snapshot</span>
                                <span className="tabular-nums text-[#2DD4BF] dark:text-[#22C1AE]">Live</span>
                            </div>
                            <div className="mt-6 space-y-4">
                                <div className="bg-[#F1F5F9] dark:bg-[#111827] rounded-xl p-4 border border-transparent dark:border-[#1F2937] transition-colors duration-200">
                                    <div className="flex items-center justify-between text-[12px] text-[#94A3B8] dark:text-[#6B7280]">
                                        <span>Verified route</span>
                                        <span className="text-[#2DD4BF] dark:text-[#22C1AE]">Confirmed</span>
                                    </div>
                                    <p className="mt-2 text-[16px] font-medium text-[#0F172A] dark:text-[#E5E7EB]">SOL → USDC via RUSH</p>
                                    <p className="mt-1 text-[14px] text-[#475569] dark:text-[#9CA3AF] tabular-nums">Fee: 0.30% · Est. finality: 0.4s</p>
                                </div>
                                <div className="bg-[#F1F5F9] dark:bg-[#111827] rounded-xl p-4 border border-transparent dark:border-[#1F2937] transition-colors duration-200">
                                    <p className="text-[13px] text-[#94A3B8] dark:text-[#6B7280]">Liquidity depth</p>
                                    <p className="text-[20px] font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">$182,400</p>
                                    <p className="text-[14px] text-[#475569] dark:text-[#9CA3AF]">Available within 0.5% price impact</p>
                                </div>
                                <p className="text-[12px] text-[#94A3B8] dark:text-[#6B7280]">
                                    Snapshot is derived from on-chain quotes with deterministic routing logic.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 sm:px-6 lg:px-8 pb-16">
                    <div className="max-w-7xl mx-auto grid gap-6 md:grid-cols-3">
                        {[
                            'Built on Solana',
                            'Non-custodial by design',
                            'Audited smart contracts',
                        ].map((item) => (
                            <div
                                key={item}
                                className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-4 transition-colors duration-200"
                            >
                                <span className="h-2.5 w-2.5 rounded-full bg-[#2DD4BF] dark:bg-[#22C1AE]" />
                                <span className="text-[14px] text-[#475569] dark:text-[#9CA3AF]">{item}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="px-4 sm:px-6 lg:px-8 py-16 bg-[#F1F5F9] dark:bg-[#111827] transition-colors duration-200">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-10">
                            <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-tight">
                                Market-grade execution without the noise.
                            </h2>
                            <p className="mt-3 text-[15px] sm:text-[16px] text-[#475569] dark:text-[#9CA3AF] max-w-[640px]">
                                SolRush is built for fast settlement, predictable routing, and sustainable rewards —
                                packaged in a UI that stays calm even when markets do not.
                            </p>
                        </div>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {[
                                { title: 'Instant finality', desc: 'Sub-second confirmation on every swap.', icon: Zap },
                                { title: 'Low fees', desc: 'Transparent pricing at 0.30% per trade.', icon: Coins },
                                { title: 'Smart routing', desc: 'Optimized paths across on-chain liquidity.', icon: Route },
                                { title: 'Earn rewards', desc: 'Liquidity incentives aligned with volume.', icon: Gift },
                            ].map(({ title, desc, icon: Icon }) => (
                                <div
                                    key={title}
                                    className="rounded-[14px] border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 transition-colors duration-200 ease-out hover:border-[#CBD5E1] dark:hover:border-[#374151]"
                                >
                                    <div className="h-10 w-10 rounded-lg bg-[#F1F5F9] dark:bg-[#111827] flex items-center justify-center transition-colors duration-200">
                                        <Icon className="h-5 w-5 text-[#475569] dark:text-[#9CA3AF]" />
                                    </div>
                                    <h3 className="mt-4 text-[16px] font-semibold">{title}</h3>
                                    <p className="mt-2 text-[14px] text-[#475569] dark:text-[#9CA3AF]">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-4 sm:px-6 lg:px-8 py-16">
                    <div className="max-w-7xl mx-auto grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
                        <div>
                            <span className="inline-flex items-center rounded-full border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] px-3 py-1 text-[12px] text-[#475569] dark:text-[#9CA3AF]">
                                Designed for execution, not distraction
                            </span>
                            <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-tight">
                                A trading surface that stays out of your way.
                            </h2>
                            <p className="mt-3 text-[15px] sm:text-[16px] text-[#475569] dark:text-[#9CA3AF] max-w-[640px]">
                                Clean pricing, clear balances, and smart confirmations. Every control is designed for
                                decisive execution without distraction.
                            </p>
                        </div>
                        <div className="relative">
                            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 transition-colors duration-200">
                                <div className="flex items-center justify-between text-[13px] text-[#94A3B8] dark:text-[#6B7280]">
                                    <span>SolRush App</span>
                                    <span className="tabular-nums">v1.0</span>
                                </div>
                                <div className="mt-6 space-y-4">
                                    <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#111827] p-4 transition-colors duration-200">
                                        <div className="flex justify-between text-[13px] text-[#94A3B8] dark:text-[#6B7280]">
                                            <span>You pay</span>
                                            <span className="tabular-nums">Balance 12.40 SOL</span>
                                        </div>
                                        <div className="mt-2 flex items-end justify-between">
                                            <span className="text-[24px] font-semibold tabular-nums">2.50</span>
                                            <span className="text-[14px] text-[#475569] dark:text-[#9CA3AF]">SOL</span>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#111827] p-4 transition-colors duration-200">
                                        <div className="flex justify-between text-[13px] text-[#94A3B8] dark:text-[#6B7280]">
                                            <span>You receive</span>
                                            <span className="tabular-nums">Estimated</span>
                                        </div>
                                        <div className="mt-2 flex items-end justify-between">
                                            <span className="text-[24px] font-semibold tabular-nums">412.30</span>
                                            <span className="text-[14px] text-[#475569] dark:text-[#9CA3AF]">USDC</span>
                                        </div>
                                    </div>
                                    <button className="w-full h-11 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-[15px] font-medium transition-colors duration-200 ease-out hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4]">
                                        Review Swap
                                    </button>
                                </div>
                            </div>
                            <div className="absolute -left-6 top-10 hidden sm:block rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F1F5F9] dark:bg-[#111827] p-4 transition-colors duration-200">
                                <p className="text-[12px] text-[#94A3B8] dark:text-[#6B7280]">Price impact</p>
                                <p className="text-[16px] font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">0.18%</p>
                            </div>
                            <div className="absolute -right-6 bottom-10 hidden sm:block rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F1F5F9] dark:bg-[#111827] p-4 transition-colors duration-200">
                                <p className="text-[12px] text-[#94A3B8] dark:text-[#6B7280]">Route confidence</p>
                                <p className="text-[16px] font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">High</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 sm:px-6 lg:px-8 py-16 bg-[#F1F5F9] dark:bg-[#111827] transition-colors duration-200">
                    <div className="max-w-7xl mx-auto grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
                        <div>
                            <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-tight">
                                Rewards and liquidity with clear, auditable math.
                            </h2>
                            <p className="mt-3 text-[15px] sm:text-[16px] text-[#475569] dark:text-[#9CA3AF] max-w-[640px]">
                                Liquidity providers earn a share of swap fees plus transparent emissions. APY is
                                calculated from rolling 7-day volume and incentives — no hidden multipliers.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 space-y-5 transition-colors duration-200">
                            <div>
                                <p className="text-[12px] text-[#94A3B8]">Current average LP APY</p>
                                <p className="text-[32px] font-semibold text-[#2DD4BF] dark:text-[#22C1AE] tabular-nums">12.4%</p>
                                <p className="text-[13px] text-[#94A3B8] dark:text-[#6B7280]">Based on last 7 days of fees</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#111827] p-4 border border-transparent dark:border-[#1F2937] transition-colors duration-200">
                                    <div className="flex items-center gap-1 text-[12px] text-[#94A3B8] dark:text-[#6B7280]">
                                        <span>Fees distributed</span>
                                        <span title="Total swap fees shared with LPs over the last 7 days">ⓘ</span>
                                    </div>
                                    <p className="text-[16px] font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">$428,310</p>
                                </div>
                                <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#111827] p-4 border border-transparent dark:border-[#1F2937] transition-colors duration-200">
                                    <div className="flex items-center gap-1 text-[12px] text-[#94A3B8] dark:text-[#6B7280]">
                                        <span>Liquidity depth</span>
                                        <span title="Total capital available across core pools">ⓘ</span>
                                    </div>
                                    <p className="text-[16px] font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">$96.2M</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#111827] p-4 text-[13px] text-[#475569] dark:text-[#9CA3AF] space-y-2 transition-colors duration-200">
                                <p className="font-medium text-[#0F172A] dark:text-[#E5E7EB]">APY formula</p>
                                <p>APY = (7-day fees + incentives) ÷ average liquidity × 365</p>
                                <p className="text-[12px] text-[#94A3B8] dark:text-[#6B7280]">Updated 12 minutes ago</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 sm:px-6 lg:px-8 py-16">
                    <div className="max-w-7xl mx-auto">
                        <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-tight">
                            Security that reads like an enterprise checklist.
                        </h2>
                        <p className="mt-3 text-[15px] sm:text-[16px] text-[#475569] dark:text-[#9CA3AF] max-w-[640px]">
                            Policies, audits, and controls aligned with institutional expectations.
                        </p>
                        <div className="mt-10 grid gap-6 md:grid-cols-3">
                            {[
                                { title: 'Audited smart contracts', desc: 'Independent reviews with published findings.', icon: FileCheck },
                                { title: 'Non-custodial architecture', desc: 'Users always retain ownership of assets.', icon: Lock },
                                { title: 'Risk monitoring', desc: 'Real-time alerts on pool and routing health.', icon: ShieldCheck },
                            ].map(({ title, desc, icon: Icon }) => (
                                <div key={title} className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 transition-colors duration-200">
                                    <div className="h-10 w-10 rounded-lg bg-[#F1F5F9] dark:bg-[#111827] flex items-center justify-center transition-colors duration-200">
                                        <Icon className="h-5 w-5 text-[#475569] dark:text-[#9CA3AF]" />
                                    </div>
                                    <h3 className="mt-4 text-[16px] font-semibold">{title}</h3>
                                    <p className="mt-2 text-[14px] text-[#475569] dark:text-[#9CA3AF]">{desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-6 transition-colors duration-200">
                            <ul className="grid gap-3 text-[14px] text-[#475569] dark:text-[#9CA3AF]">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#94A3B8] dark:text-[#6B7280]" />
                                    <span>Continuous on-chain monitoring for liquidity health and abnormal pricing.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#94A3B8] dark:text-[#6B7280]" />
                                    <span>Role-based access control for protocol upgrades and emergency actions.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#94A3B8] dark:text-[#6B7280]" />
                                    <span>Transparent program IDs and open-source tooling for verification.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="px-4 sm:px-6 lg:px-8 py-16 bg-[#F1F5F9] dark:bg-[#111827] transition-colors duration-200">
                    <div className="max-w-7xl mx-auto rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] p-10 text-center transition-colors duration-200">
                        <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-tight">
                            SolRush is built for capital that expects certainty.
                        </h2>
                        <p className="mt-3 text-[15px] sm:text-[16px] text-[#475569] dark:text-[#9CA3AF] max-w-[640px] mx-auto">
                            Deploy a calmer trading stack with verified routing, audited contracts, and transparent incentives.
                        </p>
                        <div className="mt-6">
                            <button
                                onClick={handleLaunchApp}
                                className="h-11 px-6 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-[15px] font-medium transition-colors duration-200 ease-out hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4]"
                            >
                                Launch App
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-[#E2E8F0] dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#0B1220] py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A]">
                            <img src="/logo.png" alt="SolRush Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[14px] text-[#475569] dark:text-[#9CA3AF]">© 2025 SolRush DEX</span>
                    </div>
                    <div className="flex flex-wrap gap-6 text-[14px] text-[#475569] dark:text-[#9CA3AF]">
                        <Link href="#">Terms</Link>
                        <Link href="#">Privacy</Link>
                        <Link href="#">Security</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};
