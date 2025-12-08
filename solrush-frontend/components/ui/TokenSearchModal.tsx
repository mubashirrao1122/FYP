'use client';

import React, { useState, useCallback } from 'react';
import { Search, X, Plus, ExternalLink, CheckCircle } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useTokens, Token } from '@/lib/hooks/useTokens';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { SolIcon, UsdcIcon, UsdtIcon, RushIcon } from '@/components/icons/TokenIcons';

interface TokenSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: Token) => void;
    excludeTokens?: string[];
}

/**
 * Token Search Modal Component
 * Allows searching tokens by symbol, name, or mint address
 * Supports adding custom tokens by mint address
 */
export function TokenSearchModal({
    isOpen,
    onClose,
    onSelect,
    excludeTokens = [],
}: TokenSearchModalProps) {
    const {
        tokens,
        searchTokens,
        addCustomToken,
        isValidMintAddress,
        loading,
        error,
    } = useTokens();

    const [searchQuery, setSearchQuery] = useState('');
    const [isAddingToken, setIsAddingToken] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Filter tokens based on search and exclusions
    const filteredTokens = searchTokens(searchQuery).filter(
        (token) => !excludeTokens.includes(token.symbol)
    );

    // Check if search query looks like a mint address
    const isSearchMintAddress = searchQuery.length > 30 && isValidMintAddress(searchQuery);
    const mintNotFound = isSearchMintAddress && filteredTokens.length === 0;

    /**
     * Handle adding a custom token by mint
     */
    const handleAddCustomToken = useCallback(async () => {
        if (!isValidMintAddress(searchQuery)) {
            setAddError('Invalid mint address');
            return;
        }

        setIsAddingToken(true);
        setAddError(null);

        try {
            const token = await addCustomToken(searchQuery);
            if (token) {
                onSelect(token);
                onClose();
                setSearchQuery('');
            } else {
                setAddError('Failed to fetch token info');
            }
        } catch (err: any) {
            setAddError(err.message || 'Failed to add token');
        } finally {
            setIsAddingToken(false);
        }
    }, [searchQuery, addCustomToken, isValidMintAddress, onSelect, onClose]);

    /**
     * Handle token selection
     */
    const handleSelectToken = useCallback((token: Token) => {
        onSelect(token);
        onClose();
        setSearchQuery('');
    }, [onSelect, onClose]);

    /**
     * Get icon for token
     */
    const getTokenIcon = (symbol: string): React.ReactNode => {
        switch (symbol.toUpperCase()) {
            case 'SOL':
                return <SolIcon className="w-8 h-8" />;
            case 'USDC':
                return <UsdcIcon className="w-8 h-8" />;
            case 'USDT':
                return <UsdtIcon className="w-8 h-8" />;
            case 'RUSH':
                return <RushIcon className="w-8 h-8" />;
            default:
                return (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                        {symbol.charAt(0)}
                    </div>
                );
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#0a0a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h2 className="text-lg font-bold text-white">Select Token</h2>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="p-4 border-b border-white/10">
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10 focus-within:border-purple-500/50 transition-colors">
                            <Search className="h-4 w-4 text-white/50" />
                            <input
                                type="text"
                                placeholder="Search by name, symbol, or paste mint address..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setAddError(null);
                                }}
                                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="p-1 hover:bg-white/10 rounded"
                                >
                                    <X className="w-3 h-3 text-white/50" />
                                </button>
                            )}
                        </div>

                        {/* Add Custom Token Option */}
                        {mintNotFound && (
                            <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white">Token not in list</p>
                                        <p className="text-xs text-white/50">
                                            Add by mint address
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleAddCustomToken}
                                        disabled={isAddingToken}
                                        className="bg-purple-600 hover:bg-purple-700"
                                    >
                                        {isAddingToken ? (
                                            'Adding...'
                                        ) : (
                                            <>
                                                <Plus className="w-3 h-3 mr-1" />
                                                Add Token
                                            </>
                                        )}
                                    </Button>
                                </div>
                                {addError && (
                                    <p className="mt-2 text-xs text-red-400">{addError}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Token List */}
                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
                                <p className="text-white/50 text-sm">Loading tokens...</p>
                            </div>
                        ) : filteredTokens.length > 0 ? (
                            filteredTokens.map((token) => (
                                <button
                                    key={token.mint}
                                    onClick={() => handleSelectToken(token)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                >
                                    <div className="flex-shrink-0">
                                        {getTokenIcon(token.symbol)}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white">
                                                {token.symbol}
                                            </span>
                                            {token.verified && (
                                                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                            )}
                                        </div>
                                        <span className="text-xs text-white/50">{token.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <a
                                            href={`https://explorer.solana.com/address/${token.mint}?cluster=devnet`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs text-white/30 hover:text-purple-400 flex items-center gap-1"
                                        >
                                            <span className="hidden sm:inline">
                                                {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                                            </span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-white/50 text-sm">
                                    {searchQuery
                                        ? 'No tokens found. Try pasting a mint address.'
                                        : 'No tokens available'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-white/10 bg-white/5">
                        <p className="text-xs text-white/40 text-center">
                            Can't find a token? Paste the mint address above to add it.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
