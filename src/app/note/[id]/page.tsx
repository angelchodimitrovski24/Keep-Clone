import React, { Suspense } from 'react';
import { Metadata } from 'next';
import NotePageClient from './NotePageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Keep Clone - Note',
    description: 'View note in Google Keep Clone',
  };
}

async function NoteRouteContainer({ params }: PageProps) {
  const { id } = await params;
  return <NotePageClient noteId={id} />;
}

export default function NoteRoutePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 dark:bg-[#18191a] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <NoteRouteContainer params={params} />
    </Suspense>
  );
}
