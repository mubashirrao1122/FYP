'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';

/**
 * Module 5.4: Navbar Component — Solana Cyber-Terminal aesthetic
 *
 * Glassmorphic navigation with neon underline active states,
 * glow wallet button, and slide-in mobile menu with backdrop blur.
 */
export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        isScrolled
          ? 'glass-card backdrop-blur-xl border-b border-border/30'
          : 'bg-background/70 backdrop-blur-sm border-b border-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-10 h-10 relative transition-all rounded-lg overflow-hidden border border-border/30 bg-background/80 backdrop-blur group-hover:shadow-[0_0_16px_rgba(6,182,212,0.3)]">
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
                    ? 'text-foreground bg-accent/50'
                    : 'text-foreground/60 hover:text-foreground hover:bg-accent/30'
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
              className="flex items-center h-9 px-4 rounded-full border border-border/40 text-[13px] text-foreground/60 glass-card transition-all duration-200 hover:border-neon-cyan/30 hover:text-foreground hover:shadow-[0_0_16px_rgba(6,182,212,0.12)]"
            >
              {shortAddress ? shortAddress : 'Connect Wallet'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 hover:bg-accent/40 rounded-lg transition-colors"
          >
            {isOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Navigation — slide-in with backdrop blur */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-1 animate-in fade-in slide-in-from-top-2 glass-card rounded-b-xl -mx-4 px-4 border-t border-border/20">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'block px-4 py-2.5 rounded-lg font-medium transition-all duration-200',
                  isActive(link.href)
                    ? 'text-foreground bg-accent/50 border-l-2 border-neon-cyan'
                    : 'text-foreground/60 hover:text-foreground hover:bg-accent/30'
                )}
              >
                {link.label}
              </Link>
            ))}
            {/* Wallet Button - Mobile */}
            <div className="px-4 py-2 flex items-center gap-3 border-t border-border/20 mt-2 pt-3">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="flex items-center h-9 px-4 rounded-full border border-border/40 text-[13px] text-foreground/60 glass-card transition-all duration-200 hover:border-neon-cyan/30 hover:text-foreground"
              >
                {shortAddress ? shortAddress : 'Connect Wallet'}
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
