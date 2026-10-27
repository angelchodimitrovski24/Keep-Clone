'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  GripVertical,
  ArrowUpRight,
  X,
  Search,
  Link2,
  CheckSquare,
  Rows,
  LayoutGrid,
} from 'lucide-react';
import { Note } from '@/types/note';
import { useKeep } from '@/context/KeepContext';
import { LinkNoteModal } from './LinkNoteModal';

interface NotionSubpagesSectionProps {
  parentNoteId: string;
  childNoteIds: string[];
  onChangeChildIds: (newIds: string[]) => void;
  onOpenChildNote: (note: Note) => void;
  category?: string | null;
}

export const NotionSubpagesSection: React.FC<NotionSubpagesSectionProps> = ({
  parentNoteId,
  childNoteIds = [],
  onChangeChildIds,
  onOpenChildNote,
  category,
}) => {
  const { notes, addNote, updateNote } = useKeep();
  const [newSubpageTitle, setNewSubpageTitle] = useState('');
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [isAddingActive, setIsAddingActive] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');

  const [bottomSelectedIndex, setBottomSelectedIndex] = useState<number>(-1);
  const [inlineSelectedIndex, setInlineSelectedIndex] = useState<number>(-1);

  const bottomInputRef = useRef<HTMLInputElement>(null);
  const insertInputRef = useRef<HTMLInputElement>(null);

  // Resolve child notes in the specified order
  const childNotes = useMemo(() => {
    const list: Note[] = [];
    for (const id of childNoteIds) {
      const found = notes.find((n) => n.id === id && !n.isTrash);
      if (found) list.push(found);
    }
    // Also include any notes that have parentNoteId === parentNoteId but not yet in childNoteIds
    if (parentNoteId) {
      const extra = notes.filter(
        (n) => n.parentNoteId === parentNoteId && !n.isTrash && !childNoteIds.includes(n.id)
      );
      list.push(...extra);
    }
    return list;
  }, [childNoteIds, notes, parentNoteId]);

  // Real-time matching existing notes for bottom input
  const bottomMatches = useMemo(() => {
    const q = newSubpageTitle.trim().toLowerCase();
    if (!q) return [];
    return notes
      .filter((n) => {
        if (n.isTrash) return false;
        if (parentNoteId && n.id === parentNoteId) return false;
        if (childNoteIds.includes(n.id)) return false;

        const titleMatch = Boolean(n.title && n.title.toLowerCase().includes(q));
        const contentMatch = Boolean(n.content && n.content.toLowerCase().includes(q));
        const labelMatch = Boolean(n.labels && n.labels.some((l) => l.toLowerCase().includes(q)));
        const categoryMatch = Boolean(n.category && n.category.toLowerCase().includes(q));

        return titleMatch || contentMatch || labelMatch || categoryMatch;
      })
      .slice(0, 6);
  }, [newSubpageTitle, notes, parentNoteId, childNoteIds]);

  // Real-time matching existing notes for inline input
  const inlineMatches = useMemo(() => {
    const q = inlineTitle.trim().toLowerCase();
    if (!q) return [];
    return notes
      .filter((n) => {
        if (n.isTrash) return false;
        if (parentNoteId && n.id === parentNoteId) return false;
        if (childNoteIds.includes(n.id)) return false;

        const titleMatch = Boolean(n.title && n.title.toLowerCase().includes(q));
        const contentMatch = Boolean(n.content && n.content.toLowerCase().includes(q));
        const labelMatch = Boolean(n.labels && n.labels.some((l) => l.toLowerCase().includes(q)));
        const categoryMatch = Boolean(n.category && n.category.toLowerCase().includes(q));

        return titleMatch || contentMatch || labelMatch || categoryMatch;
      })
      .slice(0, 6);
  }, [inlineTitle, notes, parentNoteId, childNoteIds]);

  const handleCreateSubpage = async (title: string, insertAtIndex?: number) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const created = await addNote({
      title: trimmed,
      content: '',
      parentNoteId: parentNoteId || null,
      category: category || null,
      noteType: 'notion',
    });

    if (created) {
      let updated: string[];
      if (typeof insertAtIndex === 'number' && insertAtIndex >= 0) {
        updated = [...childNoteIds];
        updated.splice(insertAtIndex + 1, 0, created.id);
      } else {
        updated = [...childNoteIds, created.id];
      }
      onChangeChildIds(updated);
    }
  };

  const handleAttachExistingNote = async (targetNote: Note, insertAtIndex?: number) => {
    if (childNoteIds.includes(targetNote.id)) return;

    let updated: string[];
    if (typeof insertAtIndex === 'number' && insertAtIndex >= 0) {
      updated = [...childNoteIds];
      updated.splice(insertAtIndex + 1, 0, targetNote.id);
    } else {
      updated = [...childNoteIds, targetNote.id];
    }
    onChangeChildIds(updated);

    if (parentNoteId) {
      await updateNote(targetNote.id, { parentNoteId });
    }
  };

  const handleBottomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bottomSelectedIndex >= 0 && bottomSelectedIndex < bottomMatches.length) {
      const selected = bottomMatches[bottomSelectedIndex];
      setNewSubpageTitle('');
      setBottomSelectedIndex(-1);
      await handleAttachExistingNote(selected);
      setTimeout(() => {
        bottomInputRef.current?.focus();
      }, 50);
      return;
    }

    if (!newSubpageTitle.trim()) return;
    const titleToCreate = newSubpageTitle.trim();
    setNewSubpageTitle('');
    setBottomSelectedIndex(-1);
    await handleCreateSubpage(titleToCreate);
    setTimeout(() => {
      bottomInputRef.current?.focus();
    }, 50);
  };

  const handleInsertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = insertAfterIndex;

    if (inlineSelectedIndex >= 0 && inlineSelectedIndex < inlineMatches.length) {
      const selected = inlineMatches[inlineSelectedIndex];
      setInlineTitle('');
      setInlineSelectedIndex(-1);
      setInsertAfterIndex(null);
      if (idx !== null) {
        await handleAttachExistingNote(selected, idx);
      }
      return;
    }

    if (!inlineTitle.trim()) {
      setInsertAfterIndex(null);
      return;
    }
    const titleToCreate = inlineTitle.trim();
    setInlineTitle('');
    setInlineSelectedIndex(-1);
    setInsertAfterIndex(null);
    if (idx !== null) {
      await handleCreateSubpage(titleToCreate, idx);
    }
  };

  const handleRemoveSubpage = (subNoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIds = childNoteIds.filter((id) => id !== subNoteId);
    onChangeChildIds(nextIds);
    if (parentNoteId) {
      const target = notes.find((n) => n.id === subNoteId);
      if (target && target.parentNoteId === parentNoteId) {
        updateNote(subNoteId, { parentNoteId: null });
      }
    }
  };

  return (
    <div className="w-full my-2 select-none">
      {/* Notion Database / Sub-pages View Switcher Header */}
      <div className="flex items-center justify-between mb-2.5 pb-1 text-xs">
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/60 p-0.5 rounded-lg border border-black/[0.05] dark:border-white/[0.05]">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-[#2c2c2c] text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
            title="List view"
          >
            <Rows className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'gallery'
                ? 'bg-white dark:bg-[#2c2c2c] text-amber-600 dark:text-amber-400 shadow-2xs font-semibold'
                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
            title="Gallery view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Gallery</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Link Existing Note Button */}
          <button
            type="button"
            onClick={() => setIsLinkModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors px-2 py-1 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
            title="Search and link an existing note"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link existing</span>
          </button>

          {/* New Page Button */}
          <button
            type="button"
            onClick={() => {
              setIsAddingActive(true);
              setTimeout(() => {
                bottomInputRef.current?.focus();
              }, 50);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors px-2 py-1 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New page</span>
          </button>
        </div>
      </div>

      {/* ================= LIST VIEW (Matching the user screenshot) ================= */}
      {viewMode === 'list' ? (
        <div className="space-y-0.5">
          {childNotes.map((subNote, index) => (
            <React.Fragment key={subNote.id}>
              <div
                onClick={() => onOpenChildNote(subNote)}
                className="group relative flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-black/[0.04] dark:hover:bg-[#252525] active:bg-black/[0.06] dark:active:bg-[#2c2c2c] cursor-pointer transition-colors"
              >
                {/* Left side: Gutter (+ and :: on hover) + Page Icon + Title */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Left Gutter: + and :: shown only on hover */}
                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -ml-1 text-stone-400 dark:text-stone-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInsertAfterIndex(index);
                        setInlineSelectedIndex(-1);
                        setTimeout(() => {
                          insertInputRef.current?.focus();
                        }, 50);
                      }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                      title="Add sub-page below"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span
                      className="p-0.5 cursor-grab hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* Notion Document Icon */}
                  <span className="text-stone-400 dark:text-stone-400 shrink-0">
                    {subNote.isList ? (
                      <CheckSquare className="w-4 h-4 text-stone-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-stone-400" />
                    )}
                  </span>

                  {/* Page Title */}
                  <span className="text-[14.5px] font-normal text-stone-800 dark:text-stone-100 truncate tracking-[-0.01em]">
                    {subNote.title || (
                      <span className="text-stone-400 dark:text-stone-500 italic">Untitled</span>
                    )}
                  </span>
                </div>

                {/* Right side: Hover Action buttons (↗ open arrow and X) */}
                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChildNote(subNote);
                    }}
                    className="p-1 rounded text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors"
                    title="Open page"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSubpage(subNote.id, e)}
                    className="p-1 rounded text-stone-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors"
                    title="Remove sub-page"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Insert Row */}
              {insertAfterIndex === index && (
                <div className="relative my-1">
                  <form
                    onSubmit={handleInsertSubmit}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-[#202124] rounded-lg border border-amber-500/50 shadow-xs"
                  >
                    <Search className="w-4 h-4 text-amber-500 shrink-0" />
                    <input
                      ref={insertInputRef}
                      type="text"
                      placeholder="Search existing note or type title to create... (↓/↑ to navigate)"
                      value={inlineTitle}
                      onChange={(e) => {
                        setInlineTitle(e.target.value);
                        setInlineSelectedIndex(-1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          if (inlineMatches.length > 0) {
                            e.preventDefault();
                            setInlineSelectedIndex((prev) =>
                              prev < inlineMatches.length - 1 ? prev + 1 : 0
                            );
                          }
                        } else if (e.key === 'ArrowUp') {
                          if (inlineMatches.length > 0) {
                            e.preventDefault();
                            setInlineSelectedIndex((prev) =>
                              prev > 0 ? prev - 1 : inlineMatches.length - 1
                            );
                          }
                        } else if (e.key === 'Escape') {
                          setInsertAfterIndex(null);
                          setInlineTitle('');
                          setInlineSelectedIndex(-1);
                        }
                      }}
                      className="flex-1 bg-transparent text-[13.5px] text-stone-800 dark:text-stone-200 outline-none border-none placeholder:text-stone-400 placeholder:italic"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-stone-950 transition-colors"
                    >
                      {inlineSelectedIndex >= 0 ? 'Link' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInsertAfterIndex(null);
                        setInlineTitle('');
                        setInlineSelectedIndex(-1);
                      }}
                      className="p-1 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      Cancel
                    </button>
                  </form>

                  {/* Inline Autocomplete Dropdown */}
                  {inlineMatches.length > 0 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 right-0 top-full mt-1 z-40 bg-white dark:bg-[#202124] rounded-xl shadow-xl border border-stone-200 dark:border-stone-700/80 overflow-hidden divide-y divide-black/[0.04] dark:divide-white/[0.06]"
                    >
                      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-900/50 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-amber-500" />
                          Link existing note
                        </span>
                        <span>{inlineMatches.length} matching</span>
                      </div>
                      <div className="max-h-52 overflow-y-auto py-1">
                        {inlineMatches.map((m, idx) => {
                          const isHighlighted = inlineSelectedIndex === idx;
                          return (
                            <div
                              key={m.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const afterIdx = insertAfterIndex;
                                setNewSubpageTitle('');
                                setInlineTitle('');
                                setInlineSelectedIndex(-1);
                                setInsertAfterIndex(null);
                                if (afterIdx !== null) {
                                  handleAttachExistingNote(m, afterIdx);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={() => setInlineSelectedIndex(idx)}
                              className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                                isHighlighted
                                  ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100'
                                  : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-stone-800 dark:text-stone-200'
                              }`}
                            >
                              <div className="mt-0.5 text-stone-400 shrink-0">
                                {m.isList ? <CheckSquare className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-medium truncate">
                                    {m.title || 'Untitled note'}
                                  </span>
                                  {m.category && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 shrink-0">
                                      {m.category}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">
                                  {m.isList
                                    ? `${m.todos.length} checklist items`
                                    : m.content?.replace(/<[^>]+>/g, '').trim() || 'No preview content'}
                                </p>
                              </div>
                              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0 self-center">
                                Link ↵
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const titleToCreate = inlineTitle.trim();
                          const afterIdx = insertAfterIndex;
                          setInlineTitle('');
                          setInlineSelectedIndex(-1);
                          setInsertAfterIndex(null);
                          if (afterIdx !== null) {
                            handleCreateSubpage(titleToCreate, afterIdx);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 bg-stone-50/70 dark:bg-stone-900/40 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] text-stone-600 dark:text-stone-300 transition-colors text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span>Create new sub-page &ldquo;{inlineTitle.trim()}&rdquo;</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : (
        /* ================= GALLERY VIEW ================= */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          {childNotes.map((subNote) => (
            <div
              key={subNote.id}
              onClick={() => onOpenChildNote(subNote)}
              className="group p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] hover:border-amber-500/40 bg-black/[0.01] dark:bg-white/[0.02] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] cursor-pointer transition-all flex flex-col justify-between min-h-[90px]"
            >
              <div>
                <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-400 mb-1.5">
                  <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    {subNote.title || 'Untitled'}
                  </span>
                </div>
                <p className="text-[11.5px] text-stone-400 line-clamp-2">
                  {subNote.isList
                    ? `${subNote.todos.length} items`
                    : subNote.content?.replace(/<[^>]+>/g, '').trim() || 'Empty page'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 text-[10px] text-stone-400">
                <span>{subNote.category || 'Page'}</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-add Row at bottom of list */}
      <div className="pt-2">
        {isAddingActive ? (
          <div className="relative">
            <form
              onSubmit={handleBottomSubmit}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-[#202124] rounded-lg border border-amber-500/50 shadow-xs"
            >
              <Search className="w-4 h-4 text-amber-500 shrink-0" />
              <input
                ref={bottomInputRef}
                type="text"
                autoFocus
                placeholder="Search existing note or type title to create... (↓/↑ to navigate)"
                value={newSubpageTitle}
                onChange={(e) => {
                  setNewSubpageTitle(e.target.value);
                  setBottomSelectedIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    if (bottomMatches.length > 0) {
                      e.preventDefault();
                      setBottomSelectedIndex((prev) =>
                        prev < bottomMatches.length - 1 ? prev + 1 : 0
                      );
                    }
                  } else if (e.key === 'ArrowUp') {
                    if (bottomMatches.length > 0) {
                      e.preventDefault();
                      setBottomSelectedIndex((prev) =>
                        prev > 0 ? prev - 1 : bottomMatches.length - 1
                      );
                    }
                  } else if (e.key === 'Escape') {
                    setIsAddingActive(false);
                    setNewSubpageTitle('');
                    setBottomSelectedIndex(-1);
                  }
                }}
                className="flex-1 bg-transparent text-[13.5px] text-stone-800 dark:text-stone-200 outline-none border-none placeholder:text-stone-400 placeholder:italic"
              />
              <button
                type="submit"
                disabled={!newSubpageTitle.trim()}
                className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 transition-colors"
              >
                {bottomSelectedIndex >= 0 ? 'Link' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingActive(false);
                  setNewSubpageTitle('');
                  setBottomSelectedIndex(-1);
                }}
                className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600"
              >
                Done
              </button>
            </form>

            {/* Bottom Autocomplete Dropdown */}
            {bottomMatches.length > 0 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 right-0 top-full mt-1 z-40 bg-white dark:bg-[#202124] rounded-xl shadow-xl border border-stone-200 dark:border-stone-700/80 overflow-hidden divide-y divide-black/[0.04] dark:divide-white/[0.06]"
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-900/50 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-amber-500" />
                    Link existing note
                  </span>
                  <span>{bottomMatches.length} matching</span>
                </div>
                <div className="max-h-52 overflow-y-auto py-1">
                  {bottomMatches.map((m, idx) => {
                    const isHighlighted = bottomSelectedIndex === idx;
                    return (
                      <div
                        key={m.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setNewSubpageTitle('');
                          setBottomSelectedIndex(-1);
                          handleAttachExistingNote(m);
                          setTimeout(() => {
                            bottomInputRef.current?.focus();
                          }, 50);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => setBottomSelectedIndex(idx)}
                        className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100'
                            : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-stone-800 dark:text-stone-200'
                        }`}
                      >
                        <div className="mt-0.5 text-stone-400 shrink-0">
                          {m.isList ? <CheckSquare className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium truncate">
                              {m.title || 'Untitled note'}
                            </span>
                            {m.category && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 shrink-0">
                                {m.category}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">
                            {m.isList
                              ? `${m.todos.length} checklist items`
                              : m.content?.replace(/<[^>]+>/g, '').trim() || 'No preview content'}
                          </p>
                        </div>
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0 self-center">
                          Link ↵
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const titleToCreate = newSubpageTitle.trim();
                    setNewSubpageTitle('');
                    setBottomSelectedIndex(-1);
                    handleCreateSubpage(titleToCreate);
                    setTimeout(() => {
                      bottomInputRef.current?.focus();
                    }, 50);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 bg-stone-50/70 dark:bg-stone-900/40 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] text-stone-600 dark:text-stone-300 transition-colors text-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-500" />
                  <span>Create new sub-page &ldquo;{newSubpageTitle.trim()}&rdquo;</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAddingActive(true);
                setTimeout(() => {
                  bottomInputRef.current?.focus();
                }, 50);
              }}
              className="flex-1 text-left flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors text-[14px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add a page...</span>
            </button>
          </div>
        )}
      </div>

      {/* Full Link Note Search Dialog */}
      <LinkNoteModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSelectNote={(targetNote) => handleAttachExistingNote(targetNote)}
        currentNoteId={parentNoteId}
        notes={notes.filter((n) => !childNoteIds.includes(n.id))}
      />
    </div>
  );
};
