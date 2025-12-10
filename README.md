# SolRush DEX - Decentralized Exchange on Solana

SolRush DEX is a full-featured decentralized exchange (DEX) built on Solana with automatic market maker (AMM) functionality, limit orders, and RUSH token rewards.

## 🌟 Features

- **Liquidity Pools**: Create and manage AMM pools with any token pair
- **Token Swaps**: Instant token swaps with slippage protection
- **Market Orders**: Buy and sell tokens at market price
- **Limit Orders**: Place orders that execute at your target price
- **RUSH Rewards**: Earn RUSH tokens for providing liquidity
- **Real-time Data**: Live price updates and pool statistics

## 📋 Prerequisites

Before running the project, ensure you have the following installed:

- **Solana CLI** (v1.18 or later) - [Installation Guide](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor** (v0.31 or later) - [Installation Guide](https://www.anchor-lang.com/docs/installation)
- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **npm** or **yarn**
- **Rust** (latest stable) - [Installation Guide](https://rustup.rs/)

### Verify Installation

```bash
solana --version          # Should show 1.18+
anchor --version          # Should show 0.31+
node --version            # Should show 18+
cargo --version           # Should show Rust compiler
```

## 🚀 Quick Start (Localnet)

### Step 1: Clone the Repository

```bash
git clone https://github.com/mubashirrao1122/FYP.git
cd FYP
```

### Step 2: Start Local Validator

Open a terminal and start the Solana local validator:

```bash
solana-test-validator
```

Keep this terminal open. The validator runs at `http://127.0.0.1:8899`.

### Step 3: Configure Solana CLI

```bash
solana config set --url http://127.0.0.1:8899
```

### Step 4: Build and Deploy Smart Contract

```bash
cd solrush-dex
npm install
anchor build
anchor deploy --provider.cluster localnet
```

**Note**: If the Program ID changes after deployment, update it in:
- `Anchor.toml`
- `programs/solrush-dex/src/lib.rs`
- `../solrush-frontend/.env.local`

### Step 5: Setup Tokens and Fund Wallet

This script creates token mints (USDC, USDT, WETH, RUSH) and funds the target wallet:

```bash
npx ts-node scripts/complete-localnet-setup.ts
```

This will:
- Airdrop SOL to the target wallet
- Create USDC, USDT, WETH, RUSH token mints
- Mint test tokens to the wallet
- Generate `.env.local` for the frontend

### Step 6: Start Frontend

```bash
cd ../solrush-frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 7: Connect Wallet

1. Install [Phantom](https://phantom.app/) or [Solflare](https://solflare.com/) wallet extension
2. Switch network to **Localhost** (Settings → Developer Settings → Change Network → Localhost)
3. Connect your wallet on the web app

## 📁 Project Structure

```
FYP/
├── solrush-dex/              # Anchor smart contract
│   ├── programs/
│   │   └── solrush-dex/
│   │       └── src/
│   │           ├── lib.rs            # Program entry point
│   │           ├── instructions/     # Instruction handlers
│   │           │   ├── pool.rs       # Pool management
│   │           │   ├── swap.rs       # Token swaps
│   │           │   ├── limit_orders.rs # Limit orders
│   │           │   └── rewards.rs    # RUSH rewards
│   │           ├── state/            # Account structures
│   │           └── errors/           # Custom errors
│   ├── scripts/
│   │   ├── complete-localnet-setup.ts  # Full localnet setup
│   │   ├── init-pool.ts              # Initialize pools
│   │   └── mint-tokens.ts            # Mint test tokens
│   └── tests/                        # Integration tests
│
├── solrush-frontend/         # Next.js frontend
│   ├── components/           # React components
│   │   ├── pools/           # Pool management UI
│   │   ├── trading/         # Trading interface
│   │   ├── liquidity/       # Liquidity management
│   │   └── rewards/         # Rewards UI
│   ├── lib/
│   │   ├── anchor/          # Anchor program setup
│   │   ├── hooks/           # React hooks
│   │   └── constants.ts     # Configuration
│   └── src/app/             # Next.js pages
│
└── localnet-config.json     # Generated config file
```

## 🔧 Configuration

### Environment Variables

Create `.env.local` in `solrush-frontend/`:

```bash
NEXT_PUBLIC_NETWORK=localnet
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899
NEXT_PUBLIC_PROGRAM_ID=FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1

# Token Mints (from setup script)
NEXT_PUBLIC_SOL_MINT=<your_sol_mint>
NEXT_PUBLIC_USDC_MINT=<your_usdc_mint>
NEXT_PUBLIC_USDT_MINT=<your_usdt_mint>
NEXT_PUBLIC_WETH_MINT=<your_weth_mint>
NEXT_PUBLIC_RUSH_MINT=<your_rush_mint>
```

### Program ID

Current deployed Program ID: `FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1`

## 💰 Funded Wallet

The setup script funds the following wallet:

**Address**: `8Qmx5CZtR22YRKvjXkCgfMXfg5n9BHMmJmwCAno4cxrf`

| Token | Amount |
|-------|--------|
| SOL   | 1,000 |
| USDC  | 1,000,000 |
| USDT  | 1,000,000 |
| WETH  | 100 |
| RUSH  | 10,000,000 |

## 📖 Usage Guide

### Creating a Pool

1. Go to **Pools** → **Create Pool**
2. Select token pair (e.g., SOL/USDC)
3. Enter initial liquidity amounts
4. Click **Create Pool**

### Adding Liquidity

1. Go to **Pools** → **Add Liquidity**
2. Select the pool
3. Enter deposit amounts
4. Click **Add Liquidity**

### Swapping Tokens

1. Go to **Trade** → **Swap**
2. Select input and output tokens
3. Enter amount
4. Review price impact and slippage
5. Click **Swap**

### Placing Limit Orders

1. Go to **Trade** → **Limit**
2. Enter target price and amount
3. Set expiration
4. Click **Create Order**

### Market Buy/Sell

1. Go to **Trade** → **Buy** or **Sell**
2. Enter amount
3. Click **Buy** or **Sell**

## 🧪 Running Tests

```bash
cd solrush-dex
anchor test --provider.cluster localnet
```

Or run specific test files:

```bash
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/comprehensive-test.ts
```

## 🔍 Useful Commands

### Airdrop SOL to Wallet

```bash
solana airdrop 10 <WALLET_ADDRESS> --url localhost
```

### Check Wallet Balance

```bash
solana balance <WALLET_ADDRESS> --url localhost
```

### Mint Additional Tokens

```bash
cd solrush-dex
npx ts-node scripts/mint-tokens.ts USDC 10000 <WALLET_ADDRESS>
```

### View Program Logs

```bash
solana logs --url localhost
```

## 🛠 Troubleshooting

### "Program not found" Error

1. Check if the validator is running: `solana cluster-version`
2. Verify program deployment: `solana program show <PROGRAM_ID>`
3. Re-deploy if needed: `anchor deploy --provider.cluster localnet`

### "Insufficient Balance" Error

Airdrop more SOL:
```bash
solana airdrop 100 <WALLET_ADDRESS> --url localhost
```

### Frontend Can't Connect

1. Check validator is running
2. Verify wallet is on Localhost network
3. Refresh the page

### Transaction Failed

1. Check the program logs: `solana logs --url localhost`
2. Verify token accounts exist
3. Check for sufficient balance

## 📝 Smart Contract Instructions

| Instruction | Description |
|------------|-------------|
| `initialize_pool` | Create new liquidity pool |
| `add_liquidity` | Deposit tokens to pool |
| `remove_liquidity` | Withdraw tokens from pool |
| `swap` | Exchange tokens |
| `market_buy` | Buy token A with token B |
| `market_sell` | Sell token A for token B |
| `create_limit_order` | Place limit order |
| `execute_limit_order` | Execute pending limit order |
| `cancel_limit_order` | Cancel pending limit order |
| `initialize_rush_token` | Setup RUSH rewards |
| `claim_rush_rewards` | Claim earned rewards |

## 🔐 Security Notes

- This is for educational/development purposes
- Do not use on mainnet without proper security audits
- Test thoroughly before deploying to devnet/mainnet

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Contact

For questions or support, please open an issue on GitHub.
