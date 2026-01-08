'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SolIcon, UsdcIcon, UsdtIcon, RushIcon } from '@/components/icons/TokenIcons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTokenList } from '@/lib/hooks/useTokenList';

export interface Token {
  symbol: string;
  icon: React.ReactNode | string;
  name: string;
  address?: string;
  decimals?: number;
}

interface TokenSelectProps {
  value?: Token | string;
  onChange?: (token: Token | string) => void;
  tokens?: Token[];
  placeholder?: string;
  className?: string;
  exclude?: string[];
  compact?: boolean;
}

const DEFAULT_TOKENS: Token[] = [
  { symbol: 'SOL', icon: <SolIcon className="w-8 h-8" />, name: 'Solana', decimals: 9 },
  { symbol: 'USDC', icon: <UsdcIcon className="w-8 h-8" />, name: 'USD Coin', decimals: 6 },
  { symbol: 'USDT', icon: <UsdtIcon className="w-8 h-8" />, name: 'Tether USD', decimals: 6 },
  { symbol: 'RUSH', icon: <RushIcon className="w-8 h-8" />, name: 'SolRush Token', decimals: 6 },
];

export function TokenSelect({
  value,
  onChange,
  tokens: propTokens,
  placeholder = 'Select token',
  className,
  exclude = [],
  compact = false,
}: TokenSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch tokens from API
  const { tokens: fetchedTokens, loading } = useTokenList();

  // Combine default tokens with fetched tokens
  // We prioritize propTokens if provided, otherwise defaults + fetched
  const allTokens = useMemo(() => {
    if (propTokens) return propTokens;

    // Create a map to avoid duplicates, starting with defaults
    const tokenMap = new Map<string, Token>();

    DEFAULT_TOKENS.forEach(t => tokenMap.set(t.symbol, t));

    fetchedTokens.forEach(t => {
      if (!tokenMap.has(t.symbol)) {
        tokenMap.set(t.symbol, {
          symbol: t.symbol,
          name: t.name,
          icon: t.logoURI || '', // Use logoURI from Jupiter list
          address: t.address,
          decimals: t.decimals
        });
      }
    });

    return Array.from(tokenMap.values());
  }, [propTokens, fetchedTokens]);

  const selectedToken = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'string') {
      return allTokens.find((t) => t.symbol === value) || {
        symbol: value,
        name: value,
        icon: <div className="w-8 h-8 bg-gray-600 rounded-full" />
      };
    }
    return value;
  }, [value, allTokens]);

  const filteredTokens = useMemo(() => {
    return allTokens.filter(
      (token) =>
        (token.symbol.toLowerCase().includes(search.toLowerCase()) ||
          token.name.toLowerCase().includes(search.toLowerCase())) &&
        !exclude.includes(token.symbol)
    );
  }, [allTokens, search, exclude]);

  const handleSelect = (token: Token) => {
    onChange?.(token.symbol);
    setIsOpen(false);
    setSearch('');
  };

  const renderIcon = (icon: React.ReactNode | string, className?: string) => {
    if (typeof icon === 'string') {
      return <img src={icon} alt="Token" className={cn("rounded-full", className)} />;
    }
    // Clone element to add className if it's a valid element
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className });
    }
    return icon;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between gap-2 bg-white dark:bg-[#161C2D] hover:bg-[#F1F5F9] dark:hover:bg-[#1B2234] border border-[#E2E8F0] dark:border-white/10 rounded-2xl transition-all duration-200 hover:border-[#8B5CF6] group outline-none",
            compact ? "px-2 py-1.5" : "px-3 py-2",
            className
          )}
        >
          <div className={cn("flex items-center gap-2 flex-1 overflow-hidden", compact && "gap-1.5")}>
            {selectedToken ? (
              <>
                <div className={cn(
                  "flex-shrink-0 transform group-hover:scale-110 transition-transform",
                  compact ? "w-5 h-5" : "w-8 h-8"
                )}>
                  {renderIcon(selectedToken.icon, compact ? "w-5 h-5" : "w-8 h-8")}
                </div>
                <span className={cn(
                  "font-semibold text-[#0F172A] dark:text-[#E5E7EB] truncate",
                  compact ? "text-sm" : "text-lg"
                )}>
                  {selectedToken.symbol}
                </span>
              </>
            ) : (
              <span className="text-[#94A3B8] dark:text-[#6B7280]">{placeholder}</span>
            )}
          </div>
          <ChevronDown
            className={cn(
              'text-[#94A3B8] dark:text-[#6B7280] transition-transform group-hover:text-[#0F172A] dark:group-hover:text-white',
              isOpen && 'rotate-180',
              compact ? "h-3 w-3" : "h-4 w-4"
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[300px] bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-2xl shadow-lg p-0 overflow-hidden"
        align="start"
        sideOffset={8}
      >
        {/* Search Input */}
        <div className="p-3 border-b border-[#E2E8F0] dark:border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#F1F5F9] dark:bg-[#161C2D] rounded-lg">
            <Search className="h-4 w-4 text-[#94A3B8] dark:text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[#0F172A] dark:text-[#E5E7EB] placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280] text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Token List */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
          {loading && filteredTokens.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#94A3B8] dark:text-[#6B7280]">
              Loading tokens...
            </div>
          ) : filteredTokens.length > 0 ? (
            filteredTokens.map((token) => (
              <button
                key={`${token.symbol}-${token.address || 'native'}`}
                onClick={() => handleSelect(token)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F1F5F9] dark:hover:bg-[#161C2D] transition-colors text-left',
                  selectedToken?.symbol === token.symbol &&
                  'bg-[#F1F5F9] dark:bg-[#161C2D] border-l-2 border-[#8B5CF6]'
                )}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-[#F1F5F9] dark:bg-[#161C2D] flex items-center justify-center">
                  {renderIcon(token.icon, "w-8 h-8")}
                </div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="font-semibold text-[#0F172A] dark:text-[#E5E7EB] truncate">
                    {token.symbol}
                  </span>
                  <span className="text-xs text-[#94A3B8] dark:text-[#6B7280] truncate">{token.name}</span>
                </div>
                {selectedToken?.symbol === token.symbol && (
                  <div className="h-2 w-2 bg-[#8B5CF6] rounded-full flex-shrink-0" />
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-[#94A3B8] dark:text-[#6B7280]">
              No tokens found
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
