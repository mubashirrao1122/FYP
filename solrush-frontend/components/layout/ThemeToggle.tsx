'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'solrush-theme';

function applyTheme(theme: ThemeMode) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
}

export function ThemeToggle() {
    const [theme, setTheme] = React.useState<ThemeMode>('light');

    React.useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
        const initial = stored === 'dark' ? 'dark' : 'light';
        setTheme(initial);
        applyTheme(initial);
    }, []);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        window.localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
    };

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="h-10 w-10 rounded-full border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#0F172A] text-[#475569] dark:text-[#9CA3AF] flex items-center justify-center transition-colors duration-200 ease-out hover:bg-[#F1F5F9] dark:hover:bg-[#111827]"
        >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
    );
}
