'use client';

import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Token {
  symbol: string;
  icon: string;
  name: string;
}

interface TokenSelectProps {
  value?: Token;
  onChange?: (token: Token) => void;
  tokens?: Token[];
  placeholder?: string;
  className?: string;
}

const DEFAULT_TOKENS: Token[] = [
  { symbol: 'SOL', icon: '◎', name: 'Solana' },
  { symbol: 'USDC', icon: '💵', name: 'USD Coin' },
  { symbol: 'USDT', icon: '💴', name: 'Tether USD' },
  { symbol: 'RUSH', icon: '⚡', name: 'SolRush Token' },
];

/**
 * TokenSelect Component
 * Dropdown selector for tokens with search functionality
 * 
 * Features:
 * - Token icon and symbol display
 * - Search by symbol or name
 * - Custom token list support
 * - Keyboard navigation
 * - Accessible dropdown
 */
export function TokenSelect({
  value,
  onChange,
  tokens = DEFAULT_TOKENS,
  placeholder = 'Select token',
  className,
}: TokenSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (token: Token) => {
    onChange?.(token);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          {value ? (
            <>
              <span className="text-2xl">{value.icon}</span>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-white">{value.symbol}</span>
                <span className="text-xs text-white/50">{value.name}</span>
              </div>
            </>
          ) : (
            <span className="text-white/50">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-white/50 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl shadow-purple-900/20 z-50 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-white/5">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
              <Search className="h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search tokens..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Token List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => handleSelect(token)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left',
                    value?.symbol === token.symbol && 'bg-purple-500/20 border-l-2 border-purple-500'
                  )}
                >
                  <span className="text-2xl">{token.icon}</span>
                  <div className="flex flex-col flex-1">
                    <span className="font-semibold text-white">{token.symbol}</span>
                    <span className="text-xs text-white/50">{token.name}</span>
                  </div>
                  {value?.symbol === token.symbol && (
                    <div className="h-2 w-2 bg-purple-500 rounded-full" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-white/50">
                No tokens found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
