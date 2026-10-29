'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Share2,
  Copy,
  Check,
  ClipboardCopy,
  Download,
  Calendar,
  Tag,
  Folder,
  ArrowLeft,
  ExternalLink,
  Moon,
  Sun,
  Eye,
  CheckSquare,
  Square,
  X,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SharedNoteData, TodoItem } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { NoteThemeArtwork } from './NoteThemeArtwork';
import { MarkdownRenderer } from './MarkdownRenderer';
import { saveNoteToDB } from '@/lib/db';
import { resolveLocalMediaUrl, copyNoteToClipboard } from '@/lib/formatUtils';

interface SharedNoteViewProps {
  note: SharedNoteData;
  shortId: string;
}

export const SharedNoteView: React.FC<SharedNoteViewProps> = ({ note, shortId }) => {
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>(note.todos || []);

  const fullShareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/s/${shortId}`
    : `/s/${shortId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyNoteText = async () => {
    const success = await copyNoteToClipboard({
      title: note.title,
      content: note.content,
      isList: note.isList,
      todos,
    });
    if (success) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: note.title || 'Shared Note',
          text: note.content ? note.content.slice(0, 100) : 'Check out this note on Keep Clone',
          url: fullShareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSaveToMyKeep = async () => {
    if (isSaving || isSaved) return;
    setIsSaving(true);
    try {
      const newNoteId = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      await saveNoteToDB({
        id: newNoteId,
        title: note.title,
        content: note.content,
        isList: note.isList,
        todos: todos,
        color: note.color,
        theme: note.theme,
        labels: note.labels,
        category: note.category,
        images: note.images || [],
        drawings: note.drawings || [],
        audioRecordings: note.audioRecordings || [],
        isPinned: false,
        isArchived: false,
        isTrash: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: Date.now(),
      });

      setIsSaved(true);

      // Confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // Ignore confetti error
      }
    } catch (err) {
      console.error('Failed to save shared note to local Keep:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const colorClasses = getNoteColorClasses(note.color, note.theme);
  const formattedDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-stone-100 dark:bg-[#18191a] text-stone-900 dark:text-stone-100 transition-colors">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#202124]/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 text-stone-900 dark:text-white font-semibold text-lg hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shadow-xs">
                <span className="text-xl">💡</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-bold tracking-tight">Keep</span>
                <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                  Shared Note
                </span>
              </div>
            </Link>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme toggle */}
              <button
                type="button"
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Copy Short Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 shadow-2xs transition-all"
                title="Copy short link"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-stone-500" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              {/* Copy Title & Content */}
              <button
                type="button"
                onClick={handleCopyNoteText}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 shadow-2xs transition-all"
                title="Copy note title and content"
              >
                {copiedText ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="w-4 h-4 text-stone-500" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              {/* Save to My Keep */}
              <button
                type="button"
                onClick={handleSaveToMyKeep}
                disabled={isSaving || isSaved}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm ${
                  isSaved
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 active:scale-95'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved to Keep</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Save to My Keep</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          {/* Back link & short link preview badge */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Keep App</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <span>/s/{shortId}</span>
              </span>
              <button
                type="button"
                onClick={handleNativeShare}
                className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 rounded-lg transition-colors"
                title="Share link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Note Card */}
          <article
            className={`relative rounded-3xl p-6 sm:p-10 shadow-xl border overflow-hidden transition-all ${colorClasses}`}
          >
            {/* Background Theme Artwork */}
            {note.theme && note.theme !== 'none' && (
              <NoteThemeArtwork theme={note.theme} isModal={true} />
            )}

            {/* Note Meta Badges (Category & Labels) */}
            <div className="relative z-10 flex flex-wrap items-center gap-2 mb-4">
              {note.category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/10 dark:bg-white/10 text-stone-800 dark:text-stone-100 shadow-2xs">
                  <Folder className="w-3 h-3 text-amber-500" />
                  <span>{note.category}</span>
                </span>
              )}

              {note.labels && note.labels.length > 0 && note.labels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/5 text-stone-700 dark:text-stone-300"
                >
                  <Tag className="w-2.5 h-2.5 text-stone-400" />
                  <span>{lbl}</span>
                </span>
              ))}

              <span className="text-xs text-stone-400 dark:text-stone-500 ml-auto flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formattedDate}</span>
              </span>
            </div>

            {/* Note Title */}
            {note.title && (
              <h1 className="relative z-10 text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 mb-6 leading-tight break-words">
                {note.title}
              </h1>
            )}

            {/* Image Gallery */}
            {note.images && note.images.length > 0 && (
              <section className="relative z-10 mb-8" aria-label="Attached images">
                <div
                  className={`grid gap-3 ${
                    note.images.length === 1
                      ? 'grid-cols-1'
                      : note.images.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-2 sm:grid-cols-3'
                  }`}
                >
                  {note.images.map((imgUrl, index) => (
                    <div
                      key={index}
                      onClick={() => setActiveImage(imgUrl)}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 aspect-auto max-h-96 flex items-center justify-center hover:opacity-95 transition-all shadow-xs"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveLocalMediaUrl(imgUrl)}
                        alt={`Note visual ${index + 1}`}
                        className="w-full h-full object-cover max-h-96 group-hover:scale-102 transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-6 h-6 drop-shadow-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Drawings Gallery */}
            {note.drawings && note.drawings.length > 0 && (
              <section className="relative z-10 mb-8" aria-label="Attached drawings">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {note.drawings.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => setActiveImage(d.dataUrl)}
                      className="cursor-pointer overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-stone-900/70 p-2 shadow-xs hover:opacity-95 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.dataUrl}
                        alt="Hand drawing"
                        className="w-full h-auto max-h-80 object-contain rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Checklist View */}
            {note.isList && todos.length > 0 && (
              <section className="relative z-10 space-y-2 mb-6" aria-label="Checklist items">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => toggleTodo(todo.id)}
                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors group select-none"
                  >
                    <button
                      type="button"
                      className="mt-0.5 text-stone-500 group-hover:text-amber-600 transition-colors shrink-0"
                      title={todo.completed ? 'Mark incomplete' : 'Mark completed'}
                    >
                      {todo.completed ? (
                        <CheckSquare className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <span
                      className={`text-base leading-relaxed break-words whitespace-pre-wrap min-w-0 flex-1 ${
                        todo.completed
                          ? 'line-through text-stone-400 dark:text-stone-500'
                          : 'text-stone-800 dark:text-stone-100 font-normal'
                      }`}
                    >
                      {todo.text}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* Markdown / Rich Text Content */}
            {!note.isList && note.content && (
              <div className="relative z-10 text-base leading-relaxed text-stone-800 dark:text-stone-200">
                <MarkdownRenderer content={note.content} />
              </div>
            )}

            {/* Bottom Note Footer */}
            <div className="relative z-10 mt-8 pt-6 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
              <div className="flex items-center gap-2">
                <span>Shared via Google Keep Clone</span>
                {note.views !== undefined && note.views > 0 && (
                  <span className="flex items-center gap-1 text-[11px] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                    <Eye className="w-3 h-3 text-stone-400" />
                    <span>{note.views} views</span>
                  </span>
                )}
              </div>

              {/* Share triggers */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="hover:text-stone-900 dark:hover:text-stone-100 underline transition-colors"
                >
                  {copied ? 'Link Copied!' : 'Copy Link'}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleSaveToMyKeep}
                  className="hover:text-stone-900 dark:hover:text-stone-100 underline transition-colors"
                >
                  {isSaved ? 'In your Keep' : 'Add to My Keep'}
                </button>
              </div>
            </div>
          </article>

          {/* Sticky banner if not saved */}
          {isSaved && (
            <div className="mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between gap-4 text-emerald-800 dark:text-emerald-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Note successfully added to your local Keep notes!</span>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shrink-0 shadow-xs"
              >
                <span>Open in Keep</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </main>

        {/* Fullscreen Image Lightbox Modal */}
        {activeImage && (
          <div
            onClick={() => setActiveImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close image"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt="Enlarged note preview"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        )}
      </div>
    </div>
  );
};
