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
        className="w-full h-11 px-6 rounded-lg bg-[#F1F5F9] dark:bg-[#111827] text-[#94A3B8] dark:text-[#6B7280] font-medium border border-transparent dark:border-[#1F2937] transition-colors duration-200"
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
        className="w-full h-11 px-6 rounded-lg bg-[#2DD4BF] dark:bg-[#22C1AE] text-[#0F172A] text-[15px] font-medium transition-colors duration-200 ease-out hover:bg-[#26C8B4] dark:hover:bg-[#1EB7A4] shadow-sm"
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
