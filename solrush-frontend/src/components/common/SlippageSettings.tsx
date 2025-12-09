'use client';

import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

interface SlippageSettingsProps {
    slippage: number;
    setSlippage: (value: number) => void;
}

export const SlippageSettings: React.FC<SlippageSettingsProps> = ({
    slippage,
    setSlippage,
}) => {
    const [customSlippage, setCustomSlippage] = useState<string>('');
    const PRESET_SLIPPAGES = [0.1, 0.5, 1.0];

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomSlippage(value);
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
            setSlippage(numValue);
        }
    };

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                    <Settings size={20} />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content className="w-72 bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl z-50" sideOffset={5}>
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Slippage Tolerance</h3>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {PRESET_SLIPPAGES.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => {
                                    setSlippage(preset);
                                    setCustomSlippage('');
                                }}
                                className={`px-2 py-1 text-sm rounded-lg border transition-colors ${slippage === preset && customSlippage === ''
                                        ? 'bg-blue-600/20 border-blue-600 text-blue-400'
                                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                                    }`}
                            >
                                {preset}%
                            </button>
                        ))}
                        <div className="relative">
                            <input
                                type="number"
                                placeholder="Custom"
                                value={customSlippage}
                                onChange={handleCustomChange}
                                className={`w-full px-2 py-1 text-sm bg-zinc-800 border rounded-lg outline-none focus:border-blue-600 transition-colors ${customSlippage !== ''
                                        ? 'border-blue-600 text-blue-400'
                                        : 'border-zinc-700 text-zinc-300'
                                    }`}
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
                        </div>
                    </div>
                    {slippage > 5 && (
                        <div className="text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg">
                            High slippage warning: Your transaction may be frontrun.
                        </div>
                    )}
                    <Popover.Arrow className="fill-zinc-800" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
