#!/usr/bin/env ts-node
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { loadWallet, getRPC, getProgram, getProgramId } from './utils';

async function main() {
    const connection = new Connection(getRPC(), 'confirmed');
    const payer = loadWallet();
    const provider = new AnchorProvider(connection, new Wallet(payer), {});

    console.log('=== Initialize RUSH Rewards ===\n');

    const program = await getProgram(connection, payer);

    // Get RUSH mint from env
    const rushMintStr = process.env.NEXT_PUBLIC_RUSH_MINT;
    if (!rushMintStr) {
        throw new Error('NEXT_PUBLIC_RUSH_MINT not found in environment');
    }
    const rushMint = new PublicKey(rushMintStr);

    console.log(`RUSH Mint: ${rushMint.toBase58()}`);
    console.log(`Authority: ${payer.publicKey.toBase58()}`);

    try {
        // Call initialize_rush_token
        // Reward rate: 10 tokens per second (adjust decimals)
        const rewardRate = new BN(10 * 1_000_000);

        const tx = await program.methods
            .initializeRushToken(
                rushMint,
                rewardRate
            )
            .accounts({
                authority: payer.publicKey,
                rushMint: rushMint,
                // Add other required accounts if needed based on IDL
            })
            .rpc();

        console.log(`\n✓ RUSH initialized: ${tx}`);
        console.log(`✓ Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    } catch (err: any) {
        console.error('\n❌ Error initializing RUSH:', err.message);
        if (err.logs) {
            console.log('Logs:', err.logs);
        }
    }
}

main().catch(console.error);
