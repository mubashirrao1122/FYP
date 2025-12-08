import React from 'react';
import { SolIcon, UsdcIcon, UsdtIcon, WethIcon, UsdsIcon, RushIcon, JupIcon, BonkIcon, RayIcon } from '@/components/icons/TokenIcons';

const TOKENS = [
    { name: 'Solana', symbol: 'SOL', icon: SolIcon },
    { name: 'USDC', symbol: 'USDC', icon: UsdcIcon },
    { name: 'Tether', symbol: 'USDT', icon: UsdtIcon },
    { name: 'Wrapped Ether', symbol: 'WETH', icon: WethIcon },
    { name: 'USDS', symbol: 'USDS', icon: UsdsIcon },
    { name: 'SolRush', symbol: 'RUSH', icon: RushIcon },
    { name: 'Jupiter', symbol: 'JUP', icon: JupIcon },
    { name: 'Bonk', symbol: 'BONK', icon: BonkIcon },
    { name: 'Raydium', symbol: 'RAY', icon: RayIcon },
    // Duplicate for seamless loop
    { name: 'Solana', symbol: 'SOL', icon: SolIcon },
    { name: 'USDC', symbol: 'USDC', icon: UsdcIcon },
    { name: 'Tether', symbol: 'USDT', icon: UsdtIcon },
    { name: 'Wrapped Ether', symbol: 'WETH', icon: WethIcon },
    { name: 'USDS', symbol: 'USDS', icon: UsdsIcon },
    { name: 'SolRush', symbol: 'RUSH', icon: RushIcon },
    { name: 'Jupiter', symbol: 'JUP', icon: JupIcon },
    { name: 'Bonk', symbol: 'BONK', icon: BonkIcon },
    { name: 'Raydium', symbol: 'RAY', icon: RayIcon },
];

export const TokenCarousel = () => {
    return (
        <div className="w-full overflow-hidden bg-black/20 border-y border-white/5 backdrop-blur-sm py-10">
            <div className="relative flex items-center">
                {/* Gradient Masks for smooth fade effect */}
                <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-black to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-black to-transparent z-10" />

                {/* Infinite Scroll Container */}
                <div className="flex animate-infinite-scroll gap-16 px-4">
                    {/* First Set */}
                    {TOKENS.map((token, index) => (
                        <div
                            key={`token-1-${index}`}
                            className="flex items-center gap-4 min-w-[200px] group cursor-pointer"
                        >
                            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-purple-500/50 group-hover:bg-purple-500/10 transition-all duration-300 shadow-lg shadow-black/20">
                                <token.icon className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg group-hover:text-purple-400 transition-colors">
                                    {token.symbol}
                                </h4>
                                <p className="text-white/40 text-sm">{token.name}</p>
                            </div>
                        </div>
                    ))}

                    {/* Second Set (Duplicate for seamless loop) */}
                    {TOKENS.map((token, index) => (
                        <div
                            key={`token-2-${index}`}
                            className="flex items-center gap-4 min-w-[200px] group cursor-pointer"
                        >
                            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-purple-500/50 group-hover:bg-purple-500/10 transition-all duration-300 shadow-lg shadow-black/20">
                                <token.icon className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg group-hover:text-purple-400 transition-colors">
                                    {token.symbol}
                                </h4>
                                <p className="text-white/40 text-sm">{token.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
