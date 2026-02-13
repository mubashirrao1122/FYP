'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, ArrowDownToLine, CheckCircle2, Loader2, Wallet } from 'lucide-react';
import type { DepositStep } from '@/lib/hooks/usePerpsCollateral';

interface DepositUSDCModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  onChainCollateral: number;
  depositStep: DepositStep;
  error: string | null;
  txSignature: string | null;
  requiredMargin: number | null;
  onDeposit: (amount: number) => Promise<string | null>;
  onDone: () => void;
}

const STEP_LABELS: Record<DepositStep, string> = {
  idle: '',
  'creating-ata': 'Creating token account…',
  'initializing-user': 'Initializing perps account…',
  depositing: 'Building deposit transaction…',
  confirming: 'Confirm in wallet & waiting for on-chain confirmation…',
  success: 'Deposit confirmed!',
  error: 'Deposit failed',
};

export function DepositUSDCModal({
  open,
  onOpenChange,
  walletBalance,
  onChainCollateral,
  depositStep,
  error,
  txSignature,
  requiredMargin,
  onDeposit,
  onDone,
}: DepositUSDCModalProps) {
  const [amount, setAmount] = useState('');
  const numericAmount = parseFloat(amount) || 0;
  const isProcessing = ['creating-ata', 'initializing-user', 'depositing', 'confirming'].includes(depositStep);
  const isSuccess = depositStep === 'success';
  const insufficientWallet = numericAmount > walletBalance;
  const canSubmit = numericAmount > 0 && !insufficientWallet && !isProcessing && !isSuccess;

  const shortfall = requiredMargin !== null ? Math.max(0, requiredMargin - onChainCollateral) : 0;

  const handleDeposit = async () => {
    if (!canSubmit) return;
    await onDeposit(numericAmount);
  };

  const handleDone = () => {
    setAmount('');
    onDone();
  };

  const handleSetMax = () => {
    setAmount(walletBalance.toFixed(2));
  };

  const handleSetRequired = () => {
    if (shortfall > 0) {
      // Add 1% buffer
      const buffered = Math.min(shortfall * 1.01, walletBalance);
      setAmount(buffered.toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="bg-[#0F172A] border-[#1F2937] text-[#E5E7EB] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-[#2DD4BF]" />
            Deposit USDC Collateral
          </DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            Deposit USDC to your perps margin account before opening a position.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Balances summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-3">
              <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">Wallet USDC</div>
              <div className="text-lg font-semibold font-mono text-[#E5E7EB]">
                {walletBalance.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-3">
              <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">On-chain Collateral</div>
              <div className="text-lg font-semibold font-mono text-[#E5E7EB]">
                {onChainCollateral.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Shortfall notice */}
          {requiredMargin !== null && shortfall > 0 && (
            <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3 flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
              <div className="text-xs text-[#F59E0B]">
                You need at least <strong>${requiredMargin.toFixed(2)}</strong> collateral for this trade.
                You're short <strong>${shortfall.toFixed(2)}</strong>.
                <button
                  type="button"
                  className="ml-1 underline hover:no-underline"
                  onClick={handleSetRequired}
                >
                  Fill shortfall
                </button>
              </div>
            </div>
          )}

          {/* Amount input */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Amount (USDC)</label>
              <button
                type="button"
                className="text-xs text-[#2DD4BF] hover:underline"
                onClick={handleSetMax}
                disabled={isProcessing}
              >
                Max
              </button>
            </div>
            <Input
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing || isSuccess}
              className="bg-transparent border-none text-2xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-[#6B7280] text-[#E5E7EB]"
            />
            {insufficientWallet && (
              <p className="text-xs text-[#EF4444]">
                Amount exceeds your wallet balance.
              </p>
            )}
          </div>

          {/* Progress / status */}
          {isProcessing && (
            <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#2DD4BF]" />
              <span className="text-sm text-[#9CA3AF]">{STEP_LABELS[depositStep]}</span>
            </div>
          )}

          {isSuccess && (
            <div className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-3 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              <div className="text-sm text-[#22C55E]">
                <span className="font-medium">Deposit confirmed!</span>
                {txSignature && (
                  <span className="block text-xs mt-1 text-[#22C55E]/70 font-mono truncate max-w-[280px]">
                    {txSignature}
                  </span>
                )}
              </div>
            </div>
          )}

          {error && depositStep === 'error' && (
            <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#EF4444] mt-0.5 shrink-0" />
              <span className="text-xs text-[#EF4444]">{error}</span>
            </div>
          )}

          {/* What will happen notice */}
          {!isProcessing && !isSuccess && walletBalance === 0 && (
            <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-3 flex gap-2 items-start">
              <Wallet className="w-4 h-4 text-[#9CA3AF] mt-0.5 shrink-0" />
              <p className="text-xs text-[#9CA3AF]">
                Your wallet has no USDC. Transfer or swap USDC to your wallet first, then deposit here.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:flex-row">
          {isSuccess ? (
            <Button
              className="flex-1 bg-[#2DD4BF] hover:bg-[#26C8B4] text-[#0F172A] font-medium"
              onClick={handleDone}
            >
              Continue Trading
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
                className="border-[#1F2937] text-[#E5E7EB] hover:bg-[#111827]"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#2DD4BF] hover:bg-[#26C8B4] text-[#0F172A] font-medium disabled:opacity-50"
                onClick={handleDeposit}
                disabled={!canSubmit}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing…
                  </>
                ) : (
                  `Deposit ${numericAmount > 0 ? numericAmount.toFixed(2) : ''} USDC`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
