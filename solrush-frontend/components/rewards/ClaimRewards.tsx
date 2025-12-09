"use client";

import { useRewards } from "@/lib/hooks/useRewards";
import { useWallet } from "@solana/wallet-adapter-react";
import { formatTokenAmount } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";

import { useTransaction } from "@/lib/hooks/useTransaction";
import { TransactionStatus } from "@/components/common/TransactionStatus";

export const ClaimRewards = () => {
  const { publicKey } = useWallet();
  const { rewards, loading: rewardsLoading, claimAllRewards } = useRewards();
  const { status, signature, error, sendTransaction, reset } = useTransaction();

  const handleClaim = async () => {
    await sendTransaction(
      async () => {
        const signatures = await claimAllRewards();
        // Return the last signature for tracking
        return signatures[signatures.length - 1];
      },
      'claim_rewards'
    );
  };

  if (!publicKey || rewards.claimable === 0) {
    return (
      <Button
        disabled
        className="w-full h-14 text-lg bg-white/5 text-white/40 font-bold rounded-xl border border-white/10"
      >
        No Rewards to Claim
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={handleClaim}
        disabled={rewardsLoading || status === 'pending' || status === 'confirming'}
        className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
      >
        {status === 'pending'
          ? "Approving..."
          : status === 'confirming'
            ? "Confirming..."
            : `Claim ${formatTokenAmount(rewards.claimable)} RUSH`}
      </Button>

      <TransactionStatus
        status={status}
        signature={signature}
        error={error}
        onRetry={() => {
          reset();
          handleClaim();
        }}
      />
    </div>
  );
};
