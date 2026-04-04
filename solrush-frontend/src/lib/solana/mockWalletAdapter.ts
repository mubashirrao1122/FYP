'use client';

import { BaseWalletAdapter, WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { PublicKey, Transaction } from '@solana/web3.js';

export class MockWalletAdapter extends BaseWalletAdapter {
  name = 'Mock Wallet' as WalletName<'Mock Wallet'>;
  url = 'https://example.com';
  icon = '';
  readyState = WalletReadyState.Installed;
  publicKey: PublicKey | null = null;
  connecting = false;
  supportedTransactionVersions: ReadonlySet<any> | null = null;

  get connected(): boolean {
    return this.publicKey !== null;
  }

  constructor(publicKey?: string) {
    super();
    this.publicKey = new PublicKey(publicKey ?? '7s7tqF6f4q9sfLQF7m4hJ5uNDN4iKQk1Qfq5L8Me3M8G');
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.publicKey = new PublicKey('7s7tqF6f4q9sfLQF7m4hJ5uNDN4iKQk1Qfq5L8Me3M8G');
    this.emit('connect', this.publicKey!);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.publicKey = null;
    this.emit('disconnect');
  }

  async sendTransaction(): Promise<string> {
    throw new Error('Mock wallet does not support sendTransaction');
  }

  async signTransaction(): Promise<Transaction> {
    throw new Error('Mock wallet does not support signing');
  }

  async signAllTransactions(): Promise<Transaction[]> {
    throw new Error('Mock wallet does not support signing');
  }
}
