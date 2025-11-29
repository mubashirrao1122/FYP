'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | null;
  trendValue?: string;
  loading?: boolean;
  className?: string;
}

/**
 * StatCard Component
 * Displays numerical statistics with optional trend indicators
 * 
 * Features:
 * - Large value display
 * - Trend indicator (up/down arrow)
 * - Skeleton loading state
 * - Responsive design
 */
export function StatCard({
  label,
  value,
  trend,
  trendValue,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-4 bg-white/10 rounded animate-pulse w-16" />
        <div className="h-8 bg-white/10 rounded animate-pulse w-24" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        className
      )}
    >
      <p className="text-sm text-white/60 font-medium uppercase tracking-wide">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl md:text-4xl font-bold text-white">
          {value}
        </span>
        {trend && trendValue && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-semibold',
              trend === 'up' ? 'text-green-400' : 'text-red-400'
            )}
          >
            {trend === 'up' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );
}
