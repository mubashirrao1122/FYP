'use client';

import React from 'react';
import { Plus, Minus, Eye } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface PoolCardProps {
  token1: {
    symbol: string;
    icon: React.ReactNode;
    reserve: string;
  };
  token2: {
    symbol: string;
    icon: React.ReactNode;
    reserve: string;
  };
  volume24h?: string;
  apy: string;
  fee: string;
  tvl: string;
  poolAddress?: string; // Optional pool address for navigation
  onAddLiquidity?: () => void;
  onRemoveLiquidity?: () => void;
  onViewDetails?: () => void; // Optional view details handler
  className?: string;
}

/**
 * PoolCard Component
 * Display liquidity pool information with action buttons
 * 
 * Features:
 * - Token pair display
 * - APY and fee badges
 * - TVL information
 * - Add/Remove liquidity actions
 * - Hover effects and animations
 */
export function PoolCard({
  token1,
  token2,
  volume24h,
  apy,
  fee,
  tvl,
  poolAddress,
  onAddLiquidity,
  onRemoveLiquidity,
  onViewDetails,
  className,
}: PoolCardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-2xl p-6 hover:border-[#CBD5E1] dark:hover:border-white/20 transition-colors duration-200',
        className
      )}
    >
      {/* Header: Token Pair */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-9 h-9 rounded-full border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#161C2D] flex items-center justify-center">
              {token1.icon}
            </div>
            <div className="w-9 h-9 rounded-full border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#161C2D] flex items-center justify-center">
              {token2.icon}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
              {token1.symbol} / {token2.symbol}
            </div>
            <div className="text-xs text-[#94A3B8] dark:text-[#6B7280]">Fee tier {fee}</div>
          </div>
        </div>
        <button
          type="button"
          title="APY reflects net fees earned over the last 7 days."
          className="text-xs font-medium text-[#475569] dark:text-[#9CA3AF] border border-[#E2E8F0] dark:border-white/10 rounded-full px-2.5 py-1"
        >
          Net APY {apy}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-[#E2E8F0] dark:border-white/10">
        {/* TVL */}
        <div>
          <p className="text-xs uppercase text-[#94A3B8] dark:text-[#6B7280] font-semibold mb-1">
            TVL
          </p>
          <p className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">{tvl}</p>
        </div>

        {/* 24h Volume */}
        <div>
          <p className="text-xs uppercase text-[#94A3B8] dark:text-[#6B7280] font-semibold mb-1">
            24h Volume
          </p>
          <p className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">
            {volume24h || '—'}
          </p>
        </div>

        {/* Token 1 Reserve */}
        <div>
          <p className="text-xs uppercase text-[#94A3B8] dark:text-[#6B7280] font-semibold mb-1">
            {token1.symbol}
          </p>
          <p className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">{token1.reserve}</p>
        </div>

        {/* Token 2 Reserve */}
        <div>
          <p className="text-xs uppercase text-[#94A3B8] dark:text-[#6B7280] font-semibold mb-1">
            {token2.symbol}
          </p>
          <p className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">{token2.reserve}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* View Details Button */}
        {onViewDetails && (
          <Button
            onClick={onViewDetails}
            variant="ghost"
            className="w-full gap-2 text-[#8B5CF6] hover:text-[#7C3AED] hover:bg-[#8B5CF6]/10"
          >
            <Eye className="h-4 w-4" />
            View Details
          </Button>
        )}

        {/* Add/Remove Liquidity Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onAddLiquidity}
            variant="default"
            className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          {onRemoveLiquidity && (
            <Button
              onClick={onRemoveLiquidity}
              variant="outline"
              className="flex-1 gap-2"
            >
              <Minus className="h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
