"""
Seed script — pre-populates the SolRush database with demo trades.
Run once after the DB is created: python -m db.seed

This creates realistic trade history for a demo wallet so the History
and Portfolio pages look populated from day one on localnet.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from .database import AsyncSessionLocal, engine
from .models import Base, TradeType, TradeSide, TradeStatus
from . import crud

# Demo wallet — matches the localnet-config.json targetWallet
DEMO_WALLET = "8Qmx5CZtR22YRKvjXkCgfMXfg5n9BHMmJmwCAno4cxrf"


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ── Swaps ─────────────────────────────────────────────
        swaps = [
            {
                "type": TradeType.SWAP,
                "token_in": "USDC",
                "token_out": "SOL",
                "amount_in": 500.0,
                "amount_out": 3.45,
                "price_usd": 144.93,
                "value_usd": 500.0,
                "fee_usd": 1.5,
                "tx_hash": "3xKpABCDabcd9fQr1111111111111111111111111111",
                "description": "USDC → SOL",
                "status": TradeStatus.SUCCESS,
            },
            {
                "type": TradeType.SWAP,
                "token_in": "SOL",
                "token_out": "USDC",
                "amount_in": 5.0,
                "amount_out": 750.0,
                "price_usd": 150.0,
                "value_usd": 750.0,
                "fee_usd": 2.25,
                "tx_hash": "7mNtXYZ1abcd2hJk1111111111111111111111111111",
                "description": "SOL → USDC",
                "status": TradeStatus.SUCCESS,
            },
            {
                "type": TradeType.SWAP,
                "token_in": "USDC",
                "token_out": "ETH",
                "amount_in": 500.0,
                "amount_out": 0.263,
                "price_usd": 1900.0,
                "value_usd": 500.0,
                "fee_usd": 1.5,
                "tx_hash": "6kFwMNO3abcd1mPo1111111111111111111111111111",
                "description": "USDC → ETH",
                "status": TradeStatus.SUCCESS,
            },
        ]

        base_time = datetime.now(timezone.utc)
        for i, swap in enumerate(swaps):
            trade = await crud.record_trade(db, DEMO_WALLET, swap)
            # manually patch created_at so trades appear at different times
            trade.created_at = base_time - timedelta(hours=i * 4 + 1)

        # ── LP Positions ───────────────────────────────────────
        lp_entries = [
            {
                "pool_pair": "SOL/USDC",
                "token_a": "SOL",
                "token_b": "USDC",
                "value_usd": 1200.0,
                "fees_earned_usd": 48.5,
                "apr": 24.8,
                "tx_hash": "9pLqRST4abcd4wXz1111111111111111111111111111",
            },
            {
                "pool_pair": "ETH/SOL",
                "token_a": "ETH",
                "token_b": "SOL",
                "value_usd": 850.0,
                "fees_earned_usd": 21.2,
                "apr": 18.3,
                "tx_hash": "4nMqUVW5abcd5yBc1111111111111111111111111111",
            },
        ]

        for lp_data in lp_entries:
            await crud.add_lp_position(db, DEMO_WALLET, lp_data)
            await db.flush()

        # Also record LP_ADD trade entries for history
        for lp in lp_entries:
            await crud.record_trade(db, DEMO_WALLET, {
                "type": TradeType.LP_ADD,
                "token_in": lp["token_a"],
                "token_out": lp["token_b"],
                "value_usd": lp["value_usd"],
                "fee_usd": 0.0,
                "tx_hash": lp["tx_hash"] + "_trade",
                "description": f"Added {lp['pool_pair']} Liquidity",
                "status": TradeStatus.SUCCESS,
            })

        # ── Perpetual Position (open) ──────────────────────────
        await crud.open_position(db, DEMO_WALLET, {
            "market": "SOL/USD",
            "side": TradeSide.LONG,
            "leverage": 5.0,
            "size_usd": 500.0,
            "collateral_usd": 100.0,
            "entry_price": 138.5,
            "liquidation_price": 110.8,
            "tx_hash": "2pErPQR6abcd3vKs1111111111111111111111111111",
        })

        # Also record perp open as a trade
        await crud.record_trade(db, DEMO_WALLET, {
            "type": TradeType.PERP_OPEN,
            "token_in": "USDC",
            "token_out": "SOL",
            "amount_in": 100.0,
            "value_usd": 500.0,
            "fee_usd": 1.0,
            "tx_hash": "2pErPQR6abcd3vKs1111111111111111111111111112",
            "description": "Opened LONG SOL/USD 5x",
            "status": TradeStatus.SUCCESS,
        })

        # ── Reward Claim ───────────────────────────────────────
        await crud.record_trade(db, DEMO_WALLET, {
            "type": TradeType.REWARD,
            "token_out": "RUSH",
            "amount_out": 125.0,
            "value_usd": 31.25,
            "fee_usd": 0.0,
            "tx_hash": "2cRaSTU7abcd8vBn1111111111111111111111111111",
            "description": "RUSH Rewards Claimed",
            "status": TradeStatus.SUCCESS,
        })

        await db.commit()
        print(f"✅ Seeded demo data for wallet: {DEMO_WALLET}")


if __name__ == "__main__":
    asyncio.run(seed())
