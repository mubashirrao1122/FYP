use anchor_lang::prelude::*;

pub const LP_TOKEN_DECIMALS: u8 = 6;

pub const DEFAULT_FEE_NUMERATOR: u64 = 3;
pub const DEFAULT_FEE_DENOMINATOR: u64 = 1000;

pub const POOL_SEED: &[u8] = b"pool";
pub const LP_MINT_SEED: &[u8] = b"lp_mint";
pub const POSITION_SEED: &[u8] = b"position";
pub const LIMIT_ORDER_SEED: &[u8] = b"limit_order";
pub const RUSH_CONFIG_SEED: &[u8] = b"rush_config";

pub const MIN_INITIAL_DEPOSIT: u64 = 1000;
pub const MAX_SLIPPAGE_BPS: u64 = 5000;
pub const RATIO_TOLERANCE_BPS: u64 = 100;

pub const MAX_LIMIT_ORDER_EXPIRY_DAYS: i64 = 30;

pub fn is_valid_pair(token_a_mint: &Pubkey, token_b_mint: &Pubkey) -> bool {
    token_a_mint != token_b_mint
}

pub fn get_canonical_pair(mint_a: Pubkey, mint_b: Pubkey) -> (Pubkey, Pubkey) {
    if mint_a < mint_b {
        (mint_a, mint_b)
    } else {
        (mint_b, mint_a)
    }
}
