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
    <div className="rounded-xl border border-white/10 bg-[#121826] px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[#6B7280]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2" title={tooltip} data-testid={testId}>
        <div className="text-sm font-semibold text-[#E5E7EB] tabular-nums">{value}</div>
        {delta ? (
          <div className="text-[11px] text-[#9CA3AF] tabular-nums">{delta}</div>
        ) : null}
      </div>
    </div>
  );
}
