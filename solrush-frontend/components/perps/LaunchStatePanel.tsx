import React from 'react';

interface LaunchStatePanelProps {
  connected: boolean;
}

export function LaunchStatePanel({ connected }: LaunchStatePanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121826] px-6 py-8 text-center">
      <h2 className="text-xl font-semibold text-[#E5E7EB]">No perps markets are live yet</h2>
      <p className="mt-2 text-sm text-[#9CA3AF]">
        Perpetual markets on SolRush are initialized on-chain. Once a market is live, trading
        becomes immediately available with transparent funding and margin.
      </p>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button className="h-10 px-4 rounded-xl bg-[#8B5CF6] text-white text-sm font-semibold hover:bg-[#7C3AED] transition-colors">
          {connected ? 'Initialize Market' : 'Connect Wallet'}
        </button>
        <a className="text-sm text-[#9CA3AF] hover:text-[#E5E7EB]" href="#">
          How perps work on SolRush
        </a>
      </div>
      {!connected && (
        <div className="mt-3 text-xs text-[#6B7280]">
          Market initialization requires a connected wallet.
        </div>
      )}
      <div className="mt-5 flex items-center justify-center gap-4 text-[11px] uppercase tracking-wide text-[#6B7280]">
        <span>On-chain settlement</span>
        <span>Non-custodial margin</span>
        <span>Oracle-based pricing</span>
      </div>
    </div>
  );
}
