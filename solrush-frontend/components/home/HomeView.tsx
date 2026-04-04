'use client';

import React from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Route,
  Zap,
  Coins,
  Gift,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { GlowyWavesHero } from '@/components/ui/glowy-waves-hero';
import { Button } from '@/components/ui/button';
import { MagneticCard } from '@/components/ui/magnetic-card';
import { GradientBorder } from '@/components/ui/gradient-border';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { ParticleField } from '@/components/ui/particle-field';

interface HomeViewProps {
  handleLaunchApp: () => void;
}

/* ── Framer variants for scroll-reveal sections ────────────── */
const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 50, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.12 },
  },
};

const itemReveal: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export const HomeView: React.FC<HomeViewProps> = ({ handleLaunchApp }) => {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-neon-cyan/20 transition-colors duration-200">
      {/* ── Sticky Header ─────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'glass-card backdrop-blur-xl border-b border-border/30'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg overflow-hidden border border-border/30 bg-background/80 backdrop-blur transition-shadow duration-300 group-hover:shadow-[0_0_16px_rgba(6,182,212,0.3)]">
                <img
                  src="/logo.png"
                  alt="SolRush Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[16px] font-semibold tracking-tight text-foreground">
                SolRush
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-[14px] text-foreground/60">
              {[
                { href: '#features', label: 'Features' },
                { href: '#', label: 'Docs' },
                { href: '#rewards', label: 'Rewards' },
                { href: '#security', label: 'Security' },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="nav-underline hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="flex items-center h-9 px-4 rounded-full border border-border/40 text-[13px] text-foreground/60 glass-card transition-all duration-200 hover:border-neon-cyan/30 hover:text-foreground"
              >
                {shortAddress ? shortAddress : 'Connect Wallet'}
              </button>
              <Button
                onClick={handleLaunchApp}
                className="h-9 px-4 rounded-full bg-neon-blue text-white text-[13px] font-medium hover:bg-[#2563EB] animate-glow-pulse transition-all"
              >
                Launch App
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO: Full-screen Glowy Waves ────────────────── */}
        <GlowyWavesHero onLaunchApp={handleLaunchApp} />

        {/* ── Trust Strip ──────────────────────────────────── */}
        <motion.section
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="px-4 sm:px-6 lg:px-8 py-12"
        >
          <div className="max-w-7xl mx-auto grid gap-4 md:grid-cols-3">
            {[
              { text: 'Built on Solana', icon: '⚡' },
              { text: 'Non-custodial by design', icon: '🔐' },
              { text: 'Audited smart contracts', icon: '✓' },
            ].map(({ text, icon }) => (
              <motion.div key={text} variants={itemReveal}>
                <MagneticCard
                  glowColor="rgba(6, 182, 212, 0.12)"
                  intensity={5}
                  className="glass-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-neon-cyan animate-dot-pulse text-neon-cyan" />
                    <span className="text-[14px] text-foreground/70 font-medium">{text}</span>
                  </div>
                </MagneticCard>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Features Grid ────────────────────────────────── */}
        <motion.section
          id="features"
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="px-4 sm:px-6 lg:px-8 py-20 relative overflow-hidden"
        >
          {/* Background texture */}
          <div className="absolute inset-0 bg-muted/30 transition-colors duration-200" />
          <div className="absolute inset-0 scanline" />

          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div variants={itemReveal} className="mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/20 bg-neon-cyan/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-cyan mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                Core advantages
              </div>
              <h2 className="text-[28px] sm:text-[40px] font-bold tracking-tight text-foreground leading-[1.1]">
                Market-grade execution{' '}
                <span className="text-foreground/40">without the noise.</span>
              </h2>
              <p className="mt-4 text-[15px] sm:text-[17px] text-foreground/60 max-w-[640px] leading-relaxed">
                SolRush is built for fast settlement, predictable routing, and
                sustainable rewards — packaged in a UI that stays calm even when
                markets do not.
              </p>
            </motion.div>

            {/* Asymmetric grid: first card spans 2 cols */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'Instant finality',
                  desc: 'Sub-second confirmation on every swap. Solana-native speed means your trades settle before you release the click.',
                  icon: Zap,
                  glow: 'rgba(6, 182, 212, 0.15)',
                  span: true,
                },
                {
                  title: 'Low fees',
                  desc: 'Transparent pricing at 0.30% per trade.',
                  icon: Coins,
                  glow: 'rgba(59, 130, 246, 0.15)',
                  span: false,
                },
                {
                  title: 'Smart routing',
                  desc: 'Optimized paths across on-chain liquidity.',
                  icon: Route,
                  glow: 'rgba(139, 92, 246, 0.15)',
                  span: false,
                },
                {
                  title: 'Earn rewards',
                  desc: 'Liquidity incentives aligned with volume.',
                  icon: Gift,
                  glow: 'rgba(34, 197, 94, 0.15)',
                  span: false,
                },
              ].map(({ title, desc, icon: Icon, glow, span }) => (
                <motion.div
                  key={title}
                  variants={itemReveal}
                  className={span ? 'lg:col-span-2 md:col-span-2' : ''}
                >
                  <MagneticCard glowColor={glow} className="glass-card p-6 h-full">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-neon-cyan/10 to-neon-blue/10 border border-neon-cyan/10 flex items-center justify-center transition-colors duration-200">
                      <Icon className="h-5 w-5 text-neon-cyan" />
                    </div>
                    <h3 className="mt-4 text-[17px] font-semibold text-foreground">
                      {title}
                    </h3>
                    <p className="mt-2 text-[14px] text-foreground/55 leading-relaxed">{desc}</p>
                  </MagneticCard>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Trading Preview ──────────────────────────────── */}
        <motion.section
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="px-4 sm:px-6 lg:px-8 py-20"
        >
          <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-[1.15fr_0.85fr] items-center">
            <motion.div variants={itemReveal}>
              <div className="inline-flex items-center gap-2 rounded-full border border-neon-green/20 bg-neon-green/5 px-3 py-1.5 text-[12px] uppercase tracking-[0.2em] text-neon-green font-semibold mb-4">
                <TrendingUp className="h-3 w-3" />
                Designed for execution
              </div>
              <h2 className="text-[28px] sm:text-[40px] font-bold tracking-tight text-foreground leading-[1.1]">
                A trading surface that stays{' '}
                <span className="bg-gradient-to-r from-neon-cyan to-neon-blue bg-clip-text text-transparent">
                  out of your way.
                </span>
              </h2>
              <p className="mt-4 text-[15px] sm:text-[17px] text-foreground/55 max-w-[640px] leading-relaxed">
                Clean pricing, clear balances, and smart confirmations. Every
                control is designed for decisive execution without distraction.
              </p>
            </motion.div>

            <motion.div variants={itemReveal} className="relative">
              <GradientBorder animated>
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center justify-between text-[13px] text-foreground/50">
                    <span className="font-data">SolRush App</span>
                    <span className="font-data">v1.0</span>
                  </div>
                  <div className="mt-6 space-y-4">
                    <div className="rounded-xl border border-border/30 bg-muted/30 p-4 transition-colors duration-200 neon-focus">
                      <div className="flex justify-between text-[13px] text-foreground/50">
                        <span>You pay</span>
                        <span className="font-data">Balance 12.40 SOL</span>
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="text-[28px] font-bold font-data text-foreground">
                          2.50
                        </span>
                        <span className="text-[14px] text-foreground/60 font-medium">SOL</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/30 bg-muted/30 p-4 transition-colors duration-200 neon-focus">
                      <div className="flex justify-between text-[13px] text-foreground/50">
                        <span>You receive</span>
                        <span className="font-data">Estimated</span>
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="text-[28px] font-bold font-data text-foreground">
                          412.30
                        </span>
                        <span className="text-[14px] text-foreground/60 font-medium">USDC</span>
                      </div>
                    </div>
                    <Button
                      className="w-full h-11 rounded-xl bg-neon-blue text-white text-[15px] font-semibold hover:bg-[#2563EB] animate-glow-pulse transition-all"
                    >
                      Review Swap
                    </Button>
                  </div>
                </div>
              </GradientBorder>

              {/* Floating info badges */}
              <div className="absolute -left-6 top-10 hidden sm:block glass-card rounded-xl p-4 animate-float">
                <p className="text-[12px] text-foreground/50">Price impact</p>
                <p className="text-[16px] font-bold text-foreground font-data">
                  0.18%
                </p>
              </div>
              <div className="absolute -right-6 bottom-10 hidden sm:block glass-card rounded-xl p-4 animate-float-delayed">
                <p className="text-[12px] text-foreground/50">Route confidence</p>
                <p className="text-[16px] font-bold text-neon-green font-data">
                  High
                </p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ── Rewards Section ──────────────────────────────── */}
        <motion.section
          id="rewards"
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="px-4 sm:px-6 lg:px-8 py-20 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-muted/30 transition-colors duration-200" />

          <div className="max-w-7xl mx-auto relative z-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <motion.div variants={itemReveal}>
              <div className="inline-flex items-center gap-2 rounded-full border border-neon-amber/20 bg-neon-amber/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-amber mb-4">
                <Gift className="h-3.5 w-3.5" />
                Liquidity rewards
              </div>
              <h2 className="text-[28px] sm:text-[40px] font-bold tracking-tight text-foreground leading-[1.1]">
                Rewards with{' '}
                <span className="text-foreground/40">clear, auditable math.</span>
              </h2>
              <p className="mt-4 text-[15px] sm:text-[17px] text-foreground/55 max-w-[640px] leading-relaxed">
                Liquidity providers earn a share of swap fees plus transparent
                emissions. APY is calculated from rolling 7-day volume and
                incentives — no hidden multipliers.
              </p>
            </motion.div>

            <motion.div variants={itemReveal}>
              <MagneticCard glowColor="rgba(245, 158, 11, 0.12)" className="glass-card p-6 space-y-5">
                <div>
                  <p className="text-[12px] text-foreground/50 uppercase tracking-wider">
                    Current average LP APY
                  </p>
                  <p className="text-[36px] font-bold text-neon-cyan text-glow-cyan">
                    <AnimatedCounter end={12.4} decimals={1} suffix="%" />
                  </p>
                  <p className="text-[13px] text-foreground/50">
                    Based on last 7 days of fees
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-muted/30 p-4 border border-border/15 transition-colors duration-200">
                    <div className="flex items-center gap-1 text-[12px] text-foreground/50">
                      <span>Fees distributed</span>
                      <span title="Total swap fees shared with LPs over the last 7 days">ⓘ</span>
                    </div>
                    <p className="text-[17px] font-bold text-foreground font-data">
                      <AnimatedCounter end={428310} prefix="$" />
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4 border border-border/15 transition-colors duration-200">
                    <div className="flex items-center gap-1 text-[12px] text-foreground/50">
                      <span>Liquidity depth</span>
                      <span title="Total capital available across core pools">ⓘ</span>
                    </div>
                    <p className="text-[17px] font-bold text-foreground font-data">
                      <AnimatedCounter end={96.2} decimals={1} prefix="$" suffix="M" />
                    </p>
                  </div>
                </div>
                <div className="relative rounded-xl border border-border/20 bg-muted/20 p-4 text-[13px] text-foreground/60 space-y-2 scanline overflow-hidden">
                  <p className="font-semibold text-foreground font-data">APY formula</p>
                  <p className="font-data text-[12px]">
                    APY = (7d_fees + incentives) ÷ avg_liquidity × 365
                  </p>
                  <p className="text-[12px] text-foreground/40 font-data">
                    // Updated 12 minutes ago
                  </p>
                </div>
              </MagneticCard>
            </motion.div>
          </div>
        </motion.section>

        {/* ── Security Section ─────────────────────────────── */}
        <motion.section
          id="security"
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="px-4 sm:px-6 lg:px-8 py-20"
        >
          <div className="max-w-7xl mx-auto">
            <motion.div variants={itemReveal}>
              <div className="inline-flex items-center gap-2 rounded-full border border-neon-purple/20 bg-neon-purple/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-purple mb-4">
                <ShieldCheck className="h-3.5 w-3.5" />
                Enterprise-grade security
              </div>
              <h2 className="text-[28px] sm:text-[40px] font-bold tracking-tight text-foreground leading-[1.1]">
                Security that reads like an{' '}
                <span className="text-foreground/40">enterprise checklist.</span>
              </h2>
              <p className="mt-4 text-[15px] sm:text-[17px] text-foreground/55 max-w-[640px] leading-relaxed">
                Policies, audits, and controls aligned with institutional
                expectations.
              </p>
            </motion.div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                {
                  title: 'Audited smart contracts',
                  desc: 'Independent reviews with published findings. Every function auditable.',
                  icon: FileCheck,
                },
                {
                  title: 'Non-custodial architecture',
                  desc: 'Users always retain ownership of assets. No intermediary control.',
                  icon: Lock,
                },
                {
                  title: 'Risk monitoring',
                  desc: 'Real-time alerts on pool health, routing anomalies, and pricing drift.',
                  icon: ShieldCheck,
                },
              ].map(({ title, desc, icon: Icon }) => (
                <motion.div key={title} variants={itemReveal}>
                  <MagneticCard
                    glowColor="rgba(139, 92, 246, 0.12)"
                    className="glass-card p-6 h-full"
                  >
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-neon-purple/10 to-neon-blue/10 border border-neon-purple/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-neon-purple" />
                    </div>
                    <h3 className="mt-4 text-[17px] font-semibold text-foreground">
                      {title}
                    </h3>
                    <p className="mt-2 text-[14px] text-foreground/55 leading-relaxed">{desc}</p>
                  </MagneticCard>
                </motion.div>
              ))}
            </div>

            <motion.div
              variants={itemReveal}
              className="mt-8 glass-card rounded-2xl p-6"
            >
              <ul className="grid gap-3 text-[14px] text-foreground/60">
                {[
                  'Continuous on-chain monitoring for liquidity health and abnormal pricing.',
                  'Role-based access control for protocol upgrades and emergency actions.',
                  'Transparent program IDs and open-source tooling for verification.',
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    variants={itemReveal}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-neon-green flex-shrink-0" />
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.section>

        {/* ── CTA Banner ───────────────────────────────────── */}
        <motion.section
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="px-4 sm:px-6 lg:px-8 py-20 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-muted/30 transition-colors duration-200" />

          <motion.div variants={itemReveal} className="relative z-10">
            <GradientBorder animated className="max-w-7xl mx-auto">
              <div className="relative glass-card rounded-2xl p-12 text-center overflow-hidden">
                {/* Particle background */}
                <ParticleField particleCount={25} colorScheme="mixed" />

                <div className="relative z-10">
                  <h2 className="text-[28px] sm:text-[40px] font-bold tracking-tight text-foreground leading-[1.1]">
                    SolRush is built for capital that{' '}
                    <span className="bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-purple bg-clip-text text-transparent">
                      expects certainty.
                    </span>
                  </h2>
                  <p className="mt-4 text-[15px] sm:text-[17px] text-foreground/55 max-w-[640px] mx-auto leading-relaxed">
                    Deploy a calmer trading stack with verified routing, audited
                    contracts, and transparent incentives.
                  </p>
                  <div className="mt-8">
                    <Button
                      onClick={handleLaunchApp}
                      className="h-12 px-10 rounded-full bg-neon-blue text-white text-[15px] font-semibold hover:bg-[#2563EB] animate-glow-pulse transition-all group gap-2"
                    >
                      Launch App
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </GradientBorder>
          </motion.div>
        </motion.section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border/20 bg-background/80 backdrop-blur-sm py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-border/30 bg-background/80">
              <img
                src="/logo.png"
                alt="SolRush Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[14px] text-foreground/50 font-data">
              © 2025 SolRush DEX
            </span>
          </div>
          <div className="flex flex-wrap gap-6 text-[14px] text-foreground/50">
            {['Terms', 'Privacy', 'Security', 'Docs'].map((link) => (
              <Link
                key={link}
                href="#"
                className="nav-underline hover:text-foreground transition-colors"
              >
                {link}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
