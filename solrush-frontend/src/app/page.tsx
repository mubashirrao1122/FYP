'use client';

import React from 'react';
import { useHome } from '@/lib/hooks/useHome';
import { HomeView } from '@/components/home/HomeView';

export default function HomePage() {
  const { publicKey, handleLaunchApp } = useHome();

  return (
    <HomeView
      publicKey={publicKey}
      handleLaunchApp={handleLaunchApp}
    />
  );
}
