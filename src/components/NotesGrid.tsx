'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useKeep } from '@/context/KeepContext';
import { NoteCard } from './NoteCard';
import { NotionNotesList } from './NotionNotesList';
import { Note } from '@/types/note';
import { Trash2, Lock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE = 20;

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

interface NotesGridProps {
  onSelectNote: (note: Note) => void;
  onOpenDrawingModal: (noteId: string) => void;
}

export const NotesGrid: React.FC<NotesGridProps> = ({
  onSelectNote,
  onOpenDrawingModal,
}) => {
  const {
    notes,
    categories,
    currentFilter,
    selectedLabel,
    selectedCategory,
    searchQuery,
    layoutMode,
    emptyTrash,
    unlockedCategoryNames,
    setUnlockCategoryModalTarget,
    isLoading,
  } = useKeep();

  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 whenever search query, filter view, label, or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [currentFilter, selectedLabel, selectedCategory, searchQuery]);

  // Filter notes based on current view & search query, and sort by updatedAt descending
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        // 1. Trash filter check
        if (currentFilter === 'trash') {
          if (!note.isTrash) return false;
        } else {
          if (note.isTrash) return false;
        }

        // 2. View specific check
        if (currentFilter === 'notes') {
          if (note.isArchived) return false;
        } else if (currentFilter === 'reminders') {
          if (!note.reminder || note.isArchived) return false;
        } else if (currentFilter === 'archive') {
          if (!note.isArchived) return false;
        } else if (currentFilter === 'label') {
          if (!selectedLabel || !note.labels?.includes(selectedLabel)) return false;
        } else if (currentFilter === 'category') {
          if (!selectedCategory || note.category !== selectedCategory) return false;
          if (note.isArchived) return false;
        }

        // 3. Search query check
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchesTitle = note.title?.toLowerCase().includes(query);
          const matchesContent = note.content?.toLowerCase().includes(query);
          const matchesTodos = note.todos?.some((t) => t.text.toLowerCase().includes(query));
          const matchesLabels = note.labels?.some((l) => l.toLowerCase().includes(query));
          const matchesCategory = note.category?.toLowerCase().includes(query);
          return matchesTitle || matchesContent || matchesTodos || matchesLabels || matchesCategory;
        }

        return true;
      })
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [notes, currentFilter, selectedLabel, selectedCategory, searchQuery]);

  const activeCategory = useMemo(
    () => (selectedCategory ? categories.find((c) => c.name === selectedCategory) : null),
    [selectedCategory, categories]
  );

  const isCurrentCategoryLocked = useMemo(() => {
    if (currentFilter !== 'category' || !activeCategory?.isLocked) return false;
    return !unlockedCategoryNames.includes(activeCategory.name.toLowerCase());
  }, [currentFilter, activeCategory, unlockedCategoryNames]);

  // Separate pinned vs unpinned notes (relevant for notes and category view)
  const isNotesOrCategory = currentFilter === 'notes' || currentFilter === 'category';

  // Order notes so pinned appear first, followed by others
  const orderedNotes = useMemo(() => {
    if (!isNotesOrCategory) return filteredNotes;
    const pinned = filteredNotes.filter((n) => n.isPinned);
    const unpinned = filteredNotes.filter((n) => !n.isPinned);
    return [...pinned, ...unpinned];
  }, [filteredNotes, isNotesOrCategory]);

  const totalNotes = orderedNotes.length;
  const totalPages = Math.max(1, Math.ceil(totalNotes / PAGE_SIZE));
  const effectivePage = Math.min(currentPage, totalPages);

  const startIndex = (effectivePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalNotes);

  // Exact 20 notes slice for the current page
  const pagedNotes = useMemo(() => {
    return orderedNotes.slice(startIndex, endIndex);
  }, [orderedNotes, startIndex, endIndex]);

  const pagedPinnedNotes = useMemo(() => {
    return isNotesOrCategory ? pagedNotes.filter((n) => n.isPinned) : [];
  }, [pagedNotes, isNotesOrCategory]);

  const pagedUnpinnedNotes = useMemo(() => {
    return isNotesOrCategory ? pagedNotes.filter((n) => !n.isPinned) : pagedNotes;
  }, [pagedNotes, isNotesOrCategory]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === effectivePage) return;
    setCurrentPage(newPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const pageNumbers = useMemo(() => {
    return getPageNumbers(effectivePage, totalPages);
  }, [effectivePage, totalPages]);

  const gridLayoutClasses =
    layoutMode === 'grid'
      ? 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4'
      : 'max-w-2xl mx-auto flex flex-col gap-2.5 sm:gap-3';

  // If viewing a category that is currently locked, show unlock prompt screen
  if (isCurrentCategoryLocked && activeCategory) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center select-none animate-in fade-in duration-200">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl shadow-xs"
          style={{
            backgroundColor: activeCategory.color ? `${activeCategory.color}20` : 'rgba(245, 158, 11, 0.15)',
            color: activeCategory.color || '#f59e0b',
          }}
        >
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2 flex items-center gap-2">
          <span>{activeCategory.icon || '📁'}</span>
          <span>&quot;{activeCategory.name}&quot; is Locked</span>
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mb-6">
          This category is protected with a password. Enter your password to view notes in this category.
        </p>
        {activeCategory.lockHint && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 px-3 py-1 rounded-full mb-6">
            Hint: {activeCategory.lockHint}
          </p>
        )}
        <button
          type="button"
          onClick={() => setUnlockCategoryModalTarget(activeCategory)}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-xs flex items-center gap-2 transition-all hover:shadow"
        >
          <Lock className="w-4 h-4" />
          Unlock Category
        </button>
      </div>
    );
  }

  // Notion-style List View mode
  if (layoutMode === 'notion') {
    return (
      <div className="w-full">
        {/* Trash View Top Notice */}
        {currentFilter === 'trash' && (
          <div className="max-w-3xl mx-auto flex items-center justify-between p-3 mb-4 bg-stone-100 dark:bg-stone-800/60 rounded-xl text-stone-600 dark:text-stone-300 text-sm italic">
            <span>Notes in Trash are kept local. You can empty it anytime.</span>
            {filteredNotes.length > 0 && (
              <button
                type="button"
                onClick={emptyTrash}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg not-italic font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Empty Trash
              </button>
            )}
          </div>
        )}

        {/* Top Paging Info Bar if multiple pages */}
        {totalPages > 1 && (
          <div className="max-w-3xl mx-auto flex items-center justify-between pb-3 mb-3 border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500">
            <span>
              Showing <strong className="text-stone-800 dark:text-stone-200">{startIndex + 1}–{endIndex}</strong> of{' '}
              <strong className="text-stone-800 dark:text-stone-200">{totalNotes}</strong> notes
            </span>
            <span>Page {effectivePage} of {totalPages} (20 per page)</span>
          </div>
        )}

        <NotionNotesList
          notes={pagedNotes}
          onSelectNote={onSelectNote}
          onOpenDrawingModal={onOpenDrawingModal}
        />

        {/* Bottom Pagination Controls */}
        {totalPages > 1 && (
          <div className="max-w-3xl mx-auto mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 shadow-2xs">
            <span className="text-xs text-stone-600 dark:text-stone-300">
              Page <strong>{effectivePage}</strong> of <strong>{totalPages}</strong> ({PAGE_SIZE} notes per page)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(effectivePage - 1)}
                disabled={effectivePage <= 1}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  effectivePage <= 1
                    ? 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
                    : 'text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="px-1.5 text-stone-400 select-none text-xs">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => handlePageChange(Number(p))}
                      className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        effectivePage === p
                          ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                          : 'text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => handlePageChange(effectivePage + 1)}
                disabled={effectivePage >= totalPages}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  effectivePage >= totalPages
                    ? 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
                    : 'text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
                }`}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Trash View Top Notice */}
      {currentFilter === 'trash' && (
        <div className="flex items-center justify-between p-3 mb-6 bg-stone-100 dark:bg-stone-800/60 rounded-xl text-stone-600 dark:text-stone-300 text-sm italic">
          <span>Notes in Trash are kept local. You can empty it anytime.</span>
          {filteredNotes.length > 0 && (
            <button
              type="button"
              onClick={emptyTrash}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg not-italic font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Empty Trash
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton during initial load */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-stone-200/60 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800/60" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400 select-none">
          <div className="text-6xl mb-4">
            {currentFilter === 'notes' && '💡'}
            {currentFilter === 'reminders' && '⏰'}
            {currentFilter === 'archive' && '📥'}
            {currentFilter === 'trash' && '🗑️'}
            {currentFilter === 'label' && '🏷️'}
          </div>
          <p className="text-lg font-medium text-stone-600 dark:text-stone-300">
            {currentFilter === 'notes' && 'No notes yet. Add one above!'}
            {currentFilter === 'reminders' && 'Notes with upcoming reminders appear here'}
            {currentFilter === 'archive' && 'Your archived notes appear here'}
            {currentFilter === 'trash' && 'No notes in Trash'}
            {currentFilter === 'label' && `No notes tagged with "${selectedLabel}"`}
          </p>
        </div>
      )}

      {/* Top Page Status Indicator when multiple pages */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pb-3 mb-4 px-2 text-xs text-stone-500 border-b border-stone-200/60 dark:border-stone-800/60">
          <span className="flex items-center gap-1.5">
            Showing <strong className="text-stone-800 dark:text-stone-200">{startIndex + 1}–{endIndex}</strong> of{' '}
            <strong className="text-stone-800 dark:text-stone-200">{totalNotes}</strong> notes
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Page {effectivePage} of {totalPages} (20 notes/page)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(effectivePage - 1)}
                disabled={effectivePage <= 1}
                className={`p-1 rounded-md transition-colors ${
                  effectivePage <= 1
                    ? 'text-stone-300 dark:text-stone-700 cursor-not-allowed'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
                }`}
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-stone-700 dark:text-stone-300 px-1 text-xs">{effectivePage}/{totalPages}</span>
              <button
                type="button"
                onClick={() => handlePageChange(effectivePage + 1)}
                disabled={effectivePage >= totalPages}
                className={`p-1 rounded-md transition-colors ${
                  effectivePage >= totalPages
                    ? 'text-stone-300 dark:text-stone-700 cursor-not-allowed'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
                }`}
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pinned Section */}
      {pagedPinnedNotes.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 px-2 flex items-center justify-between">
            <span>📌 Pinned</span>
            <span className="text-[11px] font-normal normal-case text-stone-400">{pagedPinnedNotes.length} pinned</span>
          </p>
          <div className={gridLayoutClasses}>
            {pagedPinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => onSelectNote(note)}
                onOpenDrawingModal={onOpenDrawingModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unpinned / Other Section */}
      {pagedUnpinnedNotes.length > 0 && (
        <div>
          {pagedPinnedNotes.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 px-2">
              Others
            </p>
          )}
          <div className={gridLayoutClasses}>
            {pagedUnpinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => onSelectNote(note)}
                onOpenDrawingModal={onOpenDrawingModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Pagination Bar */}
      {totalPages > 1 && (
        <div className="mt-10 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-stone-100/90 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 shadow-2xs backdrop-blur-xs">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Showing <span className="font-semibold text-stone-800 dark:text-stone-200">{startIndex + 1}–{endIndex}</span> of{' '}
            <span className="font-semibold text-stone-800 dark:text-stone-200">{totalNotes}</span> notes
            <span className="mx-2 text-stone-300 dark:text-stone-600">•</span>
            Page <span className="font-semibold text-stone-800 dark:text-stone-200">{effectivePage}</span> of {totalPages}
          </div>

          <div className="flex items-center gap-1">
            {/* First Page */}
            {effectivePage > 2 && (
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                className="p-1.5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            )}

            {/* Prev Page */}
            <button
              type="button"
              onClick={() => handlePageChange(effectivePage - 1)}
              disabled={effectivePage <= 1}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                effectivePage <= 1
                  ? 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
                  : 'text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
              }`}
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            {/* Page Number Buttons */}
            <div className="flex items-center gap-1 mx-1">
              {pageNumbers.map((p, idx) =>
                p === '...' ? (
                  <span key={`dots-${idx}`} className="px-1.5 text-stone-400 select-none text-xs">
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${p}`}
                    type="button"
                    onClick={() => handlePageChange(Number(p))}
                    className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      effectivePage === p
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                        : 'text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => handlePageChange(effectivePage + 1)}
              disabled={effectivePage >= totalPages}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                effectivePage >= totalPages
                  ? 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
                  : 'text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
              }`}
              title="Next page"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            {effectivePage < totalPages - 1 && (
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                className="p-1.5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
