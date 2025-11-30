import { useRewards } from "@/lib/hooks/useRewards";
import { useWallet } from "@solana/wallet-adapter-react";
import { formatTokenAmount, formatCurrency } from "@/lib/utils/formatters";
import { RushIcon } from "@/components/icons/TokenIcons";

export const RushRewards = () => {
  const { publicKey } = useWallet();
  const rewards = useRewards(publicKey?.toString() || null);

  if (!publicKey) {
    return (
      <div className="max-w-md mx-auto bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 text-center shadow-xl">
        <p className="text-white/40">Connect wallet to see rewards</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <RushIcon className="w-8 h-8" /> RUSH Rewards
      </h2>

      <div className="space-y-4">
        {/* Total RUSH */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors">
          <p className="text-white/40 text-sm mb-2">Total RUSH Earned</p>
          <div className="flex items-center gap-3">
            <RushIcon className="w-6 h-6" />
            <p className="text-white text-3xl font-bold">
              {formatTokenAmount(rewards.totalRush)}
            </p>
          </div>
        </div>

        {/* Claimable */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors">
          <p className="text-white/40 text-sm mb-2">Claimable</p>
          <div className="flex items-center gap-3">
            <RushIcon className="w-6 h-6" />
            <p className="text-green-400 text-2xl font-bold">
              {formatTokenAmount(rewards.claimable)}
            </p>
          </div>
        </div>

        {/* Already Claimed */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors">
          <p className="text-white/40 text-sm mb-2">Already Claimed</p>
          <div className="flex items-center gap-3">
            <RushIcon className="w-6 h-6" />
            <p className="text-blue-400 text-xl font-bold">
              {formatTokenAmount(rewards.claimed)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
