import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./setup";

// ─────────────────────────────────────────────
// AMM / Pool PDAs
// ─────────────────────────────────────────────

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
 * Find User Position PDA address (LP position)
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

// ─────────────────────────────────────────────
// Perps PDAs
// Seeds mirror Anchor #[account(seeds = ...)] in
// programs/solrush-dex/src/instructions/perps.rs
// ─────────────────────────────────────────────

/**
 * Perps global singleton PDA
 * Seeds: ["perps_global"]
 */
export const findPerpsGlobalAddress = (programId: PublicKey = PROGRAM_ID): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("perps_global")],
        programId
    );
};

/**
 * Perps market PDA
 * Seeds: ["perps_market", base_mint, quote_mint]
 */
export const findPerpsMarketAddress = (
    baseMint: PublicKey,
    quoteMint: PublicKey,
    programId: PublicKey = PROGRAM_ID
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("perps_market"), baseMint.toBuffer(), quoteMint.toBuffer()],
        programId
    );
};

/**
 * Perps oracle price PDA (mock / manual oracle)
 * Seeds: ["perps_oracle", admin]
 */
export const findPerpsOracleAddress = (
    admin: PublicKey,
    programId: PublicKey = PROGRAM_ID
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("perps_oracle"), admin.toBuffer()],
        programId
    );
};

/**
 * Per-user perps account PDA
 * Seeds: ["perps_user", owner]
 */
export const findPerpsUserAddress = (
    owner: PublicKey,
    programId: PublicKey = PROGRAM_ID
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("perps_user"), owner.toBuffer()],
        programId
    );
};

/**
 * Per-user per-market perps position PDA
 * Seeds: ["perps_position", owner, market]
 */
export const findPerpsPositionAddress = (
    owner: PublicKey,
    market: PublicKey,
    programId: PublicKey = PROGRAM_ID
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("perps_position"), owner.toBuffer(), market.toBuffer()],
        programId
    );
};

// ─────────────────────────────────────────────
// Convenience helpers (address only, no bump)
// ─────────────────────────────────────────────

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

export const getPerpsGlobalAddress = (programId?: PublicKey): PublicKey => {
    return findPerpsGlobalAddress(programId)[0];
};

export const getPerpsMarketAddress = (baseMint: PublicKey, quoteMint: PublicKey, programId?: PublicKey): PublicKey => {
    return findPerpsMarketAddress(baseMint, quoteMint, programId)[0];
};

export const getPerpsOracleAddress = (admin: PublicKey, programId?: PublicKey): PublicKey => {
    return findPerpsOracleAddress(admin, programId)[0];
};

export const getPerpsUserAddress = (owner: PublicKey, programId?: PublicKey): PublicKey => {
    return findPerpsUserAddress(owner, programId)[0];
};

export const getPerpsPositionAddress = (owner: PublicKey, market: PublicKey, programId?: PublicKey): PublicKey => {
    return findPerpsPositionAddress(owner, market, programId)[0];
};
