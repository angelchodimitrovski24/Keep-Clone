'use client';

import React, { Suspense } from 'react';
import { KeepProvider } from '@/context/KeepContext';
import { KeepApp } from '@/components/KeepApp';

export default function StatsPage() {
  return (
    <KeepProvider initialFilter="stats">
      <Suspense fallback={null}>
        <KeepApp />
      </Suspense>
    </KeepProvider>
  );
}
