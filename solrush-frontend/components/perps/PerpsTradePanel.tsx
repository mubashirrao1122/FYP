'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { MarketView } from '@/lib/perps/types';
import { usePerpsCollateral } from '@/lib/hooks/usePerpsCollateral';
import { usePerpsTrading } from '@/lib/hooks/usePerpsTrading';
import { DepositUSDCModal } from '@/components/perps/DepositUSDCModal';
import { parseSolanaError } from '@/lib/utils/solanaErrors';

interface PerpsTradePanelProps {
  market?: MarketView | null;
  disabled?: boolean;
  error?: string | null;
  emptyState?: boolean;
}

type TradeState = 'idle' | 'quoting' | 'ready' | 'submitting' | 'success' | 'error';

interface TradeLog {
  ts: string;
  message: string;
}

interface TradeMachine {
  state: TradeState;
  error: string | null;
  logs: TradeLog[];
  txSignature: string | null;
}

type TradeEvent =
  | { type: 'INPUT_INVALID' }
  | { type: 'INPUT_VALID' }
  | { type: 'QUOTE_READY' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_SUCCESS'; signature: string }
  | { type: 'SUBMIT_ERROR'; message: string }
  | { type: 'RESET' };

const logEntry = (message: string): TradeLog => ({
  ts: new Date().toISOString(),
  message,
});

const tradeReducer = (state: TradeMachine, event: TradeEvent): TradeMachine => {
  switch (event.type) {
    case 'INPUT_INVALID':
      return { ...state, state: 'idle', error: null, txSignature: null, logs: [...state.logs, logEntry('Input invalid')] };
    case 'INPUT_VALID':
      return { ...state, state: 'quoting', error: null, logs: [...state.logs, logEntry('Quoting started')] };
    case 'QUOTE_READY':
      return { ...state, state: 'ready', logs: [...state.logs, logEntry('Quote ready')] };
    case 'SUBMIT':
      return { ...state, state: 'submitting', error: null, logs: [...state.logs, logEntry('Submitting trade')] };
    case 'SUBMIT_SUCCESS':
      return {
        ...state,
        state: 'success',
        txSignature: event.signature,
        logs: [...state.logs, logEntry(`Success: ${event.signature}`)],
      };
    case 'SUBMIT_ERROR':
      return {
        ...state,
        state: 'error',
        error: event.message,
        logs: [...state.logs, logEntry(`Error: ${event.message}`)],
      };
    case 'RESET':
      return { ...state, state: 'idle', error: null, txSignature: null, logs: [...state.logs, logEntry('Reset')] };
    default:
      return state;
  }
};

const initialTradeState: TradeMachine = {
  state: 'idle',
  error: null,
  logs: [],
  txSignature: null,
};

export function PerpsTradePanel({ market, disabled, error, emptyState = false }: PerpsTradePanelProps) {
  const { publicKey } = useWallet();
  const [size, setSize] = React.useState('');
  const [leverage, setLeverage] = React.useState(5);
  const [side, setSide] = React.useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = React.useState<'market' | 'limit'>('market');
  const [collateral, setCollateral] = React.useState<string>('USDC');
  const [showTPSL, setShowTPSL] = React.useState(false);
  const [takeProfit, setTakeProfit] = React.useState('');
  const [stopLoss, setStopLoss] = React.useState('');
  const [limitPrice, setLimitPrice] = React.useState('');
  const [showReview, setShowReview] = React.useState(false);
  const [showDepositModal, setShowDepositModal] = React.useState(false);
  const [tradeState, dispatch] = React.useReducer(tradeReducer, initialTradeState);

  // ── Collateral management ──────────────────────────────────────────
  const {
    walletBalance,
    onChainCollateral,
    userAccountExists,
    ataExists,
    loading: collateralLoading,
    error: collateralError,
    txSignature: depositTxSig,
    depositStep,
    refresh: refreshCollateral,
    deposit: depositCollateral,
    hasEnoughCollateral,
  } = usePerpsCollateral();

  // ── On-chain trading ──────────────────────────────────────────────
  const {
    openPosition: onChainOpen,
    closePosition: onChainClose,
    reset: resetTrading,
  } = usePerpsTrading();

  const formatPrice = (value: number | null) =>
    value === null ? '—' : `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const formatPercent = (value: number | null) =>
    value === null ? '—' : `${value.toFixed(4)}%`;
  const formatNumber = (value: number | null) =>
    value === null ? '—' : value.toLocaleString();
  const tooltipFor = (value: number | null, fallback = 'Available after first trade') =>
    value === null ? fallback : undefined;

  const hasSize = size && parseFloat(size) > 0;
  const hasLimitPrice = orderType === 'limit' ? parseFloat(limitPrice) > 0 : true;
  const numericSize = hasSize ? parseFloat(size) : 0;
  const markPrice = market?.markPrice ?? null;
  const notional = markPrice && numericSize ? markPrice * numericSize : null;
  const estimatedMargin = notional ? notional / leverage : null;
  const maintenanceBps = market?.maintenanceMarginBps ?? null;
  const liquidation = notional && maintenanceBps !== null && markPrice
    ? side === 'long'
      ? markPrice - (estimatedMargin ? Math.max(estimatedMargin - (notional * maintenanceBps) / 10000, 0) / numericSize : 0)
      : markPrice + (estimatedMargin ? Math.max(estimatedMargin - (notional * maintenanceBps) / 10000, 0) / numericSize : 0)
    : null;
  const fundingEstimate =
    notional && market && market.fundingRate !== null ? (notional * market.fundingRate) / 100 : null;
  const availableBalance = publicKey ? onChainCollateral : null;

  const needsDeposit = publicKey && estimatedMargin !== null && !hasEnoughCollateral(estimatedMargin);
  const hasNoCollateral = publicKey && onChainCollateral === 0;

  const isFormValid = Boolean(market && hasSize && hasLimitPrice);
  const isReady = tradeState.state === 'ready';
  const ctaLabel = !publicKey
    ? 'Connect Wallet'
    : !market
      ? emptyState
        ? 'Select a live market'
        : 'Select Market'
      : !isFormValid
        ? 'Enter Size'
        : needsDeposit
          ? 'Deposit USDC'
          : tradeState.state === 'quoting'
            ? 'Quoting…'
            : tradeState.state === 'submitting'
              ? 'Confirming…'
              : tradeState.state === 'success'
                ? 'View Transaction'
                : tradeState.state === 'error'
                  ? 'Try Again'
                  : 'Review Order';

  React.useEffect(() => {
    if (!market || !hasSize || !hasLimitPrice) {
      dispatch({ type: 'INPUT_INVALID' });
      return;
    }
    dispatch({ type: 'INPUT_VALID' });
    const timer = setTimeout(() => dispatch({ type: 'QUOTE_READY' }), 250);
    return () => clearTimeout(timer);
  }, [market, hasSize, hasLimitPrice, orderType]);

  React.useEffect(() => {
    if (!market) return;
    setCollateral(market.quoteSymbol);
  }, [market]);

  const handleSubmit = () => {
    if (!publicKey) return;
    if (needsDeposit) {
      setShowDepositModal(true);
      return;
    }
    if (!isReady) return;
    setShowReview(true);
  };

  const confirmSubmit = async () => {
    if (!publicKey || !isReady || !market) return;
    dispatch({ type: 'SUBMIT' });
    try {
      const sig = await onChainOpen({
        marketPubkey: market.id,
        side,
        size: numericSize,
        leverage,
        orderType,
      });
      if (sig) {
        dispatch({ type: 'SUBMIT_SUCCESS', signature: sig });
        setShowReview(false);
        setSize('');
      } else {
        dispatch({ type: 'SUBMIT_ERROR', message: 'Transaction was not confirmed.' });
      }
    } catch (err: any) {
      dispatch({
        type: 'SUBMIT_ERROR',
        message: parseSolanaError(err) || err?.message || 'Failed to open position.',
      });
    }
  };

  const handleDeposit = async (amount: number) => {
    if (!market) return null;
    return depositCollateral(amount, market.id);
  };

  const handleDepositDone = () => {
    setShowDepositModal(false);
  };

  return (
    <div className="glass-card rounded-2xl p-6 transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Perps</h2>
          <p className="text-sm text-foreground/50">
            Controlled execution with transparent funding and margin.
          </p>
        </div>
        <div className="text-xs text-foreground/50 font-data">
          {market ? `${market.baseSymbol}/${market.quoteSymbol}` : 'No market selected'}
        </div>
      </div>

      {/* Long/Short + Market/Limit tabs */}
      <div className="grid grid-cols-2 gap-3">
        <Tabs value={side} onValueChange={(value) => setSide(value as 'long' | 'short')} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger
              value="long"
              className="data-[state=active]:bg-neon-green/15 data-[state=active]:text-neon-green data-[state=active]:border-neon-green/30 data-[state=active]:shadow-[0_0_12px_rgba(34,197,94,0.15)]"
            >
              Long
            </TabsTrigger>
            <TabsTrigger
              value="short"
              className="data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive data-[state=active]:border-destructive/30 data-[state=active]:shadow-[0_0_12px_rgba(239,68,68,0.15)]"
            >
              Short
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs
          value={orderType}
          onValueChange={(value) => setOrderType(value as 'market' | 'limit')}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="limit" disabled className="opacity-50 cursor-not-allowed">
              Limit <span className="text-[10px] ml-1 text-neon-cyan/70">(Soon)</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 space-y-4">
        {error && (
          <div
            className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            data-testid="perps-inline-error"
          >
            {error}
          </div>
        )}

        {/* Collateral section */}
        <div className="rounded-2xl bg-muted/20 border border-border/20 p-4 transition-colors duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">Collateral</label>
            <span className="text-xs text-foreground/50 font-data">
              {publicKey ? (
                <>
                  Margin: {collateralLoading ? '…' : `$${onChainCollateral.toFixed(2)}`}
                  <span className="mx-1 text-foreground/30">|</span>
                  Wallet: {collateralLoading ? '…' : `$${walletBalance.toFixed(2)}`}
                </>
              ) : 'Connect wallet'}
            </span>
          </div>
          {publicKey && (
            <button
              type="button"
              className="text-xs text-neon-cyan hover:underline text-left"
              onClick={() => setShowDepositModal(true)}
            >
              + Deposit USDC to margin
            </button>
          )}
          <div className="rounded-xl border border-border/20 bg-card/50 px-3 py-2">
            <select
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              disabled={disabled}
              className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
            >
              {Array.from(new Set([market?.quoteSymbol ?? 'USDC', 'USDC', 'USDT'])).map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>
          {needsDeposit && isFormValid && (
            <div className="rounded-lg border border-neon-amber/30 bg-neon-amber/10 px-3 py-2 text-xs text-neon-amber">
              Insufficient collateral — you need ${estimatedMargin?.toFixed(2)} but have ${onChainCollateral.toFixed(2)}.
              <button
                type="button"
                className="ml-1 underline hover:no-underline font-medium"
                onClick={() => setShowDepositModal(true)}
              >
                Deposit now
              </button>
            </div>
          )}
        </div>

        {/* Size input */}
        <div className="rounded-2xl bg-muted/20 border border-border/20 p-4 neon-focus transition-colors duration-200">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-semibold text-foreground">Size</label>
            <span className="text-xs text-foreground/50 font-data">
              {market ? `${market.baseSymbol} size` : 'Select market'}
            </span>
          </div>
          <Input
            type="number"
            placeholder="0.0"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            disabled={disabled || !market}
            className="bg-transparent border-none text-3xl font-semibold font-data h-auto focus:ring-0 px-0 placeholder:text-foreground/25"
          />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={!availableBalance || disabled}
                className="text-[11px] font-semibold text-foreground/50 border border-border/20 rounded-lg py-1.5 transition-all hover:border-neon-cyan/30 hover:text-neon-cyan disabled:opacity-50 disabled:hover:border-border/20 disabled:hover:text-foreground/50"
              >
                {pct}%
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-foreground/50">Estimated · Slippage protected</p>
        </div>

        {/* Limit price */}
        {orderType === 'limit' && (
          <div className="rounded-2xl bg-muted/20 border border-border/20 p-4 neon-focus transition-colors duration-200">
            <label className="text-sm font-semibold text-foreground">Limit price</label>
            <Input
              type="number"
              placeholder="0.0"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              disabled={disabled || !market}
              className="mt-2 bg-transparent border-none text-2xl font-semibold font-data h-auto focus:ring-0 px-0 placeholder:text-foreground/25"
            />
            <p className="mt-2 text-xs text-foreground/50">
              Orders execute only at your specified price.
            </p>
          </div>
        )}

        {/* Leverage slider */}
        <div className="rounded-2xl bg-muted/20 border border-border/20 p-4 transition-colors duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">Leverage</label>
            <span className="text-xs text-neon-cyan font-data font-semibold">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={market?.maxLeverage ?? 20}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            disabled={disabled || !market}
            className="neon-slider"
          />
          <div className="grid grid-cols-4 gap-2">
            {[2, 5, 10, 20].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLeverage(preset)}
                disabled={disabled || !market}
                className={`text-[11px] font-semibold rounded-lg py-1.5 border transition-all ${leverage === preset
                  ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                  : 'border-border/20 text-foreground/50 hover:border-foreground/30'
                  }`}
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>

        {/* Trade info panel */}
        <div className="rounded-xl glass-card p-3 text-sm text-foreground/50 space-y-2">
          <div className="flex items-center justify-between">
            <span>Entry price</span>
            <span className="text-foreground font-data" title={tooltipFor(market?.markPrice ?? null)}>
              {market ? formatPrice(market.markPrice) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Liquidation</span>
            <span className="text-foreground font-data" title={tooltipFor(liquidation)}>
              {formatPrice(liquidation)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Fees</span>
            <span className="text-foreground font-data" title="Available after first trade">—</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Funding (est.)</span>
            <span className="text-foreground font-data" title={tooltipFor(fundingEstimate)}>
              {fundingEstimate === null ? '—' : formatPrice(fundingEstimate)}
            </span>
          </div>
        </div>

        {/* TP/SL */}
        <div className="rounded-xl bg-muted/20 border border-border/20 p-3 text-sm text-foreground/50">
          <button
            type="button"
            onClick={() => setShowTPSL((prev) => !prev)}
            className="w-full flex items-center justify-between text-sm font-medium text-foreground"
          >
            {showTPSL ? 'Hide take profit / stop loss' : 'Add take profit / stop loss'}
            <span className="text-xs text-foreground/50">{showTPSL ? '−' : '+'}</span>
          </button>
          {showTPSL && (
            <div className="mt-3 space-y-3">
              <Input
                type="number"
                placeholder="Take profit price"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="bg-card/50 border-border/20 neon-focus"
              />
              <Input
                type="number"
                placeholder="Stop loss price"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="bg-card/50 border-border/20 neon-focus"
              />
            </div>
          )}
        </div>

        {/* Market info */}
        <div className="rounded-xl glass-card p-3 text-sm text-foreground/50 space-y-2">
          <div className="flex items-center justify-between">
            <span>Mark price</span>
            <span className="text-foreground font-data" title={market?.markPrice === null ? 'Available after first trade' : undefined}>
              {market ? formatPrice(market.markPrice) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Funding rate</span>
            <span className="text-foreground font-data" title={market?.fundingRate === null ? 'Available after first trade' : undefined}>
              {market ? formatPercent(market.fundingRate) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Open interest</span>
            <span className="text-foreground font-data" title={market?.openInterest === null ? 'Available after first trade' : undefined}>
              {market ? formatNumber(market.openInterest) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Notional</span>
            <span className="text-foreground font-data" title={tooltipFor(notional)}>
              {notional === null ? '—' : formatPrice(notional)}
            </span>
          </div>
        </div>

        {/* Review panel */}
        {showReview && (
          <div className="rounded-xl bg-muted/20 border border-border/20 p-4 text-sm text-foreground/50 space-y-2">
            <div className="text-sm font-semibold text-foreground">Review order</div>
            <div className="flex items-center justify-between">
              <span>Market</span>
              <span className="text-foreground font-data">{market?.symbol ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Side</span>
              <span className={`font-data uppercase ${side === 'long' ? 'text-neon-green' : 'text-destructive'}`}>{side}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Size</span>
              <span className="text-foreground font-data">{numericSize ? `${numericSize}` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Leverage</span>
              <span className="text-foreground font-data">{leverage}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Est. entry</span>
              <span className="text-foreground font-data">{formatPrice(market?.markPrice ?? null)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Est. liq</span>
              <span className="text-foreground font-data">{formatPrice(liquidation)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fees</span>
              <span className="text-foreground font-data">—</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Funding</span>
              <span className="text-foreground font-data">
                {fundingEstimate === null ? '—' : formatPrice(fundingEstimate)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Slippage</span>
              <span className="text-foreground font-data">—</span>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                className="flex-1 h-10 rounded-lg border border-border/30 text-foreground text-sm hover:bg-muted/30 transition-colors"
                onClick={() => setShowReview(false)}
              >
                Back
              </button>
              <button
                className={`flex-1 h-10 rounded-lg text-white text-sm font-medium transition-all ${
                  side === 'long'
                    ? 'bg-neon-green/80 hover:bg-neon-green shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                    : 'bg-destructive/80 hover:bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                }`}
                onClick={confirmSubmit}
              >
                Confirm {side === 'long' ? 'Long' : 'Short'}
              </button>
            </div>
          </div>
        )}

        {/* CTA button */}
        <Button
          disabled={disabled || !publicKey || (!isFormValid && !needsDeposit) || tradeState.state === 'quoting' || showReview}
          className={`w-full h-12 text-base font-medium rounded-lg transition-all ${
            needsDeposit && isFormValid
              ? 'bg-neon-amber hover:bg-neon-amber/80 text-background shadow-[0_0_16px_rgba(245,158,11,0.25)]'
              : side === 'long'
                ? 'bg-neon-green/90 hover:bg-neon-green text-white shadow-[0_0_16px_rgba(34,197,94,0.2)]'
                : 'bg-destructive/90 hover:bg-destructive text-white shadow-[0_0_16px_rgba(239,68,68,0.2)]'
          }`}
          onClick={handleSubmit}
          data-testid="perps-cta"
        >
          {ctaLabel}
        </Button>
        <div className="text-xs text-foreground/40 font-data" data-testid="perps-state">
          State: {tradeState.state}
        </div>
        {tradeState.error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {tradeState.error}
          </div>
        )}
        <div className="text-xs text-foreground/40 space-y-1">
          <p>Final amount may vary slightly due to on-chain execution.</p>
          <p>You always retain custody of your assets.</p>
        </div>

        {/* Developer details */}
        <details className="rounded-xl glass-card p-3 text-xs text-foreground/50">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Developer details
          </summary>
          <div className="mt-3 space-y-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-foreground/40">Status</div>
              <div className="text-sm text-foreground font-data">{tradeState.state}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-foreground/40">
                Tx signature
              </div>
              <div className="text-sm break-all text-foreground font-data">{tradeState.txSignature ?? '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-foreground/40">Logs</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {tradeState.logs.length === 0 ? (
                  <div>—</div>
                ) : (
                  tradeState.logs.map((entry, index) => (
                    <div key={`${entry.ts}-${index}`} className="font-data">
                      [{entry.ts}] {entry.message}
                    </div>
                  ))
                )}
              </div>
            </div>
            {tradeState.error && (
              <div className="text-destructive">{tradeState.error}</div>
            )}
          </div>
        </details>

        {collateralError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {collateralError}
          </div>
        )}
      </div>

      {/* Deposit USDC Modal */}
      <DepositUSDCModal
        open={showDepositModal}
        onOpenChange={setShowDepositModal}
        walletBalance={walletBalance}
        onChainCollateral={onChainCollateral}
        depositStep={depositStep}
        error={collateralError}
        txSignature={depositTxSig}
        requiredMargin={estimatedMargin}
        onDeposit={handleDeposit}
        onDone={handleDepositDone}
      />
    </div>
  );
}
