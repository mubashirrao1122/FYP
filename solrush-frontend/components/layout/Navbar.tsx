'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

/**
 * Immersive Navbar — hidden by default, slides in on hover via a
 * transparent 10 px trigger zone at the top of the viewport.
 * Glassmorphism + Framer Motion spring animation.
 */
export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/swap', label: 'Swap' },
    { href: '/perps', label: 'Perps' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/pools', label: 'Pools' },
    { href: '/rewards', label: 'Rewards' },
    { href: '/history', label: 'History' },
    { href: '/chat', label: 'AI Chat' },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Invisible hover trigger zone — always present at viewport top */}
      <div
        className="fixed top-0 left-0 right-0 h-[10px] z-[60]"
        onMouseEnter={() => setIsVisible(true)}
      />

      {/* Animated Navbar */}
      <motion.nav
        initial={{ y: '-100%' }}
        animate={{ y: isVisible ? '0%' : '-100%' }}
        transition={springTransition}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className={cn(
          'fixed top-0 left-0 right-0 z-50',
          'backdrop-blur-md bg-background/60 border-b border-white/[0.06]',
          'shadow-[0_4px_30px_rgba(0,0,0,0.25)]',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
              <div className="w-10 h-10 relative transition-all rounded-lg overflow-hidden border border-white/[0.08] bg-background/80 backdrop-blur group-hover:shadow-[0_0_16px_rgba(6,182,212,0.3)]">
                <img src="/logo.png" alt="SolRush Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-semibold text-foreground">SolRush</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'nav-underline px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive(link.href)
                      ? 'text-foreground bg-white/[0.06]'
                      : 'text-foreground/60 hover:text-foreground hover:bg-white/[0.04]'
                  )}
                  data-active={isActive(link.href) ? 'true' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Wallet Button - Desktop */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="flex items-center h-9 px-4 rounded-full border border-white/[0.08] text-[13px] text-foreground/60 bg-white/[0.03] backdrop-blur transition-all duration-200 hover:border-neon-cyan/30 hover:text-foreground hover:shadow-[0_0_16px_rgba(6,182,212,0.12)]"
              >
                {shortAddress ? shortAddress : 'Connect Wallet'}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              {isOpen ? (
                <X className="h-6 w-6 text-foreground" />
              ) : (
                <Menu className="h-6 w-6 text-foreground" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden pb-4 space-y-1 -mx-4 px-4 border-t border-white/[0.06] overflow-hidden"
              >
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'block px-4 py-2.5 rounded-lg font-medium transition-all duration-200',
                      isActive(link.href)
                        ? 'text-foreground bg-white/[0.06] border-l-2 border-neon-cyan'
                        : 'text-foreground/60 hover:text-foreground hover:bg-white/[0.04]'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="px-4 py-2 flex items-center gap-3 border-t border-white/[0.06] mt-2 pt-3">
                  <ThemeToggle />
                  <button
                    type="button"
                    onClick={() => setVisible(true)}
                    className="flex items-center h-9 px-4 rounded-full border border-white/[0.08] text-[13px] text-foreground/60 bg-white/[0.03] backdrop-blur transition-all duration-200 hover:border-neon-cyan/30 hover:text-foreground"
                  >
                    {shortAddress ? shortAddress : 'Connect Wallet'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>
    </>
  );
}
