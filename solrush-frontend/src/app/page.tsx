'use client';

import React from 'react';
import { useHome } from '@/lib/hooks/useHome';
import { HomeView } from '@/components/home/HomeView';

/**
 * Module 5.3: Landing Page
 * 
 * Sleek, modern homepage with hero section, features, stats, and pools
 * Refactored to MVC pattern:
 * - Controller: useHome hook
 * - View: HomeView component
 */
export default function HomePage() {
  const { publicKey, handleLaunchApp } = useHome();

  return (
    <HomeView
      publicKey={publicKey}
      handleLaunchApp={handleLaunchApp}
    />
  );
}
