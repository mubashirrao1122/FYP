'use client';

import { FC, ReactNode, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletError } from '@solana/wallet-adapter-base';
import { RPC_ENDPOINT, NETWORK } from '@/lib/solana/constants';
import { MockWalletAdapter } from '@/lib/solana/mockWalletAdapter';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface AppWalletProviderProps {
    children: ReactNode;
}

export const AppWalletProvider: FC<AppWalletProviderProps> = ({ children }) => {
    // FIX: For localnet, skip the WalletAdapterNetwork enum entirely.
    // Passing WalletAdapterNetwork.Devnet causes wallets (Phantom, Solflare) to
    // auto-route RPC calls to remote devnet nodes, defeating the local validator.
    // Instead, rely solely on the explicit RPC URL from the environment.
    const network = NETWORK === 'mainnet'
        ? WalletAdapterNetwork.Mainnet
        : NETWORK === 'localnet'
            ? ('localnet' as any)   // bypass the enum; wallet-adapter won't auto-route
            : WalletAdapterNetwork.Devnet;

    // The ConnectionProvider uses this URL. For localnet this MUST be 127.0.0.1:8899.
    // NEXT_PUBLIC_RPC_URL is now injected by start.sh from localnet-config.json.
    const endpoint = useMemo(() => {
        if (process.env.NEXT_PUBLIC_RPC_URL) {
            return process.env.NEXT_PUBLIC_RPC_URL;
        }
        // Safe fallback: always prefer localnet if NETWORK says so
        if (NETWORK === 'localnet') {
            return 'http://127.0.0.1:8899';
        }
        return 'https://api.devnet.solana.com';
    }, []);

    const enableMockWallet =
        process.env.NEXT_PUBLIC_E2E_WALLET === '1' &&
        typeof window !== 'undefined' &&
        !new URLSearchParams(window.location.search).has('wallet');

    // Initialize wallets
    // We return an empty array here because modern Phantom and Solflare wallets natively implement the Solana Wallet Standard.
    // passing explicit adapters like `new PhantomWalletAdapter()` conflicts with auto-detected standard wallets, breaking connection!
    const wallets = useMemo(() => {
        if (enableMockWallet) {
            return [new MockWalletAdapter() as any];
        }
        return []; 
    }, [enableMockWallet]);

    // Error handler for wallet errors
    const onError = useCallback((error: WalletError) => {
        console.error('[Wallet Error]', error);
        // You can add toast notification here
        // toast.error(error.message);
    }, []);

    return (
        <ConnectionProvider
            endpoint={endpoint}
            config={{ commitment: 'confirmed' }}
        >
            <WalletProvider
                wallets={wallets}
                autoConnect
                onError={onError}
            >
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
