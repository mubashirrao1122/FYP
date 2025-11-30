import React from 'react';

export const SolIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <circle cx="16" cy="16" r="16" fill="#000" />
        <path
            d="M22.5 13.25H9.5C9.22386 13.25 9 13.0261 9 12.75V11.25C9 10.9739 9.22386 10.75 9.5 10.75H22.5C22.7761 10.75 23 10.9739 23 11.25V12.75C23 13.0261 22.7761 13.25 22.5 13.25Z"
            fill="url(#paint0_linear)"
        />
        <path
            d="M22.5 21.25H9.5C9.22386 21.25 9 21.0261 9 20.75V19.25C9 18.9739 9.22386 18.75 9.5 18.75H22.5C22.7761 18.75 23 18.9739 23 19.25V20.75C23 21.0261 22.7761 21.25 22.5 21.25Z"
            fill="url(#paint1_linear)"
        />
        <path
            d="M22.5 17.25H9.5C9.22386 17.25 9 17.0261 9 16.75V15.25C9 14.9739 9.22386 14.75 9.5 14.75H22.5C22.7761 14.75 23 14.9739 23 15.25V16.75C23 17.0261 22.7761 17.25 22.5 17.25Z"
            fill="url(#paint2_linear)"
        />
        <defs>
            <linearGradient
                id="paint0_linear"
                x1="9.5"
                y1="12"
                x2="22.5"
                y2="12"
                gradientUnits="userSpaceOnUse"
            >
                <stop stopColor="#9945FF" />
                <stop offset="1" stopColor="#14F195" />
            </linearGradient>
            <linearGradient
                id="paint1_linear"
                x1="9.5"
                y1="20"
                x2="22.5"
                y2="20"
                gradientUnits="userSpaceOnUse"
            >
                <stop stopColor="#9945FF" />
                <stop offset="1" stopColor="#14F195" />
            </linearGradient>
            <linearGradient
                id="paint2_linear"
                x1="9.5"
                y1="16"
                x2="22.5"
                y2="16"
                gradientUnits="userSpaceOnUse"
            >
                <stop stopColor="#9945FF" />
                <stop offset="1" stopColor="#14F195" />
            </linearGradient>
        </defs>
    </svg>
);

export const UsdcIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <circle cx="16" cy="16" r="16" fill="#2775CA" />
        <path
            d="M16 8C11.5817 8 8 11.5817 8 16C8 20.4183 11.5817 24 16 24C20.4183 24 24 20.4183 24 16C24 11.5817 20.4183 8 16 8ZM16 22C12.6863 22 10 19.3137 10 16C10 12.6863 12.6863 10 16 10C19.3137 10 22 12.6863 22 16C22 19.3137 19.3137 22 16 22Z"
            fill="white"
        />
        <path
            d="M16 13.5C14.6193 13.5 13.5 14.6193 13.5 16C13.5 17.3807 14.6193 18.5 16 18.5C17.3807 18.5 18.5 17.3807 18.5 16C18.5 14.6193 17.3807 13.5 16 13.5Z"
            fill="white"
        />
    </svg>
);

export const UsdtIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <circle cx="16" cy="16" r="16" fill="#26A17B" />
        <path
            d="M17.5 17.5V24H14.5V17.5H10V14.5H22V17.5H17.5Z"
            fill="white"
        />
    </svg>
);

export const RushIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <circle cx="16" cy="16" r="16" fill="#9945FF" />
        <path
            d="M18 6L10 16H16L14 26L22 16H16L18 6Z"
            fill="white"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);
