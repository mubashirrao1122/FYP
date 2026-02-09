import { useRewards } from "@/lib/hooks/useRewards";
import { useWallet } from "@solana/wallet-adapter-react";
import { formatTokenAmount } from "@/lib/utils/formatters";
import { RushIcon } from "@/components/icons/TokenIcons";

export const RushRewards = () => {
  const { publicKey } = useWallet();
  const { rewards } = useRewards();

  if (!publicKey) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-[#0F172A] rounded-2xl p-8 border border-[#E2E8F0] dark:border-[#1F2937] text-center shadow-sm transition-colors duration-200">
        <p className="text-[#475569] dark:text-[#9CA3AF]">Connect wallet to see rewards</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-[#0F172A] rounded-2xl p-8 border border-[#E2E8F0] dark:border-[#1F2937] shadow-sm transition-colors duration-200">
      <h2 className="text-2xl font-bold text-[#0F172A] dark:text-[#E5E7EB] mb-6 flex items-center gap-3">
        <RushIcon className="w-8 h-8" /> RUSH Rewards
      </h2>

      <div className="space-y-4">
        {/* Total RUSH */}
        <div className="bg-[#F8FAFC] dark:bg-[#111827] rounded-xl p-5 border border-transparent dark:border-[#1F2937] transition-colors">
          <p className="text-[#475569] dark:text-[#9CA3AF] text-sm mb-2">Total RUSH Earned</p>
          <div className="flex items-center gap-3">
            <RushIcon className="w-6 h-6" />
            <p className="text-[#0F172A] dark:text-[#E5E7EB] text-3xl font-bold">
              {formatTokenAmount(rewards.totalEarned)}
            </p>
          </div>
        </div>

        {/* Claimable */}
        <div className="bg-[#F8FAFC] dark:bg-[#111827] rounded-xl p-5 border border-transparent dark:border-[#1F2937] transition-colors">
          <p className="text-[#475569] dark:text-[#9CA3AF] text-sm mb-2">Claimable</p>
          <div className="flex items-center gap-3">
            <RushIcon className="w-6 h-6" />
            <p className="text-[#2DD4BF] dark:text-[#22C1AE] text-2xl font-bold">
              {formatTokenAmount(rewards.claimable)}
            </p>
          </div>
        </div>

        {/* Already Claimed */}
        <div className="bg-[#F8FAFC] dark:bg-[#111827] rounded-xl p-5 border border-transparent dark:border-[#1F2937] transition-colors">
          <p className="text-[#475569] dark:text-[#9CA3AF] text-sm mb-2">Already Claimed</p>
          <div className="flex items-center gap-3">
            <RushIcon className="w-6 h-6" />
            <p className="text-[#94A3B8] dark:text-[#6B7280] text-xl font-bold">
              {formatTokenAmount(rewards.claimed)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
