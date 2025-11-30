import { useState, useEffect } from 'react';
import { TOKENS } from '../constants';
import { findPoolAddress } from '../anchor/pda';

export const usePools = () => {
    const [loading, setLoading] = useState(false);

    // Derive pool addresses
    const solUsdcPool = findPoolAddress(TOKENS.SOL, TOKENS.USDC).toBase58();
    const solUsdtPool = findPoolAddress(TOKENS.SOL, TOKENS.USDT).toBase58();
    const usdcUsdtPool = findPoolAddress(TOKENS.USDC, TOKENS.USDT).toBase58();

    // Mock pool data (in production, fetch from blockchain using program.account.liquidityPool.all())
    const pools = [
        {
            id: 'sol-usdc',
            name: 'SOL/USDC',
            tokens: ['SOL', 'USDC'],
            address: solUsdcPool,
            tvl: 1200000,
            apy: 45,
            fee: 0.3,
            volume24h: 5000000,
        },
        {
            id: 'sol-usdt',
            name: 'SOL/USDT',
            tokens: ['SOL', 'USDT'],
            address: solUsdtPool,
            tvl: 850000,
            apy: 42,
            fee: 0.3,
            volume24h: 3500000,
        },
        {
            id: 'usdc-usdt',
            name: 'USDC/USDT',
            tokens: ['USDC', 'USDT'],
            address: usdcUsdtPool,
            tvl: 2100000,
            apy: 15,
            fee: 0.01,
            volume24h: 8000000,
        },
    ];

    const handleAddLiquidity = (poolName: string) => {
        console.log(`Add liquidity to ${poolName}`);
    };

    return {
        pools,
        loading,
        handleAddLiquidity,
    };
};
