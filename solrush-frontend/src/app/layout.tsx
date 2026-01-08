import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppWalletProvider } from '@/components/providers/AppWalletProvider';
import { GlobalStoreProvider } from '@/components/providers/GlobalStoreProvider';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Toaster } from 'sonner';

const inter = Inter({
  variable: '--font-inter',
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
    <html lang="en" className="transition-colors duration-200">
      <body
        className={`${inter.variable} font-sans antialiased bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0B1220] dark:text-[#E5E7EB] transition-colors duration-200`}
      >
        <AppWalletProvider>
          <GlobalStoreProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <Toaster position="bottom-right" theme="light" />
          </GlobalStoreProvider>
        </AppWalletProvider>
      </body>
    </html>
  );
}
