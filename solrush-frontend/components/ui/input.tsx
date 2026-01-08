'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#161C2D] px-3 py-2 text-sm text-[#0F172A] dark:text-[#E5E7EB] placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2 focus:ring-offset-[#F8FAFC] dark:focus:ring-offset-[#0B0E14] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
