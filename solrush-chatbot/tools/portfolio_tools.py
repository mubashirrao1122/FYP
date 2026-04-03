"""
Portfolio advice tools for the SolRush AI chatbot.
Generates allocation recommendations based on risk tolerance and market conditions.
"""

from langchain_core.tools import tool
from tools.price_tools import get_token_price
from tools.analysis_tools import analyze_token


PORTFOLIO_TOKENS = ["SOL", "BTC", "ETH", "AVAX", "LINK"]


@tool
def suggest_portfolio(amount: float, risk_tolerance: str = "medium") -> dict:
    """Suggest a cryptocurrency portfolio allocation based on investment amount and risk tolerance.
    
    Analyzes multiple tokens and creates a diversified allocation based on:
    - Current market conditions and technical signals
    - Risk tolerance (conservative, medium, aggressive)
    - Market cap and liquidity considerations
    
    Args:
        amount: Total investment amount in USD (e.g., 1000)
        risk_tolerance: One of 'conservative', 'medium', 'aggressive'. Default 'medium'.
    
    Returns:
        Dictionary with recommended allocations, reasoning, and risk assessment.
    """
    risk_tolerance = risk_tolerance.lower().strip()
    if risk_tolerance not in ("conservative", "medium", "aggressive"):
        risk_tolerance = "medium"

    # Analyze top tokens
    analyses = {}
    prices = {}
    for token in PORTFOLIO_TOKENS:
        try:
            analysis = analyze_token.invoke({"token": token})
            price_data = get_token_price.invoke({"token": token})
            if "error" not in analysis and "error" not in price_data:
                analyses[token] = analysis
                prices[token] = price_data
        except Exception:
            continue

    if not analyses:
        return {"error": "Could not fetch market data. Please try again later."}

    # Base allocation templates by risk level
    base_allocations = {
        "conservative": {
            "BTC": 40, "ETH": 30, "SOL": 15, "LINK": 10, "AVAX": 5,
        },
        "medium": {
            "BTC": 30, "ETH": 25, "SOL": 25, "LINK": 10, "AVAX": 10,
        },
        "aggressive": {
            "BTC": 15, "ETH": 20, "SOL": 35, "LINK": 15, "AVAX": 15,
        },
    }

    base = base_allocations[risk_tolerance]

    # Adjust allocations based on analysis signals
    adjustments = {}
    for token, analysis in analyses.items():
        signal = analysis.get("analysis", {}).get("signal", "HOLD")
        if signal in ("BUY",):
            adjustments[token] = 5  # boost by 5%
        elif signal in ("WEAK BUY",):
            adjustments[token] = 2
        elif signal in ("SELL",):
            adjustments[token] = -5
        elif signal in ("WEAK SELL",):
            adjustments[token] = -2
        else:
            adjustments[token] = 0

    # Apply adjustments
    adjusted = {}
    for token in PORTFOLIO_TOKENS:
        adj = adjustments.get(token, 0)
        pct = base.get(token, 0) + adj
        adjusted[token] = max(pct, 5)  # minimum 5% per token

    # Normalize to 100%
    total = sum(adjusted.values())
    for token in adjusted:
        adjusted[token] = round((adjusted[token] / total) * 100, 1)

    # Build final allocations
    allocations = []
    for token in PORTFOLIO_TOKENS:
        if token not in adjusted or token not in analyses:
            continue
        pct = adjusted[token]
        usd_amount = round(amount * pct / 100, 2)
        analysis = analyses[token]
        price = prices.get(token, {})
        
        allocations.append({
            "token": token,
            "name": price.get("name", token),
            "allocation_pct": pct,
            "usd_amount": usd_amount,
            "current_price": price.get("current_price"),
            "estimated_tokens": round(usd_amount / price["current_price"], 6) if price.get("current_price") else None,
            "signal": analysis.get("analysis", {}).get("signal", "HOLD"),
            "trend": analysis.get("analysis", {}).get("trend", "NEUTRAL"),
            "reasoning": f"{analysis.get('analysis', {}).get('signal', 'HOLD')} signal — RSI: {analysis.get('indicators', {}).get('rsi_14', 'N/A')}, {analysis.get('analysis', {}).get('trend', 'NEUTRAL')} trend",
        })

    # Sort by allocation
    allocations.sort(key=lambda x: x["allocation_pct"], reverse=True)

    # Risk assessment
    if risk_tolerance == "conservative":
        risk_note = "This portfolio emphasizes large-cap stability (BTC/ETH heavy). Lower upside potential but better downside protection."
    elif risk_tolerance == "aggressive":
        risk_note = "This portfolio tilts toward higher-beta assets (SOL/ALTs heavy). Higher upside potential but more volatile."
    else:
        risk_note = "This is a balanced portfolio mixing large-cap stability with mid-cap growth potential."

    return {
        "total_investment": amount,
        "risk_tolerance": risk_tolerance,
        "allocations": allocations,
        "risk_assessment": risk_note,
        "rebalance_suggestion": "Review and rebalance monthly or when any position drifts >10% from target.",
        "disclaimer": "This is algorithmic analysis for educational purposes, not financial advice. Always do your own research (DYOR).",
        "source": "CoinGecko + Technical Analysis",
    }
