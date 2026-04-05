"""
Database-powered LangChain tools for the SolRush AI chatbot.
These give the AI access to the user's real trade history and portfolio.
"""

import asyncio
from langchain_core.tools import tool
from db.database import AsyncSessionLocal
from db import crud


def _run_async(coro):
    """Run an async coroutine from a sync context (tool functions are sync)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're inside an async context (FastAPI); use a new thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


async def _fetch_portfolio(wallet: str) -> dict:
    async with AsyncSessionLocal() as db:
        return await crud.get_portfolio_summary(db, wallet)


async def _fetch_history(wallet: str, limit: int) -> list:
    async with AsyncSessionLocal() as db:
        trades = await crud.get_trade_history(db, wallet, limit=limit)
        return [crud._trade_to_dict(t) for t in trades]


@tool
def get_user_portfolio_from_db(wallet_address: str) -> dict:
    """
    Get the user's actual trade history, open positions, and portfolio summary
    from the SolRush database. Use this when the user asks about their trades,
    performance, profit/loss, or portfolio on SolRush.

    Args:
        wallet_address: The Solana wallet address of the user (base58 string)

    Returns:
        Dictionary with trade_stats, realized_pnl, open_positions,
        active_lp_positions, and recent_trades.
    """
    if not wallet_address or len(wallet_address) < 32:
        return {"error": "Invalid wallet address. Please connect your wallet first."}

    try:
        summary = _run_async(_fetch_portfolio(wallet_address))
        if not summary:
            return {"message": f"No trading history found for wallet {wallet_address[:8]}..."}

        # Format human-readable summary for the AI
        trade_stats = summary.get("trade_stats", {})
        return {
            "wallet": wallet_address[:8] + "...",
            "total_trades": trade_stats.get("total_trades", 0),
            "total_volume_usd": trade_stats.get("total_volume_usd", 0),
            "total_fees_paid_usd": trade_stats.get("total_fees_usd", 0),
            "realized_pnl_usd": summary.get("realized_pnl_usd", 0),
            "open_positions": summary.get("open_positions", []),
            "open_positions_count": summary.get("open_positions_count", 0),
            "active_lp_positions": summary.get("active_lp_positions", []),
            "active_lp_count": summary.get("active_lp_positions_count", 0),
            "total_lp_value_usd": summary.get("total_lp_value_usd", 0),
            "total_lp_fees_usd": summary.get("total_lp_fees_usd", 0),
            "recent_trades": summary.get("recent_trades", []),
            "source": "SolRush Database",
        }
    except Exception as e:
        return {
            "error": f"Could not fetch portfolio data: {str(e)}. "
                     "Make sure the database is running (check DATABASE_URL in .env)."
        }


@tool
def get_user_trade_history(wallet_address: str, limit: int = 20) -> dict:
    """
    Get the last N trades made by a user on SolRush.
    Use this when the user asks about their recent trades, swap history, or activity.

    Args:
        wallet_address: The user's Solana wallet address
        limit: Number of trades to return (max 50, default 20)

    Returns:
        Dictionary with a list of trade records including type, tokens, amounts, and timestamps.
    """
    if not wallet_address or len(wallet_address) < 32:
        return {"error": "Invalid wallet address provided."}

    limit = min(max(limit, 1), 50)

    try:
        trades = _run_async(_fetch_history(wallet_address, limit))
        if not trades:
            return {
                "message": f"No trades found for wallet {wallet_address[:8]}...",
                "trades": [],
                "count": 0,
            }
        return {
            "wallet": wallet_address[:8] + "...",
            "trades": trades,
            "count": len(trades),
            "source": "SolRush Database",
        }
    except Exception as e:
        return {"error": f"Could not fetch trade history: {str(e)}"}
