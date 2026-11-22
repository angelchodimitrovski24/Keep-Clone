'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Link2, FileText, CheckSquare, FolderOpen, Lock, Plus } from 'lucide-react';
import { Note, NoteConnectionRole } from '@/types/note';
import { useKeep } from '@/context/KeepContext';
import { searchLinkableNotesFromDB } from '@/lib/db';
import { CONNECTION_ROLE_META, CONNECTION_ROLES_ORDER } from '@/lib/noteGraph';

interface LinkNoteModalProps {
  currentNoteId?: string;
  currentCategory?: string | null;
  excludeNoteIds?: string[];
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNote: (targetNote: Note, role: NoteConnectionRole) => void;
  initialRole?: NoteConnectionRole;
  enableRoleSelector?: boolean;
  modalTitle?: string;
  modalSubtitle?: string;
}

export const LinkNoteModal: React.FC<LinkNoteModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <LinkNoteModalInner
      key={`${props.currentNoteId || 'new'}:${props.initialRole || 'related'}`}
      {...props}
    />
  );
};

const LinkNoteModalInner: React.FC<LinkNoteModalProps> = ({
  currentNoteId,
  currentCategory,
  excludeNoteIds,
  notes,
  onClose,
  onSelectNote,
  initialRole = 'related',
  enableRoleSelector = true,
  modalTitle = 'Link to Another Note',
  modalSubtitle = 'Connect notes across categories with optional meaning',
}) => {
  const { categories, selectedCategory, isCategoryLocked, addNote, hubTrees } = useKeep();
  const [query, setQuery] = useState('');
  const [categoryScope, setCategoryScope] = useState<string>('__all__');
  const [selectedRole, setSelectedRole] = useState<NoteConnectionRole>(initialRole);
  const [dbNotes, setDbNotes] = useState<Note[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const activeNoteCategory = currentCategory !== undefined ? currentCategory : selectedCategory;

  const excludedIds = useMemo(() => {
    const list = [...(excludeNoteIds || [])];
    if (currentNoteId) list.push(currentNoteId);
    return list;
  }, [excludeNoteIds, currentNoteId]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      searchLinkableNotesFromDB({
        query,
        categoryFilter: categoryScope === '__hubs__' ? '__all__' : categoryScope,
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
  }, [query, categoryScope, excludedIds]);

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
      if (categoryScope === '__hubs__') return Boolean(n.isHub);
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
    const hubNodes = hubTrees.map((t) => t.hub);
    const sourceList = dbNotes ? [...hubNodes, ...dbNotes, ...notes] : [...hubNodes, ...notes];
    for (const n of sourceList) {
      if (n.isTrash || excludeSet.has(n.id) || merged.has(n.id)) continue;
      if (!matchesCategory(n) || !matchesQuery(n)) continue;
      merged.set(n.id, n);
      if (merged.size >= 40) break;
    }

    const list = Array.from(merged.values());
    if (selectedRole === 'part_of') {
      list.sort((a, b) => Number(Boolean(b.isHub)) - Number(Boolean(a.isHub)));
    }
    return list;
  }, [dbNotes, notes, hubTrees, excludedIds, query, categoryScope, selectedRole]);

  const handleCreateAndLink = async () => {
    const trimmed = query.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const created = await addNote({
        title: trimmed,
        content: '',
        category: activeNoteCategory || null,
        isHub: selectedRole === 'part_of',
        noteType: selectedRole === 'part_of' ? 'notion' : 'default',
      });
      if (created) {
        onSelectNote(created, selectedRole);
        onClose();
      }
    } finally {
      setIsCreating(false);
    }
  };

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
        className="w-full max-w-md max-h-[85vh] bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700/80 p-5 flex flex-col gap-3 text-stone-800 dark:text-stone-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100 leading-tight">
                {modalTitle}
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {modalSubtitle}
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

        {/* Connection Role Selector */}
        {enableRoleSelector && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              Connection Meaning
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CONNECTION_ROLES_ORDER.map((r) => {
                const meta = CONNECTION_ROLE_META[r];
                const isActive = selectedRole === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSelectedRole(r);
                      if (r === 'part_of' && hubTrees.length > 0 && categoryScope === '__all__') {
                        setCategoryScope('__hubs__');
                      } else if (r !== 'part_of' && categoryScope === '__hubs__') {
                        setCategoryScope('__all__');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                      isActive
                        ? `${meta.badgeClass} font-semibold shadow-2xs`
                        : 'bg-stone-50 dark:bg-stone-800/70 border-stone-200 dark:border-stone-700/80 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                    title={meta.description}
                  >
                    <span className="shrink-0">{meta.emoji}</span>
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Search notes or type a new note title..."
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
            All
          </button>

          {hubTrees.length > 0 && (
            <button
              type="button"
              onClick={() => setCategoryScope('__hubs__')}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                categoryScope === '__hubs__'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-stone-100 dark:bg-stone-800/80 border-transparent text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-700/70'
              }`}
            >
              🏠 Hubs ({hubTrees.length})
            </button>
          )}

          {activeNoteCategory && (
            <button
              type="button"
              onClick={() => setCategoryScope(activeNoteCategory)}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors truncate max-w-[120px] ${
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
              className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-200 outline-none focus:ring-2 focus:ring-amber-500 max-w-[130px]"
            >
              <option value="__all__">All Categories</option>
              <option value="__hubs__">🏠 Hubs Only</option>
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
        <div className="flex-1 overflow-y-auto max-h-68 space-y-1.5 pr-1">
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
                    onSelectNote(n, selectedRole);
                    onClose();
                  }}
                  className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-amber-500/10 dark:hover:bg-amber-500/15 border border-transparent hover:border-amber-500/20 cursor-pointer transition-colors group"
                >
                  <div className="mt-0.5 text-stone-400 group-hover:text-amber-600 shrink-0">
                    {locked ? (
                      <Lock className="w-4 h-4 text-amber-500" />
                    ) : n.isHub ? (
                      <span className="text-sm leading-none">🏠</span>
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
                        {n.isHub && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                            Hub
                          </span>
                        )}
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
            <div className="py-6 text-center text-xs text-stone-400">
              No matching notes found.
            </div>
          )}
        </div>

        {/* Create & Link on the fly */}
        {query.trim() && (
          <button
            type="button"
            disabled={isCreating}
            onClick={handleCreateAndLink}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isCreating
                ? 'Creating...'
                : `Create ${selectedRole === 'part_of' ? 'Hub' : 'Note'} "${query.trim()}" & Connect`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
