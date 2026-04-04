import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppWalletProvider } from '@/components/providers/AppWalletProvider';
import { GlobalStoreProvider } from '@/components/providers/GlobalStoreProvider';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Toaster } from 'sonner';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground transition-colors duration-200`}
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
