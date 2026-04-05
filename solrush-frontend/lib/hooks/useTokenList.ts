import { useState, useEffect } from 'react';

export interface Token {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    logoURI?: string;
}

export const useTokenList = () => {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTokens = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                const response = await fetch('https://token.jup.ag/strict', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setTokens(data);
            } catch (err: any) {
                console.warn('Could not fetch external token list, using local fallback:', err.message);
                // Fallback to basic tokens for local dev
                setTokens([
                    { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
                    { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
                    { symbol: 'USDT', name: 'Tether USD', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
                ]);
                setError(null); // Don't propagate as a fatal error since we have a fallback
            } finally {
                setLoading(false);
            }
        };

        fetchTokens();
    }, []);

    return { tokens, loading, error };
};
