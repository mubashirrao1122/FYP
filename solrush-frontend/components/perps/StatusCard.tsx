import React from 'react';

interface StatusCardProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  details?: string;
}

export function StatusCard({ title, message, actionLabel, onAction, details }: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] px-6 py-5 text-left shadow-sm transition-colors duration-200">
      <div className="text-lg font-semibold text-[#0F172A] dark:text-[#E5E7EB]">{title}</div>
      <div className="mt-2 text-sm text-[#475569] dark:text-[#9CA3AF]">{message}</div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 h-10 px-4 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-sm font-medium hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4] transition-colors duration-200"
        >
          {actionLabel}
        </button>
      )}
      {details && (
        <details className="mt-4 text-xs text-[#475569] dark:text-[#9CA3AF]">
          <summary className="cursor-pointer text-sm text-[#0F172A] dark:text-[#E5E7EB]">Developer details</summary>
          <div className="mt-2 whitespace-pre-wrap">{details}</div>
        </details>
      )}
    </div>
  );
}
