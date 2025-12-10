use anchor_lang::prelude::*;

use crate::errors::CustomError;
pub fn calculate_lp_tokens(amount_a: u64, amount_b: u64) -> Result<u64> {
    let product = (amount_a as u128)
        .checked_mul(amount_b as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    Ok((isqrt(product)) as u64)
}

pub fn calculate_lp_tokens_for_add_liquidity(
    amount_a: u64,
    amount_b: u64,
    reserve_a: u64,
    reserve_b: u64,
    total_lp_supply: u64,
) -> Result<u64> {
    require!(amount_a > 0 && amount_b > 0, CustomError::InvalidAmount);
    
    if total_lp_supply == 0 {
        // Initial liquidity provision
        let product = (amount_a as u128)
            .checked_mul(amount_b as u128)
            .ok_or(error!(CustomError::CalculationOverflow))?;
        return Ok(isqrt(product) as u64);
    }

    require!(reserve_a > 0 && reserve_b > 0, CustomError::InsufficientLiquidity);
    let lp_from_a = (amount_a as u128)
        .checked_mul(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    let lp_from_b = (amount_b as u128)
        .checked_mul(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_b as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    Ok(if lp_from_a < lp_from_b { lp_from_a } else { lp_from_b })
}

pub fn calculate_remove_liquidity_amounts(
    lp_tokens_to_burn: u64,
    total_lp_supply: u64,
    reserve_a: u64,
    reserve_b: u64,
) -> Result<(u64, u64)> {
    require!(lp_tokens_to_burn > 0, CustomError::InvalidAmount);
    require!(total_lp_supply > 0, CustomError::InsufficientLiquidity);
    let amount_a = (lp_tokens_to_burn as u128)
        .checked_mul(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    let amount_b = (lp_tokens_to_burn as u128)
        .checked_mul(reserve_b as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(total_lp_supply as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    Ok((amount_a, amount_b))
}

pub fn validate_ratio_imbalance(
    amount_a: u64,
    amount_b: u64,
    reserve_a: u64,
    reserve_b: u64,
) -> Result<()> {
    let expected_ratio = (reserve_b as u128)
        .checked_mul(10000)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let provided_ratio = (amount_b as u128)
        .checked_mul(10000)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(amount_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    let tolerance = 100u128;
    let diff = if expected_ratio > provided_ratio {
        expected_ratio - provided_ratio
    } else {
        provided_ratio - expected_ratio
    };
    require!(diff <= tolerance, CustomError::RatioImbalance);
    Ok(())
}

pub fn calculate_output_amount(
    input_amount: u64,
    input_reserve: u64,
    output_reserve: u64,
    fee_numerator: u64,
    fee_denominator: u64,
) -> Result<u64> {
    require!(input_amount > 0, CustomError::InvalidAmount);
    require!(
        input_reserve > 0 && output_reserve > 0,
        CustomError::InsufficientLiquidity
    );
    
    // Standard AMM formula: output = (input * (1 - fee) * output_reserve) / (input_reserve + input * (1 - fee))
    // Using x * y = k constant product formula
    
    // Calculate input amount after fee
    let amount_in_with_fee = (input_amount as u128)
        .checked_mul((fee_denominator - fee_numerator) as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    
    // Numerator: amount_in_with_fee * output_reserve
    let numerator = amount_in_with_fee
        .checked_mul(output_reserve as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    
    // Denominator: input_reserve * fee_denominator + amount_in_with_fee
    let denominator = (input_reserve as u128)
        .checked_mul(fee_denominator as u128)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_add(amount_in_with_fee)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    
    let output_amount = numerator
        .checked_div(denominator)
        .ok_or(error!(CustomError::CalculationOverflow))?;
    
    require!(output_amount > 0, CustomError::InsufficientLiquidity);
    Ok(output_amount as u64)
}

pub fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

pub fn calculate_pool_price(reserve_a: u64, reserve_b: u64) -> Result<u64> {
    require!(reserve_a > 0, CustomError::InsufficientLiquidity);
    let price = (reserve_b as u128)
        .checked_mul(1_000_000)
        .ok_or(error!(CustomError::CalculationOverflow))?
        .checked_div(reserve_a as u128)
        .ok_or(error!(CustomError::CalculationOverflow))? as u64;
    Ok(price)
}

pub fn check_price_condition(
    pool_price: u64,
    target_price: u64,
    is_sell: bool,
) -> bool {
    if is_sell {
        pool_price >= target_price
    } else {
        pool_price <= target_price
    }
}
