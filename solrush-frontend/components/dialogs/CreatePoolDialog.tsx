import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle } from 'lucide-react';

interface CreatePoolDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tokenA: string;
    tokenB: string;
    amountA: number;
    amountB: number;
    feeTier: number;
    onConfirm: () => void;
    loading?: boolean;
}

export const CreatePoolDialog: React.FC<CreatePoolDialogProps> = ({
    open,
    onOpenChange,
    tokenA,
    tokenB,
    amountA,
    amountB,
    feeTier,
    onConfirm,
    loading = false,
}) => {
    const estimatedLPTokens = Math.sqrt(amountA * amountB);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900 border-white/20">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <Plus className="w-5 h-5 text-purple-400" />
                        Confirm Create Pool
                    </DialogTitle>
                    <DialogDescription className="text-white/60">
                        Review the details before creating {tokenA}/{tokenB} pool
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Pool Details */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-white/60">Pool Pair</span>
                            <span className="text-white font-semibold">{tokenA}/{tokenB}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/60">Fee Tier</span>
                            <span className="text-white font-semibold">{feeTier}%</span>
                        </div>
                    </div>

                    {/* Initial Liquidity */}
                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-white">Initial Liquidity:</div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-white/60">{tokenA}</span>
                                <span className="text-white font-semibold">{amountA.toFixed(6)}</span>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-white/60">{tokenB}</span>
                                <span className="text-white font-semibold">{amountB.toFixed(6)}</span>
                            </div>
                        </div>
                    </div>

                    {/* LP Tokens */}
                    <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                        <div className="text-sm text-purple-300 mb-1">Estimated LP Tokens</div>
                        <div className="text-2xl font-bold text-purple-200">
                            {estimatedLPTokens.toFixed(6)}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-300">
                            You'll be the first liquidity provider. The ratio you set will determine the initial price.
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="text-white border-white/20"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={loading}
                        className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                    >
                        {loading ? 'Creating...' : 'Create Pool'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
