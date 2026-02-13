/**
 * Robust Solana / Anchor error parser.
 *
 * Maps raw error codes / messages to user-friendly strings so the UI
 * never shows a raw hex dump or "Transaction simulation failed".
 */

// ── Anchor program error codes from errors/mod.rs ──────────────────
// Custom errors start at 6000 in Anchor v0.30+
const PROGRAM_ERRORS: Record<number, string> = {
  6000: 'Initial deposit must be greater than zero.',
  6001: 'Insufficient liquidity in the pool.',
  6002: 'Invalid fee parameters.',
  6003: 'Insufficient pool reserves.',
  6004: 'Calculation overflow — try a smaller amount.',
  6005: 'Pool ratio imbalance exceeds tolerance.',
  6006: 'Insufficient LP token balance.',
  6007: 'Amount must be greater than zero.',
  6008: 'Slippage tolerance exceeded — adjust slippage and retry.',
  6009: 'Pool is not empty.',
  6010: 'Insufficient token balance.',
  6011: 'Limit order not found.',
  6012: 'Invalid order status for this operation.',
  6013: 'Limit order has expired.',
  6014: 'Only the order owner can cancel.',
  6015: 'Price condition not met for execution.',
  6016: 'Invalid expiry time.',
  6017: 'Invalid authority — must be configured authority.',
  6018: 'RUSH rewards are currently paused.',
  6019: 'Invalid APY configuration.',
  6020: 'RUSH token supply exhausted.',
  6021: 'Transaction deadline exceeded — please retry.',
  6022: 'Invalid vault — must be pool\'s token vault.',
  6023: 'Invalid pool — order does not belong to this pool.',
  6024: 'Invalid LP mint — must be pool\'s LP token mint.',
  6025: 'Perps trading is currently paused.',
  6026: 'Unauthorized admin.',
  6027: 'Invalid leverage.',
  6028: 'Insufficient collateral — deposit more USDC first.',
  6029: 'Position already open for this market.',
  6030: 'No open position.',
  6031: 'Order type not supported.',
  6032: 'Oracle price unavailable — try again shortly.',
  6033: 'Maintenance margin violation.',
};

// ── Well-known Solana runtime errors ───────────────────────────────
const RUNTIME_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /AccountNotFound/i,
    message: 'Account not found on-chain. You may need to initialize your account first.',
  },
  {
    pattern: /ConstraintSeeds/i,
    message: 'PDA seed mismatch — the derived account address is incorrect.',
  },
  {
    pattern: /ConstraintHasOne/i,
    message: 'Account ownership constraint failed.',
  },
  {
    pattern: /ConstraintRaw/i,
    message: 'Account constraint check failed.',
  },
  {
    pattern: /InsufficientFunds/i,
    message: 'Insufficient SOL for transaction fees. Please add SOL to your wallet.',
  },
  {
    pattern: /Insufficient funds/i,
    message: 'Insufficient SOL for transaction fees. Please add SOL to your wallet.',
  },
  {
    pattern: /0x1$/,
    message: 'Insufficient funds for this transaction.',
  },
  {
    pattern: /custom program error: 0x0/i,
    message: 'The instruction returned an error. Please check your inputs.',
  },
  {
    pattern: /Transaction simulation failed/i,
    message: 'Transaction simulation failed — check your inputs and try again.',
  },
  {
    pattern: /Blockhash not found/i,
    message: 'Network congestion — please retry.',
  },
  {
    pattern: /block height exceeded/i,
    message: 'Transaction expired — please retry.',
  },
  {
    pattern: /User rejected/i,
    message: 'Transaction was rejected in your wallet.',
  },
  {
    pattern: /WalletSignTransactionError/i,
    message: 'Wallet signature was cancelled.',
  },
  {
    pattern: /WalletNotConnectedError/i,
    message: 'Please connect your wallet first.',
  },
  {
    pattern: /AccountOwnedByWrongProgram/i,
    message: 'Account is owned by a different program.',
  },
  {
    pattern: /already in use/i,
    message: 'Account already exists.',
  },
  {
    pattern: /TokenAccountNotFoundError/i,
    message: 'Token account not found — it will be created automatically.',
  },
];

/**
 * Extract an Anchor custom error code from a raw error message.
 * Anchor embeds "custom program error: 0xHEX" in simulation logs.
 */
function extractAnchorCode(raw: string): number | null {
  // Matches: "custom program error: 0x1770"
  const hex = raw.match(/custom program error:\s*0x([0-9a-fA-F]+)/);
  if (hex) return parseInt(hex[1], 16);

  // Matches: "Error Code: InvalidAmount. Error Number: 6007"
  const decimal = raw.match(/Error Number:\s*(\d+)/);
  if (decimal) return parseInt(decimal[1], 10);

  return null;
}

/**
 * Parse any error thrown during a Solana transaction into a
 * human-readable message suitable for UI display.
 */
export function parseSolanaError(error: unknown): string {
  if (!error) return 'An unknown error occurred.';

  const raw = error instanceof Error ? error.message : String(error);

  // 1. Try Anchor program error code
  const code = extractAnchorCode(raw);
  if (code !== null && PROGRAM_ERRORS[code]) {
    return PROGRAM_ERRORS[code];
  }

  // 2. Try runtime pattern matching
  for (const { pattern, message } of RUNTIME_PATTERNS) {
    if (pattern.test(raw)) {
      return message;
    }
  }

  // 3. If message is short enough, return as-is (but cleaned up)
  const cleaned = raw
    .replace(/^Error:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= 160) {
    return cleaned;
  }

  // 4. Fallback
  return 'Transaction failed. Please check your inputs and try again.';
}

/**
 * Check if an error indicates the perps user account doesn't exist yet.
 * Used to auto-trigger initialization.
 */
export function isAccountNotInitialized(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    /AccountNotFound/i.test(raw) ||
    /Account does not exist/i.test(raw) ||
    /could not find account/i.test(raw)
  );
}

/**
 * Check if the error means the user rejected in their wallet.
 */
export function isUserRejection(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    /User rejected/i.test(raw) ||
    /WalletSignTransactionError/i.test(raw) ||
    /cancelled/i.test(raw)
  );
}
