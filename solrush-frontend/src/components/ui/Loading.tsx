'use client';

import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
    className = '', 
    width, 
    height 
}) => {
    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;

    return (
        <div 
            className={`animate-pulse bg-gray-700/50 rounded ${className}`}
            style={style}
        />
    );
};

// Loading spinner
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ 
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
    };

    return (
        <svg 
            className={`animate-spin text-purple-500 ${sizeClasses[size]} ${className}`} 
            fill="none" 
            viewBox="0 0 24 24"
        >
            <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
            />
            <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
            />
        </svg>
    );
};

// Swap card skeleton
export const SwapCardSkeleton: React.FC = () => (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
        <div className="space-y-4">
            {/* Token input skeleton */}
            <div className="bg-gray-700/50 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                    <Skeleton width={60} height={16} />
                    <Skeleton width={80} height={16} />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton width={120} height={36} />
                    <Skeleton width={100} height={40} className="rounded-full" />
                </div>
            </div>

            {/* Swap arrow */}
            <div className="flex justify-center">
                <Skeleton width={40} height={40} className="rounded-full" />
            </div>

            {/* Token output skeleton */}
            <div className="bg-gray-700/50 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                    <Skeleton width={60} height={16} />
                    <Skeleton width={80} height={16} />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton width={120} height={36} />
                    <Skeleton width={100} height={40} className="rounded-full" />
                </div>
            </div>

            {/* Details skeleton */}
            <div className="space-y-2">
                <div className="flex justify-between">
                    <Skeleton width={80} height={14} />
                    <Skeleton width={60} height={14} />
                </div>
                <div className="flex justify-between">
                    <Skeleton width={100} height={14} />
                    <Skeleton width={80} height={14} />
                </div>
            </div>

            {/* Button skeleton */}
            <Skeleton height={48} className="w-full rounded-xl" />
        </div>
    </div>
);

// Pool card skeleton
export const PoolCardSkeleton: React.FC = () => (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
            <div className="flex -space-x-2">
                <Skeleton width={32} height={32} className="rounded-full" />
                <Skeleton width={32} height={32} className="rounded-full" />
            </div>
            <Skeleton width={100} height={20} />
        </div>
        <div className="grid grid-cols-3 gap-4">
            <div>
                <Skeleton width={40} height={12} className="mb-1" />
                <Skeleton width={80} height={18} />
            </div>
            <div>
                <Skeleton width={40} height={12} className="mb-1" />
                <Skeleton width={60} height={18} />
            </div>
            <div>
                <Skeleton width={40} height={12} className="mb-1" />
                <Skeleton width={50} height={18} />
            </div>
        </div>
    </div>
);

// Pool list skeleton
export const PoolListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <PoolCardSkeleton key={i} />
        ))}
    </div>
);

// Stats card skeleton
export const StatsCardSkeleton: React.FC = () => (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <Skeleton width={80} height={14} className="mb-2" />
        <Skeleton width={120} height={28} />
    </div>
);

// Rewards card skeleton
export const RewardsCardSkeleton: React.FC = () => (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
        <div className="flex justify-between items-start mb-6">
            <div>
                <Skeleton width={120} height={20} className="mb-2" />
                <Skeleton width={160} height={36} />
            </div>
            <Skeleton width={100} height={40} className="rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Skeleton width={60} height={14} className="mb-1" />
                <Skeleton width={100} height={24} />
            </div>
            <div>
                <Skeleton width={60} height={14} className="mb-1" />
                <Skeleton width={100} height={24} />
            </div>
        </div>
    </div>
);

// Full page loading
export const PageLoading: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-400">{message}</p>
    </div>
);

// Loading overlay
export const LoadingOverlay: React.FC<{ message?: string }> = ({ message }) => (
    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
        <div className="text-center">
            <LoadingSpinner size="lg" />
            {message && <p className="mt-3 text-gray-300 text-sm">{message}</p>}
        </div>
    </div>
);

export default Skeleton;
