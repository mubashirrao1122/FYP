'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { MarketView } from '@/lib/perps/types';

interface PerpsTradePanelProps {
  market?: MarketView | null;
  disabled?: boolean;
  error?: string | null;
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

export function PerpsTradePanel({ market, disabled, error }: PerpsTradePanelProps) {
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
  const [tradeState, dispatch] = React.useReducer(tradeReducer, initialTradeState);

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
    notional && market?.fundingRate !== null ? (notional * market.fundingRate) / 100 : null;
  const availableBalance = null;

  const isFormValid = Boolean(market && hasSize && hasLimitPrice);
  const isReady = tradeState.state === 'ready';
  const ctaLabel = !publicKey
    ? 'Connect Wallet'
    : !market
      ? 'Select Market'
      : !isFormValid
        ? 'Enter Size'
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
    if (!publicKey || !isReady) return;
    setShowReview(true);
  };

  const confirmSubmit = () => {
    if (!publicKey || !isReady) return;
    dispatch({ type: 'SUBMIT' });
    setTimeout(() => {
      dispatch({ type: 'SUBMIT_ERROR', message: 'Execution not wired yet.' });
    }, 600);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121826] p-6 transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[#E5E7EB]">Perps</h2>
          <p className="text-sm text-[#9CA3AF]">
            Controlled execution with transparent funding and margin.
          </p>
        </div>
        <div className="text-xs text-[#9CA3AF]">
          {market ? `${market.baseSymbol}/${market.quoteSymbol}` : 'No market selected'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tabs value={side} onValueChange={(value) => setSide(value as 'long' | 'short')} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="long">Long</TabsTrigger>
            <TabsTrigger value="short">Short</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs
          value={orderType}
          onValueChange={(value) => setOrderType(value as 'market' | 'limit')}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="limit">Limit</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 space-y-4">
        {error && (
          <div
            className="rounded-xl border border-[#E2E8F0] dark:border-white/10 bg-[#FEF2F2] dark:bg-[#1F1822] px-3 py-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]"
            data-testid="perps-inline-error"
          >
            {error}
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-[#0B0E14] p-4 transition-colors duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[#E5E7EB]">Collateral</label>
            <span
              className="text-xs text-[#9CA3AF]"
              title={publicKey && availableBalance === null ? 'Available after first trade' : undefined}
            >
              Balance: {publicKey ? formatNumber(availableBalance) : 'Connect wallet'}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#121826] px-3 py-2">
            <select
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-[#E5E7EB] outline-none"
            >
              {Array.from(new Set([market?.quoteSymbol ?? 'USDC', 'USDC', 'USDT'])).map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B0E14] p-4 transition-colors duration-200">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-semibold text-[#E5E7EB]">Size</label>
            <span className="text-xs text-[#9CA3AF]">
              {market ? `${market.baseSymbol} size` : 'Select market'}
            </span>
          </div>
          <Input
            type="number"
            placeholder="0.0"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            disabled={disabled || !market}
            className="bg-transparent border-none text-3xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280]"
          />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={!availableBalance || disabled}
                className="text-[11px] font-semibold text-[#9CA3AF] border border-white/10 rounded-lg py-1.5 transition-colors hover:border-[#8B5CF6] disabled:opacity-50 disabled:hover:border-white/10"
              >
                {pct}%
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#9CA3AF]">Estimated · Slippage protected</p>
        </div>

        {orderType === 'limit' && (
          <div className="rounded-2xl border border-white/10 bg-[#0B0E14] p-4 transition-colors duration-200">
            <label className="text-sm font-semibold text-[#E5E7EB]">Limit price</label>
            <Input
              type="number"
              placeholder="0.0"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              disabled={disabled || !market}
              className="mt-2 bg-transparent border-none text-2xl font-semibold h-auto focus:ring-0 px-0 placeholder:text-[#94A3B8] dark:placeholder:text-[#6B7280]"
            />
            <p className="mt-2 text-xs text-[#9CA3AF]">
              Orders execute only at your specified price.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-[#0B0E14] p-4 transition-colors duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[#E5E7EB]">Leverage</label>
            <span className="text-xs text-[#9CA3AF]">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={market?.maxLeverage ?? 20}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            disabled={disabled || !market}
            className="w-full accent-[#8B5CF6]"
          />
          <div className="grid grid-cols-4 gap-2">
            {[2, 5, 10, 20].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLeverage(preset)}
                className={`text-[11px] font-semibold rounded-lg py-1.5 border transition-colors ${
                  leverage === preset
                    ? 'border-[#8B5CF6] text-[#E5E7EB]'
                    : 'border-white/10 text-[#9CA3AF]'
                }`}
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#121826] p-3 text-sm text-[#9CA3AF] space-y-2">
          <div className="flex items-center justify-between">
            <span>Entry price</span>
            <span
              className="text-[#E5E7EB] tabular-nums"
              title={tooltipFor(market?.markPrice ?? null)}
            >
              {market ? formatPrice(market.markPrice) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Liquidation</span>
            <span
              className="text-[#E5E7EB] tabular-nums"
              title={tooltipFor(liquidation)}
            >
              {formatPrice(liquidation)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Fees</span>
            <span className="text-[#E5E7EB] tabular-nums" title="Available after first trade">
              —
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Funding (est.)</span>
            <span
              className="text-[#E5E7EB] tabular-nums"
              title={tooltipFor(fundingEstimate)}
            >
              {fundingEstimate === null ? '—' : formatPrice(fundingEstimate)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0B0E14] p-3 text-sm text-[#9CA3AF]">
          <button
            type="button"
            onClick={() => setShowTPSL((prev) => !prev)}
            className="w-full flex items-center justify-between text-sm font-medium text-[#E5E7EB]"
          >
            {showTPSL ? 'Hide take profit / stop loss' : 'Add take profit / stop loss'}
            <span className="text-xs text-[#9CA3AF]">{showTPSL ? '−' : '+'}</span>
          </button>
          {showTPSL && (
            <div className="mt-3 space-y-3">
              <Input
                type="number"
                placeholder="Take profit price"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="bg-[#121826]"
              />
              <Input
                type="number"
                placeholder="Stop loss price"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="bg-[#121826]"
              />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#121826] p-3 text-sm text-[#9CA3AF] space-y-2">
          <div className="flex items-center justify-between">
            <span>Mark price</span>
            <span
              className="text-[#E5E7EB] tabular-nums"
              title={market?.markPrice === null ? 'Available after first trade' : undefined}
            >
              {market ? formatPrice(market.markPrice) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Funding rate</span>
            <span
              className="text-[#E5E7EB] tabular-nums"
              title={market?.fundingRate === null ? 'Available after first trade' : undefined}
            >
              {market ? formatPercent(market.fundingRate) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Open interest</span>
            <span
              className="text-[#E5E7EB] tabular-nums"
              title={market?.openInterest === null ? 'Available after first trade' : undefined}
            >
              {market ? formatNumber(market.openInterest) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Notional</span>
            <span
              className="text-[#E5E7EB] tabular-nums"
              title={tooltipFor(notional)}
            >
              {notional === null ? '—' : formatPrice(notional)}
            </span>
          </div>
        </div>

        {showReview && (
          <div className="rounded-xl border border-white/10 bg-[#0B0E14] p-4 text-sm text-[#9CA3AF] space-y-2">
            <div className="text-sm font-semibold text-[#E5E7EB]">Review order</div>
            <div className="flex items-center justify-between">
              <span>Market</span>
              <span className="text-[#E5E7EB]">{market?.symbol ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Side</span>
              <span className="text-[#E5E7EB] uppercase">{side}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Size</span>
              <span className="text-[#E5E7EB]">{numericSize ? `${numericSize}` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Leverage</span>
              <span className="text-[#E5E7EB]">{leverage}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Est. entry</span>
              <span className="text-[#E5E7EB]">{formatPrice(market?.markPrice ?? null)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Est. liq</span>
              <span className="text-[#E5E7EB]">{formatPrice(liquidation)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fees</span>
              <span className="text-[#E5E7EB]">—</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Funding</span>
              <span className="text-[#E5E7EB]">
                {fundingEstimate === null ? '—' : formatPrice(fundingEstimate)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Slippage</span>
              <span className="text-[#E5E7EB]">—</span>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                className="flex-1 h-10 rounded-xl border border-white/10 text-[#E5E7EB] text-sm"
                onClick={() => setShowReview(false)}
              >
                Back
              </button>
              <button
                className="flex-1 h-10 rounded-xl bg-[#8B5CF6] text-white text-sm font-semibold hover:bg-[#7C3AED] transition-colors"
                onClick={confirmSubmit}
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        <Button
          disabled={disabled || !publicKey || !isFormValid || tradeState.state === 'quoting' || showReview}
          className="w-full h-12 text-base bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-xl transition-all"
          onClick={handleSubmit}
          data-testid="perps-cta"
        >
          {ctaLabel}
        </Button>
        <div className="text-xs text-[#9CA3AF]" data-testid="perps-state">
          State: {tradeState.state}
        </div>
        {tradeState.error && (
          <div className="rounded-xl border border-white/10 bg-[#1F1822] px-3 py-2 text-xs text-[#FCA5A5]">
            {tradeState.error}
          </div>
        )}
        <div className="text-xs text-[#9CA3AF] space-y-1">
          <p>Final amount may vary slightly due to on-chain execution.</p>
          <p>You always retain custody of your assets.</p>
        </div>

        <details className="rounded-xl border border-white/10 bg-[#121826] p-3 text-xs text-[#9CA3AF]">
          <summary className="cursor-pointer text-sm font-medium text-[#E5E7EB]">
            Developer details
          </summary>
          <div className="mt-3 space-y-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#6B7280]">Status</div>
              <div className="text-sm text-[#E5E7EB]">{tradeState.state}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#6B7280]">
                Tx signature
              </div>
              <div className="text-sm break-all text-[#E5E7EB]">{tradeState.txSignature ?? '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#6B7280]">Logs</div>
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
              <div className="text-[#B91C1C] dark:text-[#FCA5A5]">{tradeState.error}</div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
