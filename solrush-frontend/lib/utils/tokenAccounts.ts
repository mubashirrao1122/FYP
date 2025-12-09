import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount,
} from '@solana/spl-token';

/**
 * Result of ATA check/creation
 */
export interface ATAResult {
    address: PublicKey;
    instruction: TransactionInstruction | null;
    exists: boolean;
}

/**
 * Check if an Associated Token Account exists, and return creation instruction if needed
 * 
 * @param connection - Solana connection
 * @param payer - Account that will pay for ATA creation
 * @param mint - Token mint address
 * @param owner - Owner of the ATA (defaults to payer if not specified)
 * @returns ATA address, creation instruction (if needed), and existence status
 * 
 * @example
 * const result = await getOrCreateATA(connection, wallet.publicKey, usdcMint);
 * if (result.instruction) {
 *   // Add to transaction
 *   transaction.add(result.instruction);
 * }
 * // Use result.address in your instruction
 */
export async function getOrCreateATA(
    connection: Connection,
    payer: PublicKey,
    mint: PublicKey,
    owner?: PublicKey
): Promise<ATAResult> {
    const ownerAddress = owner || payer;

    // Get the ATA address (deterministic derivation)
    const ataAddress = await getAssociatedTokenAddress(
        mint,
        ownerAddress,
        false // allowOwnerOffCurve
    );

    // Check if the account exists on-chain
    try {
        await getAccount(connection, ataAddress);

        // Account exists - no instruction needed
        return {
            address: ataAddress,
            instruction: null,
            exists: true,
        };
    } catch (error) {
        // Account doesn't exist - create instruction
        const instruction = createAssociatedTokenAccountInstruction(
            payer,        // payer
            ataAddress,   // ata address
            ownerAddress, // owner
            mint          // mint
        );

        return {
            address: ataAddress,
            instruction,
            exists: false,
        };
    }
}

/**
 * Create ATA instruction directly (use when you're certain it doesn't exist)
 * 
 * @param payer - Account that will pay for creation
 * @param ata - ATA address
 * @param owner - Owner of the ATA
 * @param mint - Token mint address
 * @returns Transaction instruction to create the ATA
 */
export function createATAInstruction(
    payer: PublicKey,
    ata: PublicKey,
    owner: PublicKey,
    mint: PublicKey
): TransactionInstruction {
    return createAssociatedTokenAccountInstruction(
        payer,
        ata,
        owner,
        mint
    );
}

/**
 * Get or create multiple ATAs in parallel
 * 
 * @param connection - Solana connection
 * @param payer - Account that will pay for ATA creation
 * @param mints - Array of token mint addresses
 * @param owner - Owner of the ATAs (defaults to payer if not specified)
 * @returns Array of ATA results
 * 
 * @example
 * const [inputATA, outputATA] = await getOrCreateMultipleATAs(
 *   connection,
 *   wallet.publicKey,
 *   [solMint, usdcMint]
 * );
 */
export async function getOrCreateMultipleATAs(
    connection: Connection,
    payer: PublicKey,
    mints: PublicKey[],
    owner?: PublicKey
): Promise<ATAResult[]> {
    return Promise.all(
        mints.map(mint => getOrCreateATA(connection, payer, mint, owner))
    );
}
