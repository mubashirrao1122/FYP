import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Load wallet keypair from Solana CLI default location
 */
export const loadWallet = (): Keypair => {
    const keypairPath = path.join(process.env.HOME || '', '.config', 'solana', 'id.json');

    if (!fs.existsSync(keypairPath)) {
        throw new Error(
            `Wallet not found at ${keypairPath}. ` +
            'Create one with: solana-keygen new'
        );
    }

    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
};

/**
 * Get RPC endpoint from environment or use default devnet
 */
export const getRPC = (): string => {
    return process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
};

/**
 * Get token mint address from environment
 */
export const getTokenMint = (symbol: string): PublicKey => {
    const envKey = `NEXT_PUBLIC_${symbol.toUpperCase()}_MINT`;
    const mint = process.env[envKey];

    if (!mint) {
        throw new Error(
            `${envKey} not found in .env.local. ` +
            'Run: npm run setup:devnet'
        );
    }

    return new PublicKey(mint);
};

/**
 * Get program ID from environment
 */
export const getProgramId = (): PublicKey => {
    const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;

    if (!programId) {
        throw new Error('NEXT_PUBLIC_PROGRAM_ID not found in environment');
    }

    return new PublicKey(programId);
};

/**
 * Load IDL and create program instance
 */
export const getProgram = async (
    connection: Connection,
    wallet: Keypair
): Promise<Program> => {
    const provider = new AnchorProvider(
        connection,
        new Wallet(wallet),
        { commitment: 'confirmed' }
    );

    // Load IDL
    const idlPath = path.join(process.cwd(), 'lib', 'solana', 'idl.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    const programId = getProgramId();

    return new Program(idl, programId, provider);
};

/**
 * Format number with commas for display
 */
export const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
