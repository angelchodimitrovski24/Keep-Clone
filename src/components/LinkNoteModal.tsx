'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Link2, FileText, CheckSquare, FolderOpen, Lock } from 'lucide-react';
import { Note } from '@/types/note';
import { useKeep } from '@/context/KeepContext';
import { searchLinkableNotesFromDB } from '@/lib/db';

interface LinkNoteModalProps {
  currentNoteId?: string;
  currentCategory?: string | null;
  excludeNoteIds?: string[];
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNote: (targetNote: Note) => void;
}

export const LinkNoteModal: React.FC<LinkNoteModalProps> = ({
  currentNoteId,
  currentCategory,
  excludeNoteIds,
  notes,
  isOpen,
  onClose,
  onSelectNote,
}) => {
  const { categories, selectedCategory, isCategoryLocked } = useKeep();
  const [query, setQuery] = useState('');
  const [categoryScope, setCategoryScope] = useState<string>('__all__');
  const [dbNotes, setDbNotes] = useState<Note[] | null>(null);

  const activeNoteCategory = currentCategory !== undefined ? currentCategory : selectedCategory;

  // Reset search state and default to cross-category search whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategoryScope('__all__');
    }
  }, [isOpen]);

  const excludedIds = useMemo(() => {
    const list = [...(excludeNoteIds || [])];
    if (currentNoteId) list.push(currentNoteId);
    return list;
  }, [excludeNoteIds, currentNoteId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      searchLinkableNotesFromDB({
        query,
        categoryFilter: categoryScope,
        excludeNoteIds: excludedIds,
        limit: 40,
      })
        .then((res) => {
          if (!cancelled) {
            setDbNotes(res);
          }
        })
        .catch(() => {});
    }, query ? 80 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, query, categoryScope, excludedIds]);

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      if (c.color) map.set(c.name.toLowerCase(), c.color);
    }
    return map;
  }, [categories]);

  const candidates = useMemo(() => {
    const excludeSet = new Set(excludedIds);
    const q = query.trim().toLowerCase();

    const matchesCategory = (n: Note) => {
      if (categoryScope === '__all__') return true;
      if (categoryScope === '__uncategorized__') return !n.category;
      return (n.category || '').toLowerCase() === categoryScope.toLowerCase();
    };

    const matchesQuery = (n: Note) => {
      if (!q) return true;
      return (
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (n.category && n.category.toLowerCase().includes(q)) ||
        (n.labels || []).some((l) => l.toLowerCase().includes(q))
      );
    };

    const merged = new Map<string, Note>();
    const sourceList = dbNotes ? [...dbNotes, ...notes] : notes;
    for (const n of sourceList) {
      if (n.isTrash || excludeSet.has(n.id) || merged.has(n.id)) continue;
      if (!matchesCategory(n) || !matchesQuery(n)) continue;
      merged.set(n.id, n);
      if (merged.size >= 40) break;
    }

    return Array.from(merged.values());
  }, [dbNotes, notes, excludedIds, query, categoryScope]);

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
        className="w-full max-w-md max-h-[82vh] bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700/80 p-5 flex flex-col gap-3 text-stone-800 dark:text-stone-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100 leading-tight">
                Link to Another Note
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Link notes within the same or different categories
              </p>
            </div>
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
            placeholder="Search notes across all categories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-stone-100 dark:bg-stone-800 border-none outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Cross-category scope filter */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setCategoryScope('__all__')}
            className={`px-2.5 py-1 rounded-lg font-medium border transition-colors ${
              categoryScope === '__all__'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'bg-stone-100 dark:bg-stone-800/80 border-transparent text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-700/70'
            }`}
          >
            All Categories
          </button>

          {activeNoteCategory && (
            <button
              type="button"
              onClick={() => setCategoryScope(activeNoteCategory)}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors truncate max-w-[140px] ${
                categoryScope.toLowerCase() === activeNoteCategory.toLowerCase()
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-stone-100 dark:bg-stone-800/80 border-transparent text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-700/70'
              }`}
              title={`Filter to current category: ${activeNoteCategory}`}
            >
              {activeNoteCategory}
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            <FolderOpen className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <select
              value={categoryScope}
              onChange={(e) => setCategoryScope(e.target.value)}
              aria-label="Filter linkable notes by category"
              className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-200 outline-none focus:ring-2 focus:ring-amber-500 max-w-[145px]"
            >
              <option value="__all__">All Categories</option>
              <option value="__uncategorized__">Uncategorized</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.icon ? `${cat.icon} ` : ''}
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto max-h-72 space-y-1.5 pr-1">
          {candidates.length > 0 ? (
            candidates.map((n) => {
              const catColor = n.category ? categoryColorMap.get(n.category.toLowerCase()) : undefined;
              const locked = Boolean(n.category && isCategoryLocked(n.category));
              const isCrossCategory = Boolean(
                activeNoteCategory && (n.category || '') !== activeNoteCategory
              );
              return (
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
                    {locked ? (
                      <Lock className="w-4 h-4 text-amber-500" />
                    ) : n.isList ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-700 dark:group-hover:text-amber-300">
                        {n.title || 'Untitled Note'}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {n.isArchived && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-700/70 text-stone-500 dark:text-stone-400">
                            Archived
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${
                            isCrossCategory
                              ? 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300'
                              : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          {catColor && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: catColor }}
                            />
                          )}
                          <span>{n.category || 'Uncategorized'}</span>
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                      {locked
                        ? 'Locked category note'
                        : n.isEncrypted
                        ? 'Encrypted note'
                        : n.isList
                        ? `${n.todos.length} checklist items`
                        : n.content?.replace(/<[^>]+>/g, '').trim() || 'No preview content'}
                    </p>
                  </div>
                </div>
              );
            })
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
