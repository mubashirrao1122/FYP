/// Fixed-point arithmetic and position engine for perps.
///
/// All prices are represented as `i64` scaled by `PRICE_SCALE` (10^6).
/// All PnL values are `i128` scaled by `PRICE_SCALE`.
/// No floating-point math is used anywhere in this module.
use anchor_lang::prelude::*;
use crate::errors::CustomError;

// ─────────────────────────────────────────────
// Scale constants
// ─────────────────────────────────────────────

/// Price scale factor — 1 USD = 1_000_000 in our fixed-point representation.
/// Matches USDC 6-decimal precision.
pub const PRICE_SCALE: i128 = 1_000_000;

/// Alias for readability: base amounts use the same scale as PRICE_SCALE.
pub const BASE_SCALE: i128 = PRICE_SCALE;

/// Quote amounts (collateral / margin / PnL) use the same scale.
pub const QUOTE_SCALE: i128 = PRICE_SCALE;

// ─────────────────────────────────────────────
// Core arithmetic primitives
// ─────────────────────────────────────────────

/// Unsigned `(a * b) / denom` with intermediate 256-bit precision (via i128 → u128).
///
/// All inputs must be non-negative.  Rounds toward zero (truncation).
///
/// # Errors
/// `CalculationOverflow` on overflow or `denom == 0`.
pub fn mul_div(a: u128, b: u128, denom: u128) -> Result<u128> {
    if denom == 0 {
        return Err(error!(CustomError::CalculationOverflow));
    }
    // Use widening multiplication via u128 → split into high/low
    // For values that fit in u128*u128 we can use checked math:
    // max(a) * max(b) can overflow u128, so we use a two-step approach.
    let result = wide_mul_div_u128(a, b, denom)?;
    Ok(result)
}

/// Signed `(a * b) / denom` with overflow protection.
///
/// Sign is computed from `a` and `b`.  `denom` must be > 0.
/// Rounds toward zero (truncation toward zero).
pub fn signed_mul_div(a: i128, b: i128, denom: i128) -> Result<i128> {
    if denom == 0 {
        return Err(error!(CustomError::CalculationOverflow));
    }
    let neg = (a < 0) ^ (b < 0) ^ (denom < 0);
    let abs_a = (a as i128).unsigned_abs();
    let abs_b = (b as i128).unsigned_abs();
    let abs_d = (denom as i128).unsigned_abs();
    let abs_result = wide_mul_div_u128(abs_a, abs_b, abs_d)?;
    let result = i128::try_from(abs_result).map_err(|_| error!(CustomError::CalculationOverflow))?;
    Ok(if neg { -result } else { result })
}

/// `base + signed_delta` returning i128, with overflow check.
pub fn checked_add_signed(base: i128, delta: i128) -> Result<i128> {
    base.checked_add(delta)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))
}

/// `base - delta` returning i128, with overflow check.
pub fn checked_sub_signed(base: i128, delta: i128) -> Result<i128> {
    base.checked_sub(delta)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))
}

// ─────────────────────────────────────────────
// Rounding helpers
// ─────────────────────────────────────────────

/// `a / b` rounded toward negative infinity (floor division).
///
/// For positive results this is the same as truncation.
/// For negative results this rounds *down* (more negative), which is
/// conservative for the protocol when computing user PnL.
pub fn floor_div(a: i128, b: i128) -> Result<i128> {
    if b == 0 {
        return Err(error!(CustomError::CalculationOverflow));
    }
    let d = a / b;
    let r = a % b;
    // If remainder and divisor have opposite signs, we need to subtract 1
    if (r != 0) && ((r ^ b) < 0) {
        Ok(d - 1)
    } else {
        Ok(d)
    }
}

/// `a / b` rounded toward positive infinity (ceiling division).
///
/// Conservative for the protocol when computing required margin.
pub fn ceil_div(a: i128, b: i128) -> Result<i128> {
    if b == 0 {
        return Err(error!(CustomError::CalculationOverflow));
    }
    let d = a / b;
    let r = a % b;
    // If remainder and divisor have the same sign (both positive or both negative),
    // we need to add 1
    if (r != 0) && ((r ^ b) >= 0) {
        Ok(d + 1)
    } else {
        Ok(d)
    }
}

/// Signed `(a * b) / denom` with floor rounding (toward -inf).
pub fn signed_mul_div_floor(a: i128, b: i128, denom: i128) -> Result<i128> {
    if denom == 0 {
        return Err(error!(CustomError::CalculationOverflow));
    }
    // Full product via unsigned path, then apply floor semantics
    let neg = (a < 0) ^ (b < 0) ^ (denom < 0);
    let abs_a = a.unsigned_abs();
    let abs_b = b.unsigned_abs();
    let abs_d = denom.unsigned_abs();
    let (quotient, remainder) = wide_mul_div_with_rem_u128(abs_a, abs_b, abs_d)?;
    let q_signed = i128::try_from(quotient).map_err(|_| error!(CustomError::CalculationOverflow))?;
    if neg {
        // Negative result — floor means more negative, so round up abs if remainder != 0
        if remainder != 0 {
            Ok(-(q_signed + 1))
        } else {
            Ok(-q_signed)
        }
    } else {
        Ok(q_signed)
    }
}

/// Signed `(a * b) / denom` with ceiling rounding (toward +inf).
pub fn signed_mul_div_ceil(a: i128, b: i128, denom: i128) -> Result<i128> {
    if denom == 0 {
        return Err(error!(CustomError::CalculationOverflow));
    }
    let neg = (a < 0) ^ (b < 0) ^ (denom < 0);
    let abs_a = a.unsigned_abs();
    let abs_b = b.unsigned_abs();
    let abs_d = denom.unsigned_abs();
    let (quotient, remainder) = wide_mul_div_with_rem_u128(abs_a, abs_b, abs_d)?;
    let q_signed = i128::try_from(quotient).map_err(|_| error!(CustomError::CalculationOverflow))?;
    if neg {
        // Negative result — ceil means closer to zero, so truncate
        Ok(-q_signed)
    } else {
        // Positive result — ceil means round up if remainder != 0
        if remainder != 0 {
            Ok(q_signed + 1)
        } else {
            Ok(q_signed)
        }
    }
}

// ─────────────────────────────────────────────
// Position engine — pure functions
// ─────────────────────────────────────────────

/// Snapshot of a position's signed base, entry price, and realized PnL.
///
/// All prices are scaled by PRICE_SCALE.
/// `base_position` is signed: positive = long, negative = short.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PositionState {
    pub base_position: i64,
    pub entry_price: i64,
    pub realized_pnl: i128,
    pub last_cum_funding: i128,
}

/// Result of applying a trade to a position.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TradeResult {
    pub new_base_position: i64,
    pub new_entry_price: i64,
    pub new_realized_pnl: i128,
    pub pnl_delta: i128,
}

/// Apply a trade to an existing position (pure function, no side effects).
///
/// `trade_base_delta`: signed base change. +ve = buy, -ve = sell.
/// `trade_price`: the execution price, scaled by PRICE_SCALE.
///
/// Handles:
/// 1. Increase same direction — weighted average entry price.
/// 2. Partial reduction — realize PnL on reduced portion.
/// 3. Full close — realize PnL, reset position.
/// 4. Direction flip — close old position + open in new direction.
pub fn apply_trade_to_position(
    state: &PositionState,
    trade_base_delta: i64,
    trade_price: i64,
) -> Result<TradeResult> {
    if trade_base_delta == 0 {
        return Ok(TradeResult {
            new_base_position: state.base_position,
            new_entry_price: state.entry_price,
            new_realized_pnl: state.realized_pnl,
            pnl_delta: 0,
        });
    }

    let old_base = state.base_position as i128;
    let delta = trade_base_delta as i128;
    let new_base_i128 = checked_add_signed(old_base, delta)?;

    // Clamp to i64 range
    let new_base = i64::try_from(new_base_i128)
        .map_err(|_| error!(CustomError::CalculationOverflow))?;

    // Case 0: No existing position — just open new
    if state.base_position == 0 {
        return Ok(TradeResult {
            new_base_position: new_base,
            new_entry_price: trade_price,
            new_realized_pnl: state.realized_pnl,
            pnl_delta: 0,
        });
    }

    let same_direction = (old_base > 0 && delta > 0) || (old_base < 0 && delta < 0);

    if same_direction {
        // ── Case 1: Increasing in same direction ──
        // Weighted average entry price:
        //   new_entry = (|old_base| * old_entry + |delta| * trade_price) / |new_base|
        let abs_old = old_base.unsigned_abs();
        let abs_delta = delta.unsigned_abs();
        let abs_new = new_base_i128.unsigned_abs();
        if abs_new == 0 {
            return Err(error!(CustomError::CalculationOverflow));
        }
        let old_cost = abs_old
            .checked_mul(state.entry_price as u128)
            .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
        let delta_cost = abs_delta
            .checked_mul(trade_price as u128)
            .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
        let total_cost = old_cost
            .checked_add(delta_cost)
            .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
        // Use truncation for entry price (conservative: slightly lower entry for longs)
        let avg_entry = total_cost / abs_new;
        let avg_entry_i64 = i64::try_from(avg_entry)
            .map_err(|_| error!(CustomError::CalculationOverflow))?;

        Ok(TradeResult {
            new_base_position: new_base,
            new_entry_price: avg_entry_i64,
            new_realized_pnl: state.realized_pnl,
            pnl_delta: 0,
        })
    } else {
        // Opposite direction — could be partial reduction, full close, or flip
        let abs_old = old_base.abs();
        let abs_delta = delta.abs();

        // How much of the old position is being closed
        let close_size = abs_old.min(abs_delta);

        // Realize PnL on the closed portion:
        // pnl = close_size * (trade_price - entry_price) * sign(old_base) / PRICE_SCALE
        // We keep PnL in scaled units (PRICE_SCALE), so:
        // pnl_delta = close_size * (trade_price - entry_price) * sign(old_base)
        let price_diff = (trade_price as i128)
            .checked_sub(state.entry_price as i128)
            .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
        let direction = if old_base > 0 { 1i128 } else { -1i128 };
        let pnl_delta = (close_size as i128)
            .checked_mul(price_diff)
            .ok_or_else(|| error!(CustomError::CalculationOverflow))?
            .checked_mul(direction)
            .ok_or_else(|| error!(CustomError::CalculationOverflow))?;

        let new_realized = checked_add_signed(state.realized_pnl, pnl_delta)?;

        if new_base == 0 {
            // ── Case 3: Full close ──
            Ok(TradeResult {
                new_base_position: 0,
                new_entry_price: 0,
                new_realized_pnl: new_realized,
                pnl_delta,
            })
        } else if (new_base > 0) == (state.base_position > 0) {
            // ── Case 2: Partial reduction (same direction remains) ──
            // Entry price stays the same
            Ok(TradeResult {
                new_base_position: new_base,
                new_entry_price: state.entry_price,
                new_realized_pnl: new_realized,
                pnl_delta,
            })
        } else {
            // ── Case 4: Direction flip ──
            // Old position fully closed (PnL realized above).
            // New position opens at trade_price.
            Ok(TradeResult {
                new_base_position: new_base,
                new_entry_price: trade_price,
                new_realized_pnl: new_realized,
                pnl_delta,
            })
        }
    }
}

/// Compute unrealized PnL for a position at a given mark price.
///
/// Returns signed PnL in scaled units:
///   `base_position * (mark_price - entry_price)`
///
/// Positive = profit for longs when mark > entry.
/// Positive = profit for shorts when mark < entry.
pub fn unrealized_pnl(base_position: i64, entry_price: i64, mark_price: i64) -> Result<i128> {
    if base_position == 0 {
        return Ok(0);
    }
    let price_diff = (mark_price as i128)
        .checked_sub(entry_price as i128)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
    (base_position as i128)
        .checked_mul(price_diff)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))
}

/// Compute the notional value of a position at a given price.
///
/// Returns `|base_position| * price` (always non-negative).
pub fn notional_value(base_position: i64, price: i64) -> Result<i128> {
    let abs_base = (base_position as i128).unsigned_abs();
    let abs_price = (price as i128).unsigned_abs();
    let n = abs_base
        .checked_mul(abs_price)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
    i128::try_from(n).map_err(|_| error!(CustomError::CalculationOverflow))
}

/// Compute required margin (initial) for a notional value.
///
/// `required = ceil(notional / leverage)` — ceil is conservative for the protocol.
pub fn required_margin_scaled(notional: i128, leverage: u16) -> Result<i128> {
    if leverage == 0 {
        return Err(error!(CustomError::InvalidLeverage));
    }
    ceil_div(notional, leverage as i128)
}

// ─────────────────────────────────────────────
// Risk engine — margin & equity calculations
// ─────────────────────────────────────────────

/// Compute initial margin requirement.
///
/// `initial_margin = notional × IMR = notional / leverage`
///
/// where `IMR = 1 / leverage`.
///
/// Uses ceil rounding (conservative: protocol always requires ≥ theoretical IM).
pub fn initial_margin(notional: i128, leverage: u16) -> Result<i128> {
    if leverage == 0 {
        return Err(error!(CustomError::InvalidLeverage));
    }
    ceil_div(notional, leverage as i128)
}

/// Compute maintenance margin requirement.
///
/// `maintenance_margin = ceil(notional × mm_bps / 10_000)`
///
/// Uses ceil rounding (conservative for the protocol).
pub fn maintenance_margin(notional: i128, mm_bps: u16) -> Result<i128> {
    let numerator = notional
        .checked_mul(mm_bps as i128)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
    ceil_div(numerator, 10_000)
}

/// Full equity calculation for a position.
///
/// `equity = collateral + realized_pnl + unrealized_pnl − funding_owed`
///
/// Parameters:
/// - `collateral` — locked quote-token collateral (atomic units).
/// - `realized_pnl` — accumulated realized PnL (signed, same scale as uPnL).
/// - `base_position` — signed base size (long > 0, short < 0).
/// - `entry_price` — weighted-average entry price (PRICE_SCALE).
/// - `mark_price` — current mark / oracle price (PRICE_SCALE).
/// - `funding_owed` — pending funding owed (0 if already settled).
///
/// Returns signed equity — negative means bad debt.
pub fn compute_equity(
    collateral: u64,
    realized_pnl: i128,
    base_position: i64,
    entry_price: i64,
    mark_price: i64,
    funding_owed: i128,
) -> Result<i128> {
    let upnl = unrealized_pnl(base_position, entry_price, mark_price)?;
    (collateral as i128)
        .checked_add(realized_pnl)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))?
        .checked_add(upnl)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))?
        .checked_sub(funding_owed)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))
}

/// Guard: can a position be increased?
///
/// Returns `true` when `equity_after ≥ initial_margin`.
/// Equality is permitted — the position is exactly at the margin boundary.
pub fn can_increase_position(equity_after: i128, im: i128) -> bool {
    equity_after >= im
}

/// Guard: is a position liquidatable?
///
/// Returns `true` when `equity < maintenance_margin`.
/// Strict less-than: borderline positions (equity == mm) are NOT liquidated.
pub fn is_liquidatable_check(equity: i128, mm: i128) -> bool {
    equity < mm
}

// ─────────────────────────────────────────────
// Liquidation helpers
// ─────────────────────────────────────────────

/// Compute the equity of a position at a given mark price.
///
/// Simplified alias: `equity = collateral + unrealized_pnl`.
/// For the full formula (with realized PnL and funding), use `compute_equity`.
///
/// Returns signed value — negative means bad debt.
pub fn position_equity(collateral: u64, base_position: i64, entry_price: i64, mark_price: i64) -> Result<i128> {
    compute_equity(collateral, 0, base_position, entry_price, mark_price, 0)
}

/// Check whether a position is liquidatable.
///
/// A position is liquidatable when:
///   equity < maintenance_margin
///
/// Where:
///   equity = collateral + unrealized_pnl
///   maintenance_margin = ceil(notional × mm_bps / 10_000)
pub fn is_liquidatable(
    collateral: u64,
    base_position: i64,
    entry_price: i64,
    mark_price: i64,
    maintenance_margin_bps: u16,
) -> Result<bool> {
    if base_position == 0 {
        return Ok(false);
    }
    let equity = compute_equity(collateral, 0, base_position, entry_price, mark_price, 0)?;
    let notional = notional_value(base_position, mark_price)?;
    let mm = maintenance_margin(notional, maintenance_margin_bps)?;
    Ok(is_liquidatable_check(equity, mm))
}

/// Compute the minimum base size to close in order to restore margin safety.
///
/// We want: after closing `close_size`, the remaining position satisfies
///   remaining_equity >= remaining_mm
///
/// For simplicity (and safety), we use full liquidation when equity is
/// at or below zero, and otherwise close the minimum portion that
/// restores the maintenance margin ratio.
///
/// Returns absolute close size (always positive).  If full liquidation
/// is needed, returns `|base_position|`.
pub fn compute_liquidation_close_size(
    collateral: u64,
    base_position: i64,
    entry_price: i64,
    mark_price: i64,
    maintenance_margin_bps: u16,
) -> Result<i64> {
    let abs_base = base_position.unsigned_abs() as i64;
    if abs_base == 0 {
        return Ok(0);
    }
    let equity = compute_equity(collateral, 0, base_position, entry_price, mark_price, 0)?;
    // If equity <= 0, full liquidation is required
    if equity <= 0 {
        return Ok(abs_base);
    }

    let notional = notional_value(base_position, mark_price)?;
    let mm = maintenance_margin(notional, maintenance_margin_bps)?;

    // margin_deficit = mm - equity
    let deficit = mm
        .checked_sub(equity)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))?;

    if deficit <= 0 {
        // Not actually under-margined — shouldn't happen if is_liquidatable was true
        return Ok(0);
    }

    // mm_per_unit = ceil(|mark_price| * mm_bps / 10_000)
    let mm_per_unit_num = (mark_price.unsigned_abs() as i128)
        .checked_mul(maintenance_margin_bps as i128)
        .ok_or_else(|| error!(CustomError::CalculationOverflow))?;
    let mm_per_unit = ceil_div(mm_per_unit_num, 10_000)?;

    if mm_per_unit == 0 {
        return Ok(abs_base);
    }

    // close_size = ceil(deficit / mm_per_unit), clamped to |base_position|
    let close_size = ceil_div(deficit, mm_per_unit)?;
    let close_i64 = i64::try_from(close_size.min(abs_base as i128))
        .map_err(|_| error!(CustomError::CalculationOverflow))?;
    // Ensure at least 1 unit is closed
    Ok(close_i64.max(1))
}

// ─────────────────────────────────────────────
// Internal: 256-bit widening multiplication
// ─────────────────────────────────────────────

/// Compute `(a * b) / d` without overflow, using 256-bit intermediate.
///
/// Implements Knuth-style u128 × u128 → u256 then divides.
fn wide_mul_div_u128(a: u128, b: u128, d: u128) -> Result<u128> {
    let (q, _) = wide_mul_div_with_rem_u128(a, b, d)?;
    Ok(q)
}

/// Compute `(a * b) / d` returning `(quotient, remainder)`.
fn wide_mul_div_with_rem_u128(a: u128, b: u128, d: u128) -> Result<(u128, u128)> {
    if d == 0 {
        return Err(error!(CustomError::CalculationOverflow));
    }
    // Short-circuit for zero
    if a == 0 || b == 0 {
        return Ok((0, 0));
    }
    // Try direct multiply first (most common path for reasonable values)
    if let Some(product) = a.checked_mul(b) {
        return Ok((product / d, product % d));
    }
    // Overflow: use 256-bit arithmetic
    // Split a and b into two 64-bit halves and multiply
    let (hi, lo) = full_mul_u128(a, b);
    wide_div_u256(hi, lo, d)
}

/// 128×128 → 256 bit multiplication, returning (high_128, low_128).
fn full_mul_u128(a: u128, b: u128) -> (u128, u128) {
    let a_lo = a & 0xFFFFFFFFFFFFFFFF;
    let a_hi = a >> 64;
    let b_lo = b & 0xFFFFFFFFFFFFFFFF;
    let b_hi = b >> 64;

    let ll = a_lo * b_lo;
    let lh = a_lo * b_hi;
    let hl = a_hi * b_lo;
    let hh = a_hi * b_hi;

    let mid_sum = (ll >> 64) + (lh & 0xFFFFFFFFFFFFFFFF) + (hl & 0xFFFFFFFFFFFFFFFF);
    let lo = (ll & 0xFFFFFFFFFFFFFFFF) | ((mid_sum & 0xFFFFFFFFFFFFFFFF) << 64);
    let hi = hh + (lh >> 64) + (hl >> 64) + (mid_sum >> 64);
    (hi, lo)
}

/// Divide a 256-bit value (hi, lo) by a 128-bit divisor.
/// Returns (quotient_128, remainder_128). Errors if quotient > 128 bits.
fn wide_div_u256(hi: u128, lo: u128, d: u128) -> Result<(u128, u128)> {
    if hi >= d {
        // Quotient would overflow u128
        return Err(error!(CustomError::CalculationOverflow));
    }
    // Long division: (hi * 2^128 + lo) / d
    // Split into two 128-bit divisions using the identity:
    // q = (hi * 2^128 + lo) / d
    // Since hi < d, we can compute via two iterations of div with remainder.
    //
    // Step 1: q_hi * 2^64 = (hi * 2^64 + lo_hi) / d  (where lo_hi is top 64 bits of lo)
    // This is a standard divide-with-remainder approach.

    // We'll use a simple repeated-shift algorithm since we're in no_std context.
    // For our use case (i128 values), the widening path is rare.
    let mut remainder = hi;
    let mut quotient: u128 = 0;

    // Process 128 bits of `lo`, one bit at a time (MSB first)
    for i in (0..128).rev() {
        // Shift remainder left by 1, bring in bit i of lo
        remainder = (remainder << 1) | ((lo >> i) & 1);
        quotient <<= 1;
        if remainder >= d {
            remainder -= d;
            quotient |= 1;
        }
    }

    Ok((quotient, remainder))
}

// ─────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── mul_div tests ──

    #[test]
    fn test_mul_div_basic() {
        // 100 * 200 / 50 = 400
        assert_eq!(mul_div(100, 200, 50).unwrap(), 400);
    }

    #[test]
    fn test_mul_div_large_values() {
        // Near-max u128 values that would overflow simple u128 multiply
        let a: u128 = u128::MAX / 2;
        let b: u128 = 2;
        let d: u128 = 1;
        assert_eq!(mul_div(a, b, d).unwrap(), u128::MAX - 1);
    }

    #[test]
    fn test_mul_div_zero_denom() {
        assert!(mul_div(100, 200, 0).is_err());
    }

    #[test]
    fn test_mul_div_truncation() {
        // 7 * 3 / 2 = 10 (truncated, not 10.5)
        assert_eq!(mul_div(7, 3, 2).unwrap(), 10);
    }

    // ── signed_mul_div tests ──

    #[test]
    fn test_signed_mul_div_positive() {
        assert_eq!(signed_mul_div(100, 200, 50).unwrap(), 400);
    }

    #[test]
    fn test_signed_mul_div_negative() {
        // -100 * 200 / 50 = -400
        assert_eq!(signed_mul_div(-100, 200, 50).unwrap(), -400);
    }

    #[test]
    fn test_signed_mul_div_both_negative() {
        // -100 * -200 / 50 = 400
        assert_eq!(signed_mul_div(-100, -200, 50).unwrap(), 400);
    }

    #[test]
    fn test_signed_mul_div_truncation_toward_zero() {
        // -7 * 3 / 2 = -10 (truncated toward zero, not -10.5 → -11)
        assert_eq!(signed_mul_div(-7, 3, 2).unwrap(), -10);
    }

    // ── floor_div / ceil_div tests ──

    #[test]
    fn test_floor_div_positive() {
        assert_eq!(floor_div(7, 2).unwrap(), 3);
    }

    #[test]
    fn test_floor_div_negative() {
        // -7 / 2 = -3.5, floor = -4
        assert_eq!(floor_div(-7, 2).unwrap(), -4);
    }

    #[test]
    fn test_floor_div_exact() {
        assert_eq!(floor_div(-8, 2).unwrap(), -4);
    }

    #[test]
    fn test_ceil_div_positive() {
        // 7 / 2 = 3.5, ceil = 4
        assert_eq!(ceil_div(7, 2).unwrap(), 4);
    }

    #[test]
    fn test_ceil_div_negative() {
        // -7 / 2 = -3.5, ceil = -3
        assert_eq!(ceil_div(-7, 2).unwrap(), -3);
    }

    #[test]
    fn test_ceil_div_exact() {
        assert_eq!(ceil_div(8, 2).unwrap(), 4);
    }

    // ── signed_mul_div_floor / signed_mul_div_ceil tests ──

    #[test]
    fn test_signed_mul_div_floor_negative_pnl() {
        // -7 * 1 / 2 => floor(-3.5) = -4
        assert_eq!(signed_mul_div_floor(-7, 1, 2).unwrap(), -4);
    }

    #[test]
    fn test_signed_mul_div_ceil_margin() {
        // 7 * 1 / 2 => ceil(3.5) = 4
        assert_eq!(signed_mul_div_ceil(7, 1, 2).unwrap(), 4);
    }

    // ── Position engine tests ──

    fn make_pos(base: i64, entry: i64, rpnl: i128) -> PositionState {
        PositionState {
            base_position: base,
            entry_price: entry,
            realized_pnl: rpnl,
            last_cum_funding: 0,
        }
    }

    #[test]
    fn test_open_from_zero_long() {
        let pos = make_pos(0, 0, 0);
        let r = apply_trade_to_position(&pos, 10_000_000, 50_000_000).unwrap();
        assert_eq!(r.new_base_position, 10_000_000);
        assert_eq!(r.new_entry_price, 50_000_000);
        assert_eq!(r.pnl_delta, 0);
    }

    #[test]
    fn test_open_from_zero_short() {
        let pos = make_pos(0, 0, 0);
        let r = apply_trade_to_position(&pos, -10_000_000, 50_000_000).unwrap();
        assert_eq!(r.new_base_position, -10_000_000);
        assert_eq!(r.new_entry_price, 50_000_000);
        assert_eq!(r.pnl_delta, 0);
    }

    #[test]
    fn test_increase_long() {
        // Long 10 @ 50, add 10 @ 60 → avg = (10*50 + 10*60) / 20 = 55
        let pos = make_pos(10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, 10_000_000, 60_000_000).unwrap();
        assert_eq!(r.new_base_position, 20_000_000);
        assert_eq!(r.new_entry_price, 55_000_000);
        assert_eq!(r.pnl_delta, 0);
    }

    #[test]
    fn test_increase_short() {
        // Short 10 @ 50, add short 10 @ 40 → avg = (10*50 + 10*40) / 20 = 45
        let pos = make_pos(-10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, -10_000_000, 40_000_000).unwrap();
        assert_eq!(r.new_base_position, -20_000_000);
        assert_eq!(r.new_entry_price, 45_000_000);
        assert_eq!(r.pnl_delta, 0);
    }

    #[test]
    fn test_partial_close_long_profit() {
        // Long 10 @ 50, close 5 @ 60
        // PnL = 5 * (60 - 50) * 1 = 50 (in scaled units: 5e6 * 10e6 = 50e12)
        let pos = make_pos(10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, -5_000_000, 60_000_000).unwrap();
        assert_eq!(r.new_base_position, 5_000_000);
        assert_eq!(r.new_entry_price, 50_000_000); // entry price unchanged
        let expected_pnl: i128 = 5_000_000i128 * 10_000_000i128; // 50_000_000_000_000
        assert_eq!(r.pnl_delta, expected_pnl);
        assert_eq!(r.new_realized_pnl, expected_pnl);
    }

    #[test]
    fn test_partial_close_long_loss() {
        // Long 10 @ 50, close 5 @ 40
        // PnL = 5 * (40 - 50) * 1 = -50 (in scaled units)
        let pos = make_pos(10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, -5_000_000, 40_000_000).unwrap();
        assert_eq!(r.new_base_position, 5_000_000);
        let expected_pnl: i128 = 5_000_000i128 * (-10_000_000i128); // -50_000_000_000_000
        assert_eq!(r.pnl_delta, expected_pnl);
    }

    #[test]
    fn test_full_close_long() {
        let pos = make_pos(10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, -10_000_000, 60_000_000).unwrap();
        assert_eq!(r.new_base_position, 0);
        assert_eq!(r.new_entry_price, 0);
        let expected_pnl: i128 = 10_000_000i128 * 10_000_000i128;
        assert_eq!(r.pnl_delta, expected_pnl);
    }

    #[test]
    fn test_full_close_short_profit() {
        // Short 10 @ 50, close at 40 → profit = 10 * (40 - 50) * -1 = +100
        let pos = make_pos(-10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, 10_000_000, 40_000_000).unwrap();
        assert_eq!(r.new_base_position, 0);
        assert_eq!(r.new_entry_price, 0);
        // pnl = close_size * (trade_price - entry_price) * direction
        // direction for short (old_base < 0) = -1
        // = 10e6 * (40e6 - 50e6) * (-1) = 10e6 * (-10e6) * (-1) = +100e12
        let expected_pnl: i128 = 10_000_000i128 * 10_000_000i128;
        assert_eq!(r.pnl_delta, expected_pnl);
    }

    #[test]
    fn test_full_close_short_loss() {
        // Short 10 @ 50, close at 60 → loss = 10 * (60 - 50) * -1 = -100
        let pos = make_pos(-10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, 10_000_000, 60_000_000).unwrap();
        assert_eq!(r.new_base_position, 0);
        assert_eq!(r.new_entry_price, 0);
        let expected_pnl: i128 = 10_000_000i128 * (-10_000_000i128);
        assert_eq!(r.pnl_delta, expected_pnl);
    }

    #[test]
    fn test_flip_long_to_short() {
        // Long 10 @ 50, sell 15 @ 60 → close 10 @ 60 (profit), open short 5 @ 60
        let pos = make_pos(10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, -15_000_000, 60_000_000).unwrap();
        assert_eq!(r.new_base_position, -5_000_000);
        assert_eq!(r.new_entry_price, 60_000_000); // new direction
        let expected_pnl: i128 = 10_000_000i128 * 10_000_000i128;
        assert_eq!(r.pnl_delta, expected_pnl);
    }

    #[test]
    fn test_flip_short_to_long() {
        // Short 10 @ 50, buy 15 @ 40 → close 10 @ 40 (profit), open long 5 @ 40
        let pos = make_pos(-10_000_000, 50_000_000, 0);
        let r = apply_trade_to_position(&pos, 15_000_000, 40_000_000).unwrap();
        assert_eq!(r.new_base_position, 5_000_000);
        assert_eq!(r.new_entry_price, 40_000_000);
        let expected_pnl: i128 = 10_000_000i128 * 10_000_000i128; // profit
        assert_eq!(r.pnl_delta, expected_pnl);
    }

    // ── unrealized_pnl tests ──

    #[test]
    fn test_unrealized_pnl_long_profit() {
        // Long 10 @ 50, mark = 60 → upnl = 10 * (60-50) = 100
        let pnl = unrealized_pnl(10_000_000, 50_000_000, 60_000_000).unwrap();
        assert_eq!(pnl, 10_000_000i128 * 10_000_000i128);
    }

    #[test]
    fn test_unrealized_pnl_long_loss() {
        let pnl = unrealized_pnl(10_000_000, 50_000_000, 40_000_000).unwrap();
        assert_eq!(pnl, 10_000_000i128 * (-10_000_000i128));
    }

    #[test]
    fn test_unrealized_pnl_short_profit() {
        // Short -10 @ 50, mark = 40 → upnl = -10 * (40-50) = +100
        let pnl = unrealized_pnl(-10_000_000, 50_000_000, 40_000_000).unwrap();
        assert_eq!(pnl, -10_000_000i128 * (-10_000_000i128));
        assert!(pnl > 0);
    }

    #[test]
    fn test_unrealized_pnl_short_loss() {
        let pnl = unrealized_pnl(-10_000_000, 50_000_000, 60_000_000).unwrap();
        assert_eq!(pnl, -10_000_000i128 * 10_000_000i128);
        assert!(pnl < 0);
    }

    #[test]
    fn test_unrealized_pnl_zero_position() {
        assert_eq!(unrealized_pnl(0, 50_000_000, 60_000_000).unwrap(), 0);
    }

    // ── required_margin_scaled tests ──

    #[test]
    fn test_required_margin_ceil() {
        // notional = 1001, leverage = 10 → ceil(1001/10) = 101
        assert_eq!(required_margin_scaled(1001, 10).unwrap(), 101);
    }

    #[test]
    fn test_required_margin_exact() {
        assert_eq!(required_margin_scaled(1000, 10).unwrap(), 100);
    }

    #[test]
    fn test_required_margin_zero_leverage() {
        assert!(required_margin_scaled(1000, 0).is_err());
    }

    // ── Edge: accumulating realized PnL across multiple trades ──

    #[test]
    fn test_multiple_partial_closes() {
        // Long 20 @ 50, close 5 @ 60 (profit), then close 5 @ 45 (loss)
        let pos0 = make_pos(20_000_000, 50_000_000, 0);
        let r1 = apply_trade_to_position(&pos0, -5_000_000, 60_000_000).unwrap();
        assert_eq!(r1.new_base_position, 15_000_000);
        let pnl1 = 5_000_000i128 * 10_000_000i128; // +50e12
        assert_eq!(r1.pnl_delta, pnl1);

        let pos1 = PositionState {
            base_position: r1.new_base_position,
            entry_price: r1.new_entry_price,
            realized_pnl: r1.new_realized_pnl,
            last_cum_funding: 0,
        };
        let r2 = apply_trade_to_position(&pos1, -5_000_000, 45_000_000).unwrap();
        assert_eq!(r2.new_base_position, 10_000_000);
        let pnl2 = 5_000_000i128 * (-5_000_000i128); // -25e12
        assert_eq!(r2.pnl_delta, pnl2);
        assert_eq!(r2.new_realized_pnl, pnl1 + pnl2);
    }

    // ── Large values stress test ──

    #[test]
    fn test_large_position_pnl() {
        // 1 billion base units @ price 100_000 (1e5 scaled)
        // This tests that i128 can handle the multiplication
        let pos = make_pos(1_000_000_000, 100_000_000_000, 0); // 1e9 base, 1e11 price
        let r = apply_trade_to_position(&pos, -1_000_000_000, 100_001_000_000).unwrap();
        // PnL = 1e9 * (100_001e6 - 100_000e6) = 1e9 * 1e6 = 1e15
        assert_eq!(r.pnl_delta, 1_000_000_000i128 * 1_000_000i128);
    }

    #[test]
    fn test_notional_value() {
        let n = notional_value(10_000_000, 50_000_000).unwrap();
        // |10e6| * |50e6| = 500e12
        assert_eq!(n, 500_000_000_000_000i128);
    }

    #[test]
    fn test_notional_value_short() {
        let n = notional_value(-10_000_000, 50_000_000).unwrap();
        assert_eq!(n, 500_000_000_000_000i128);
    }

    // ── is_liquidatable tests ──

    #[test]
    fn test_healthy_position_not_liquidatable() {
        // Long 10 @ 100, mark = 100, collateral = 200, mm_bps = 500 (5%)
        // equity = 200 + 10*(100-100) = 200
        // mm = |10|*|100| * 500/10000 = 1000 * 0.05 = 50
        // 200 >= 50 → not liquidatable
        assert_eq!(
            is_liquidatable(200, 10, 100, 100, 500).unwrap(),
            false
        );
    }

    #[test]
    fn test_underwater_position_liquidatable() {
        // Long 10 @ 100, mark = 91, collateral = 100
        // upnl = 10 * (91-100) = -90 (in scaled: 10e6 * -9e6 = -90e12)
        // equity = 100e6 + (-90e12) → negative → liquidatable
        // BUT wait, upnl is in PRICE_SCALE-squared while collateral is atomic.
        // Let's use small numbers: 10 base units at price 100, collateral = 100
        // upnl = 10 * (91 - 100) = -90
        // equity = 100 + (-90) = 10
        // mm = 10 * 91 * 500 / 10000 = 45.5
        // 10 < 45.5 → liquidatable
        assert_eq!(
            is_liquidatable(100, 10, 100, 91, 500).unwrap(),
            true
        );
    }

    #[test]
    fn test_zero_position_not_liquidatable() {
        assert_eq!(is_liquidatable(0, 0, 0, 100, 500).unwrap(), false);
    }

    #[test]
    fn test_short_position_liquidatable() {
        // Short -10 @ 100, mark rises to 109, collateral = 100
        // upnl = -10 * (109 - 100) = -90
        // equity = 100 + (-90) = 10
        // mm = 10 * 109 * 500/10000 = 54.5
        // 10 < 54.5 → liquidatable
        assert_eq!(
            is_liquidatable(100, -10, 100, 109, 500).unwrap(),
            true
        );
    }

    // ── position_equity tests ──

    #[test]
    fn test_position_equity_profit() {
        // Long 10 @ 100, mark = 110, collateral = 100
        // equity = 100 + 10*(110-100) = 200
        assert_eq!(position_equity(100, 10, 100, 110).unwrap(), 200);
    }

    #[test]
    fn test_position_equity_loss() {
        // Long 10 @ 100, mark = 90, collateral = 100
        // equity = 100 + 10*(90-100) = 0
        assert_eq!(position_equity(100, 10, 100, 90).unwrap(), 0);
    }

    #[test]
    fn test_position_equity_negative() {
        // Long 10 @ 100, mark = 80, collateral = 100
        // equity = 100 + 10*(80-100) = -100
        assert_eq!(position_equity(100, 10, 100, 80).unwrap(), -100);
    }

    // ── compute_liquidation_close_size tests ──

    #[test]
    fn test_close_size_full_when_equity_zero() {
        // equity <= 0 → full liquidation
        assert_eq!(
            compute_liquidation_close_size(100, 10, 100, 80, 500).unwrap(),
            10
        );
    }

    #[test]
    fn test_close_size_partial() {
        // Long 100 @ 100, mark = 96, collateral = 1000
        // upnl = 100 * (96-100) = -400
        // equity = 1000 - 400 = 600
        // mm = 100 * 96 * 500/10000 = 480
        // 600 > 480 → not liquidatable → close_size = 0
        assert_eq!(
            compute_liquidation_close_size(1000, 100, 100, 96, 500).unwrap(),
            0
        );
    }

    #[test]
    fn test_close_size_zero_position() {
        assert_eq!(
            compute_liquidation_close_size(100, 0, 100, 50, 500).unwrap(),
            0
        );
    }

    // ── Risk engine tests ──

    #[test]
    fn test_initial_margin_basic() {
        // notional = 1000, leverage = 5 → im = ceil(1000/5) = 200
        assert_eq!(initial_margin(1000, 5).unwrap(), 200);
    }

    #[test]
    fn test_initial_margin_ceil_rounding() {
        // notional = 1001, leverage = 5 → ceil(1001/5) = ceil(200.2) = 201
        assert_eq!(initial_margin(1001, 5).unwrap(), 201);
    }

    #[test]
    fn test_initial_margin_zero_leverage() {
        assert!(initial_margin(1000, 0).is_err());
    }

    #[test]
    fn test_maintenance_margin_basic() {
        // notional = 10000, mm_bps = 500 → mm = ceil(10000*500/10000) = 500
        assert_eq!(maintenance_margin(10000, 500).unwrap(), 500);
    }

    #[test]
    fn test_maintenance_margin_ceil_rounding() {
        // notional = 10001, mm_bps = 500 → ceil(10001*500/10000) = ceil(500.05) = 501
        assert_eq!(maintenance_margin(10001, 500).unwrap(), 501);
    }

    #[test]
    fn test_compute_equity_all_components() {
        // collateral=1000, realized_pnl=200, base=10, entry=100, mark=110, funding=50
        // upnl = 10*(110-100) = 100
        // equity = 1000 + 200 + 100 - 50 = 1250
        assert_eq!(compute_equity(1000, 200, 10, 100, 110, 50).unwrap(), 1250);
    }

    #[test]
    fn test_compute_equity_negative() {
        // collateral=100, realized_pnl=0, base=10, entry=100, mark=80, funding=0
        // upnl = 10*(80-100) = -200
        // equity = 100 + 0 + (-200) - 0 = -100
        assert_eq!(compute_equity(100, 0, 10, 100, 80, 0).unwrap(), -100);
    }

    #[test]
    fn test_compute_equity_with_funding() {
        // collateral=500, rpnl=0, base=10, entry=100, mark=100, funding=100
        // upnl = 0, equity = 500 + 0 + 0 - 100 = 400
        assert_eq!(compute_equity(500, 0, 10, 100, 100, 100).unwrap(), 400);
    }

    #[test]
    fn test_can_increase_position_sufficient() {
        assert!(can_increase_position(200, 200));  // equality allowed
        assert!(can_increase_position(201, 200));
    }

    #[test]
    fn test_can_increase_position_insufficient() {
        assert!(!can_increase_position(199, 200));
        assert!(!can_increase_position(-100, 200));
    }

    #[test]
    fn test_is_liquidatable_check_below_mm() {
        assert!(is_liquidatable_check(49, 50));
    }

    #[test]
    fn test_is_liquidatable_check_at_mm() {
        // At exactly MM → NOT liquidatable (strict less-than)
        assert!(!is_liquidatable_check(50, 50));
    }

    #[test]
    fn test_is_liquidatable_check_above_mm() {
        assert!(!is_liquidatable_check(51, 50));
    }

    // ── Integration: position blocked if insufficient margin ──

    #[test]
    fn test_position_blocked_insufficient_margin() {
        // User has a losing long and tries to increase.
        // Long 20 @ 95 (weighted avg after increase), mark = 90.
        // notional = |20| * 90 = 1800
        // im = ceil(1800 / 5) = 360   (5× leverage)
        // upnl = 20 * (90 - 95) = -100
        // equity(with collateral=im) = 360 + 0 + (-100) - 0 = 260
        // 260 < 360 → CANNOT increase
        let notional = notional_value(20, 90).unwrap();
        let im = initial_margin(notional, 5).unwrap();
        let equity = compute_equity(im as u64, 0, 20, 95, 90, 0).unwrap();
        assert!(!can_increase_position(equity, im));
    }

    #[test]
    fn test_position_allowed_with_extra_collateral() {
        // Same scenario but user locks more collateral to cover the uPnL gap.
        // Need: collateral + upnl >= im → collateral >= im - upnl = 360 + 100 = 460
        let notional = notional_value(20, 90).unwrap();
        let im = initial_margin(notional, 5).unwrap();
        let equity = compute_equity(460, 0, 20, 95, 90, 0).unwrap();
        // equity = 460 - 100 = 360 = im → allowed (equality)
        assert!(can_increase_position(equity, im));
    }

    // ── Borderline IM / MM edge cases ──

    #[test]
    fn test_borderline_im_exactly_at_margin() {
        // Long 10 @ 100, mark = 100 → upnl = 0
        // notional = 1000, im(5×) = 200, collateral = 200
        // equity = 200 → exactly IM → allowed
        let notional = notional_value(10, 100).unwrap();
        let im = initial_margin(notional, 5).unwrap();
        let equity = compute_equity(im as u64, 0, 10, 100, 100, 0).unwrap();
        assert!(can_increase_position(equity, im));
    }

    #[test]
    fn test_borderline_im_one_below() {
        // collateral is 1 less than IM → blocked
        let notional = notional_value(10, 100).unwrap();
        let im = initial_margin(notional, 5).unwrap();
        let equity = compute_equity((im - 1) as u64, 0, 10, 100, 100, 0).unwrap();
        assert!(!can_increase_position(equity, im));
    }

    #[test]
    fn test_borderline_mm_exactly_at_margin() {
        // equity exactly at MM → NOT liquidatable
        let notional = notional_value(10, 100).unwrap();  // 1000
        let mm = maintenance_margin(notional, 500).unwrap();  // ceil(500000/10000) = 50
        assert!(!is_liquidatable_check(mm, mm));
    }

    #[test]
    fn test_borderline_mm_one_below() {
        // equity one unit below MM → liquidatable
        let notional = notional_value(10, 100).unwrap();
        let mm = maintenance_margin(notional, 500).unwrap();
        assert!(is_liquidatable_check(mm - 1, mm));
    }

    // ── High leverage prevention ──

    #[test]
    fn test_high_leverage_blocked() {
        // 100× leverage: even a 1-tick move blows through margin.
        // Long 100 @ 100, mark drops to 99.
        // notional = 100 * 99 = 9900
        // im = ceil(9900/100) = 99
        // upnl = 100 * (99 - 100) = -100
        // equity = 99 + 0 + (-100) - 0 = -1
        // -1 < 99 → cannot increase
        let notional = notional_value(100, 99).unwrap();
        let im = initial_margin(notional, 100).unwrap();
        let equity = compute_equity(im as u64, 0, 100, 100, 99, 0).unwrap();
        assert!(!can_increase_position(equity, im));
    }

    #[test]
    fn test_high_leverage_also_liquidatable() {
        // Same position, check MM with 2% (200 bps)
        // mm = ceil(9900 * 200 / 10000) = ceil(198) = 198
        // equity = -1 < 198 → liquidatable
        let notional = notional_value(100, 99).unwrap();
        let mm = maintenance_margin(notional, 200).unwrap();
        let equity = compute_equity(99, 0, 100, 100, 99, 0).unwrap();
        assert!(is_liquidatable_check(equity, mm));
    }

    #[test]
    fn test_conservative_rounding_favors_protocol() {
        // Verify ceil rounding makes IM/MM slightly larger, protecting protocol.
        // notional = 999, leverage = 7 → exact = 142.71… → ceil = 143
        assert_eq!(initial_margin(999, 7).unwrap(), 143);
        // notional = 999, mm_bps = 333 → exact = 999*333/10000 = 33.2667 → ceil = 34
        assert_eq!(maintenance_margin(999, 333).unwrap(), 34);
    }
}
