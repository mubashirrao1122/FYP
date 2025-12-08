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
import { AlertCircle, TrendingDown } from 'lucide-react';

interface RemoveLiquidityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    poolName: string;
    lpAmount: number;
    tokenAAmount: number;
    tokenBAmount: number;
    tokenASymbol: string;
    tokenBSymbol: string;
    onConfirm: () => void;
    loading?: boolean;
}

export const RemoveLiquidityDialog: React.FC<RemoveLiquidityDialogProps> = ({
    open,
    onOpenChange,
    poolName,
    lpAmount,
    tokenAAmount,
    tokenBAmount,
    tokenASymbol,
    tokenBSymbol,
    onConfirm,
    loading = false,
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900 border-white/20">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <TrendingDown className="w-5 h-5 text-red-400" />
                        Confirm Remove Liquidity
                    </DialogTitle>
                    <DialogDescription className="text-white/60">
                        You are about to remove liquidity from {poolName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* LP Tokens */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="text-sm text-white/40 mb-1">LP Tokens to burn</div>
                        <div className="text-2xl font-bold text-white">{lpAmount.toFixed(6)}</div>
                    </div>

                    {/* Expected Returns */}
                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-white">You will receive:</div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-white/60">{tokenASymbol}</span>
                                <span className="text-white font-semibold">{tokenAAmount.toFixed(6)}</span>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-white/60">{tokenBSymbol}</span>
                                <span className="text-white font-semibold">{tokenBAmount.toFixed(6)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-500">
                            <strong>Important:</strong> Removing liquidity will permanently burn your LP tokens.
                            Make sure you understand the implications before proceeding.
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
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {loading ? 'Removing...' : 'Confirm Remove'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
