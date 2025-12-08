'use client';

import React, { useState } from 'react';

interface SlippageSettingsProps {
    slippage: number;
    onSlippageChange: (slippage: number) => void;
    isOpen?: boolean;
    onClose?: () => void;
}

const PRESET_SLIPPAGES = [0.1, 0.5, 1.0];

export const SlippageSettings: React.FC<SlippageSettingsProps> = ({
    slippage,
    onSlippageChange,
    isOpen = true,
    onClose,
}) => {
    const [customSlippage, setCustomSlippage] = useState<string>('');
    const [isCustom, setIsCustom] = useState(false);

    const handlePresetClick = (value: number) => {
        setIsCustom(false);
        setCustomSlippage('');
        onSlippageChange(value);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        
        // Allow empty or valid number
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setCustomSlippage(value);
            setIsCustom(true);
            
            const numValue = parseFloat(value);
            if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
                onSlippageChange(numValue);
            }
        }
    };

    const isHighSlippage = slippage > 5;
    const isVeryHighSlippage = slippage > 10;

    if (!isOpen) return null;

    return (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Slippage Tolerance</h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="flex gap-2 mb-3">
                {PRESET_SLIPPAGES.map((preset) => (
                    <button
                        key={preset}
                        onClick={() => handlePresetClick(preset)}
                        className={`
                            flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                            ${!isCustom && slippage === preset
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }
                        `}
                    >
                        {preset}%
                    </button>
                ))}
            </div>

            <div className="relative">
                <input
                    type="text"
                    value={isCustom ? customSlippage : ''}
                    onChange={handleCustomChange}
                    onFocus={() => setIsCustom(true)}
                    placeholder="Custom"
                    className={`
                        w-full py-2 px-3 pr-8 rounded-lg text-sm
                        bg-gray-700 border transition-all
                        ${isCustom
                            ? 'border-purple-500 text-white'
                            : 'border-gray-600 text-gray-400'
                        }
                        focus:outline-none focus:border-purple-500
                    `}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    %
                </span>
            </div>

            {/* Warning messages */}
            {isVeryHighSlippage && (
                <div className="mt-3 p-2 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <p className="text-xs text-red-400">
                        ⚠️ Very high slippage ({slippage}%). Your transaction may be frontrun.
                    </p>
                </div>
            )}
            {isHighSlippage && !isVeryHighSlippage && (
                <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                    <p className="text-xs text-yellow-400">
                        ⚠️ High slippage ({slippage}%). Consider using a lower value.
                    </p>
                </div>
            )}

            {/* Current slippage display */}
            <div className="mt-3 text-xs text-gray-500">
                Current: {slippage}% slippage tolerance
            </div>
        </div>
    );
};

// Inline version for swap forms
export const SlippageButton: React.FC<{
    slippage: number;
    onClick: () => void;
}> = ({ slippage, onClick }) => {
    const isHighSlippage = slippage > 5;

    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all
                ${isHighSlippage
                    ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
            `}
        >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {slippage}%
        </button>
    );
};

export default SlippageSettings;
