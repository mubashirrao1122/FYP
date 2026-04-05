"""
Async CRUD operations for SolRush database.
All functions accept an AsyncSession and return ORM objects or dicts.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Trade, Position, LpPosition, TradeStatus, TradeSide


# ─────────────────────────────────────────────────────────────
# TRADES
# ─────────────────────────────────────────────────────────────

async def record_trade(db: AsyncSession, wallet: str, data: dict) -> Trade:
    """Insert a new trade record or return existing if tx_hash matches."""
    tx_hash = data.get("tx_hash")
    
    # FIX: Upsert logic to prevent UniqueViolationError during repeated seeding or re-runs.
    if tx_hash:
        stmt = select(Trade).where(Trade.tx_hash == tx_hash)
        result = await db.execute(stmt)
        existing_trade = result.scalar_one_or_none()
        if existing_trade:
            return existing_trade

    trade = Trade(
        wallet_address=wallet,
        type=data["type"],
        token_in=data.get("token_in"),
        token_out=data.get("token_out"),
        amount_in=data.get("amount_in"),
        amount_out=data.get("amount_out"),
        price_usd=data.get("price_usd"),
        value_usd=data.get("value_usd"),
        fee_usd=data.get("fee_usd", 0.0),
        tx_hash=tx_hash,
        description=data.get("description"),
        status=data.get("status", TradeStatus.SUCCESS),
    )
    db.add(trade)
    await db.flush()
    await db.refresh(trade)
    return trade


async def get_trade_history(
    db: AsyncSession,
    wallet: str,
    limit: int = 50,
    offset: int = 0,
) -> list[Trade]:
    """Return recent trades for a wallet, newest first."""
    result = await db.execute(
        select(Trade)
        .where(Trade.wallet_address == wallet)
        .order_by(Trade.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_trade_stats(db: AsyncSession, wallet: str) -> dict:
    """Aggregate trade statistics for a wallet."""
    result = await db.execute(
        select(
            func.count(Trade.id).label("total_trades"),
            func.sum(Trade.value_usd).label("total_volume_usd"),
            func.sum(Trade.fee_usd).label("total_fees_usd"),
        ).where(Trade.wallet_address == wallet)
    )
    row = result.one()
    return {
        "total_trades": row.total_trades or 0,
        "total_volume_usd": round(row.total_volume_usd or 0, 2),
        "total_fees_usd": round(row.total_fees_usd or 0, 2),
    }


# ─────────────────────────────────────────────────────────────
# POSITIONS (Perpetuals)
# ─────────────────────────────────────────────────────────────

async def open_position(db: AsyncSession, wallet: str, data: dict) -> Position:
    """Create a new open perpetual position or return existing if tx_hash matches."""
    tx_hash = data.get("tx_hash")
    
    # FIX: Check for existing tx_hash_open to prevent duplicate entries during re-seeding
    if tx_hash:
        stmt = select(Position).where(Position.tx_hash_open == tx_hash)
        result = await db.execute(stmt)
        existing_pos = result.scalar_one_or_none()
        if existing_pos:
            return existing_pos

    pos = Position(
        wallet_address=wallet,
        market=data["market"],
        side=data["side"],
        leverage=data.get("leverage", 1.0),
        size_usd=data["size_usd"],
        collateral_usd=data["collateral_usd"],
        entry_price=data["entry_price"],
        liquidation_price=data.get("liquidation_price"),
        tx_hash_open=tx_hash,
        is_open=True,
    )
    db.add(pos)
    await db.flush()
    await db.refresh(pos)
    return pos


async def close_position(
    db: AsyncSession,
    position_id: str,
    exit_price: float,
    tx_hash: Optional[str] = None,
    wallet: Optional[str] = None,
    market: Optional[str] = None,
) -> Optional[Position]:
    """Close an open position and calculate realized PnL."""
    if position_id and position_id != "latest":
        result = await db.execute(select(Position).where(Position.id == position_id))
    elif wallet and market:
        # Fallback: find the latest open position for this wallet and market
        result = await db.execute(
            select(Position)
            .where(Position.wallet_address == wallet, Position.market == market, Position.is_open == True)
            .order_by(Position.opened_at.desc())
            .limit(1)
        )
    else:
        return None

    pos = result.scalar_one_or_none()
    if not pos or not pos.is_open:
        return None

    # Calculate PnL
    price_diff = exit_price - pos.entry_price
    if pos.side == TradeSide.SHORT:
        price_diff = -price_diff
    pnl_pct = price_diff / pos.entry_price
    realized_pnl = round(pos.size_usd * pnl_pct, 4)

    pos.is_open = False
    pos.exit_price = exit_price
    pos.realized_pnl = realized_pnl
    pos.closed_at = datetime.now(timezone.utc)
    pos.tx_hash_close = tx_hash

    await db.flush()
    await db.refresh(pos)
    return pos


async def get_open_positions(db: AsyncSession, wallet: str) -> list[Position]:
    """Return all currently open positions for a wallet."""
    result = await db.execute(
        select(Position)
        .where(Position.wallet_address == wallet, Position.is_open == True)
        .order_by(Position.opened_at.desc())
    )
    return list(result.scalars().all())


async def get_closed_positions(db: AsyncSession, wallet: str, limit: int = 20) -> list[Position]:
    """Return recently closed positions for a wallet."""
    result = await db.execute(
        select(Position)
        .where(Position.wallet_address == wallet, Position.is_open == False)
        .order_by(Position.closed_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_realized_pnl(db: AsyncSession, wallet: str) -> float:
    """Total realized PnL across all closed positions."""
    result = await db.execute(
        select(func.sum(Position.realized_pnl)).where(
            Position.wallet_address == wallet,
            Position.is_open == False,
        )
    )
    return round(result.scalar() or 0.0, 4)


# ─────────────────────────────────────────────────────────────
# LP POSITIONS
# ─────────────────────────────────────────────────────────────

async def add_lp_position(db: AsyncSession, wallet: str, data: dict) -> LpPosition:
    """Record a new LP position or return existing if tx_hash matches."""
    tx_hash = data.get("tx_hash")
    
    # FIX: Check for existing tx_hash to prevent duplicate entries during re-seeding
    if tx_hash:
        stmt = select(LpPosition).where(LpPosition.tx_hash == tx_hash)
        result = await db.execute(stmt)
        existing_lp = result.scalar_one_or_none()
        if existing_lp:
            return existing_lp

    lp = LpPosition(
        wallet_address=wallet,
        pool_pair=data["pool_pair"],
        token_a=data["token_a"],
        token_b=data["token_b"],
        value_usd=data["value_usd"],
        fees_earned_usd=data.get("fees_earned_usd", 0.0),
        apr=data.get("apr"),
        tx_hash=tx_hash,
        is_active=True,
    )
    db.add(lp)
    await db.flush()
    await db.refresh(lp)
    return lp


async def get_active_lp_positions(db: AsyncSession, wallet: str) -> list[LpPosition]:
    """Return all active LP positions for a wallet."""
    result = await db.execute(
        select(LpPosition)
        .where(LpPosition.wallet_address == wallet, LpPosition.is_active == True)
        .order_by(LpPosition.created_at.desc())
    )
    return list(result.scalars().all())


async def get_total_lp_fees(db: AsyncSession, wallet: str) -> float:
    """Total LP fees earned for a wallet."""
    result = await db.execute(
        select(func.sum(LpPosition.fees_earned_usd)).where(
            LpPosition.wallet_address == wallet
        )
    )
    return round(result.scalar() or 0.0, 4)


# ─────────────────────────────────────────────────────────────
# PORTFOLIO SUMMARY
# ─────────────────────────────────────────────────────────────

async def get_portfolio_summary(db: AsyncSession, wallet: str) -> dict:
    """Aggregate a full portfolio summary for a given wallet."""
    trade_stats = await get_trade_stats(db, wallet)
    realized_pnl = await get_realized_pnl(db, wallet)
    open_positions = await get_open_positions(db, wallet)
    active_lp = await get_active_lp_positions(db, wallet)
    lp_fees = await get_total_lp_fees(db, wallet)
    recent_trades = await get_trade_history(db, wallet, limit=10)

    lp_value = sum(p.value_usd for p in active_lp)

    return {
        "wallet": wallet,
        "trade_stats": trade_stats,
        "realized_pnl_usd": realized_pnl,
        "open_positions_count": len(open_positions),
        "active_lp_positions_count": len(active_lp),
        "total_lp_value_usd": round(lp_value, 2),
        "total_lp_fees_usd": lp_fees,
        "open_positions": [_pos_to_dict(p) for p in open_positions],
        "active_lp_positions": [_lp_to_dict(p) for p in active_lp],
        "recent_trades": [_trade_to_dict(t) for t in recent_trades],
    }


# ─────────────────────────────────────────────────────────────
# Serialization helpers
# ─────────────────────────────────────────────────────────────

def _trade_to_dict(t: Trade) -> dict:
    return {
        "id": t.id,
        "type": t.type.value if hasattr(t.type, "value") else t.type,
        "token_in": t.token_in,
        "token_out": t.token_out,
        "amount_in": t.amount_in,
        "amount_out": t.amount_out,
        "value_usd": t.value_usd,
        "fee_usd": t.fee_usd,
        "description": t.description,
        "tx_hash": t.tx_hash,
        "status": t.status.value if hasattr(t.status, "value") else t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _pos_to_dict(p: Position) -> dict:
    return {
        "id": p.id,
        "market": p.market,
        "side": p.side.value if hasattr(p.side, "value") else p.side,
        "leverage": p.leverage,
        "size_usd": p.size_usd,
        "collateral_usd": p.collateral_usd,
        "entry_price": p.entry_price,
        "liquidation_price": p.liquidation_price,
        "is_open": p.is_open,
        "exit_price": p.exit_price,
        "realized_pnl": p.realized_pnl,
        "opened_at": p.opened_at.isoformat() if p.opened_at else None,
        "closed_at": p.closed_at.isoformat() if p.closed_at else None,
    }


def _lp_to_dict(lp: LpPosition) -> dict:
    return {
        "id": lp.id,
        "pool_pair": lp.pool_pair,
        "token_a": lp.token_a,
        "token_b": lp.token_b,
        "value_usd": lp.value_usd,
        "fees_earned_usd": lp.fees_earned_usd,
        "apr": lp.apr,
        "is_active": lp.is_active,
        "created_at": lp.created_at.isoformat() if lp.created_at else None,
    }
