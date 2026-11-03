'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { KeepProvider } from '@/context/KeepContext';

const KeepApp = dynamic(() => import('@/components/KeepApp').then((mod) => mod.KeepApp), {
  ssr: false,
});

export default function Home() {
  return (
    <KeepProvider>
      <Suspense fallback={null}>
        <KeepApp />
      </Suspense>
    </KeepProvider>
  );
}
