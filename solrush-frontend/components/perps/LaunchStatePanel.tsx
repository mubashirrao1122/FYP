import React from 'react';

interface LaunchStatePanelProps {
  connected: boolean;
}

export function LaunchStatePanel({ connected }: LaunchStatePanelProps) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] px-6 py-8 text-center shadow-sm transition-colors duration-200">
      <h2 className="text-xl font-semibold text-[#0F172A] dark:text-[#E5E7EB]">No perps markets are live yet</h2>
      <p className="mt-2 text-sm text-[#475569] dark:text-[#9CA3AF]">
        Perpetual markets on SolRush are initialized on-chain. Once a market is live, trading
        becomes immediately available with transparent funding and margin.
      </p>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button className="h-10 px-4 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-sm font-medium hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4] transition-colors duration-200">
          {connected ? 'Initialize Market' : 'Connect Wallet'}
        </button>
        <a className="text-sm text-[#475569] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#E5E7EB] transition-colors" href="#">
          How perps work on SolRush
        </a>
      </div>
      {!connected && (
        <div className="mt-3 text-xs text-[#6B7280] dark:text-[#6B7280]">
          Market initialization requires a connected wallet.
        </div>
      )}
      <div className="mt-5 flex items-center justify-center gap-4 text-[11px] uppercase tracking-wide text-[#6B7280] dark:text-[#6B7280]">
        <span>On-chain settlement</span>
        <span>Non-custodial margin</span>
        <span>Oracle-based pricing</span>
      </div>
    </div>
  );
}
