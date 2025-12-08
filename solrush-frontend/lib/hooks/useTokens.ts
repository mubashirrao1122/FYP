'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_DECIMALS, TOKENS, TOKEN_LIST } from '../constants';

export interface Token {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    logoURI?: string;
    verified?: boolean;
    price?: number;
}

// Well-known tokens on Devnet
const DEVNET_TOKENS: Token[] = [
    {
        symbol: 'SOL',
        name: 'Solana',
        mint: 'So11111111111111111111111111111111111111112',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        verified: true,
    },
    {
        symbol: 'USDC',
        name: 'USD Coin (Devnet)',
        mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
        verified: true,
    },
    {
        symbol: 'USDT',
        name: 'Tether USD (Devnet)',
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
        verified: true,
    },
    {
        symbol: 'RAY',
        name: 'Raydium',
        mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
        verified: true,
    },
    {
        symbol: 'BONK',
        name: 'Bonk',
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        decimals: 5,
        logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
        verified: true,
    },
];

// Custom tokens added by user (stored in local storage)
const CUSTOM_TOKENS_KEY = 'solrush_custom_tokens';

/**
 * Custom hook for managing token list
 */
export const useTokens = () => {
    const { connection } = useConnection();
    const [tokens, setTokens] = useState<Token[]>(DEVNET_TOKENS);
    const [customTokens, setCustomTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load custom tokens from local storage
     */
    const loadCustomTokens = useCallback(() => {
        try {
            const stored = localStorage.getItem(CUSTOM_TOKENS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Token[];
                setCustomTokens(parsed);
                setTokens([...DEVNET_TOKENS, ...parsed]);
            }
        } catch (err) {
            console.error('Failed to load custom tokens:', err);
        }
    }, []);

    /**
     * Save custom tokens to local storage
     */
    const saveCustomTokens = useCallback((newCustomTokens: Token[]) => {
        try {
            localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(newCustomTokens));
            setCustomTokens(newCustomTokens);
            setTokens([...DEVNET_TOKENS, ...newCustomTokens]);
        } catch (err) {
            console.error('Failed to save custom tokens:', err);
        }
    }, []);

    /**
     * Fetch token metadata from mint address
     */
    const fetchTokenMetadata = useCallback(async (mintAddress: string): Promise<Token | null> => {
        setLoading(true);
        setError(null);

        try {
            const mint = new PublicKey(mintAddress);
            
            // Fetch mint info to get decimals
            const mintInfo = await connection.getParsedAccountInfo(mint);
            
            if (!mintInfo.value) {
                throw new Error('Token mint not found');
            }

            const parsedData = (mintInfo.value.data as any).parsed;
            if (!parsedData || parsedData.type !== 'mint') {
                throw new Error('Invalid mint account');
            }

            const decimals = parsedData.info.decimals;

            // Check if already in our list
            const existing = tokens.find(t => t.mint === mintAddress);
            if (existing) {
                return existing;
            }

            // Create token info (without metadata - would need Metaplex for full metadata)
            const token: Token = {
                symbol: mintAddress.slice(0, 4).toUpperCase(),
                name: `Token ${mintAddress.slice(0, 8)}...`,
                mint: mintAddress,
                decimals,
                verified: false,
            };

            return token;
        } catch (err: any) {
            console.error('Failed to fetch token metadata:', err);
            setError(err.message || 'Failed to fetch token');
            return null;
        } finally {
            setLoading(false);
        }
    }, [connection, tokens]);

    /**
     * Add a custom token by mint address
     */
    const addCustomToken = useCallback(async (mintAddress: string): Promise<Token | null> => {
        // Check if already exists
        const existing = tokens.find(t => t.mint === mintAddress);
        if (existing) {
            return existing;
        }

        const token = await fetchTokenMetadata(mintAddress);
        if (token) {
            const newCustomTokens = [...customTokens, token];
            saveCustomTokens(newCustomTokens);
            return token;
        }

        return null;
    }, [tokens, customTokens, fetchTokenMetadata, saveCustomTokens]);

    /**
     * Remove a custom token
     */
    const removeCustomToken = useCallback((mintAddress: string) => {
        const newCustomTokens = customTokens.filter(t => t.mint !== mintAddress);
        saveCustomTokens(newCustomTokens);
    }, [customTokens, saveCustomTokens]);

    /**
     * Search tokens by symbol or name
     */
    const searchTokens = useCallback((query: string): Token[] => {
        if (!query) return tokens;
        
        const lowerQuery = query.toLowerCase();
        return tokens.filter(t => 
            t.symbol.toLowerCase().includes(lowerQuery) ||
            t.name.toLowerCase().includes(lowerQuery) ||
            t.mint.toLowerCase().includes(lowerQuery)
        );
    }, [tokens]);

    /**
     * Get token by symbol
     */
    const getTokenBySymbol = useCallback((symbol: string): Token | undefined => {
        return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    }, [tokens]);

    /**
     * Get token by mint address
     */
    const getTokenByMint = useCallback((mintAddress: string): Token | undefined => {
        return tokens.find(t => t.mint === mintAddress);
    }, [tokens]);

    /**
     * Validate if a string is a valid mint address
     */
    const isValidMintAddress = useCallback((address: string): boolean => {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }, []);

    // Load custom tokens on mount
    useEffect(() => {
        loadCustomTokens();
    }, [loadCustomTokens]);

    return {
        tokens,
        customTokens,
        loading,
        error,
        addCustomToken,
        removeCustomToken,
        searchTokens,
        getTokenBySymbol,
        getTokenByMint,
        fetchTokenMetadata,
        isValidMintAddress,
    };
};
