'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  GripVertical,
  ExternalLink,
  MoreVertical,
  Pin,
  Trash2,
  Archive,
  Tag,
  Check,
  ChevronRight,
  LayoutGrid,
  Rows,
  Sparkles,
} from 'lucide-react';
import { Note } from '@/types/note';
import { useKeep } from '@/context/KeepContext';

interface NotionNotesListProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onOpenDrawingModal?: (noteId: string) => void;
}

export const NotionNotesList: React.FC<NotionNotesListProps> = ({
  notes,
  onSelectNote,
}) => {
  const {
    addNote,
    updateNote,
    togglePinNote,
    toggleArchiveNote,
    trashNote,
    categories,
    selectedCategory,
    selectedLabel,
    currentFilter,
    layoutMode,
    setLayoutMode,
    setIsNotionTemplateModalOpen,
  } = useKeep();

  const [newTitle, setNewTitle] = useState('');
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [inlineAddTitle, setInlineAddTitle] = useState('');
  const [isAddingAtBottom, setIsAddingAtBottom] = useState(false);
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);

  const bottomInputRef = useRef<HTMLInputElement>(null);
  const insertInputRef = useRef<HTMLInputElement>(null);

  const activeCategory = useMemo(
    () => (selectedCategory ? categories.find((c) => c.name === selectedCategory) : null),
    [selectedCategory, categories]
  );

  // View title and icon
  const viewInfo = useMemo(() => {
    if (currentFilter === 'category' && activeCategory) {
      return {
        icon: activeCategory.icon || '📚',
        title: activeCategory.name,
        breadcrumb: `Categories / ${activeCategory.name}`,
      };
    }
    if (currentFilter === 'label' && selectedLabel) {
      return {
        icon: '🏷️',
        title: selectedLabel,
        breadcrumb: `Labels / #${selectedLabel}`,
      };
    }
    if (currentFilter === 'archive') {
      return {
        icon: '📥',
        title: 'Archive',
        breadcrumb: 'Workspace / Archive',
      };
    }
    if (currentFilter === 'trash') {
      return {
        icon: '🗑️',
        title: 'Trash',
        breadcrumb: 'Workspace / Trash',
      };
    }
    return {
      icon: '📚',
      title: 'Notes & Procedures',
      breadcrumb: 'Workspace / All Notes',
    };
  }, [currentFilter, activeCategory, selectedLabel]);

  // Create new note in this Notion list
  const handleCreateNote = async (title: string, atIndex?: number) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const created = await addNote({
      title: trimmed,
      content: '',
      category: selectedCategory || null,
      labels: selectedLabel ? [selectedLabel] : [],
      noteType: 'notion',
    });

    return created;
  };

  const handleBottomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const titleToCreate = newTitle.trim();
    setNewTitle('');
    await handleCreateNote(titleToCreate);
    // Keep focus for fast rapid-entry of notes
    setTimeout(() => {
      bottomInputRef.current?.focus();
    }, 50);
  };

  const handleInsertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineAddTitle.trim()) {
      setInsertAfterIndex(null);
      return;
    }
    const titleToCreate = inlineAddTitle.trim();
    setInlineAddTitle('');
    setInsertAfterIndex(null);
    await handleCreateNote(titleToCreate);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 animate-in fade-in duration-150">
      {/* Top Notion-style Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 mb-3 select-none">
        <span>Workspace</span>
        <span>/</span>
        <span className="text-stone-600 dark:text-stone-300 font-medium truncate">
          {viewInfo.breadcrumb}
        </span>
      </div>

      {/* Big Notion Page Title Header */}
      <div className="mb-6 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl sm:text-4xl leading-none select-none">{viewInfo.icon}</span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {viewInfo.title}
          </h1>
        </div>

        {/* View Mode Switcher Pill (Notion-style) */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-xs font-medium text-stone-600 dark:text-stone-300">
            <button
              type="button"
              onClick={() => setLayoutMode('notion')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-[#202124] text-stone-900 dark:text-stone-100 shadow-xs"
              title="Notion Page List"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Notion List</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Gallery / Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="List View"
            >
              <Rows className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNotionTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 transition-colors"
              title="Create Notion Template Hub (Today, Days, Keyword)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Use Template</span>
            </button>
            <span className="text-xs text-stone-400 dark:text-stone-500 select-none">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </span>
          </div>
        </div>
      </div>

      {/* Notion Page List Rows */}
      <div className="space-y-0.5 select-none">
        {notes.map((note, index) => {
          const isMenuOpen = activeMenuNoteId === note.id;

          return (
            <React.Fragment key={note.id}>
              <div
                onClick={() => onSelectNote(note)}
                className="group relative flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] transition-colors cursor-pointer"
              >
                {/* Left side: Drag handle, Icon, Title */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Drag Grip Handle on hover */}
                  <span
                    className="opacity-0 group-hover:opacity-40 hover:opacity-100 text-stone-400 dark:text-stone-500 transition-opacity p-0.5 -ml-1 cursor-grab"
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>

                  {/* Notion Page Icon */}
                  <span className="text-stone-400 dark:text-stone-400 shrink-0 group-hover:text-stone-600 dark:group-hover:text-stone-200 transition-colors">
                    <FileText className="w-4 h-4" />
                  </span>

                  {/* Note Title */}
                  <span className="text-[14.5px] font-normal text-stone-800 dark:text-stone-200 tracking-[-0.01em] truncate group-hover:text-stone-950 dark:group-hover:text-white">
                    {note.title || (
                      <span className="text-stone-400 dark:text-stone-500 italic">Untitled</span>
                    )}
                  </span>

                  {/* Pinned Indicator badge */}
                  {note.isPinned && (
                    <span className="shrink-0 text-amber-500">
                      <Pin className="w-3 h-3 fill-current" />
                    </span>
                  )}
                </div>

                {/* Right side: Hover Action buttons (Add, Open, More) */}
                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Insert below button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInsertAfterIndex(index);
                      setTimeout(() => {
                        insertInputRef.current?.focus();
                      }, 50);
                    }}
                    className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                    title="Add a note below"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Open note arrow button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNote(note);
                    }}
                    className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                    title="Open note"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {/* More options button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuNoteId(isMenuOpen ? null : note.id);
                      }}
                      className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                      title="More options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick menu popup */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-7 w-40 py-1 bg-white dark:bg-[#202124] rounded-xl shadow-xl border border-black/[0.08] dark:border-stone-700/60 z-30 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            togglePinNote(note.id);
                            setActiveMenuNoteId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-700 dark:text-stone-300"
                        >
                          <Pin className="w-3.5 h-3.5" />
                          <span>{note.isPinned ? 'Unpin' : 'Pin'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            toggleArchiveNote(note.id);
                            setActiveMenuNoteId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-700 dark:text-stone-300"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>{note.isArchived ? 'Unarchive' : 'Archive'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            trashNote(note.id);
                            setActiveMenuNoteId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-red-500/10 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Insert Row (when user clicked + on a specific note) */}
              {insertAfterIndex === index && (
                <form
                  onSubmit={handleInsertSubmit}
                  className="flex items-center gap-2 px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-lg my-0.5 border border-amber-500/30"
                >
                  <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                  <input
                    ref={insertInputRef}
                    type="text"
                    placeholder="Note title... (press Enter to create)"
                    value={inlineAddTitle}
                    onChange={(e) => setInlineAddTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setInsertAfterIndex(null);
                        setInlineAddTitle('');
                      }
                    }}
                    className="flex-1 bg-transparent text-[14.5px] text-stone-800 dark:text-stone-200 outline-none border-none placeholder:text-stone-400 placeholder:italic"
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
                      setInlineAddTitle('');
                    }}
                    className="p-1 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Notion Quick-Add Row at bottom */}
      <div className="mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
        {isAddingAtBottom ? (
          <form
            onSubmit={handleBottomSubmit}
            className="flex items-center gap-2 px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-lg border border-amber-500/30"
          >
            <FileText className="w-4 h-4 text-amber-500 shrink-0" />
            <input
              ref={bottomInputRef}
              type="text"
              autoFocus
              placeholder="Note title... (press Enter to create, Esc to exit)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsAddingAtBottom(false);
                  setNewTitle('');
                }
              }}
              className="flex-1 bg-transparent text-[14.5px] text-stone-800 dark:text-stone-200 outline-none border-none placeholder:text-stone-400 placeholder:italic"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 transition-colors"
            >
              Add note
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingAtBottom(false);
                setNewTitle('');
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
              setIsAddingAtBottom(true);
              setTimeout(() => {
                bottomInputRef.current?.focus();
              }, 50);
            }}
            className="w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors text-[14px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add a note...</span>
          </button>
        )}
      </div>
    </div>
  );
};
