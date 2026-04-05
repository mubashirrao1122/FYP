from langchain_core.tools import tool

PLATFORM_GUIDE = """
**SolRush Platform Guide & Instructions:**

**1. Connecting a Wallet:**
- Click the 'Connect Wallet' button located in the top right corner of the navigation bar.
- A popup will appear. Select a Solana-compatible wallet from the list (such as Phantom or Solflare).
- Your wallet extension will prompt you to approve the connection. Click 'Approve' or 'Connect'.
- Once connected, your wallet address and balance will be visible.

**2. How to Swap Tokens:**
- Go to the primary 'Swap' or 'Trade' interface.
- In the top input box (You Pay), select the token you want to sell and enter the amount.
- In the bottom input box (You Receive), select the token you want to buy. The estimated amount will auto-calculate.
- Verify the routing, slippage tolerance (adjustable in settings), and network fees.
- Click the 'Swap' button and sign the secure transaction popup in your wallet.

**3. Creating a Perpetual Trade (Long/Short):**
- Switch to the 'Perpetuals' interface to access leveraged trading.
- Select your target market (e.g., SOL/USD).
- Choose 'Long' if you expect the price to go up, or 'Short' if you expect it to go down.
- Enter your initial collateral amount (margin).
- Use the slider to select your leverage multiplier (up to 50x available). Be aware of the risk!
- The system will calculate your entry price, liquidation price, and fees.
- Click 'Open Position' and approve the transaction.

**4. Creating/Adding to a Liquidity Pool:**
- Navigate to the 'Pools' or 'Liquidity' tab.
- Click 'Add Liquidity' or select a specific token pair that you wish to provide.
- Deposit an equivalent value of both tokens (e.g., $100 of SOL and $100 of USDC).
- Review the pool parameters, including your projected share of the pool and expected fee yields.
- Click 'Supply' and sign the transaction. You will earn fees from swaps passing through your pool.

**5. Checking Your Portfolio:**
- Navigate to the 'Portfolio' page from the main menu.
- Here you can view a comprehensive breakdown of your connected wallet's assets.
- The dashboard displays your spot token balances, active perpetual positions (including PnL), and your provided liquidity.
- You can manage (close/adjust) your active positions directly from this screen.
"""

@tool
def get_solrush_platform_help() -> str:
    """Provides step-by-step instructions on how to use the SolRush platform features, including connecting wallets, swapping tokens, perpetual trading, liquidity pools, and portfolio tracking. Call this when users ask "how to" questions about the DEX."""
    return PLATFORM_GUIDE
