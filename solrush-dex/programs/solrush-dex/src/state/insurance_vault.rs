use anchor_lang::prelude::*;

/// Per-market insurance vault state.
///
/// Holds a balance of quote tokens that covers socialized losses when
/// a liquidated position's equity is negative (bad debt).
#[account]
pub struct InsuranceVault {
    /// The market this vault belongs to.
    pub market: Pubkey,
    /// SPL token account holding the insurance funds.
    pub vault_ata: Pubkey,
    /// Running balance tracked on-chain (mirrors the token account).
    pub balance_u64: u64,
    pub bump: u8,
}

impl InsuranceVault {
    // 8 (discriminator) + 32 + 32 + 8 + 1 = 81
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1;
}
