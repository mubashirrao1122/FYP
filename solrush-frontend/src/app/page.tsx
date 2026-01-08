'use client';

import React from 'react';
import { useHome } from '@/lib/hooks/useHome';
import { HomeView } from '@/components/home/HomeView';

export default function HomePage() {
  const { handleLaunchApp } = useHome();

  return (
    <HomeView
      handleLaunchApp={handleLaunchApp}
    />
  );
}
