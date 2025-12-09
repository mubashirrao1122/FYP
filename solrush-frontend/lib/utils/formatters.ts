/**
 * Format currency with USD symbol
 */
export const formatCurrency = (value: number, decimals: number = 2): string => {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * Format percentage
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
};

/**
 * Format token amount
 */
/**
 * Format token amount with proper decimals and optional abbreviation
 */
export function formatTokenAmount(
  amount: number,
  decimals: number = 2,
  abbreviate: boolean = false
): string {
  if (amount === 0) return '0';

  // Abbreviate large numbers
  if (abbreviate) {
    if (amount >= 1e9) {
      return `${(amount / 1e9).toFixed(decimals)}B`;
    }
    if (amount >= 1e6) {
      return `${(amount / 1e6).toFixed(decimals)}M`;
    }
    if (amount >= 1e3) {
      return `${(amount / 1e3).toFixed(decimals)}K`;
    }
  }

  // Very small numbers - use scientific notation
  if (amount < 0.0001 && amount > 0) {
    return amount.toExponential(2);
  }

  // Format with commas and decimals
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format pool reserves for display
 */
export function formatReserves(
  reserveA: number,
  tokenA: string,
  reserveB: number,
  tokenB: string
): string {
  if (reserveA === 0 && reserveB === 0) {
    return 'Empty pool';
  }

  const formattedA = formatTokenAmount(reserveA, 2, true);
  const formattedB = formatTokenAmount(reserveB, 2, true);

  return `${formattedA} ${tokenA} / ${formattedB} ${tokenB}`;
}

/**
 * Truncate address
 */
export const truncateAddress = (
  address: string,
  chars: number = 4
): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Format date
 */
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Format time ago
 */
export const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return formatDate(date);
};
