'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { KeepProvider } from '@/context/KeepContext';

const KeepApp = dynamic(() => import('@/components/KeepApp').then((mod) => mod.KeepApp), {
  ssr: false,
});

interface NotePageClientProps {
  noteId: string;
}

export default function NotePageClient({ noteId }: NotePageClientProps) {
  return (
    <KeepProvider>
      <Suspense fallback={null}>
        <KeepApp initialNoteId={noteId} />
      </Suspense>
    </KeepProvider>
  );
}
