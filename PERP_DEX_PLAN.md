# SolRush Perp DEX — Architecture Audit & Completion Plan

---

## 1. On-Chain Program Module Map

### Accounts (State)

| Account Struct | File | Seeds (PDA) | Key Fields |
|---|---|---|---|
| `LiquidityPool` | `state/pool.rs` | `["pool", token_a_mint, token_b_mint]` (canonical sort) | reserve_a/b `u64`, total_lp_supply `u64`, fee_numerator/denominator `u64`, token_a/b_decimals `u8` |
| `UserLiquidityPosition` | `state/user_position.rs` | `["position", pool, user]` | lp_tokens `u64`, deposit_timestamp `i64`, total_rush_claimed `u64` |
| `LimitOrder` | `state/limit_order.rs` | `["limit_order", pool, user, order_id(8 bytes LE)]` | sell_amount/target_price/minimum_receive `u64`, status `OrderStatus` enum |
| `RushConfig` | `state/rush_config.rs` | `["rush_config"]` | rewards_per_second `u64`, apy_numerator/denominator `u64`, is_paused `bool` |
| **`PerpsGlobalState`** | `state/perps_global_state.rs` | `["perps_global"]` | authority `Pubkey`, paused `bool`, fee_bps `u16` |
| **`PerpsMarket`** | `state/perps_market.rs` | `["perps_market", base_mint, quote_mint]` | pyth_feed_id `[u8;32]`, max_leverage `u16`, maintenance_margin_bps `u16`, funding_rate_i64 `i64`, open_interest_i128 `i128`, cumulative_funding_i128 `i128`, last_funding_ts `i64`, collateral_vault `Pubkey` |
| **`PerpsPosition`** | `state/perps_position.rs` | `["perps_position", owner, market]` | side `u8`, size_i64 `i64`, entry_price_i64 `i64`, collateral_u64 `u64`, leverage_u16 `u16`, last_funding_i128 `i128` |
| **`PerpsUserAccount`** | `state/perps_user_account.rs` | `["perps_user", owner]` | collateral_quote_u64 `u64`, positions_count_u8 `u8` |
| **`PerpsOraclePrice`** | `state/perps_oracle_price.rs` | `["perps_oracle", admin]` | price_i64 `i64`, last_update_ts `i64` |

### Instructions

| Instruction | Context Struct | File | Status |
|---|---|---|---|
| `initialize_pool` | `InitializePool` | `instructions/pool.rs` | Done |
| `add_liquidity` | `AddLiquidity` | `instructions/pool.rs` | Done |
| `remove_liquidity` | `RemoveLiquidity` | `instructions/pool.rs` | Done |
| `close_pool` | `ClosePool` | `instructions/pool.rs` | Done |
| `swap` | `Swap` | `instructions/swap.rs` | Done |
| `market_buy` | `MarketBuy` | `instructions/swap.rs` | Done |
| `market_sell` | `MarketSell` | `instructions/swap.rs` | Done |
| `create_limit_order` | `CreateLimitOrder` | `instructions/limit_orders.rs` | Done |
| `execute_limit_order` | `ExecuteLimitOrder` | `instructions/limit_orders.rs` | Done |
| `cancel_limit_order` | `CancelLimitOrder` | `instructions/limit_orders.rs` | Done |
| `initialize_rush_token` | `InitializeRushToken` | `instructions/rewards.rs` | Done |
| `calculate_pending_rewards` | `CalculateRewards` | `instructions/rewards.rs` | Done |
| `claim_rush_rewards` | `ClaimRewards` | `instructions/rewards.rs` | Done |
| `update_rush_apy` | `UpdateRushAPY` | `instructions/rewards.rs` | Done |
| `pause_rush_rewards` | `PauseRewards` | `instructions/rewards.rs` | Done |
| **`initialize_perps_global`** | `InitializePerpsGlobal` | `instructions/perps.rs` | Done |
| **`create_perps_market`** | `CreatePerpsMarket` | `instructions/perps.rs` | Done |
| **`initialize_perps_oracle`** | `InitializeOraclePrice` | `instructions/perps.rs` | Done |
| **`set_perps_oracle_price`** | `SetOraclePrice` | `instructions/perps.rs` | Done |
| **`initialize_perps_user`** | `InitializePerpsUser` | `instructions/perps.rs` | Done |
| **`deposit_perps_collateral`** | `DepositCollateral` | `instructions/perps.rs` | Done |
| **`open_perps_position`** | `OpenPosition` | `instructions/perps.rs` | Done (Market only) |
| **`close_perps_position`** | `ClosePosition` | `instructions/perps.rs` | Done (full close only) |
| **`withdraw_perps_collateral`** | `WithdrawCollateral` | `instructions/perps.rs` | Done |

### Events (Anchor `emit!`)

| Event | File | Emitted By |
|---|---|---|
| `PoolCreated` | `events/pool_events.rs` | `initialize_pool` |
| `LiquidityAdded` | `events/pool_events.rs` | `add_liquidity` |
| `LiquidityRemoved` | `events/pool_events.rs` | `remove_liquidity` |
| `SwapExecuted` | `events/swap_events.rs` | `swap`, `market_buy`, `market_sell` |
| `LimitOrderCreated` | `events/order_events.rs` | `create_limit_order` |
| `LimitOrderExecuted` | `events/order_events.rs` | `execute_limit_order` |
| `LimitOrderCancelled` | `events/order_events.rs` | `cancel_limit_order` |
| `RushTokenInitialized` | `events/rush_events.rs` | `initialize_rush_token` |
| `RewardsClaimed` | `events/rush_events.rs` | `claim_rush_rewards` |
| `RewardsConfigUpdated` | `events/rush_events.rs` | `update_rush_apy` |
| `RewardsPaused` | `events/rush_events.rs` | `pause_rush_rewards` |
| **MISSING: all perps events** | — | `open_position`, `close_position`, etc. emit **nothing** |

---

## 2. Frontend Map

### State Management / Hooks

| Hook / Store | File | Responsibility |
|---|---|---|
| `usePerps` | `lib/hooks/usePerps.ts` | Fetches markets + positions from chain or mock; merges Pyth prices; computes PnL/liquidation; polls every ~5 s |
| `usePythPrice` | `lib/perps/usePythPrice.ts` | Subscribes to Hermes REST polling for a single feed ID |
| `useMockTrade` | `lib/hooks/useMockTrade.ts` | Mock trading against localStorage state |
| `usePool` / `usePools` | `lib/hooks/usePool.ts`, `usePools.ts` | On-chain pool account fetching |
| `useSwap` | `lib/hooks/useSwap.ts` | Swap instruction builder + quote |
| `useLimitOrders` | `lib/hooks/useLimitOrders.ts` | Limit order CRUD |
| `useRewards` | `lib/hooks/useRewards.ts` | RUSH claim flow |
| `useBalance` | `lib/hooks/useBalance.ts` | Token balances |
| `useTokens` / `useTokenList` | `lib/hooks/useTokens.ts` | Token metadata |
| `usePortfolio` | `lib/hooks/usePortfolio.ts` | Aggregated portfolio view |
| `useTransaction` | `lib/hooks/useTransaction.ts` | Tx confirmation helper |

### Wallet / Program

| Module | File | Role |
|---|---|---|
| Anchor setup | `lib/anchor/setup.ts` | Creates `AnchorProvider` + `Program` from IDL |
| PDA helpers | `lib/anchor/pda.ts` | `findPoolAddress`, `findLpMintAddress`, `findPositionAddress`, `findRushConfigAddress`, `findLimitOrderAddress` — **NO perps PDAs exported** |
| Program wrapper | `lib/solana/program.ts` | Cached program getter over `setup.ts` |
| Connection | `lib/solana/connection.ts` | Singleton RPC connection |
| Constants | `lib/solana/constants.ts` + `lib/constants.ts` | Token mints, decimals, program ID (duplicated across both files) |
| WalletButton | `components/wallet/WalletButton.tsx` | Adapter UI |

### Perps Service Layer

| Module | File | Role |
|---|---|---|
| `onchain.ts` | `lib/perps/onchain.ts` | `fetchPerpsMarkets`, `fetchPerpsPositions` — reads on-chain data via Anchor + `getProgramAccounts` |
| `compute.ts` | `lib/perps/compute.ts` | `computePnl`, `computeLiquidationPrice`, `computeMarkPrice` — **client-side only, naive formulas** |
| `pyth.ts` | `lib/perps/pyth.ts` | REST poller to Pyth Hermes `/api/latest_price_feeds` with caching |
| `mockData.ts` | `lib/perps/mockData.ts` | In-memory random-walk price sim for mock mode |
| `mockPositions.ts` | `lib/perps/mockPositions.ts` | localStorage-backed mock positions |
| `types.ts` | `lib/perps/types.ts` | `MarketView`, `PositionView`, `AccountView`, `PythPrice` |

### Price / Oracle Services

| Service | File | Role |
|---|---|---|
| `oracleService` | `lib/services/oracleService.ts` | Jupiter Price API wrapper with cache (spot prices; **not used for perps**) |
| `priceService` | `lib/services/priceService.ts` | CoinGecko + Jupiter fallback (spot prices; **not used for perps**) |
| `pnlService` | `lib/services/pnlService.ts` | PnL from `Transaction[]` — **fully mock/stub** based on tx signature hash |

### Perps Components

| Component | File |
|---|---|
| `PerpsView` | `components/perps/PerpsView.tsx` — main layout |
| `PerpsTradePanel` | `components/perps/PerpsTradePanel.tsx` — order form |
| `PerpsPositions` | `components/perps/PerpsPositions.tsx` — position table |
| `PerpsChart` | `components/perps/PerpsChart.tsx` |
| `MarketSelector` | `components/perps/MarketSelector.tsx` |
| `OrderBook` | `components/perps/OrderBook.tsx` |
| `RecentTrades` | `components/perps/RecentTrades.tsx` |
| `MockBalance` | `components/perps/MockBalance.tsx` |
| `LaunchStatePanel` | `components/perps/LaunchStatePanel.tsx` |
| `StatusCard` | `components/perps/StatusCard.tsx` |
| `MetricPill` | `components/perps/MetricPill.tsx` |

### Pages (Next.js App Router)

| Route | Dir |
|---|---|
| `/` | `src/app/page.tsx` |
| `/swap` | `src/app/swap/` |
| `/pools` | `src/app/pools/` |
| `/perps` | `src/app/perps/` |
| `/portfolio` | `src/app/portfolio/` |
| `/rewards` | `src/app/rewards/` |
| `/history` | `src/app/history/` |

---

## 3. PDA Seed Catalog

| PDA | Seed Literals | Derived In (program) | Derived In (frontend) |
|---|---|---|---|
| **LiquidityPool** | `["pool", token_a_mint, token_b_mint]` (canonical sort) | `instructions/pool.rs` `InitializePool` | `lib/anchor/pda.ts` `findPoolAddress` |
| **LP Mint** | `["lp_mint", pool]` | `instructions/pool.rs` `InitializePool` | `lib/anchor/pda.ts` `findLpMintAddress` |
| **UserLiquidityPosition** | `["position", pool, user]` | `instructions/pool.rs` `AddLiquidity` | `lib/anchor/pda.ts` `findPositionAddress` |
| **LimitOrder** | `["limit_order", pool, user, order_id(8 LE)]` | `instructions/limit_orders.rs` `CreateLimitOrder` | `lib/anchor/pda.ts` `findLimitOrderAddress` |
| **RushConfig** | `["rush_config"]` | `instructions/rewards.rs` `InitializeRushToken` | `lib/anchor/pda.ts` `findRushConfigAddress` |
| **PerpsGlobalState** | `["perps_global"]` | `instructions/perps.rs` `InitializePerpsGlobal` | **MISSING from pda.ts** — inline in `onchain.ts` (implicit) |
| **PerpsMarket** | `["perps_market", base_mint, quote_mint]` | `instructions/perps.rs` `CreatePerpsMarket` | **MISSING from pda.ts** — `onchain.ts` fetches via `getProgramAccounts` |
| **PerpsPosition** | `["perps_position", owner, market]` | `instructions/perps.rs` `OpenPosition` | `lib/perps/onchain.ts` `fetchPerpsPositions` (inline derivation) |
| **PerpsUserAccount** | `["perps_user", owner]` | `instructions/perps.rs` `InitializePerpsUser` | **MISSING from pda.ts** |
| **PerpsOraclePrice** | `["perps_oracle", admin]` | `instructions/perps.rs` `InitializeOraclePrice` | **MISSING from pda.ts** |

---

## 4. Precision & Decimals Map

| Context | Type | Scale / Precision | File |
|---|---|---|---|
| LP token decimals | constant | `LP_TOKEN_DECIMALS = 6` | `constants.rs` |
| Pool price helper | `u64` | `reserve_b * 1_000_000 / reserve_a` (6-decimal fixed-point) | `state/pool.rs` `get_price_a_to_b` |
| LP share calc | `u128→u64` | `lp_tokens * 1_000_000 / total_lp_supply` (6 dp) | `state/user_position.rs` |
| AMM swap output | `u128→u64` | full `u128` intermediate; fee via `(fee_den - fee_num)` multiplier | `utils.rs` `calculate_output_amount` |
| Ratio tolerance | BPS | `RATIO_TOLERANCE_BPS = 100` (1%) | `constants.rs` |
| Swap fee | fraction | `3/1000` = 0.3% default | `constants.rs` |
| Max slippage | BPS | `5000` = 50% | `constants.rs` |
| **Perps notional** | `i128` | `size_i64 * price_i64` — **raw product, no scaling** | `instructions/perps.rs` `notional_from_size` |
| **Oracle price** | `i64` | When Pyth: `price.price` (expo typically -8); when mock oracle: **raw i64, no exponent field stored** | `instructions/perps.rs` `read_oracle_price` |
| **PnL calc** | `i128` | `(exit_price - entry_price) * size` — **raw, no decimal normalization with Pyth expo** | `instructions/perps.rs` `close_position` |
| **Required margin** | `i128→u64` | `notional / leverage` — **same raw units** | `instructions/perps.rs` `required_margin` |
| **Maintenance margin** | BPS (`u16`) | stored per market; **not checked on close** | `state/perps_market.rs` |
| **Funding rate** | `i64` | stored but **never computed or applied** | `state/perps_market.rs` |
| Frontend token decimals | map | `SOL:9, USDC:6, USDT:6, WETH:8, RUSH:6` | `lib/constants.ts`, `lib/solana/constants.ts` |
| Frontend BN helpers | fn | `toBN(amount, decimals=9)`, `fromBN(bn, decimals=9)` | `lib/anchor/setup.ts` |
| Frontend PnL | `number` | `(markPrice - entryPrice) * size` — **no decimal normalization** | `lib/perps/compute.ts` |
| Frontend liquidation | `number` | `entryPrice ∓ (margin - maintMargin*notional/10000) / size` | `lib/perps/compute.ts` |

### Critical Precision Bugs

1. **Perps notional/PnL uses raw `i64` prices from Pyth (expo = -8 typically) without dividing by `10^|expo|`**. Collateral requirements and PnL are off by ~10^8.
2. **Mock oracle `PerpsOraclePrice.price_i64` has no exponent field**. If you feed e.g. `10000` meaning $100.00 (2 dp), but Pyth feeds `10000000000` (expo = -8 meaning $100.00), the math is incompatible.
3. **Frontend `computePnl` and `computeLiquidationPrice` operate on `number`** without knowing whether the price is already human-scaled (from Hermes) or raw (from chain). `entryPrice` from chain is raw `i64` but `markPrice` from Pyth is already scaled.

---

## 5. Prioritized TODO — Perp DEX Completion

### P0 — Critical: Fix Foundations

- [ ] **P0.1 — Price normalization layer**
  - **On-chain** `instructions/perps.rs`: Add `price_expo: i32` to `PerpsOraclePrice` and `PerpsMarket`; normalize all prices to a common fixed-point (e.g. 6 decimal USD) before notional/PnL math. Update `read_oracle_price()` to return `(price, expo)` tuple and build a `normalize(price, expo, target_decimals)` helper in `utils.rs`.
  - **On-chain** `state/perps_oracle_price.rs`: Add `expo: i32` field.
  - **On-chain** `state/perps_market.rs`: Store `price_expo` or standardize that all prices are 6-decimal fixed.
  - **Frontend** `lib/perps/onchain.ts`: When reading `entryPriceI64` from chain, apply the same expo scaling so it matches Pyth Hermes human-readable prices.

- [ ] **P0.2 — PnL must account for position decimals**
  - **On-chain** `instructions/perps.rs` `close_position`: Change PnL formula to `(exit_price - entry_price) * size / 10^price_decimals`. Currently `collateral_i128 + pnl` can yield absurd numbers.
  - **Frontend** `lib/perps/compute.ts` `computePnl`: Must convert chain `entryPrice` (raw i64) to the same unit as `markPrice` (USD float from Pyth).

- [ ] **P0.3 — Add perps PDA helpers to frontend**
  - **File** `lib/anchor/pda.ts`: Add `findPerpsGlobalAddress()`, `findPerpsMarketAddress(baseMint, quoteMint)`, `findPerpsPositionAddress(owner, market)`, `findPerpsUserAddress(owner)`, `findPerpsOracleAddress(admin)`.

### P1 — Funding Rate Engine

- [ ] **P1.1 — `crank_funding` instruction (new)**
  - **File** `instructions/perps.rs`: Add `CrankFunding` context: requires `market (mut)`, `global`, optional `clock`. Permissionless crank.
  - Formula: `funding_rate = clamp(premium_rate, -max_funding, +max_funding)` where `premium = (markPrice - indexPrice) / indexPrice`. Store interval constant (e.g. 1 hour).
  - Update `market.funding_rate_i64`, `market.cumulative_funding_i128`, `market.last_funding_ts`.
  - Add `FundingCranked` event to `events/` — new file `events/perps_events.rs`.

- [ ] **P1.2 — Apply accrued funding on position open/close**
  - **File** `instructions/perps.rs`: In `open_position`, set `position.last_funding_i128 = market.cumulative_funding_i128`. In `close_position`, compute `accrued_funding = (market.cumulative_funding_i128 - position.last_funding_i128) * position.size_i64` and debit/credit from collateral before PnL settlement.

- [ ] **P1.3 — Add `max_funding_rate_bps` to `PerpsMarket` state**
  - **File** `state/perps_market.rs`: New field, update `LEN`.

- [ ] **P1.4 — Frontend: display funding rate, next funding timestamp**
  - `lib/perps/onchain.ts`: Parse `lastFundingTs`, compute countdown.
  - `components/perps/MetricPill.tsx` / `MarketSelector.tsx`: Show live funding rate.

### P2 — Liquidation Engine

- [ ] **P2.1 — `liquidate_position` instruction (new)**
  - **File** `instructions/perps.rs`: Add `Liquidate` context with `liquidator`, `owner`, `market`, `position`, `oracle_price_account`, `user` accounts.
  - Logic: Read oracle price → compute unrealized PnL (using normalized price from P0) → compute `margin_ratio = (collateral + pnl) / notional`. If `margin_ratio < maintenance_margin_bps / 10000`, liquidate.
  - Reward liquidator with a fraction of remaining collateral (e.g. 5% liquidation fee stored in `PerpsGlobalState`).
  - Zero out position fields; decrement `user.positions_count_u8`, reduce `market.open_interest_i128`.
  - Emit `PositionLiquidated` event → add to `events/perps_events.rs`.

- [ ] **P2.2 — Add `liquidation_fee_bps` to `PerpsGlobalState`**
  - **File** `state/perps_global_state.rs`: New `u16` field, update `LEN`.

- [ ] **P2.3 — Liquidation bot / crank script**
  - **File** `scripts/crank-liquidations.ts` (new): Poll all open `PerpsPosition` accounts via `getProgramAccounts` with `dataSize` filter → check margin → call `liquidate_position`.

- [ ] **P2.4 — Frontend: liquidation price display**
  - `lib/perps/compute.ts` `computeLiquidationPrice`: Already exists but needs P0 price normalization fix to be correct.
  - `components/perps/PerpsPositions.tsx`: Wire liquidation price column.

### P3 — Partial Close

- [ ] **P3.1 — `close_partial_position` instruction (new)**
  - **File** `instructions/perps.rs`: New `ClosePartial` context, same accounts as `ClosePosition` + `close_size: i64` arg.
  - Logic: Validate `close_size <= position.size_i64`. Compute pro-rata PnL: `pnl_portion = pnl * close_size / size`. Return `collateral_portion = position.collateral_u64 * close_size / position.size_i64 + pnl_portion`. Update `position.size_i64 -= close_size`, `position.collateral_u64 -= collateral_portion`. Reduce `market.open_interest_i128`. If `size_i64 == 0`, treat as full close.
  - Emit `PositionPartiallyClosed` event.

- [ ] **P3.2 — Wire into `lib.rs`**
  - Add `pub fn close_partial_perps_position(ctx, close_size) -> Result<()>` to the `#[program]` block in `lib.rs`.

- [ ] **P3.3 — Frontend: partial close UI**
  - `components/perps/PerpsPositions.tsx`: Add slider / input for partial close amount.
  - Wire to new instruction via `lib/perps/onchain.ts`.

### P4 — Robust PnL Settlement

- [ ] **P4.1 — Settle PnL against collateral vault (actual token transfer)**
  - **Currently** `close_position` only adjusts `user.collateral_quote_u64` (a ledger number). There is **no token transfer** of profit from the vault to the user, and no mechanism for covering losses beyond zeroing collateral.
  - **Fix** in `instructions/perps.rs` `close_position` and the new `close_partial_position`:
    - If `pnl > 0`: Transfer `pnl` tokens from `collateral_vault` to `user_quote_ata` using market PDA signer seeds.
    - If `pnl < 0`: The loss is already retained in the vault (user deposited collateral). Bookkeeping only.
  - Requires adding `user_quote_ata` and `collateral_vault` + `token_program` accounts to `ClosePosition` context.

- [ ] **P4.2 — Insurance fund / socialized loss**
  - Add `insurance_fund_vault` to `PerpsGlobalState` (new `Pubkey` field).
  - On liquidation, if remaining collateral < 0, debit insurance fund.
  - Optional: charge a small trading fee that flows into insurance fund.

- [ ] **P4.3 — Frontend: realized PnL tracking**
  - `lib/services/pnlService.ts`: Replace mock stub with on-chain event parsing (query tx logs for `PositionClosed` / `PositionPartiallyClosed` events).
  - `components/perps/PerpsPositions.tsx`: Show realized PnL history.

### P5 — Order Placement (Limit / Stop Orders)

- [ ] **P5.1 — `PerpsOrder` account (new state)**
  - **File** `state/perps_order.rs` (new): `owner`, `market`, `side`, `size`, `price`, `order_type` (Limit/StopLoss/TakeProfit enum), `trigger_price`, `status`, `created_at`, `expires_at`, `bump`.
  - Seeds: `["perps_order", owner, market, order_id(8 LE)]`.

- [ ] **P5.2 — `place_perps_order` instruction (new)**
  - **File** `instructions/perps.rs` (or new `instructions/perps_orders.rs`): Validates price, escrows collateral, writes `PerpsOrder`.
  - Emit `PerpsOrderPlaced` event.

- [ ] **P5.3 — `execute_perps_order` (permissionless crank)**
  - Check oracle price against trigger. If met, call internal `_open_position` logic.
  - Emit `PerpsOrderExecuted`.

- [ ] **P5.4 — `cancel_perps_order`**
  - Return escrowed collateral. Emit `PerpsOrderCancelled`.

- [ ] **P5.5 — `OrderType::Limit` support in `open_position`**
  - Currently `require!(order_type == OrderType::Market, ...)` rejects Limit.
  - Remove the guard; route to escrow-based `place_perps_order` when `OrderType::Limit`.

- [ ] **P5.6 — Frontend: order entry UI**
  - `components/perps/PerpsTradePanel.tsx`: Add Limit / Stop-Loss / Take-Profit tabs.
  - Wire to new instructions.
  - `components/perps/OrderBook.tsx`: Currently likely stub. Wire to on-chain `PerpsOrder` accounts.

- [ ] **P5.7 — Crank script for order execution**
  - **File** `scripts/crank-perps-orders.ts` (new): Poll open orders, compare trigger price vs oracle, execute matches.

### P6 — Indexing & Events

- [ ] **P6.1 — Create `events/perps_events.rs` (new)**
  - Events: `PositionOpened { owner, market, side, size, entry_price, leverage, collateral, timestamp }`, `PositionClosed { owner, market, exit_price, pnl, funding_paid, timestamp }`, `PositionPartiallyClosed { ... }`, `PositionLiquidated { owner, market, liquidator, collateral_seized, timestamp }`, `FundingCranked { market, old_rate, new_rate, cumulative, timestamp }`, `CollateralDeposited { owner, amount }`, `CollateralWithdrawn { owner, amount }`, `PerpsOrderPlaced / Executed / Cancelled`.
  - Register in `events/mod.rs`.

- [ ] **P6.2 — Emit events in all perps instructions**
  - `instructions/perps.rs`: Add `emit!()` calls in `open_position`, `close_position`, `deposit_collateral`, `withdraw_collateral`, `crank_funding`, `liquidate_position`.
  - Currently **zero** `emit!` calls in perps.rs.

- [ ] **P6.3 — Transaction log parser (frontend)**
  - **File** `lib/perps/eventParser.ts` (new): Use `@coral-xyz/anchor` event parser to decode program logs from confirmed transactions. Map to `PositionOpened`, `PositionClosed`, etc.

- [ ] **P6.4 — Historical data / indexer**
  - Option A: Off-chain indexer (e.g. Helius webhook or Geyser plugin) → Postgres → REST API.
  - Option B: Lightweight `scripts/index-perps-events.ts` that polls `getSignaturesForAddress` on program ID and logs parsed events to a JSON/SQLite file.
  - Needed for: 24h volume, 24h price change, trade history, funding history.

- [ ] **P6.5 — Frontend: trade history tab**
  - `src/app/history/`: Wire to event parser / indexer API.
  - `components/perps/RecentTrades.tsx`: Display parsed `PositionOpened/Closed` events with PnL.

### P7 — Misc / Hardening

- [ ] **P7.1 — Remove duplicate constants files**
  - `lib/constants.ts` and `lib/solana/constants.ts` overlap. Consolidate to one source of truth.

- [ ] **P7.2 — `withdraw_collateral` should allow partial withdraw with open positions**
  - Currently gated by `positions_count_u8 == 0`. Should check that remaining collateral meets maintenance margin for all open positions.

- [ ] **P7.3 — `positions_count_u8` overflow at 255**
  - Use `u16` or enforce a max positions-per-user constant.

- [ ] **P7.4 — `PerpsPosition` uses `init_if_needed` — consider explicit open/close lifecycle**
  - `init_if_needed` is convenient but can mask bugs. Consider separate `create_position_account` + `open_position` pattern.

- [ ] **P7.5 — Anchor test coverage for perps**
  - `tests/perps.ts`: Expand beyond basic open/close to cover edge cases: max leverage, zero-collateral close, oracle stale price, concurrent positions.

- [ ] **P7.6 — Devnet deployment script for perps**
  - `scripts/setup-devnet.ts`: Extend to create `PerpsGlobal`, a SOL-USDC market, initialize oracle, so devnet testing is one command.

---

## Execution Order Recommendation

```
Phase 1 (foundations):    P0 → P6.1 → P6.2 → rebuild+test
Phase 2 (core features):  P1 → P2 → P4.1 → test
Phase 3 (UX features):    P3 → P5 → P4.2 → test
Phase 4 (indexing/polish): P6.3 → P6.4 → P6.5 → P7
```

Estimated scope: ~2,500–3,500 lines of Rust, ~1,500 lines of TypeScript.
