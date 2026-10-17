import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSharedNote } from '@/lib/shareStorage';
import { SharedNoteView } from '@/components/SharedNoteView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const note = await getSharedNote(id, false);

  if (!note) {
    return {
      title: 'Shared Note Not Found - Keep Clone',
    };
  }

  const title = note.title ? `${note.title} - Keep Clone` : 'Shared Note - Keep Clone';
  const description = note.content ? note.content.slice(0, 160) : 'View this note on Google Keep Clone';
  const ogImage = note.images && note.images.length > 0 ? note.images[0] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

async function SharedNoteContainer({ params }: PageProps) {
  const { id } = await params;
  const note = await getSharedNote(id, true);

  if (!note) {
    notFound();
  }

  return <SharedNoteView note={note} shortId={id} />;
}

export default function SharedNotePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-100 dark:bg-[#18191a] flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Loading shared note...
            </span>
          </div>
        </div>
      }
    >
      <SharedNoteContainer params={params} />
    </Suspense>
  );
}
