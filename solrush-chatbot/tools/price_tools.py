"""
CoinGecko price tools for the SolRush AI chatbot.
Uses the free CoinGecko API (no key required).
"""

import httpx
from langchain_core.tools import tool
from typing import Optional

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# Map common symbols to CoinGecko IDs
SYMBOL_TO_ID = {
    "sol": "solana",
    "solana": "solana",
    "btc": "bitcoin",
    "bitcoin": "bitcoin",
    "eth": "ethereum",
    "ethereum": "ethereum",
    "usdc": "usd-coin",
    "usdt": "tether",
    "bnb": "binancecoin",
    "xrp": "ripple",
    "ada": "cardano",
    "doge": "dogecoin",
    "dot": "polkadot",
    "avax": "avalanche-2",
    "matic": "matic-network",
    "link": "chainlink",
    "uni": "uniswap",
    "atom": "cosmos",
    "near": "near",
    "apt": "aptos",
    "sui": "sui",
    "arb": "arbitrum",
    "op": "optimism",
    "jup": "jupiter-exchange-solana",
    "ray": "raydium",
    "jto": "jito-governance-token",
    "bonk": "bonk",
    "wif": "dogwifcoin",
}


def _resolve_id(token: str) -> str:
    """Resolve a token symbol or name to CoinGecko ID."""
    token_lower = token.lower().strip()
    return SYMBOL_TO_ID.get(token_lower, token_lower)


@tool
def get_token_price(token: str) -> dict:
    """Get the current price, 24h change, market cap, and volume for a cryptocurrency token.
    
    Args:
        token: The token symbol or name (e.g., 'SOL', 'BTC', 'ETH', 'solana', 'bitcoin')
    
    Returns:
        Dictionary with price data including current_price, price_change_24h, 
        market_cap, total_volume, and other market data.
    """
    coin_id = _resolve_id(token)
    
    try:
        with httpx.Client(timeout=10) as client:
            # Get detailed market data
            resp = client.get(
                f"{COINGECKO_BASE}/coins/markets",
                params={
                    "vs_currency": "usd",
                    "ids": coin_id,
                    "order": "market_cap_desc",
                    "sparkline": "false",
                    "price_change_percentage": "1h,24h,7d,30d",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            if not data:
                return {"error": f"Token '{token}' not found on CoinGecko. Try using the full name (e.g., 'solana' instead of 'SOL')."}

            coin = data[0]
            return {
                "token": coin.get("symbol", "").upper(),
                "name": coin.get("name", ""),
                "current_price": coin.get("current_price"),
                "price_change_24h_pct": round(coin.get("price_change_percentage_24h", 0) or 0, 2),
                "price_change_7d_pct": round(coin.get("price_change_percentage_7d_in_currency", 0) or 0, 2),
                "price_change_30d_pct": round(coin.get("price_change_percentage_30d_in_currency", 0) or 0, 2),
                "market_cap": coin.get("market_cap"),
                "total_volume_24h": coin.get("total_volume"),
                "circulating_supply": coin.get("circulating_supply"),
                "ath": coin.get("ath"),
                "ath_change_pct": round(coin.get("ath_change_percentage", 0) or 0, 2),
                "market_cap_rank": coin.get("market_cap_rank"),
                "last_updated": coin.get("last_updated"),
                "source": "CoinGecko",
            }
    except httpx.HTTPStatusError as e:
        return {"error": f"CoinGecko API error: {e.response.status_code}"}
    except Exception as e:
        return {"error": f"Failed to fetch price: {str(e)}"}


@tool
def get_price_history(token: str, days: int = 30) -> dict:
    """Get historical price data for a cryptocurrency token over a specified number of days.
    
    Args:
        token: The token symbol or name (e.g., 'SOL', 'BTC', 'ETH')
        days: Number of days of history to retrieve (1, 7, 14, 30, 90, 180, 365). Default 30.
    
    Returns:
        Dictionary with prices array of {timestamp, price} objects and summary statistics.
    """
    coin_id = _resolve_id(token)
    days = min(max(days, 1), 365)

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{COINGECKO_BASE}/coins/{coin_id}/market_chart",
                params={
                    "vs_currency": "usd",
                    "days": str(days),
                },
            )
            resp.raise_for_status()
            data = resp.json()

            prices_raw = data.get("prices", [])
            if not prices_raw:
                return {"error": f"No price history found for '{token}'."}

            prices = [
                {"timestamp": int(p[0]), "price": round(p[1], 4)}
                for p in prices_raw
            ]

            price_values = [p["price"] for p in prices]
            first_price = price_values[0]
            last_price = price_values[-1]
            change_pct = round(((last_price - first_price) / first_price) * 100, 2)

            return {
                "token": token.upper(),
                "days": days,
                "data_points": len(prices),
                "prices": prices,  
                "summary": {
                    "start_price": round(first_price, 4),
                    "end_price": round(last_price, 4),
                    "high": round(max(price_values), 4),
                    "low": round(min(price_values), 4),
                    "change_pct": change_pct,
                    "avg_price": round(sum(price_values) / len(price_values), 4),
                },
                "source": "CoinGecko",
            }
    except httpx.HTTPStatusError as e:
        return {"error": f"CoinGecko API error: {e.response.status_code}"}
    except Exception as e:
        return {"error": f"Failed to fetch history: {str(e)}"}
