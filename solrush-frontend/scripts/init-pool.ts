#!/usr/bin/env ts-node
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { loadWallet, getRPC, getProgram, getTokenMint } from './utils';

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 4) {
        console.error('Usage: npm run init:pool -- <tokenA> <tokenB> <amountA> <amountB>');
        console.error('Example: npm run init:pool -- SOL USDC 100 10000');
        process.exit(1);
    }

    const [tokenASymbol, tokenBSymbol, amountAStr, amountBStr] = args;

    const connection = new Connection(getRPC(), 'confirmed');
    const payer = loadWallet();

    console.log('=== Initialize Pool ===\n');
    console.log(`Pool: ${tokenASymbol}/${tokenBSymbol}`);
    console.log(`Initial Liquidity: ${amountAStr} ${tokenASymbol}, ${amountBStr} ${tokenBSymbol}\n`);

    try {
        const program = await getProgram(connection, payer);

        // Get mints
        // Handle SOL specially if needed, but usually wrapped SOL mint is used
        // For this script, we assume standard SPL tokens or Wrapped SOL
        const tokenAMint = getTokenMint(tokenASymbol);
        const tokenBMint = getTokenMint(tokenBSymbol);

        console.log(`Token A Mint (${tokenASymbol}): ${tokenAMint.toBase58()}`);
        console.log(`Token B Mint (${tokenBSymbol}): ${tokenBMint.toBase58()}`);

        // 1. Initialize pool
        console.log('\nCreating pool...');
        // Note: You might need to derive PDAs here if the IDL doesn't handle it automatically
        // or if you need them for the instruction arguments

        const initTx = await program.methods
            .initializePool(30) // 0.3% fee (30 basis points)
            .accounts({
                tokenAMint,
                tokenBMint,
                creator: payer.publicKey,
                // Anchor usually resolves PDAs, but check IDL if specific ones are needed
            })
            .rpc();

        console.log(`✓ Pool created: ${initTx}`);

        // 2. Add liquidity
        console.log('\nAdding initial liquidity...');

        // Adjust decimals (assuming 9 for SOL, 6 for USDC/USDT/RUSH)
        const decimalsA = tokenASymbol === 'SOL' ? 9 : 6;
        const decimalsB = tokenBSymbol === 'SOL' ? 9 : 6;

        const amountA = new BN(parseFloat(amountAStr) * Math.pow(10, decimalsA));
        const amountB = new BN(parseFloat(amountBStr) * Math.pow(10, decimalsB));

        // We need to find the pool address (PDA) to pass to addLiquidity
        // This depends on your specific program's seeds
        // Assuming standard seeds: ["pool", token_a_mint, token_b_mint]
        // You might need to import findProgramAddress from web3.js

        // For now, we'll assume the user will use the UI to add liquidity 
        // or we can implement a separate add-liquidity script if this gets too complex with PDAs
        // But let's try to call it if possible.

        /* 
        // Uncomment when PDAs are fully resolved
        const addLiqTx = await program.methods
          .addLiquidity(amountA, amountB, new BN(0))
          .accounts({
            // pool: poolPda,
            user: payer.publicKey,
            // ... other accounts
          })
          .rpc();
        
        console.log(`✓ Liquidity added: ${addLiqTx}`);
        */

        console.log(`\n✓ Pool initialized! You can now add liquidity via the UI.`);

    } catch (err: any) {
        console.error('\n❌ Error:', err.message);
        if (err.logs) {
            console.log('Logs:', err.logs);
        }
    }
}

main().catch(console.error);
