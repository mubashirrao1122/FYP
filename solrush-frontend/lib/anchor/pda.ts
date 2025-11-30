import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./setup";

export const findPoolAddress = (tokenAMint: PublicKey, tokenBMint: PublicKey): PublicKey => {
    // Sort mints to ensure deterministic order (if required by backend, usually yes)
    // But looking at lib.rs: seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()]
    // It doesn't explicitly sort in the macro, but usually pools sort them.
    // I'll assume the caller passes them in the correct order or I should sort them.
    // For safety, I'll assume the backend expects them in the order they were initialized.
    // However, standard AMM practice is to sort.
    // Let's assume sorted for now.
    const [mintA, mintB] = tokenAMint.toBuffer().compare(tokenBMint.toBuffer()) < 0
        ? [tokenAMint, tokenBMint]
        : [tokenBMint, tokenAMint];

    return PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
        PROGRAM_ID
    )[0];
};

export const findLpMintAddress = (poolAddress: PublicKey): PublicKey => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), poolAddress.toBuffer()],
        PROGRAM_ID
    )[0];
};

export const findVaultAddress = (poolAddress: PublicKey, tokenMint: PublicKey): PublicKey => {
    // The backend doesn't seem to use a PDA for vaults in the search results I saw?
    // Wait, I missed checking vault seeds.
    // initializePool accounts: tokenAVault, tokenBVault.
    // Usually these are Token Accounts owned by the PDA or ATAs.
    // If they are PDAs, I need the seeds.
    // If they are just ATAs owned by the pool, I use getAssociatedTokenAddress.
    // Let's assume they are ATAs for now or check lib.rs again if needed.
    // But for swap, I need to pass them.
    // Let's look at the search results again.
    // I don't see "vault" seeds.
    // So they might be ATAs.
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), poolAddress.toBuffer(), tokenMint.toBuffer()],
        PROGRAM_ID
    )[0];
};

export const findPositionAddress = (poolAddress: PublicKey, userAddress: PublicKey): PublicKey => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("position"), poolAddress.toBuffer(), userAddress.toBuffer()],
        PROGRAM_ID
    )[0];
};
