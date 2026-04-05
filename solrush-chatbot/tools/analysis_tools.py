"""
Technical analysis tools for the SolRush AI chatbot.
Calculates RSI, SMA, trend signals from CoinGecko price data.
"""

import numpy as np
from langchain_core.tools import tool
from tools.price_tools import get_price_history, _resolve_id


def _calculate_rsi(prices: list[float], period: int = 14) -> float:
    """Calculate Relative Strength Index."""
    if len(prices) < period + 1:
        return 50.0  # neutral if not enough data

    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)

    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def _calculate_sma(prices: list[float], period: int) -> float | None:
    """Calculate Simple Moving Average."""
    if len(prices) < period:
        return None
    return round(np.mean(prices[-period:]), 4)


def _calculate_ema(prices: list[float], period: int) -> float | None:
    """Calculate Exponential Moving Average."""
    if len(prices) < period:
        return None
    multiplier = 2 / (period + 1)
    ema = np.mean(prices[:period])
    for price in prices[period:]:
        ema = (price - ema) * multiplier + ema
    return round(ema, 4)


def _determine_trend(prices: list[float], sma_7: float, sma_30: float, rsi: float) -> dict:
    """Determine overall trend and generate a trading signal."""
    current = prices[-1]
    
    signals = []
    
    # Price vs SMA
    if sma_7 and current > sma_7:
        signals.append("above_sma7")
    else:
        signals.append("below_sma7")
    
    if sma_30 and current > sma_30:
        signals.append("above_sma30")
    else:
        signals.append("below_sma30")
    
    # SMA crossover
    if sma_7 and sma_30:
        if sma_7 > sma_30:
            signals.append("golden_cross")
        else:
            signals.append("death_cross")
    
    # RSI
    if rsi > 70:
        signals.append("overbought")
    elif rsi < 30:
        signals.append("oversold")
    else:
        signals.append("rsi_neutral")
    
    # Recent momentum (7-day price change)
    if len(prices) >= 7:
        week_change = ((current - prices[-7]) / prices[-7]) * 100
    else:
        week_change = 0
    
    # Determine overall signal
    bullish_count = sum(1 for s in signals if s in ["above_sma7", "above_sma30", "golden_cross", "oversold"])
    bearish_count = sum(1 for s in signals if s in ["below_sma7", "below_sma30", "death_cross", "overbought"])
    
    if bullish_count >= 3:
        trend = "BULLISH"
        signal = "BUY"
        confidence = "HIGH"
    elif bullish_count >= 2:
        trend = "SLIGHTLY BULLISH"
        signal = "WEAK BUY"
        confidence = "MEDIUM"
    elif bearish_count >= 3:
        trend = "BEARISH"
        signal = "SELL"
        confidence = "HIGH"
    elif bearish_count >= 2:
        trend = "SLIGHTLY BEARISH"
        signal = "WEAK SELL"
        confidence = "MEDIUM"
    else:
        trend = "NEUTRAL"
        signal = "HOLD"
        confidence = "LOW"
    
    return {
        "trend": trend,
        "signal": signal,
        "confidence": confidence,
        "signals": signals,
        "week_change_pct": round(week_change, 2),
    }


@tool
def analyze_token(token: str) -> dict:
    """Perform technical analysis on a cryptocurrency token using RSI, SMA, and trend indicators.
    
    Analyzes the token's price history to calculate:
    - RSI (Relative Strength Index) — overbought >70, oversold <30
    - SMA 7-day and 30-day — trend comparison
    - EMA 12 and 26 — momentum
    - Overall trend signal (BUY/SELL/HOLD) with confidence level
    
    Args:
        token: The token symbol or name (e.g., 'SOL', 'BTC', 'ETH')
    
    Returns:
        Dictionary with technical indicators, trend analysis, and investment signal.
    """
    # Fetch 90 days of data for meaningful analysis
    history = get_price_history.invoke({"token": token, "days": 90})
    
    if "error" in history:
        return history
    
    prices = [p["price"] for p in history["prices"]]
    
    if len(prices) < 14:
        return {"error": f"Not enough price data for {token} to perform analysis."}
    
    rsi = _calculate_rsi(prices)
    sma_7 = _calculate_sma(prices, 7)
    sma_30 = _calculate_sma(prices, 30)
    ema_12 = _calculate_ema(prices, 12)
    ema_26 = _calculate_ema(prices, 26)
    
    trend = _determine_trend(prices, sma_7, sma_30, rsi)
    
    # Volatility (standard deviation of daily returns)
    returns = np.diff(prices) / prices[:-1]
    volatility = round(np.std(returns) * 100, 2)  # as percentage
    
    current_price = prices[-1]
    
    # Support and resistance (simple: recent low and high)
    recent_prices = prices[-30:] if len(prices) >= 30 else prices
    support = round(min(recent_prices), 4)
    resistance = round(max(recent_prices), 4)
    
    # Generate reasoning
    reasons = []
    if rsi > 70:
        reasons.append(f"RSI at {rsi} indicates the token is OVERBOUGHT — potential pullback ahead")
    elif rsi < 30:
        reasons.append(f"RSI at {rsi} indicates the token is OVERSOLD — potential bounce opportunity")
    else:
        reasons.append(f"RSI at {rsi} is in neutral territory")
    
    if sma_7 and sma_30:
        if sma_7 > sma_30:
            reasons.append(f"7-day SMA (${sma_7}) is above 30-day SMA (${sma_30}) — bullish crossover")
        else:
            reasons.append(f"7-day SMA (${sma_7}) is below 30-day SMA (${sma_30}) — bearish crossover")
    
    reasons.append(f"Volatility is {volatility}% (daily returns std dev)")
    reasons.append(f"Support at ${support}, Resistance at ${resistance}")

    return {
        "token": token.upper(),
        "current_price": round(current_price, 4),
        "indicators": {
            "rsi_14": rsi,
            "sma_7": sma_7,
            "sma_30": sma_30,
            "ema_12": ema_12,
            "ema_26": ema_26,
            "volatility_pct": volatility,
            "support": support,
            "resistance": resistance,
        },
        "analysis": {
            "trend": trend["trend"],
            "signal": trend["signal"],
            "confidence": trend["confidence"],
            "week_change_pct": trend["week_change_pct"],
            "reasoning": reasons,
        },
        "disclaimer": "This is algorithmic analysis, not financial advice. Always do your own research.",
        "source": "CoinGecko + Technical Analysis",
    }
