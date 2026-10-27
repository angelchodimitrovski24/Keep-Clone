'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Link2, FileText, CheckSquare } from 'lucide-react';
import { Note } from '@/types/note';

interface LinkNoteModalProps {
  currentNoteId?: string;
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNote: (targetNote: Note) => void;
}

export const LinkNoteModal: React.FC<LinkNoteModalProps> = ({
  currentNoteId,
  notes,
  isOpen,
  onClose,
  onSelectNote,
}) => {
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => {
    const list = notes.filter((n) => !n.isTrash && n.id !== currentNoteId);
    if (!query.trim()) return list.slice(0, 20);

    const q = query.toLowerCase();
    return list
      .filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          n.labels.some((l) => l.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [notes, currentNoteId, query]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-portal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
      className="keep-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[80vh] bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700/80 p-5 flex flex-col gap-3 text-stone-800 dark:text-stone-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
              Link to Another Note
            </h3>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Search notes by title or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-stone-100 dark:bg-stone-800 border-none outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto max-h-72 space-y-1.5 pr-1">
          {candidates.length > 0 ? (
            candidates.map((n) => (
              <div
                key={n.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNote(n);
                  onClose();
                }}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-amber-500/10 dark:hover:bg-amber-500/15 border border-transparent hover:border-amber-500/20 cursor-pointer transition-colors group"
              >
                <div className="mt-0.5 text-stone-400 group-hover:text-amber-600 shrink-0">
                  {n.isList ? <CheckSquare className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-700 dark:group-hover:text-amber-300">
                    {n.title || 'Untitled Note'}
                  </h4>
                  <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                    {n.isList
                      ? `${n.todos.length} checklist items`
                      : n.content?.replace(/<[^>]+>/g, '').trim() || 'No preview content'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-stone-400">
              No matching notes found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
