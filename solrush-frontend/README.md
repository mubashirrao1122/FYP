# SolRush DEX Frontend

## Devnet Setup

### Prerequisites
- Solana CLI installed
- Devnet wallet with SOL (`solana airdrop 2`)

### Quick Start

1. **Setup devnet environment**:
   ```bash
   npm run setup:devnet
   ```
   This creates mock tokens and mints test tokens to your wallet.

2. **Initialize RUSH rewards**:
   ```bash
   npm run init:rush
   ```

3. **Create initial pool**:
   ```bash
   npm run init:pool -- SOL USDC 100 10000
   ```
   Creates SOL/USDC pool with 100 SOL and 10,000 USDC

4. **Start the app**:
   ```bash
   npm run dev
   ```

### Manual Pool Creation

```bash
npm run init:pool -- <TOKEN_A> <TOKEN_B> <AMOUNT_A> <AMOUNT_B>
```

Examples:
- `npm run init:pool -- SOL USDC 100 10000`
- `npm run init:pool -- SOL USDT 50 5000`
- `npm run init:pool -- USDC USDT 10000 10000`
