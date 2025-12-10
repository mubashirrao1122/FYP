import { Program, Idl, AnchorProvider, setProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Commitment } from "@solana/web3.js";
import rawIdl from "../solana/idl.json";

// Convert legacy IDL format to work with anchor
const idl = {
    ...rawIdl,
    metadata: {
        address: process.env.NEXT_PUBLIC_PROGRAM_ID || "FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1"
    }
} as unknown as Idl;

// Define the program ID - should match Anchor.toml
export const PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID || "FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1"
);

// Network configuration - defaults to localnet
export const NETWORK = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899";

// Commitment level for transactions
export const COMMITMENT: Commitment = "confirmed";

// Provider options
export const PROVIDER_OPTIONS = {
    preflightCommitment: COMMITMENT,
    commitment: COMMITMENT,
};

/**
 * Create Anchor Provider from wallet and connection
 */
export const getProvider = (connection: Connection, wallet: any): AnchorProvider => {
    const provider = new AnchorProvider(
        connection,
        wallet,
        PROVIDER_OPTIONS
    );
    setProvider(provider);
    return provider;
};

/**
 * Get Anchor Program instance
 */
export const getProgram = (connection: Connection, wallet: any): Program | null => {
    try {
        const provider = getProvider(connection, wallet);
        return new Program(idl, provider);
    } catch (error) {
        console.error("Failed to create program:", error);
        return null;
    }
};

/**
 * Get Program without wallet (read-only operations)
 */
export const getReadOnlyProgram = (connection: Connection): Program | null => {
    try {
        // Create a dummy wallet for read-only operations
        const readOnlyWallet = {
            publicKey: PublicKey.default,
            signTransaction: async () => { throw new Error("Read-only"); },
            signAllTransactions: async () => { throw new Error("Read-only"); },
        };
        const provider = new AnchorProvider(connection, readOnlyWallet as any, PROVIDER_OPTIONS);
        return new Program(idl, provider);
    } catch (error) {
        console.error("Failed to create read-only program:", error);
        return null;
    }
};

/**
 * Convert number to BN with decimals
 */
export const toBN = (amount: number, decimals: number = 9): BN => {
    return new BN(Math.floor(amount * Math.pow(10, decimals)));
};

/**
 * Convert BN to number with decimals
 */
export const fromBN = (amount: BN, decimals: number = 9): number => {
    return amount.toNumber() / Math.pow(10, decimals);
};

export { BN };
