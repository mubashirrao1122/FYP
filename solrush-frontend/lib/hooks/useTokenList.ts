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
                const response = await fetch('https://token.jup.ag/strict');
                if (!response.ok) {
                    throw new Error('Failed to fetch token list');
                }
                const data = await response.json();
                // Map to our interface and limit if necessary (though strict list is usually manageable)
                // We might want to prioritize common tokens
                setTokens(data);
            } catch (err: any) {
                console.error('Error fetching token list:', err);
                // Fallback to basic tokens for local dev
                setTokens([
                    { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
                    { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
                    { symbol: 'USDT', name: 'Tether USD', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
                ]);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTokens();
    }, []);

    return { tokens, loading, error };
};
