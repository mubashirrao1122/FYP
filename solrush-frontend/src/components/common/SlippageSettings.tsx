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
                <button className="p-2 text-[#94A3B8] dark:text-[#6B7280] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#161C2D] rounded-lg transition-colors duration-200">
                    <Settings size={18} />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content className="w-72 bg-white dark:bg-[#121826] border border-[#E2E8F0] dark:border-white/10 rounded-xl p-4 shadow-lg z-50" sideOffset={5}>
                    <h3 className="text-sm font-medium text-[#475569] dark:text-[#9CA3AF] mb-3">Slippage Tolerance</h3>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {PRESET_SLIPPAGES.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => {
                                    setSlippage(preset);
                                    setCustomSlippage('');
                                }}
                                className={`px-2 py-1 text-sm rounded-lg border transition-colors ${slippage === preset && customSlippage === ''
                                        ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                                        : 'bg-[#F1F5F9] dark:bg-[#161C2D] border-[#E2E8F0] dark:border-white/10 text-[#475569] dark:text-[#9CA3AF] hover:border-[#8B5CF6]'
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
                                className={`w-full px-2 py-1 text-sm bg-[#F1F5F9] dark:bg-[#161C2D] border rounded-lg outline-none focus:border-[#8B5CF6] transition-colors ${customSlippage !== ''
                                        ? 'border-[#8B5CF6] text-[#0F172A] dark:text-white'
                                        : 'border-[#E2E8F0] dark:border-white/10 text-[#475569] dark:text-[#9CA3AF]'
                                    }`}
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] dark:text-[#6B7280]">%</span>
                        </div>
                    </div>
                    {slippage > 5 && (
                        <div className="text-xs text-[#F59E0B] bg-[#F59E0B]/10 p-2 rounded-lg">
                            High slippage warning: Your transaction may be frontrun.
                        </div>
                    )}
                    <Popover.Arrow className="fill-white dark:fill-[#121826]" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
