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
    <div className="bg-[#0B0E11]/80 backdrop-blur-xl border border-white/[0.05] rounded-2xl p-5 transition-colors duration-200 font-sans">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">Trade</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Controlled execution · transparent funding
          </p>
        </div>
        <div className="text-[11px] text-zinc-600 font-mono tabular-nums">
          {market ? `${market.baseSymbol}/${market.quoteSymbol}` : 'No market'}
        </div>
      </div>

      {/* Long/Short + Market/Limit tabs */}
      <div className="grid grid-cols-2 gap-2">
        <Tabs value={side} onValueChange={(value) => setSide(value as 'long' | 'short')} className="w-full">
          <TabsList className="grid grid-cols-2 w-full bg-[#0D1117] border border-white/[0.04] rounded-lg h-9">
            <TabsTrigger
              value="long"
              className="rounded-md text-xs font-medium data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 data-[state=active]:shadow-[0_0_10px_rgba(16,185,129,0.12)]"
            >
              Long
            </TabsTrigger>
            <TabsTrigger
              value="short"
              className="rounded-md text-xs font-medium data-[state=active]:bg-red-500/15 data-[state=active]:text-red-400 data-[state=active]:shadow-[0_0_10px_rgba(239,68,68,0.12)]"
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
          <TabsList className="grid grid-cols-2 w-full bg-[#0D1117] border border-white/[0.04] rounded-lg h-9">
            <TabsTrigger value="market" className="rounded-md text-xs font-medium">Market</TabsTrigger>
            <TabsTrigger value="limit" disabled className="rounded-md text-xs font-medium opacity-40 cursor-not-allowed">
              Limit
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 space-y-3">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400" data-testid="perps-inline-error">
            {error}
          </div>
        )}

        {/* ─── Collateral ─────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-400">Collateral</label>
            <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
              {publicKey ? (
                <>
                  {collateralLoading ? '…' : `$${onChainCollateral.toFixed(2)}`}
                  <span className="mx-1.5 text-zinc-700">·</span>
                  <span className="text-zinc-600">wallet {collateralLoading ? '…' : `$${walletBalance.toFixed(2)}`}</span>
                </>
              ) : 'Connect wallet'}
            </span>
          </div>

          <div className="h-px bg-white/[0.04]" />

          <div className="flex items-center justify-between">
            <select
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              disabled={disabled}
              className="bg-transparent text-xs font-medium text-white outline-none cursor-pointer"
            >
              {Array.from(new Set([market?.quoteSymbol ?? 'USDC', 'USDC', 'USDT'])).map((symbol) => (
                <option key={symbol} value={symbol} className="bg-[#0B0E11]">
                  {symbol}
                </option>
              ))}
            </select>
            {publicKey && (
              <button
                type="button"
                className="text-[11px] text-blue-400/80 hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
                onClick={() => setShowDepositModal(true)}
              >
                + Deposit
              </button>
            )}
          </div>

          {needsDeposit && isFormValid && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
              Need ${estimatedMargin?.toFixed(2)} — have ${onChainCollateral.toFixed(2)}.{' '}
              <button type="button" className="underline hover:no-underline" onClick={() => setShowDepositModal(true)}>
                Deposit
              </button>
            </div>
          )}
        </div>

        {/* ─── Size Input ─────────────────────────────────────── */}
        <div className="rounded-xl bg-[#080A0E] border border-white/[0.04] p-4 transition-all duration-200 focus-within:border-blue-500/30 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          <div className="flex justify-between mb-2">
            <label className="text-xs font-medium text-zinc-400">Size</label>
            <span className="text-[11px] text-zinc-600 font-mono">
              {market ? market.baseSymbol : '—'}
            </span>
          </div>
          <Input
            type="number"
            placeholder="0.0"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            disabled={disabled || !market}
            className="bg-transparent border-none text-2xl font-semibold font-mono tabular-nums text-white h-auto focus:ring-0 px-0 placeholder:text-zinc-700"
          />
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={!availableBalance || disabled}
                className="text-[10px] font-medium text-zinc-500 border border-white/[0.04] bg-white/[0.02] rounded-md py-1.5 transition-all hover:border-blue-500/20 hover:text-blue-400 disabled:opacity-30"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* ─── Limit Price ────────────────────────────────────── */}
        {orderType === 'limit' && (
          <div className="rounded-xl bg-[#080A0E] border border-white/[0.04] p-4 transition-all duration-200 focus-within:border-blue-500/30 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <label className="text-xs font-medium text-zinc-400">Limit Price</label>
            <Input
              type="number"
              placeholder="0.0"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              disabled={disabled || !market}
              className="mt-2 bg-transparent border-none text-xl font-semibold font-mono tabular-nums text-white h-auto focus:ring-0 px-0 placeholder:text-zinc-700"
            />
          </div>
        )}

        {/* ─── Leverage Slider ────────────────────────────────── */}
        <div className="rounded-xl bg-[#080A0E] border border-white/[0.04] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-400">Leverage</label>
            <span className="text-sm text-white font-mono font-semibold tabular-nums">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={market?.maxLeverage ?? 20}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            disabled={disabled || !market}
            className="neon-slider w-full"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {[2, 5, 10, 20].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLeverage(preset)}
                disabled={disabled || !market}
                className={`text-[10px] font-medium rounded-md py-1.5 border transition-all ${leverage === preset
                  ? 'border-blue-500/30 text-blue-400 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.12)]'
                  : 'border-white/[0.04] text-zinc-500 bg-white/[0.02] hover:border-white/[0.08]'
                  }`}
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>

        {/* ─── Trade Info ─────────────────────────────────────── */}
        <div className="rounded-xl bg-[#080A0E] border border-white/[0.04] p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Entry Price</span>
            <span className="text-white font-mono tabular-nums" title={tooltipFor(market?.markPrice ?? null)}>
              {market ? formatPrice(market.markPrice) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Liquidation</span>
            <span className={`font-mono tabular-nums ${liquidation !== null ? 'text-red-400' : 'text-zinc-600'}`} title={tooltipFor(liquidation)}>
              {formatPrice(liquidation)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Fees</span>
            <span className="text-zinc-600 font-mono tabular-nums">—</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Funding (est.)</span>
            <span className="text-white font-mono tabular-nums" title={tooltipFor(fundingEstimate)}>
              {fundingEstimate === null ? '—' : formatPrice(fundingEstimate)}
            </span>
          </div>
        </div>

        {/* ─── TP/SL ──────────────────────────────────────────── */}
        <div className="rounded-xl bg-[#080A0E] border border-white/[0.04] p-3">
          <button
            type="button"
            onClick={() => setShowTPSL((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            {showTPSL ? 'Hide TP / SL' : 'Add TP / SL'}
            <span className="text-zinc-600">{showTPSL ? '−' : '+'}</span>
          </button>
          {showTPSL && (
            <div className="mt-3 space-y-2">
              <Input
                type="number"
                placeholder="Take profit"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="bg-[#0B0E11] border-white/[0.04] text-sm font-mono focus-within:border-blue-500/30 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              />
              <Input
                type="number"
                placeholder="Stop loss"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="bg-[#0B0E11] border-white/[0.04] text-sm font-mono focus-within:border-blue-500/30 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              />
            </div>
          )}
        </div>

        {/* ─── Market Stats ───────────────────────────────────── */}
        <div className="rounded-xl bg-[#080A0E] border border-white/[0.04] p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Mark Price</span>
            <span className="text-white font-mono tabular-nums">
              {market ? formatPrice(market.markPrice) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Funding Rate</span>
            <span className="text-white font-mono tabular-nums">
              {market ? formatPercent(market.fundingRate) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Open Interest</span>
            <span className="text-white font-mono tabular-nums">
              {market ? formatNumber(market.openInterest) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Notional</span>
            <span className={`font-mono tabular-nums ${notional ? 'text-white' : 'text-zinc-600'}`}>
              {notional === null ? '—' : formatPrice(notional)}
            </span>
          </div>
        </div>

        {/* ─── Review Panel ───────────────────────────────────── */}
        {showReview && (
          <div className="rounded-xl bg-[#080A0E] border border-blue-500/20 p-4 text-xs space-y-2 shadow-[0_0_20px_rgba(59,130,246,0.08)]">
            <div className="text-sm font-semibold text-white mb-2">Review Order</div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Market</span>
              <span className="text-white font-mono">{market?.symbol ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Side</span>
              <span className={`font-mono uppercase font-medium ${side === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>{side}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Size</span>
              <span className="text-white font-mono">{numericSize || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Leverage</span>
              <span className="text-white font-mono">{leverage}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Est. Entry</span>
              <span className="text-white font-mono">{formatPrice(market?.markPrice ?? null)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Est. Liq</span>
              <span className="text-red-400 font-mono">{formatPrice(liquidation)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Fees</span>
              <span className="text-zinc-600 font-mono">—</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Funding</span>
              <span className="text-white font-mono">
                {fundingEstimate === null ? '—' : formatPrice(fundingEstimate)}
              </span>
            </div>
            <div className="h-px bg-white/[0.04] my-2" />
            <div className="flex items-center gap-2 pt-1">
              <button
                className="flex-1 h-9 rounded-lg border border-white/[0.06] text-zinc-400 text-xs hover:bg-white/[0.03] transition-colors"
                onClick={() => setShowReview(false)}
              >
                Back
              </button>
              <button
                className={`flex-1 h-9 rounded-lg text-white text-xs font-medium transition-all ${
                  side === 'long'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:brightness-110 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                }`}
                onClick={confirmSubmit}
              >
                Confirm {side === 'long' ? 'Long' : 'Short'}
              </button>
            </div>
          </div>
        )}

        {/* ─── CTA Button ─────────────────────────────────────── */}
        <Button
          disabled={disabled || !publicKey || (!isFormValid && !needsDeposit) || tradeState.state === 'quoting' || showReview}
          className={`w-full h-11 text-sm font-medium rounded-lg transition-all duration-200 ${
            needsDeposit && isFormValid
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-white shadow-[0_0_16px_rgba(245,158,11,0.2)]'
              : side === 'long'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 text-white shadow-[0_0_16px_rgba(59,130,246,0.2)]'
                : 'bg-gradient-to-r from-red-600 to-rose-500 hover:brightness-110 text-white shadow-[0_0_16px_rgba(239,68,68,0.2)]'
          }`}
          onClick={handleSubmit}
          data-testid="perps-cta"
        >
          {ctaLabel}
        </Button>
        <div className="text-[10px] text-zinc-600 font-mono" data-testid="perps-state">
          {tradeState.state}
        </div>
        {tradeState.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
            {tradeState.error}
          </div>
        )}
        <div className="text-[10px] text-zinc-600 space-y-0.5">
          <p>Final amount may vary due to on-chain execution.</p>
          <p>You retain custody of all assets.</p>
        </div>

        {/* Developer details */}
        <details className="rounded-lg bg-[#080A0E] border border-white/[0.04] p-3 text-[11px] text-zinc-500">
          <summary className="cursor-pointer text-xs font-medium text-zinc-400">
            Developer
          </summary>
          <div className="mt-3 space-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Status</div>
              <div className="text-xs text-white font-mono">{tradeState.state}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Tx</div>
              <div className="text-xs break-all text-white font-mono">{tradeState.txSignature ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Logs</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {tradeState.logs.length === 0 ? (
                  <div>—</div>
                ) : (
                  tradeState.logs.map((entry, index) => (
                    <div key={`${entry.ts}-${index}`} className="font-mono">
                      [{entry.ts}] {entry.message}
                    </div>
                  ))
                )}
              </div>
            </div>
            {tradeState.error && (
              <div className="text-red-400">{tradeState.error}</div>
            )}
          </div>
        </details>

        {collateralError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
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
