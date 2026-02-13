# SolRush Perps — System Invariants

> Every instruction handler, crank, and client must preserve **all** invariants
> listed below. Any violation is a critical bug. Invariants are numbered for
> cross-reference in tests and code comments (`// INV-3.2`).

---

## 0. Notation & Conventions

| Symbol | Meaning |
|--------|---------|
| `P_entry` | Entry price stored in `PerpsPosition.entry_price_i64` |
| `P_mark` | Current mark/oracle price (see §5) |
| `S` | Signed position size (`PerpsPosition.size_i64`, positive = units) |
| `side` | `0` = Long, `1` = Short |
| `C` | Position collateral (`PerpsPosition.collateral_u64`) |
| `L` | Leverage (`PerpsPosition.leverage_u16`) |
| `mm_bps` | Maintenance margin in basis points (`PerpsMarket.maintenance_margin_bps`) |
| `cf` | Market cumulative funding index (`PerpsMarket.cumulative_funding_i128`) |
| `cf_pos` | Position snapshot of cumulative funding (`PerpsPosition.last_funding_i128`) |
| `OI` | Open interest (`PerpsMarket.open_interest_i128`) |
| `PRICE_DECIMALS` | Target fixed-point precision for prices: **6** (i.e. 1 USD = `1_000_000`) |
| `PRICE_SCALE` | `10^PRICE_DECIMALS` = `1_000_000` |
| `⌊x⌋` | Floor (truncation toward zero) |
| `⌈x⌉` | Ceiling (truncation away from zero) |

All prices and monetary values on-chain are **integer fixed-point** with
`PRICE_DECIMALS = 6` unless otherwise noted.  
Example: $123.456789 → stored as `123_456_789` (6 decimals).

---

## 1. Position State Invariants

### INV-1.1 — Size is non-negative when open

```
position.size_i64 > 0   ⟺   position is open
position.size_i64 == 0  ⟺   position is closed / empty
```

`size_i64` represents the **absolute quantity** of the base asset. It must
never be negative. The direction is encoded in `position.side`.

### INV-1.2 — Entry price is positive when open

```
position.size_i64 > 0  ⟹  position.entry_price_i64 > 0
position.size_i64 == 0 ⟹  position.entry_price_i64 == 0
```

### INV-1.3 — Closed position has all fields zeroed

After a full close:

```
position.size_i64        == 0
position.entry_price_i64 == 0
position.collateral_u64  == 0
position.leverage_u16    == 0
position.last_funding_i128 == 0
```

No "ghost" state must remain.

### INV-1.4 — Entry price on partial close uses FIFO basis

When partially closing `close_size` from a position of size `S`:

```
new_size  = S - close_size           (must be > 0)
new_entry = P_entry                  (unchanged — FIFO)
```

The entry price does **not** change during partial close. Only
`collateral_u64` shrinks pro-rata.

### INV-1.5 — Realized PnL formula

On closing `close_size` units at mark price `P_mark`:

```
                ⎧ (P_mark - P_entry) × close_size / PRICE_SCALE   if Long
pnl_raw_i128 = ⎨
                ⎩ (P_entry - P_mark) × close_size / PRICE_SCALE   if Short
```

The realized PnL is in **quote token base units** (e.g. USDC lamports at 6
decimals).

**Example (Long):**

| Field | Raw value | Human |
|-------|-----------|-------|
| `P_entry` | `100_000_000` | $100.00 |
| `P_mark` | `105_000_000` | $105.00 |
| `close_size` | `2_000_000` | 2.0 SOL (6 dp base) |
| `pnl_raw` | `(105_000_000 - 100_000_000) × 2_000_000 / 1_000_000` = `10_000_000` | $10.00 profit |

**Example (Short):**

| Field | Raw value | Human |
|-------|-----------|-------|
| `P_entry` | `100_000_000` | $100.00 |
| `P_mark` | `95_000_000` | $95.00 |
| `close_size` | `3_000_000` | 3.0 SOL |
| `pnl_raw` | `(100_000_000 - 95_000_000) × 3_000_000 / 1_000_000` = `15_000_000` | $15.00 profit |

### INV-1.6 — Collateral returned on close

```
returned_collateral = min(
    position.collateral_u64 × (close_size / position.size_i64)  + pnl  - funding_owed,
    vault_balance
)

// If the computed value is negative, clamp to 0.
returned_collateral = max(returned_collateral, 0)
```

The user can **never** receive more than the vault holds and can never be
debited below zero (no negative balances; losses exceeding collateral are
socialized).

---

## 2. Margin & Equity Invariants

### INV-2.1 — Initial margin requirement

At `open_position` time:

```
notional = |S| × P_mark / PRICE_SCALE
required_margin = ⌈notional / L⌉          // ceiling: round against user
required_margin ≤ user.collateral_quote_u64
```

The instruction **must reject** if the user doesn't have enough free
collateral.

**Example:**

| Field | Value | Human |
|-------|-------|-------|
| `S` | `5_000_000` | 5.0 SOL |
| `P_mark` | `100_000_000` | $100.00 |
| `L` | `10` | 10× leverage |
| `notional` | `5_000_000 × 100_000_000 / 1_000_000` = `500_000_000` | $500 |
| `required_margin` | `⌈500_000_000 / 10⌉` = `50_000_000` | $50 |

### INV-2.2 — Leverage bounds

```
1 ≤ leverage_u16 ≤ market.max_leverage
```

Both bounds are inclusive. `max_leverage` is per-market (e.g. 20 for SOL-PERP,
10 for altcoins).

### INV-2.3 — Equity definition

At any point for an open position:

```
equity = collateral_u64 + unrealized_pnl - accrued_funding
```

Where:
- `unrealized_pnl` is computed per INV-1.5 using full `size_i64`
- `accrued_funding` is computed per §3

### INV-2.4 — Margin ratio

```
margin_ratio = equity / notional
```

Where `notional = |S| × P_mark / PRICE_SCALE`.

This ratio must be expressible in basis points for comparison:

```
margin_ratio_bps = equity × 10_000 / notional
```

### INV-2.5 — Withdraw constraint

A collateral withdrawal of amount `w` is only permitted if, for **every**
open position of the user after withdrawal:

```
(user.collateral_quote_u64 - w) ≥ Σ required_maintenance_for_each_position
```

Where per-position maintenance:

```
maintenance_i = |S_i| × P_mark_i / PRICE_SCALE × mm_bps_i / 10_000
```

If the user has zero open positions (`positions_count == 0`), any withdrawal
up to the full balance is allowed.

**Example:**

| Field | Value | Human |
|-------|-------|-------|
| User collateral | `200_000_000` | $200 |
| Position notional | `1_000_000_000` | $1,000 |
| `mm_bps` | `500` | 5% |
| Required maintenance | `1_000_000_000 × 500 / 10_000` = `50_000_000` | $50 |
| Max withdrawable | `200_000_000 - 50_000_000` = `150_000_000` | $150 |

---

## 3. Funding Invariants

### INV-3.1 — Cumulative funding index is monotonically timestamped

```
market.last_funding_ts_new > market.last_funding_ts_old
```

The crank must reject if called within the same slot/second as the previous
update. Prevents double-cranking.

### INV-3.2 — Funding rate formula

At each crank interval:

```
elapsed_hours = (current_ts - market.last_funding_ts) / 3600
premium_rate  = (P_mark - P_index) / P_index
funding_rate  = clamp(premium_rate, -max_funding_rate, +max_funding_rate)
payment       = funding_rate × elapsed_hours
```

The funding rate is stored as `funding_rate_i64` in fixed-point with
`PRICE_DECIMALS` (6 dp).

- **Longs pay funding** when `funding_rate > 0` (mark above index).
- **Shorts pay funding** when `funding_rate < 0` (mark below index).

### INV-3.3 — Cumulative funding index update

```
market.cumulative_funding_i128 += funding_rate × elapsed_hours × PRICE_SCALE
```

This is an **ever-increasing absolute accumulator** (can go negative if
shorts pay longs persistently).

### INV-3.4 — Per-position accrued funding

For any position:

```
funding_delta = market.cumulative_funding_i128 - position.last_funding_i128

                ⎧ funding_delta × |S| / PRICE_SCALE    if Long  (positive delta = user pays)
accrued_cost = ⎨
                ⎩ -funding_delta × |S| / PRICE_SCALE   if Short (positive delta = user receives)
```

`accrued_cost > 0` means the position holder **owes**; `< 0` means they
**receive**.

### INV-3.5 — Funding snapshot on open

```
position.last_funding_i128 = market.cumulative_funding_i128
```

Set at position open time. This ensures the position only accrues funding
from the moment it was opened.

### INV-3.6 — Funding is settled on close

On close (full or partial), accrued funding is deducted from returned
collateral before crediting the user:

```
returned = collateral_portion + pnl_portion - accrued_funding
```

**Example — Funding accrual over 8 hours:**

| Timestamp | `cumulative_funding` | Position snapshot |
|-----------|---------------------|-------------------|
| T=0 (open) | `1_000_000` | `last_funding = 1_000_000` |
| T=8h (close) | `1_040_000` | — |
| `funding_delta` | `40_000` | — |
| Position size | `10_000_000` (10 SOL) | — |
| Accrued (Long) | `40_000 × 10_000_000 / 1_000_000` = `400_000` ($0.40) | — |

---

## 4. Liquidation Invariants

### INV-4.1 — Liquidation eligibility

A position is liquidatable if and only if:

```
margin_ratio_bps < mm_bps

where:
  equity = collateral_u64 + unrealized_pnl - accrued_funding
  notional = |S| × P_mark / PRICE_SCALE
  margin_ratio_bps = equity × 10_000 / notional
```

No position with `margin_ratio_bps ≥ mm_bps` may be liquidated.

**Example — Long getting liquidated:**

| Field | Value | Human |
|-------|-------|-------|
| `P_entry` | `100_000_000` | $100 |
| `P_mark` | `90_000_000` | $90 |
| `S` | `10_000_000` | 10 SOL |
| `C` (collateral) | `50_000_000` | $50 |
| `accrued_funding` | `500_000` | $0.50 |
| `mm_bps` | `500` | 5% |
| unrealized PnL | `(90M - 100M) × 10M / 1M` = `-100_000_000` | -$100 |
| equity | `50_000_000 + (-100_000_000) - 500_000` = `-50_500_000` | -$50.50 |
| notional | `10M × 90M / 1M` = `900_000_000` | $900 |
| margin_ratio_bps | `-50_500_000 × 10_000 / 900_000_000` ≈ `-561` | -5.6% |
| **Liquidatable?** | **Yes** (`-561 < 500`) | |

### INV-4.2 — Liquidation price formula

The price at which a Long becomes liquidatable:

```
P_liq_long = P_entry - (C - accrued_funding) × PRICE_SCALE / (|S| × (1 - mm_bps/10_000))
```

For a Short:

```
P_liq_short = P_entry + (C - accrued_funding) × PRICE_SCALE / (|S| × (1 - mm_bps/10_000))
```

**Example — Long liquidation price:**

| Field | Value |
|-------|-------|
| `P_entry` | `100_000_000` ($100) |
| `C` | `50_000_000` ($50) |
| `accrued_funding` | `0` |
| `S` | `10_000_000` (10 SOL) |
| `mm_bps` | `500` (5%) |
| `denom` | `10_000_000 × (1 - 500/10_000)` = `10_000_000 × 0.95` = `9_500_000` |
| `P_liq` | `100_000_000 - 50_000_000 × 1_000_000 / 9_500_000` = `100_000_000 - 5_263_157` ≈ `94_736_843` (**$94.74**) |

### INV-4.3 — Liquidation effects

When a position is liquidated:

```
remaining_collateral = max(equity, 0)
liquidator_reward    = remaining_collateral × liquidation_fee_bps / 10_000
insurance_deposit    = remaining_collateral - liquidator_reward
// If equity < 0, both are 0 and the shortfall is a socialized loss.

// Position is fully zeroed (INV-1.3)
// market.open_interest_i128 -= old_notional
// user.positions_count_u8 -= 1
```

### INV-4.4 — Self-liquidation is forbidden

```
liquidator ≠ position.owner
```

A user cannot liquidate their own position to earn the liquidation reward.

### INV-4.5 — Liquidation is atomic

The entire liquidation (PnL settle, reward transfer, position zero-out, OI
update) happens in a single instruction. No partial liquidations in the base
design.

---

## 5. Oracle / Mark Price Guards

### INV-5.1 — Oracle staleness bound

```
current_ts - oracle.last_update_ts ≤ MAX_ORACLE_AGE
```

Where `MAX_ORACLE_AGE` = **60 seconds** for Pyth feeds (configured in
`read_oracle_price`). If violated, the instruction must error with
`OraclePriceUnavailable`.

### INV-5.2 — Oracle price positivity

```
oracle_price > 0
```

A zero or negative oracle price must be rejected. All downstream math
assumes strictly positive prices.

### INV-5.3 — Oracle price normalization

When reading from Pyth:

```
normalized_price = pyth_price.price × 10^(PRICE_DECIMALS + pyth_price.expo)
```

Pyth's `expo` is typically negative (e.g. `-8`). To convert to 6-decimal
fixed-point:

```
normalized = price × 10^(6 + (-8)) = price × 10^(-2) = price / 100
```

When reading from the mock `PerpsOraclePrice`:

```
normalized_price = oracle.price_i64    // already in PRICE_DECIMALS scale
```

The mock oracle must store prices in the **same scale** as the normalized Pyth
output.

**Example — Pyth SOL/USD at $100.50:**

| Field | Value |
|-------|-------|
| `pyth.price` | `10_050_000_000` |
| `pyth.expo` | `-8` |
| `normalized` | `10_050_000_000 × 10^(6-8)` = `10_050_000_000 / 100` = `100_500_000` |
| Human | $100.50 (6 dp) |

### INV-5.4 — Mark price band

Mark price must not deviate from index (oracle) price beyond a safety band:

```
|P_mark - P_index| / P_index ≤ MAX_MARK_DEVIATION_BPS / 10_000
```

Suggested `MAX_MARK_DEVIATION_BPS` = `500` (5%). If the mark price (e.g.
from an internal TWAP or order book) deviates more, fall back to `P_index`.

In the current system where mark = oracle, this invariant is trivially
satisfied but must be enforced once a mark price diverges.

### INV-5.5 — Oracle confidence interval

If Pyth's `confidence` exceeds a threshold relative to price, the oracle
reading should be rejected:

```
pyth.confidence / |pyth.price| ≤ MAX_CONFIDENCE_RATIO
```

Suggested `MAX_CONFIDENCE_RATIO` = `0.05` (5%). This prevents using a price
whose confidence band is wider than the maintenance margin.

---

## 6. Rounding Rules

> **Principle:** Round **against** the speculative user and **for** the
> protocol/vault in every operation. This ensures the vault can never become
> insolvent due to rounding.

### INV-6.1 — Operations that round **UP** (ceiling, `⌈x⌉`)

| Operation | What is rounded up | Why |
|---|---|---|
| Required initial margin | `⌈notional / leverage⌉` | User must provide at least this much |
| Maintenance margin check | `⌈notional × mm_bps / 10_000⌉` | Slightly tighter requirement |
| Funding payment (user pays) | `⌈funding_delta × size / PRICE_SCALE⌉` | User pays at least this |
| Trading fee | `⌈notional × fee_bps / 10_000⌉` | Protocol receives at least this |

### INV-6.2 — Operations that round **DOWN** (floor, `⌊x⌋`)

| Operation | What is rounded down | Why |
|---|---|---|
| PnL credited to user | `⌊(exit - entry) × size / PRICE_SCALE⌋` | Vault never owes more than it has |
| Collateral returned on close | `⌊collateral_portion + pnl - funding⌋` | Rounds against user |
| Funding payment (user receives) | `⌊funding_delta × size / PRICE_SCALE⌋` | Protocol keeps dust |
| Liquidation reward | `⌊remaining × liq_fee_bps / 10_000⌋` | Slightly less to liquidator |
| Pro-rata collateral (partial close) | `⌊C × close_size / S⌋` | Remainder stays locked |

### INV-6.3 — Implementation in Rust

All fixed-point divisions must use explicit floor/ceil:

```
// Floor division (default for unsigned integers)
let floor = numerator / denominator;

// Ceiling division
let ceil = (numerator + denominator - 1) / denominator;
// For signed: use checked_div + adjustment
```

**Never** use floating-point (`f32`/`f64`) in any on-chain financial
calculation. The only exception is off-chain display formatting.

### INV-6.4 — Dust tolerance

After all rounding, the vault may accumulate "dust" — small remainders from
truncation. This is by design:

```
vault_balance ≥ Σ all_user_collateral + Σ all_unrealized_pnl_if_positive
```

The vault must **never** be negative. Rounding toward the vault ensures this.

**Example — Rounding in partial close:**

| Field | Value |
|-------|-------|
| `C` (total collateral) | `100_000_007` |
| `S` (total size) | `3_000_000` (3.0) |
| `close_size` | `1_000_000` (1.0) |
| Pro-rata collateral (exact) | `100_000_007 / 3` = `33_333_335.666...` |
| Returned (floor) | `33_333_335` |
| Remaining on position | `100_000_007 - 33_333_335` = `66_666_672` |
| Dust retained in position | `66_666_672` vs exact `66_666_671.333...` → **+1 unit** stays locked |

---

## 7. Global System Invariants

### INV-7.1 — Open interest consistency

```
market.open_interest_i128 == Σ notional_i  for all open positions in that market
```

Every `open_position` adds `notional`, every `close_position` /
`close_partial` / `liquidate` subtracts the corresponding notional.

### INV-7.2 — User position count consistency

```
user.positions_count_u8 == count of positions where position.size_i64 > 0
                           AND position.owner == user.owner
```

Incremented on open, decremented on full close / liquidation.

### INV-7.3 — Vault solvency

```
collateral_vault.amount ≥ Σ_all_users (collateral_quote_u64)
```

Under-collateralization (vault < ledger total) indicates a critical bug or
an un-handled socialized loss event.

### INV-7.4 — Pause flag

```
global.paused == true  ⟹  all mutating perps instructions MUST reject
```

Read-only operations (fetching state) are still allowed.

### INV-7.5 — One position per market per user

```
∀ (user, market): at most ONE PerpsPosition account exists
```

Enforced by the PDA seed `["perps_position", owner, market]`. The same
seeds always derive the same address — two concurrent positions for the
same pair are impossible.

---

## Appendix: Quick Reference Table

| Invariant | ID | Checked Where |
|-----------|----|---------------|
| Size non-negative when open | INV-1.1 | `open_position`, `close_position`, `close_partial` |
| Entry price positive when open | INV-1.2 | `open_position` |
| Closed position zeroed | INV-1.3 | `close_position`, `liquidate` |
| Entry price unchanged on partial close | INV-1.4 | `close_partial` |
| PnL formula correct | INV-1.5 | `close_position`, `close_partial`, `liquidate` |
| Collateral return clamped | INV-1.6 | `close_position`, `close_partial` |
| Initial margin met | INV-2.1 | `open_position` |
| Leverage in bounds | INV-2.2 | `open_position` |
| Equity definition | INV-2.3 | `liquidate`, margin checks |
| Margin ratio formula | INV-2.4 | `liquidate`, `withdraw_collateral` |
| Withdraw respects maintenance | INV-2.5 | `withdraw_collateral` |
| Funding timestamp monotonic | INV-3.1 | `crank_funding` |
| Funding rate formula | INV-3.2 | `crank_funding` |
| Cumulative index update | INV-3.3 | `crank_funding` |
| Per-position accrued funding | INV-3.4 | `close_position`, `liquidate` |
| Funding snapshot on open | INV-3.5 | `open_position` |
| Funding settled on close | INV-3.6 | `close_position`, `close_partial` |
| Liquidation eligibility | INV-4.1 | `liquidate` |
| Liquidation price formula | INV-4.2 | frontend display, tests |
| Liquidation effects | INV-4.3 | `liquidate` |
| No self-liquidation | INV-4.4 | `liquidate` |
| Liquidation is atomic | INV-4.5 | `liquidate` |
| Oracle staleness | INV-5.1 | `read_oracle_price` |
| Oracle positivity | INV-5.2 | `read_oracle_price` |
| Oracle normalization to 6dp | INV-5.3 | `read_oracle_price` |
| Mark-index band | INV-5.4 | future mark price logic |
| Oracle confidence check | INV-5.5 | `read_oracle_price` (Pyth path) |
| Margin/fees round up | INV-6.1 | all margin & fee calcs |
| PnL/returns round down | INV-6.2 | all settlement calcs |
| No floats on-chain | INV-6.3 | entire program |
| Vault ≥ ledger total | INV-6.4 | system-wide |
| OI == Σ notional | INV-7.1 | `open`, `close`, `liquidate` |
| Position count accurate | INV-7.2 | `open`, `close`, `liquidate` |
| Vault solvency | INV-7.3 | system-wide |
| Pause blocks mutations | INV-7.4 | all mutating instructions |
| One position per market per user | INV-7.5 | PDA derivation |
