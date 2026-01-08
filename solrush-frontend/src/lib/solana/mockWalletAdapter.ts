'use client';

import { BaseWalletAdapter, WalletReadyState } from '@solana/wallet-adapter-base';
import { PublicKey, Transaction } from '@solana/web3.js';

export class MockWalletAdapter extends BaseWalletAdapter {
  name = 'Mock Wallet';
  url = 'https://example.com';
  icon = '';
  readyState = WalletReadyState.Installed;
  publicKey: PublicKey | null;
  connecting = false;
  connected = false;

  constructor(publicKey?: string) {
    super();
    this.publicKey = new PublicKey(publicKey ?? '7s7tqF6f4q9sfLQF7m4hJ5uNDN4iKQk1Qfq5L8Me3M8G');
    this.connected = true;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.emit('connect', this.publicKey);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
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
