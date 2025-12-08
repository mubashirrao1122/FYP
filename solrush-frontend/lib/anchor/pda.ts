import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./setup";

/**
 * Find Pool PDA address
 * Seeds: ["pool", token_a_mint, token_b_mint]
 * NOTE: Mints are sorted to ensure deterministic address
 */
export const findPoolAddress = (tokenAMint: PublicKey, tokenBMint: PublicKey): [PublicKey, number] => {
    // Sort mints to ensure deterministic order (smaller first)
    const [mintA, mintB] = tokenAMint.toBuffer().compare(tokenBMint.toBuffer()) < 0
        ? [tokenAMint, tokenBMint]
        : [tokenBMint, tokenAMint];

    return PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
        PROGRAM_ID
    );
};

/**
 * Find LP Token Mint PDA address
 * Seeds: ["lp_mint", pool_address]
 */
export const findLpMintAddress = (poolAddress: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), poolAddress.toBuffer()],
        PROGRAM_ID
    );
};

/**
 * Find User Position PDA address
 * Seeds: ["position", pool_address, user_address]
 */
export const findPositionAddress = (poolAddress: PublicKey, userAddress: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("position"), poolAddress.toBuffer(), userAddress.toBuffer()],
        PROGRAM_ID
    );
};

/**
 * Find RUSH Config PDA address
 * Seeds: ["rush_config"]
 */
export const findRushConfigAddress = (): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("rush_config")],
        PROGRAM_ID
    );
};

/**
 * Find Limit Order PDA address
 * Seeds: ["limit_order", pool_address, user_address, order_id_bytes]
 */
export const findLimitOrderAddress = (
    poolAddress: PublicKey,
    userAddress: PublicKey,
    orderId: number
): [PublicKey, number] => {
    const orderIdBuffer = Buffer.alloc(8);
    orderIdBuffer.writeBigUInt64LE(BigInt(orderId));

    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("limit_order"),
            poolAddress.toBuffer(),
            userAddress.toBuffer(),
            orderIdBuffer,
        ],
        PROGRAM_ID
    );
};

/**
 * Helper to get just the address (without bump)
 */
export const getPoolAddress = (tokenAMint: PublicKey, tokenBMint: PublicKey): PublicKey => {
    return findPoolAddress(tokenAMint, tokenBMint)[0];
};

export const getLpMintAddress = (poolAddress: PublicKey): PublicKey => {
    return findLpMintAddress(poolAddress)[0];
};

export const getPositionAddress = (poolAddress: PublicKey, userAddress: PublicKey): PublicKey => {
    return findPositionAddress(poolAddress, userAddress)[0];
};

export const getRushConfigAddress = (): PublicKey => {
    return findRushConfigAddress()[0];
};

export const getLimitOrderAddress = (
    poolAddress: PublicKey,
    userAddress: PublicKey,
    orderId: number
): PublicKey => {
    return findLimitOrderAddress(poolAddress, userAddress, orderId)[0];
};
