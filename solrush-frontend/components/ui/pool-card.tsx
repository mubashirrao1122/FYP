'use client';

import React from 'react';
import { Plus, Minus, TrendingUp, Eye } from 'lucide-react';
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
        'bg-gradient-to-br from-white/5 via-white/2 to-transparent border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/10 group',
        className
      )}
    >
      {/* Header: Token Pair */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          {/* Token 1 */}
          <div className="flex flex-col items-center">
            <div className="text-3xl flex items-center justify-center w-10 h-10">{token1.icon}</div>
            <span className="text-xs font-semibold text-white mt-1">
              {token1.symbol}
            </span>
          </div>

          {/* Separator */}
          <div className="px-3 text-white/30">/</div>

          {/* Token 2 */}
          <div className="flex flex-col items-center">
            <div className="text-3xl flex items-center justify-center w-10 h-10">{token2.icon}</div>
            <span className="text-xs font-semibold text-white mt-1">
              {token2.symbol}
            </span>
          </div>
        </div>

        {/* APY Badge */}
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg px-3 py-1 flex items-center gap-1">
          <TrendingUp className="h-4 w-4 text-green-400" />
          <span className="text-sm font-bold text-green-300">{apy} APY</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-white/5">
        {/* TVL */}
        <div>
          <p className="text-xs uppercase text-white/50 font-semibold mb-1">
            TVL
          </p>
          <p className="text-lg font-bold text-white">{tvl}</p>
        </div>

        {/* Fee */}
        <div>
          <p className="text-xs uppercase text-white/50 font-semibold mb-1">
            Fee
          </p>
          <p className="text-lg font-bold text-white">{fee}</p>
        </div>

        {/* Token 1 Reserve */}
        <div>
          <p className="text-xs uppercase text-white/50 font-semibold mb-1">
            {token1.symbol} Reserve
          </p>
          <p className="text-lg font-bold text-white">{token1.reserve}</p>
        </div>

        {/* Token 2 Reserve */}
        <div>
          <p className="text-xs uppercase text-white/50 font-semibold mb-1">
            {token2.symbol} Reserve
          </p>
          <p className="text-lg font-bold text-white">{token2.reserve}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* View Details Button */}
        {onViewDetails && (
          <Button
            onClick={onViewDetails}
            variant="ghost"
            className="w-full gap-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
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
            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button
            onClick={onRemoveLiquidity}
            variant="outline"
            className="flex-1 gap-2"
          >
            <Minus className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
