use anchor_lang::prelude::*;
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OrderStatus {
    Pending = 0,
    Executed = 1,
    Cancelled = 2,
    Expired = 3,
}
impl OrderStatus {
    pub fn is_executable(&self) -> bool {
        matches!(self, OrderStatus::Pending)
    }
    pub fn is_cancellable(&self) -> bool {
        matches!(self, OrderStatus::Pending)
    }
    pub fn is_final(&self) -> bool {
        matches!(self, OrderStatus::Executed | OrderStatus::Cancelled | OrderStatus::Expired)
    }
}
#[account]
pub struct LimitOrder {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub sell_token: Pubkey,
    pub buy_token: Pubkey,
    pub sell_amount: u64,
    pub target_price: u64,
    pub minimum_receive: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: OrderStatus,
    pub bump: u8,
    pub order_id: u64,
}
impl LimitOrder {
    pub const SIZE: usize = 8 + 32*4 + 8*5 + 1 + 1 + 8;
    pub fn is_expired(&self, current_timestamp: i64) -> bool {
        current_timestamp >= self.expires_at
    }
    pub fn can_execute(&self, current_timestamp: i64) -> bool {
        self.status.is_executable() && !self.is_expired(current_timestamp)
    }
    pub fn time_until_expiry(&self, current_timestamp: i64) -> u64 {
        if current_timestamp >= self.expires_at {
            0
        } else {
            (self.expires_at - current_timestamp) as u64
        }
    }
    pub fn is_sell_order(&self, token_a_mint: &Pubkey) -> bool {
        self.sell_token == *token_a_mint
    }
    pub fn get_asking_price(&self) -> u64 {
        self.target_price
    }
}
