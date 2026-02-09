import React from 'react';

interface MetricPillProps {
  label: string;
  value: string;
  delta?: string | null;
  tooltip?: string;
  testId?: string;
}

export function MetricPill({ label, value, delta, tooltip, testId }: MetricPillProps) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] px-3 py-3 transition-colors duration-200">
      <div className="text-[11px] uppercase tracking-wide text-[#6B7280] dark:text-[#6B7280]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2" title={tooltip} data-testid={testId}>
        <div className="text-sm font-semibold text-[#0F172A] dark:text-[#E5E7EB] tabular-nums">{value}</div>
        {delta ? (
          <div className="text-[11px] text-[#475569] dark:text-[#9CA3AF] tabular-nums">{delta}</div>
        ) : null}
      </div>
    </div>
  );
}
