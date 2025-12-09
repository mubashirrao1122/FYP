'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTransaction } from '@/lib/hooks/useTransaction';
import { TransactionStatus } from '@/components/common/TransactionStatus';

// ... imports

export function RemoveLiquidity({ poolAddress }: { poolAddress: string }) {
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const [lpTokenAmount, setLpTokenAmount] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [slippage, setSlippage] = useState(1.0);
  const [showDetails, setShowDetails] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { pool, userPosition, loading, removeLiquidity, calculateRemoveAmounts } =
    usePool(poolAddress);

  const { status, signature, error, sendTransaction, reset } = useTransaction();

  // ... effects and helpers

  const handleRemoveLiquidity = async () => {
    if (!publicKey) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to continue.',
      });
      return;
    }

    if (!lpTokenAmount || parseFloat(lpTokenAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid LP token amount.',
      });
      return;
    }

    setIsConfirmOpen(true);
  };

  const executeRemoveLiquidity = async () => {
    setIsConfirmOpen(false);

    try {
      const minAmountA = receivedAmountA * (1 - slippage / 100);
      const minAmountB = receivedAmountB * (1 - slippage / 100);

      await sendTransaction(
        () => removeLiquidity({
          lpTokenAmount: parseFloat(lpTokenAmount),
          minAmountA,
          minAmountB,
        }),
        'remove_liquidity'
      );

      toast({
        title: 'Liquidity Removed Successfully!',
        description: `Received ${receivedAmountA.toFixed(4)} ${tokenASymbol} and ${receivedAmountB.toFixed(2)} ${tokenBSymbol}`,
      });

      setLpTokenAmount('');
      setPercentage(0);
    } catch (error: any) {
      console.error('Remove liquidity failed:', error);
    }
  };

  // ...

  return (
    <Card className="w-full max-w-lg bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
      <CardHeader>
        <CardTitle className="text-white">Remove Liquidity</CardTitle>
        <CardDescription className="text-white/40">
          Withdraw your tokens and close your liquidity position
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ... Position Summary and Inputs ... */}

        {/* Remove Button */}
        <Button
          onClick={handleRemoveLiquidity}
          disabled={!publicKey || loading || status === 'pending' || status === 'confirming' || !lpTokenAmount}
          className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
        >
          {!publicKey
            ? 'Connect Wallet'
            : status === 'pending'
              ? 'Approving...'
              : status === 'confirming'
                ? 'Confirming...'
                : loading
                  ? 'Removing Liquidity...'
                  : 'Remove Liquidity'}
        </Button>

        <TransactionStatus
          status={status}
          signature={signature}
          error={error}
          onRetry={() => {
            reset();
            handleRemoveLiquidity();
          }}
        />
      </CardContent>

      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={executeRemoveLiquidity}
        title="Confirm Remove Liquidity"
        description={`Are you sure you want to remove ${percentage}% of your liquidity? You will receive approximately ${receivedAmountA.toFixed(4)} ${tokenASymbol} and ${receivedAmountB.toFixed(2)} ${tokenBSymbol}.`}
        confirmText="Remove Liquidity"
        variant="danger"
        isLoading={false}
      />
    </Card>
  );
}
