/**
 * Input validation utilities for forms
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validate amount input
 */
export const validateAmount = (
    amount: string,
    balance: number,
    decimals: number = 9
): ValidationResult => {
    // Empty check
    if (!amount || amount.trim() === '') {
        return { isValid: false, error: 'Please enter an amount' };
    }

    // Number check
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
        return { isValid: false, error: 'Invalid amount' };
    }

    // Positive check
    if (numAmount <= 0) {
        return { isValid: false, error: 'Amount must be greater than 0' };
    }

    // Balance check
    if (numAmount > balance) {
        return { isValid: false, error: 'Insufficient balance' };
    }

    // Decimal precision check
    const decimalPart = amount.split('.')[1];
    if (decimalPart && decimalPart.length > decimals) {
        return { isValid: false, error: `Maximum ${decimals} decimal places allowed` };
    }

    // Minimum amount check (prevent dust)
    const minAmount = Math.pow(10, -decimals);
    if (numAmount < minAmount) {
        return { isValid: false, error: `Minimum amount is ${minAmount}` };
    }

    return { isValid: true };
};

/**
 * Validate slippage input
 */
export const validateSlippage = (slippage: number): ValidationResult => {
    if (isNaN(slippage)) {
        return { isValid: false, error: 'Invalid slippage value' };
    }

    if (slippage < 0) {
        return { isValid: false, error: 'Slippage cannot be negative' };
    }

    if (slippage > 50) {
        return { isValid: false, error: 'Slippage cannot exceed 50%' };
    }

    if (slippage < 0.01) {
        return { isValid: false, error: 'Slippage too low, transaction may fail' };
    }

    return { isValid: true };
};

/**
 * Validate price input for limit orders
 */
export const validatePrice = (price: string): ValidationResult => {
    if (!price || price.trim() === '') {
        return { isValid: false, error: 'Please enter a price' };
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
        return { isValid: false, error: 'Invalid price' };
    }

    if (numPrice <= 0) {
        return { isValid: false, error: 'Price must be greater than 0' };
    }

    return { isValid: true };
};

/**
 * Validate liquidity amounts
 */
export const validateLiquidityAmounts = (
    amountA: string,
    amountB: string,
    balanceA: number,
    balanceB: number,
    decimalsA: number = 9,
    decimalsB: number = 6
): ValidationResult => {
    const validA = validateAmount(amountA, balanceA, decimalsA);
    if (!validA.isValid) {
        return { isValid: false, error: `Token A: ${validA.error}` };
    }

    const validB = validateAmount(amountB, balanceB, decimalsB);
    if (!validB.isValid) {
        return { isValid: false, error: `Token B: ${validB.error}` };
    }

    return { isValid: true };
};

/**
 * Format number input - only allow valid number characters
 */
export const formatNumberInput = (value: string): string => {
    // Remove non-numeric characters except decimal point
    let formatted = value.replace(/[^0-9.]/g, '');
    
    // Only allow one decimal point
    const parts = formatted.split('.');
    if (parts.length > 2) {
        formatted = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Remove leading zeros (except before decimal)
    if (formatted.length > 1 && formatted[0] === '0' && formatted[1] !== '.') {
        formatted = formatted.replace(/^0+/, '');
    }
    
    return formatted;
};

/**
 * Parse and validate number input
 */
export const parseNumberInput = (value: string): number | null => {
    const formatted = formatNumberInput(value);
    const num = parseFloat(formatted);
    return isNaN(num) ? null : num;
};

/**
 * Validate token selection
 */
export const validateTokenSelection = (
    inputToken: string,
    outputToken: string
): ValidationResult => {
    if (!inputToken) {
        return { isValid: false, error: 'Please select input token' };
    }

    if (!outputToken) {
        return { isValid: false, error: 'Please select output token' };
    }

    if (inputToken === outputToken) {
        return { isValid: false, error: 'Input and output tokens must be different' };
    }

    return { isValid: true };
};

/**
 * Comprehensive swap validation
 */
export const validateSwap = (params: {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    balance: number;
    decimals: number;
    slippage: number;
}): ValidationResult => {
    // Token selection
    const tokenValidation = validateTokenSelection(params.inputToken, params.outputToken);
    if (!tokenValidation.isValid) return tokenValidation;

    // Amount
    const amountValidation = validateAmount(params.inputAmount, params.balance, params.decimals);
    if (!amountValidation.isValid) return amountValidation;

    // Slippage
    const slippageValidation = validateSlippage(params.slippage);
    if (!slippageValidation.isValid) return slippageValidation;

    return { isValid: true };
};
