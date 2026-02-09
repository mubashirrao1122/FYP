'use client';

import React from 'react';

export default function PerpsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0E14] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#121826] p-6 text-center">
        <h1 className="text-xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">
          Perps failed to load
        </h1>
        <p className="mt-2 text-sm text-[#475569] dark:text-[#9CA3AF]">
          {error.message || 'Unexpected error.'}
        </p>
        <button
          onClick={reset}
          className="mt-4 w-full h-10 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-sm font-medium hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4] transition-colors duration-200"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
