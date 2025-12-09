import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppWalletProvider } from '@/components/providers/AppWalletProvider';
import { GlobalStoreProvider } from '@/components/providers/GlobalStoreProvider';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Toaster } from 'sonner';

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
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'SolRush DEX',
    description: 'Decentralized Exchange on Solana',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: 'SolRush DEX Logo',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <AppWalletProvider>
          <GlobalStoreProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <Toaster position="bottom-right" theme="dark" />
          </GlobalStoreProvider>
        </AppWalletProvider>
      </body>
    </html>
  );
}
