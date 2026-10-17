'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckSquare,
  Sparkles,
  Trash2,
  Globe,
  MessageCircle,
  Mail,
  Loader2,
} from 'lucide-react';
import { Note } from '@/types/note';

interface ShareNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareNoteModal: React.FC<ShareNoteModalProps> = ({
  note,
  isOpen,
  onClose,
}) => {
  const [shortId, setShortId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSlug, setCustomSlug] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // When note opens, automatically create or retrieve share link
  useEffect(() => {
    if (!isOpen || !note) {
      setShortId(null);
      setCopied(false);
      setError(null);
      setCustomSlug('');
      setShowCustomInput(false);
      return;
    }

    let isMounted = true;
    const generateLink = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note }),
        });
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.shortId) {
            setShortId(data.shortId);
          } else {
            setError(data.error || 'Failed to create share link');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to create share link:', err);
          setError('Network error while generating short link');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    generateLink();

    return () => {
      isMounted = false;
    };
  }, [isOpen, note]);

  if (!isOpen || !note) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shortUrl = shortId ? `${origin}/s/${shortId}` : '';

  const handleCopy = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share && shortUrl) {
      try {
        await navigator.share({
          title: note.title || 'Shared Note',
          text: note.content ? note.content.slice(0, 100) : 'Check out this note on Keep Clone',
          url: shortUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const handleCreateCustom = async () => {
    if (!customSlug.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, customSlug: customSlug.trim() }),
      });
      const data = await res.json();
      if (data.success && data.shortId) {
        setShortId(data.shortId);
        setShowCustomInput(false);
      } else {
        setError(data.error || 'Failed to create custom link');
      }
    } catch {
      setError('Network error creating custom link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!shortId) return;
    if (!confirm('Are you sure you want to disable this short link? Anyone with the link will no longer be able to view this note.')) {
      return;
    }
    setIsLoading(true);
    try {
      await fetch(`/api/share?id=${shortId}`, { method: 'DELETE' });
      setShortId(null);
      onClose();
    } catch (err) {
      console.error('Failed to revoke share link:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalImages = (note.images?.length || 0) + (note.drawings?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#202124] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Share Note
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Create a fast, clean short link with all images and contents
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-130px)]">
          {/* Note Summary Card */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 space-y-2">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm line-clamp-1">
              {note.title || 'Untitled Note'}
            </h3>

            {/* Note contents snippet */}
            {note.content && (
              <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
                {note.content}
              </p>
            )}

            {/* Pills summary: images, todos, category */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              {totalImages > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  <ImageIcon className="w-3 h-3" />
                  <span>{totalImages} {totalImages === 1 ? 'image' : 'images'} included</span>
                </span>
              )}

              {note.isList && note.todos && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  <CheckSquare className="w-3 h-3" />
                  <span>{note.todos.length} checklist items</span>
                </span>
              )}

              {note.category && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200">
                  📁 {note.category}
                </span>
              )}
            </div>

            {/* Thumbnail previews of images inside note */}
            {note.images && note.images.length > 0 && (
              <div className="flex items-center gap-2 pt-2 overflow-x-auto pb-1">
                {note.images.slice(0, 4).map((img, i) => (
                  <div
                    key={i}
                    className="w-14 h-14 rounded-xl border border-stone-300 dark:border-stone-600 overflow-hidden shrink-0 bg-stone-200 dark:bg-stone-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="Thumbnail preview" className="w-full h-full object-cover" />
                  </div>
                ))}
                {note.images.length > 4 && (
                  <span className="text-xs text-stone-500 dark:text-stone-400 pl-1 font-semibold">
                    +{note.images.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Short Link Output Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider flex items-center justify-between">
              <span>Short Link</span>
              {shortId && (
                <span className="text-emerald-600 dark:text-emerald-400 font-mono lowercase font-normal">
                  /s/{shortId}
                </span>
              )}
            </label>

            {isLoading ? (
              <div className="h-12 flex items-center justify-center gap-2 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-500 text-xs font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Generating short link...</span>
              </div>
            ) : error ? (
              <div className="p-3 text-xs rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                {error}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={shortUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-2xl border border-stone-200 dark:border-stone-700 outline-none focus:ring-2 focus:ring-amber-500 select-all"
                  />
                </div>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all shadow-xs shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 active:scale-95'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Open preview */}
                {shortUrl && (
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors shrink-0"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Social / Direct Share Shortcuts */}
          {shortUrl && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                Quick Share
              </p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-xs font-medium text-stone-700 dark:text-stone-200"
                >
                  <Share2 className="w-4 h-4 text-amber-500" />
                  <span>Share</span>
                </button>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `${note.title ? note.title + ' - ' : ''}${shortUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-xs font-medium text-stone-700 dark:text-stone-200"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `${note.title || 'Check out my note'}`
                  )}&url=${encodeURIComponent(shortUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-xs font-medium text-stone-700 dark:text-stone-200"
                >
                  <svg className="w-4 h-4 fill-current text-stone-800 dark:text-stone-100" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span>X / Tweet</span>
                </a>

                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    note.title || 'Shared Note'
                  )}&body=${encodeURIComponent(
                    `Check out this note: ${shortUrl}\n\n${note.content || ''}`
                  )}`}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-xs font-medium text-stone-700 dark:text-stone-200"
                >
                  <Mail className="w-4 h-4 text-rose-500" />
                  <span>Email</span>
                </a>
              </div>
            </div>
          )}

          {/* Custom slug option toggle */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Customize short link (e.g. /s/my-slug)</span>
              </button>
            ) : (
              <div className="space-y-2 animate-in fade-in duration-100">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  Custom short slug:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-1.5 border border-stone-200 dark:border-stone-700 text-xs">
                    <span className="text-stone-400 font-mono">/s/</span>
                    <input
                      type="text"
                      placeholder="e.g. shopping-list"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                      className="w-full bg-transparent outline-none font-mono text-stone-900 dark:text-stone-100 pl-1"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!customSlug.trim() || isLoading}
                    onClick={handleCreateCustom}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="px-2 py-1.5 text-xs text-stone-400 hover:text-stone-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 dark:bg-stone-900/40 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
          {shortId ? (
            <button
              type="button"
              onClick={handleRevoke}
              className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-red-600 transition-colors"
              title="Delete this short link so it can no longer be accessed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Revoke link</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
