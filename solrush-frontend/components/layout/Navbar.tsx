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
 * Module 5.4: Navbar Component
 * 
 * Sticky navigation bar with logo, links, and wallet connection
 * Features:
 * - Logo with SolRush branding
 * - Navigation links (Swap, Pools, Rewards)
 * - Wallet button integration
 * - Mobile responsive hamburger menu
 * - Active route highlighting
 * - Sticky on scroll
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
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/swap', label: 'Swap' },
    { href: '/perps', label: 'Perps' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/pools', label: 'Pools' },
    { href: '/rewards', label: 'Rewards' },
    { href: '/history', label: 'History' },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-200',
        isScrolled
          ? 'bg-[#F8FAFC]/90 dark:bg-[#0B0E14]/90 backdrop-blur-sm border-b border-[#E2E8F0] dark:border-white/10'
          : 'bg-[#F8FAFC]/70 dark:bg-[#0B0E14]/70 backdrop-blur-sm border-b border-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-10 h-10 relative transition-all rounded-lg overflow-hidden border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826]">
              <img src="/logo.png" alt="SolRush Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">SolRush</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive(link.href)
                    ? 'text-[#0F172A] dark:text-[#E5E7EB] bg-[#F1F5F9] dark:bg-[#161C2D] border border-[#2DD4BF] dark:border-[#22C1AE]'
                    : 'text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB] hover:bg-[#F1F5F9] dark:hover:bg-[#161C2D]'
                )}
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
              className="h-9 px-3 rounded-full border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826] text-xs text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB] transition-colors duration-200"
            >
              {shortAddress ? shortAddress : 'Connect Wallet'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 hover:bg-[#F1F5F9] dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            {isOpen ? (
              <X className="h-6 w-6 text-[#0F172A] dark:text-white" />
            ) : (
              <Menu className="h-6 w-6 text-[#0F172A] dark:text-white" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-3 animate-in fade-in slide-in-from-top-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'block px-4 py-2 rounded-lg font-medium transition-all duration-200',
                  isActive(link.href)
                    ? 'text-[#0F172A] dark:text-[#E5E7EB] bg-[#F1F5F9] dark:bg-[#161C2D] border border-[#2DD4BF] dark:border-[#22C1AE]'
                    : 'text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB] hover:bg-[#F1F5F9] dark:hover:bg-[#161C2D]'
                )}
              >
                {link.label}
              </Link>
            ))}
            {/* Wallet Button - Mobile */}
            <div className="px-4 py-2 flex items-center gap-3">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="h-9 px-3 rounded-full border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826] text-xs text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB] transition-colors duration-200"
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
