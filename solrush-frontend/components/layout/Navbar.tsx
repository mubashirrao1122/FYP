'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Zap } from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/swap', label: 'Swap' },
    { href: '/pools', label: 'Pools' },
    { href: '/rewards', label: 'Rewards' },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-black/60 backdrop-blur-xl border-b border-white/20 shadow-2xl shadow-purple-900/10'
          : 'bg-black/40 backdrop-blur-md border-b border-white/5'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-10 h-10 relative group-hover:shadow-lg group-hover:shadow-purple-500/30 transition-all rounded-lg overflow-hidden">
              <img src="/logo.png" alt="SolRush Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
              SolRush
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-lg font-medium transition-all duration-200',
                  isActive(link.href)
                    ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Wallet Button - Desktop */}
          <div className="hidden md:block">
            <WalletButton />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <Menu className="h-6 w-6 text-white" />
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
                    ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                {link.label}
              </Link>
            ))}
            {/* Wallet Button - Mobile */}
            <div className="px-4 py-2">
              <WalletButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
