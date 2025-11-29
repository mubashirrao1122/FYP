'use client';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { useMemo } from 'react';
import { DEVNET_RPC } from '@/lib/solana/constants';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SolRush DEX - Decentralized Exchange on Solana',
  description: 'Trade, provide liquidity, and earn RUSH rewards on Solana',
  keywords: ['Solana', 'DEX', 'Trading', 'Liquidity', 'Rewards'],
  openGraph: {
    title: 'SolRush DEX',
    description: 'Decentralized Exchange on Solana',
    type: 'website',
  },
};

/**
 * Module 5.1 & 5.2: Root Layout with Wallet Integration
 * 
 * This is the root layout component that wraps the entire application
 * with Solana wallet context and providers.
 * 
 * Features:
 * - ConnectionProvider for Solana blockchain connection
 * - WalletProvider for Phantom and Solflare wallets
 * - WalletModalProvider for wallet selection UI
 * - Auto-connect to previously connected wallet
 * - Tailwind CSS dark mode styling
 * - Global fonts and styling
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = DEVNET_RPC;

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              {children}
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
