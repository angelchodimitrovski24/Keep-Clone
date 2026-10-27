'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  GripVertical,
  ExternalLink,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Note } from '@/types/note';
import { useKeep } from '@/context/KeepContext';

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
  const { notes, addNote, trashNote } = useKeep();
  const [newSubpageTitle, setNewSubpageTitle] = useState('');
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [isAddingActive, setIsAddingActive] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const handleBottomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubpageTitle.trim()) return;
    const titleToCreate = newSubpageTitle.trim();
    setNewSubpageTitle('');
    await handleCreateSubpage(titleToCreate);
    setTimeout(() => {
      bottomInputRef.current?.focus();
    }, 50);
  };

  const handleInsertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTitle.trim()) {
      setInsertAfterIndex(null);
      return;
    }
    const titleToCreate = inlineTitle.trim();
    setInlineTitle('');
    const idx = insertAfterIndex;
    setInsertAfterIndex(null);
    if (idx !== null) {
      await handleCreateSubpage(titleToCreate, idx);
    }
  };

  const handleRemoveSubpage = (subNoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIds = childNoteIds.filter((id) => id !== subNoteId);
    onChangeChildIds(nextIds);
  };

  return (
    <div className="w-full my-4 py-3 px-3 sm:px-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.07]">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2 select-none">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>Sub-pages</span>
          <span className="text-[11px] font-normal text-stone-400 dark:text-stone-500 lowercase ml-1">
            ({childNotes.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsCollapsed(false);
            setIsAddingActive(true);
            setTimeout(() => {
              bottomInputRef.current?.focus();
            }, 50);
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add sub-page</span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-0.5 mt-1 select-none">
          {/* List of sub-page notes */}
          {childNotes.map((subNote, index) => (
            <React.Fragment key={subNote.id}>
              <div
                onClick={() => onOpenChildNote(subNote)}
                className="group flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.07] dark:active:bg-white/[0.09] cursor-pointer transition-colors"
              >
                {/* Left: icon & title */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-stone-400 dark:text-stone-400 shrink-0 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="text-[14px] font-normal text-stone-800 dark:text-stone-200 truncate group-hover:text-stone-950 dark:group-hover:text-white">
                    {subNote.title || (
                      <span className="text-stone-400 dark:text-stone-500 italic">Untitled sub-page</span>
                    )}
                  </span>
                </div>

                {/* Right: hover actions */}
                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInsertAfterIndex(index);
                      setTimeout(() => {
                        insertInputRef.current?.focus();
                      }, 50);
                    }}
                    className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    title="Add sub-page below"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChildNote(subNote);
                    }}
                    className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    title="Open sub-page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSubpage(subNote.id, e)}
                    className="p-1 rounded text-stone-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    title="Remove sub-page"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Insert Row */}
              {insertAfterIndex === index && (
                <form
                  onSubmit={handleInsertSubmit}
                  className="flex items-center gap-2 px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-lg my-1 border border-amber-500/30"
                >
                  <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                  <input
                    ref={insertInputRef}
                    type="text"
                    placeholder="Sub-page title... (press Enter to create)"
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setInsertAfterIndex(null);
                        setInlineTitle('');
                      }
                    }}
                    className="flex-1 bg-transparent text-[14px] text-stone-800 dark:text-stone-200 outline-none border-none placeholder:text-stone-400 placeholder:italic"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-stone-950 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInsertAfterIndex(null);
                      setInlineTitle('');
                    }}
                    className="p-1 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </React.Fragment>
          ))}

          {/* Quick-add Row at bottom of list */}
          <div className="pt-1">
            {isAddingActive ? (
              <form
                onSubmit={handleBottomSubmit}
                className="flex items-center gap-2 px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-lg border border-amber-500/30"
              >
                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                <input
                  ref={bottomInputRef}
                  type="text"
                  autoFocus
                  placeholder="Sub-page title... (press Enter to create, Esc to exit)"
                  value={newSubpageTitle}
                  onChange={(e) => setNewSubpageTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsAddingActive(false);
                      setNewSubpageTitle('');
                    }
                  }}
                  className="flex-1 bg-transparent text-[14px] text-stone-800 dark:text-stone-200 outline-none border-none placeholder:text-stone-400 placeholder:italic"
                />
                <button
                  type="submit"
                  disabled={!newSubpageTitle.trim()}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingActive(false);
                    setNewSubpageTitle('');
                  }}
                  className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600"
                >
                  Done
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingActive(true);
                  setTimeout(() => {
                    bottomInputRef.current?.focus();
                  }, 50);
                }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors text-[13.5px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add a sub-page...</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
