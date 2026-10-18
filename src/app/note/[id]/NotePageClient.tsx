'use client';

import React, { Suspense } from 'react';
import { KeepProvider } from '@/context/KeepContext';
import { KeepApp } from '@/components/KeepApp';

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
