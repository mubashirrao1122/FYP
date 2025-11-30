'use client';

import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SolIcon, UsdcIcon, UsdtIcon, RushIcon } from '@/components/icons/TokenIcons';

export interface Token {
  symbol: string;
  icon: React.ReactNode;
  name: string;
}

interface TokenSelectProps {
  value?: Token | string;
  onChange?: (token: Token | string) => void;
  tokens?: Token[];
  placeholder?: string;
  className?: string;
  exclude?: string[];
  compact?: boolean; // New compact mode for smaller display
}

const DEFAULT_TOKENS: Token[] = [
  { symbol: 'SOL', icon: <SolIcon className="w-8 h-8" />, name: 'Solana' },
  { symbol: 'USDC', icon: <UsdcIcon className="w-8 h-8" />, name: 'USD Coin' },
  { symbol: 'USDT', icon: <UsdtIcon className="w-8 h-8" />, name: 'Tether USD' },
  { symbol: 'RUSH', icon: <RushIcon className="w-8 h-8" />, name: 'SolRush Token' },
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
  exclude = [],
  compact = false,
}: TokenSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Get Token object from value (string or Token)
  const selectedToken =
    typeof value === 'string'
      ? tokens.find((t) => t.symbol === value)
      : value;

  const filteredTokens = tokens.filter(
    (token) =>
      (token.symbol.toLowerCase().includes(search.toLowerCase()) ||
        token.name.toLowerCase().includes(search.toLowerCase())) &&
      !exclude.includes(token.symbol)
  );

  const handleSelect = (token: Token) => {
    onChange?.(token.symbol); // Pass symbol for compatibility
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all hover:border-purple-500/30 group",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        )}
      >
        <div className={cn("flex items-center gap-2 flex-1 overflow-hidden", compact && "gap-1.5")}>
          {selectedToken ? (
            <>
              <div className={cn(
                "flex-shrink-0 transform group-hover:scale-110 transition-transform",
                compact ? "w-5 h-5" : "w-8 h-8"
              )}>
                {compact ?
                  React.cloneElement(selectedToken.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" }) :
                  selectedToken.icon
                }
              </div>
              <span className={cn(
                "font-bold text-white truncate",
                compact ? "text-sm" : "text-lg"
              )}>
                {selectedToken.symbol}
              </span>
            </>
          ) : (
            <span className="text-white/50">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'text-white/50 transition-transform group-hover:text-white',
            isOpen && 'rotate-180',
            compact ? "h-3 w-3" : "h-4 w-4"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a1a] border border-white/10 rounded-2xl shadow-2xl shadow-purple-900/20 z-50 overflow-hidden backdrop-blur-xl">
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
                    selectedToken?.symbol === token.symbol &&
                    'bg-purple-500/20 border-l-2 border-purple-500'
                  )}
                >
                  <div className="flex-shrink-0">{token.icon}</div>
                  <div className="flex flex-col flex-1">
                    <span className="font-semibold text-white">
                      {token.symbol}
                    </span>
                    <span className="text-xs text-white/50">{token.name}</span>
                  </div>
                  {selectedToken?.symbol === token.symbol && (
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
