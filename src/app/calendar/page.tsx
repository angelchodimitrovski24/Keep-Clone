'use client';

import React, { Suspense } from 'react';
import { KeepProvider } from '@/context/KeepContext';
import { KeepApp } from '@/components/KeepApp';

export default function CalendarPage() {
  return (
    <KeepProvider initialFilter="calendar">
      <Suspense fallback={null}>
        <KeepApp />
      </Suspense>
    </KeepProvider>
  );
}
