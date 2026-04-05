import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Boolean, DateTime,
    Enum as SAEnum, Text, ForeignKey
)
from sqlalchemy.orm import DeclarativeBase
import enum


class Base(DeclarativeBase):
    pass


def _now():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


class TradeType(str, enum.Enum):
    SWAP = "SWAP"
    PERP_OPEN = "PERP_OPEN"
    PERP_CLOSE = "PERP_CLOSE"
    LP_ADD = "LP_ADD"
    LP_REMOVE = "LP_REMOVE"
    REWARD = "REWARD"


class TradeSide(str, enum.Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    NONE = "NONE"


class TradeStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    PENDING = "PENDING"
    FAILED = "FAILED"

class Trade(Base):
    __tablename__ = "trades"

    id = Column(String, primary_key=True, default=_uuid)
    wallet_address = Column(String(64), nullable=False, index=True)
    type = Column(SAEnum(TradeType, name="trade_type"), nullable=False)

    # Token info
    token_in = Column(String(20), nullable=True)    # e.g. "SOL"
    token_out = Column(String(20), nullable=True)   # e.g. "USDC"
    amount_in = Column(Float, nullable=True)
    amount_out = Column(Float, nullable=True)

    # Value
    price_usd = Column(Float, nullable=True)        # price at execution time
    value_usd = Column(Float, nullable=True)        # total value of the trade in USD
    fee_usd = Column(Float, nullable=True, default=0.0)

    # Meta
    tx_hash = Column(String(128), nullable=True, unique=True)
    description = Column(Text, nullable=True)       # human-readable, e.g. "SOL → USDC"
    status = Column(SAEnum(TradeStatus, name="trade_status"), default=TradeStatus.SUCCESS)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

class Position(Base):
    __tablename__ = "positions"

    id = Column(String, primary_key=True, default=_uuid)
    wallet_address = Column(String(64), nullable=False, index=True)

    market = Column(String(20), nullable=False)     # "SOL/USD", "BTC/USD"
    side = Column(SAEnum(TradeSide, name="trade_side"), nullable=False)
    leverage = Column(Float, nullable=False, default=1.0)
    size_usd = Column(Float, nullable=False)
    collateral_usd = Column(Float, nullable=False)
    entry_price = Column(Float, nullable=False)
    liquidation_price = Column(Float, nullable=True)

    # Closing info
    is_open = Column(Boolean, default=True, nullable=False)
    exit_price = Column(Float, nullable=True)
    realized_pnl = Column(Float, nullable=True)     # USD profit/loss on close

    # Timestamps
    opened_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    tx_hash_open = Column(String(128), nullable=True)
    tx_hash_close = Column(String(128), nullable=True)

class LpPosition(Base):
    __tablename__ = "lp_positions"

    id = Column(String, primary_key=True, default=_uuid)
    wallet_address = Column(String(64), nullable=False, index=True)

    pool_pair = Column(String(30), nullable=False)  # "SOL/USDC"
    token_a = Column(String(20), nullable=False)
    token_b = Column(String(20), nullable=False)
    value_usd = Column(Float, nullable=False)
    fees_earned_usd = Column(Float, default=0.0)
    apr = Column(Float, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    tx_hash = Column(String(128), nullable=True)
