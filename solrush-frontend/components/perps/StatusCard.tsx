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
    <div className="rounded-2xl border border-white/10 bg-[#121826] px-6 py-5 text-left">
      <div className="text-lg font-semibold text-[#E5E7EB]">{title}</div>
      <div className="mt-2 text-sm text-[#9CA3AF]">{message}</div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 h-10 px-4 rounded-xl bg-[#8B5CF6] text-white text-sm font-semibold hover:bg-[#7C3AED] transition-colors"
        >
          {actionLabel}
        </button>
      )}
      {details && (
        <details className="mt-4 text-xs text-[#9CA3AF]">
          <summary className="cursor-pointer text-sm text-[#E5E7EB]">Developer details</summary>
          <div className="mt-2 whitespace-pre-wrap">{details}</div>
        </details>
      )}
    </div>
  );
}
