'use client';

import React, { Suspense } from 'react';
import { KeepProvider } from '@/context/KeepContext';
import { KeepApp } from '@/components/KeepApp';

export default function Home() {
  return (
    <KeepProvider>
      <Suspense fallback={null}>
        <KeepApp />
      </Suspense>
    </KeepProvider>
  );
}
