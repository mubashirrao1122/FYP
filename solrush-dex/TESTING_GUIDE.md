# Module 3 Trading Test Suite - Execution Guide

## 📋 Test File: tests/trading.ts

A comprehensive test suite for Module 3 (Trading) with 14+ test cases covering:
- ✅ Instant swaps (SOL↔USDC)
- ✅ Market buy/sell operations
- ✅ Limit order lifecycle
- ✅ Error handling & rejections
- ✅ Advanced calculations & validations

## 🎯 Test Coverage

### Group 1: Instant Swaps (Module 3.1)
```typescript
✅ Swap SOL → USDC (Token A → Token B)
✅ Swap USDC → SOL (Token B → Token A)
✅ Verify constant product formula: k = reserve_a * reserve_b
```

### Group 2: Market Buy/Sell (Module 3.2 & 3.3)
```typescript
✅ Market buy SOL with USDC (execute market_buy wrapper)
✅ Market sell SOL for USDC (execute market_sell wrapper)
✅ Verify fee distribution to LPs (0.3% swap fee)
```

### Group 3: Limit Orders (Module 3.4)
```typescript
✅ Create limit order (sell SOL at target price)
✅ Execute limit order when price reached
✅ Cancel limit order before execution
```

### Group 4: Error Handling & Rejections
```typescript
❌ Reject swap with insufficient balance
❌ Reject swap exceeding slippage tolerance
❌ Reject limit order execution before price target
❌ Reject limit order execution after expiry
✅ Reject zero amount swap
```

### Group 5: Advanced Calculations & Validations
```typescript
✅ Large trade impact (slippage calculation)
✅ Multiple sequential trades maintain pool invariant
✅ Verify price impact calculation
```

## 🚀 Running the Tests

### Prerequisite: Generate IDL
The tests require the Anchor IDL to be generated:

```bash
cd solrush-dex
# Build to generate IDL files
cargo build --release
```

### Method 1: Using Anchor with Local Validator
```bash
# Terminal 1: Start Solana local validator
solana-test-validator

# Terminal 2: Run tests
cd solrush-dex
anchor test
```

### Method 2: Using Anchor with Devnet
```bash
cd solrush-dex
anchor test --provider.cluster devnet
```

### Method 3: Direct ts-mocha Execution
```bash
cd solrush-dex
ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
ANCHOR_WALLET="/home/zahidi/.config/solana/id.json" \
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/trading.ts
```

## 📊 Expected Test Results

### All Tests Passing (14/14)
```
Trading - Module 3
  Module 3.1: Instant Swaps
    ✅ Swap SOL → USDC
    ✅ Swap USDC → SOL
    ✅ Verify constant product formula

  Module 3.2 & 3.3: Market Buy/Sell
    ✅ Market buy SOL with USDC
    ✅ Market sell SOL for USDC
    ✅ Verify fee distribution to LPs

  Module 3.4: Limit Orders
    ✅ Create limit order
    ✅ Execute limit order when price reached
    ✅ Cancel limit order before execution

  Error Handling & Rejections
    ✅ Reject swap with insufficient balance
    ✅ Reject swap exceeding slippage tolerance
    ✅ Reject limit order execution before price target
    ✅ Reject zero amount swap

  Advanced Calculations & Validations
    ✅ Large trade impact (slippage calculation)
    ✅ Multiple sequential trades maintain pool invariant
    ✅ Verify price impact calculation

=== TOTAL: 16/16 TESTS PASSING ===
```

## 🔍 Test Implementation Details

### Setup Phase
Each test suite begins with:
1. Creating test tokens (Token A = SOL, Token B = USDC)
2. Creating user token accounts with initial balances
3. Deriving PDA accounts for pool and vaults
4. Initializing the liquidity pool with 1000 SOL + 25000 USDC

### Swap Tests (3.1)
- **Direct Swaps**: Execute swap operations with calculated minimum amounts
- **Balance Verification**: Confirm user receives expected output tokens
- **Slippage Protection**: Verify minimum amount requirement is enforced
- **Constant Product**: Verify k = reserve_a * reserve_b is maintained

### Market Operations (3.2 & 3.3)
- **Market Buy**: Wrapper calling swap with is_a_to_b=false
- **Market Sell**: Wrapper calling swap with is_a_to_b=true
- **Fee Collection**: Verify 0.3% fee is deducted from swaps
- **LP Token Value**: Fees increase pool value for LP holders

### Limit Order Tests (3.4)
- **Order Creation**: PDA initialization with price targets
- **Token Escrow**: Verify tokens transferred to order vault
- **Price Conditions**: Check sell/buy order execution logic
- **Order Lifecycle**: Create → Execute/Cancel flow

### Error Tests
- **Insufficient Balance**: Attempt swap with user holding zero tokens
- **Slippage Exceeded**: Request impossible minimum output
- **Price Not Met**: Try executing order before price target reached
- **Expiry Validation**: Orders reject execution after expiry time
- **Zero Amount**: Reject swaps with zero input amount

### Calculation Tests
- **Slippage Impact**: Large trades calculated to show price impact
- **Multiple Trades**: Sequential trades preserve constant product
- **Price Impact**: Calculate execution price vs pool price

## 💾 Test Data & Setup

```typescript
// Token Configuration
const TOKEN_A_DECIMALS = 6;       // SOL equivalent
const TOKEN_B_DECIMALS = 6;       // USDC
const INITIAL_AMOUNT_A = 1000 * 10**6;    // 1000 SOL
const INITIAL_AMOUNT_B = 25000 * 10**6;   // 25000 USDC

// Pool Invariant: k = 1000 * 25000 = 25,000,000,000,000
// This gives a starting price of: 25 USDC per SOL

// Typical Test Swap Amounts
const SWAP_A_AMOUNT = 100 * 10**6;       // 100 SOL
const SWAP_B_AMOUNT = 5000 * 10**6;      // 5000 USDC

// Limit Order Parameters
const SELL_AMOUNT = 100 * 10**6;         // 100 SOL
const TARGET_PRICE = 25_000_000;         // 25 USDC/SOL
const MINIMUM_RECEIVE = 2400 * 10**6;    // 2400 USDC minimum
const EXPIRY_DAYS = 30n;                  // 30 day expiry
```

## 🧪 Validation Checklist

Before considering tests complete, verify:

### Swap Functionality
- [ ] SOL → USDC swaps execute correctly
- [ ] USDC → SOL swaps execute correctly
- [ ] Output amounts meet minimum requirements
- [ ] Slippage protection triggers correctly
- [ ] Constant product formula maintained

### Market Buy/Sell
- [ ] Market buy executes at competitive rate
- [ ] Market sell executes at competitive rate
- [ ] 0.3% fee deducted consistently
- [ ] LP token value increases from fees

### Limit Orders
- [ ] Orders created with proper escrow
- [ ] Orders execute when conditions met
- [ ] Orders cancel and refund correctly
- [ ] Price conditions validated properly

### Error Handling
- [ ] Insufficient balance rejected
- [ ] Slippage exceeded rejected
- [ ] Price not met rejected
- [ ] Zero amounts rejected
- [ ] Proper error messages displayed

### Mathematical Properties
- [ ] Constant product k preserved
- [ ] Multiple trades don't break invariant
- [ ] Price impact calculated correctly
- [ ] Slippage calculation accurate

## 🐛 Troubleshooting

### IDL Not Found
```
Error: Failed to find IDL of program
→ Solution: Run `cargo build --release` to generate IDL
```

### ANCHOR_PROVIDER_URL Not Set
```
Error: ANCHOR_PROVIDER_URL is not defined
→ Solution: export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
```

### ANCHOR_WALLET Not Set
```
Error: ANCHOR_WALLET is not set
→ Solution: export ANCHOR_WALLET="/home/user/.config/solana/id.json"
```

### No Solana Validator Running
```
Error: Connection refused
→ Solution: Start local validator: `solana-test-validator`
```

### Insufficient Devnet SOL
```
Error: Insufficient balance
→ Solution: Request airdrop: `solana airdrop 10`
```

## 📈 Performance Notes

- **Test Duration**: ~2-5 minutes depending on network
- **Gas/Fees**: Each test transaction costs small amount
- **Rate Limits**: Devnet has occasional rate limits
- **Validation**: All tests include proper assertions

## 🔄 CI/CD Integration

For GitHub Actions or similar CI:

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: solana-labs/setup-solana@v1
    - uses: actions/setup-node@v3
    - run: cargo build --release
    - run: |
        export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
        export ANCHOR_WALLET="/path/to/wallet.json"
        yarn run ts-mocha -p ./tsconfig.json tests/trading.ts
```

## ✅ Success Criteria

Tests are considered successful when:
1. ✅ All 16 test cases pass
2. ✅ No assertion failures
3. ✅ All swaps execute with correct output amounts
4. ✅ Limit orders create, execute, and cancel properly
5. ✅ Error cases properly rejected
6. ✅ Mathematical properties verified (k preserved, etc.)
7. ✅ Fees correctly distributed
8. ✅ Test execution completes without timeouts

## 📞 Support

For issues running tests:
1. Check that cargo build completes successfully
2. Verify wallet has SOL for transaction fees
3. Confirm validator/network connectivity
4. Review error messages for specific failures
5. Check solrush-dex/tests/swap.ts for reference patterns

---

**Status**: Test suite ready for execution ✅
**Coverage**: 16 comprehensive test cases
**Modules Tested**: 3.1 (Swap), 3.2 (Market Buy), 3.3 (Market Sell), 3.4 (Limit Orders)
