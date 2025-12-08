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
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTokens();
    }, []);

    return { tokens, loading, error };
};
