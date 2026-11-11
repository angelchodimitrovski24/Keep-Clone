'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useKeep } from '@/context/KeepContext';
import { NoteCard } from './NoteCard';
import { NotionNotesList } from './NotionNotesList';
import { Note } from '@/types/note';
import { Trash2, Lock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Tag } from 'lucide-react';
import { DeleteNotesConfirmModal } from './DeleteNotesConfirmModal';

const pageSize = 20;

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
    currentPage,
    pageSize,
    totalPages,
    totalNotesCount,
    setCurrentPage,
    deleteAllNotesFromCategory,
    deleteAllNotesFromLabel,
  } = useKeep();

  const [isMounted, setIsMounted] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'category' | 'label'; name: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeCategory = useMemo(
    () => (selectedCategory ? categories.find((c) => c.name === selectedCategory) : null),
    [selectedCategory, categories]
  );

  const isCurrentCategoryLocked = useMemo(() => {
    if (searchQuery.trim().length > 0) return false;
    if (currentFilter !== 'category' || !activeCategory?.isLocked) return false;
    return !unlockedCategoryNames.includes(activeCategory.name.toLowerCase());
  }, [currentFilter, activeCategory, unlockedCategoryNames, searchQuery]);

  // Separate pinned vs unpinned notes (relevant for notes, category view, and search)
  const isNotesOrCategory = currentFilter === 'notes' || currentFilter === 'category' || searchQuery.trim().length > 0;

  const viewFilteredNotes = useMemo(() => {
    if (currentFilter === 'trash') return notes.filter((n) => n.isTrash);
    if (currentFilter === 'archive') return notes.filter((n) => !n.isTrash && n.isArchived);
    return notes.filter((n) => !n.isTrash && !n.isArchived);
  }, [notes, currentFilter]);

  const pagedPinnedNotes = useMemo(() => {
    return isNotesOrCategory ? viewFilteredNotes.filter((n) => n.isPinned) : [];
  }, [viewFilteredNotes, isNotesOrCategory]);

  const pagedUnpinnedNotes = useMemo(() => {
    return isNotesOrCategory ? viewFilteredNotes.filter((n) => !n.isPinned) : viewFilteredNotes;
  }, [viewFilteredNotes, isNotesOrCategory]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalNotesCount);

  const pageNumbers = useMemo(() => {
    return getPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

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

  // Show skeleton while loading or before client hydration completes
  if (!isMounted || isLoading) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-stone-200/60 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800/60" />
          ))}
        </div>
      </div>
    );
  }

  const renderBanner = (maxWClass: string = 'w-full') => {
    if (currentFilter === 'trash') {
      return (
        <div className={`${maxWClass} flex items-center justify-between p-3 mb-5 bg-stone-100 dark:bg-stone-800/60 rounded-xl text-stone-600 dark:text-stone-300 text-sm italic`}>
          <span>Notes in Trash are kept local. You can empty it anytime.</span>
          {totalNotesCount > 0 && (
            <button
              type="button"
              onClick={emptyTrash}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg not-italic font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Empty Trash
            </button>
          )}
        </div>
      );
    }

    if (currentFilter === 'category' && selectedCategory) {
      return (
        <div className={`${maxWClass} flex items-center justify-between p-3 mb-5 bg-stone-100/90 dark:bg-stone-800/60 rounded-xl text-stone-700 dark:text-stone-300 text-sm border border-stone-200/60 dark:border-stone-700/60 shadow-2xs`}>
          <div className="flex items-center gap-2">
            <span className="text-base">{activeCategory?.icon || '📁'}</span>
            <span className="font-semibold text-stone-900 dark:text-stone-100">{selectedCategory}</span>
            <span className="text-xs text-stone-400 dark:text-stone-500">• {totalNotesCount} {totalNotesCount === 1 ? 'note' : 'notes'}</span>
          </div>
          {totalNotesCount > 0 && (
            <button
              type="button"
              onClick={() => setDeleteConfirmTarget({ type: 'category', name: selectedCategory })}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title={`Delete all notes in category "${selectedCategory}"`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete all notes</span>
            </button>
          )}
        </div>
      );
    }

    if (currentFilter === 'label' && selectedLabel) {
      return (
        <div className={`${maxWClass} flex items-center justify-between p-3 mb-5 bg-stone-100/90 dark:bg-stone-800/60 rounded-xl text-stone-700 dark:text-stone-300 text-sm border border-stone-200/60 dark:border-stone-700/60 shadow-2xs`}>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-stone-900 dark:text-stone-100">{selectedLabel}</span>
            <span className="text-xs text-stone-400 dark:text-stone-500">• {totalNotesCount} {totalNotesCount === 1 ? 'note' : 'notes'}</span>
          </div>
          {totalNotesCount > 0 && (
            <button
              type="button"
              onClick={() => setDeleteConfirmTarget({ type: 'label', name: selectedLabel })}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title={`Delete all notes tagged with "${selectedLabel}"`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete all notes</span>
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  const confirmModal = deleteConfirmTarget ? (
    <DeleteNotesConfirmModal
      isOpen={!!deleteConfirmTarget}
      onClose={() => setDeleteConfirmTarget(null)}
      targetType={deleteConfirmTarget.type}
      targetName={deleteConfirmTarget.name}
      noteCount={totalNotesCount}
      onConfirm={async (permanent) => {
        if (deleteConfirmTarget.type === 'category') {
          await deleteAllNotesFromCategory(deleteConfirmTarget.name, permanent);
        } else {
          await deleteAllNotesFromLabel(deleteConfirmTarget.name, permanent);
        }
      }}
    />
  ) : null;

  // Notion-style List View mode
  if (layoutMode === 'notion') {
    return (
      <div className="w-full">
        {renderBanner('max-w-3xl mx-auto')}

        {/* Top Paging Info Bar if multiple pages */}
        {totalPages > 1 && (
          <div className="max-w-3xl mx-auto flex items-center justify-between pb-3 mb-3 border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500">
            <span>
              Showing <strong className="text-stone-800 dark:text-stone-200">{startIndex + 1}–{endIndex}</strong> of{' '}
              <strong className="text-stone-800 dark:text-stone-200">{totalNotesCount}</strong> notes
            </span>
            <span>Page {currentPage} of {totalPages} (20 per page)</span>
          </div>
        )}

        <NotionNotesList
          notes={viewFilteredNotes}
          onSelectNote={onSelectNote}
          onOpenDrawingModal={onOpenDrawingModal}
        />

        {/* Bottom Pagination Controls */}
        {totalPages > 1 && (
          <div className="max-w-3xl mx-auto mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 shadow-2xs">
            <span className="text-xs text-stone-600 dark:text-stone-300">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({pageSize} notes per page)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  currentPage <= 1
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
                        currentPage === p
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
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  currentPage >= totalPages
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

        {confirmModal}
      </div>
    );
  }

  return (
    <div className="w-full">
      {renderBanner()}

      {/* Empty State */}
      {totalNotesCount === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400 select-none text-center px-4">
          <div className="text-6xl mb-4">
            {searchQuery.trim()
              ? '🔍'
              : currentFilter === 'notes'
              ? '💡'
              : currentFilter === 'reminders'
              ? '⏰'
              : currentFilter === 'archive'
              ? '📥'
              : currentFilter === 'trash'
              ? '🗑️'
              : '🏷️'}
          </div>
          <p className="text-lg font-medium text-stone-600 dark:text-stone-300">
            {searchQuery.trim()
              ? `No notes matching "${searchQuery.trim()}"`
              : currentFilter === 'notes'
              ? 'No notes yet. Add one above!'
              : currentFilter === 'reminders'
              ? 'Notes with upcoming reminders appear here'
              : currentFilter === 'archive'
              ? 'Your archived notes appear here'
              : currentFilter === 'trash'
              ? 'No notes in Trash'
              : currentFilter === 'label'
              ? `No notes tagged with "${selectedLabel}"`
              : 'No notes found'}
          </p>
          {searchQuery.trim() && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
              Tip: Search matches Note Title, Content body, Category name, and Labels
            </p>
          )}
        </div>
      )}

      {/* Top Page Status Indicator when multiple pages */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pb-3 mb-4 px-2 text-xs text-stone-500 border-b border-stone-200/60 dark:border-stone-800/60">
          <span className="flex items-center gap-1.5">
            Showing <strong className="text-stone-800 dark:text-stone-200">{startIndex + 1}–{endIndex}</strong> of{' '}
            <strong className="text-stone-800 dark:text-stone-200">{totalNotesCount}</strong> notes
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Page {currentPage} of {totalPages} (20 notes/page)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className={`p-1 rounded-md transition-colors ${
                  currentPage <= 1
                    ? 'text-stone-300 dark:text-stone-700 cursor-not-allowed'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
                }`}
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-stone-700 dark:text-stone-300 px-1 text-xs">{currentPage}/{totalPages}</span>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className={`p-1 rounded-md transition-colors ${
                  currentPage >= totalPages
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
            Showing{' '}
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              {totalNotesCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, totalNotesCount)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-stone-800 dark:text-stone-200">{totalNotesCount.toLocaleString()}</span> notes
            <span className="mx-2 text-stone-300 dark:text-stone-600">•</span>
            Page <span className="font-semibold text-stone-800 dark:text-stone-200">{currentPage}</span> of{' '}
            <span className="font-semibold text-stone-800 dark:text-stone-200">{totalPages.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1">
            {/* First Page */}
            {currentPage > 2 && (
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
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                currentPage <= 1
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
                      currentPage === p
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
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                currentPage >= totalPages
                  ? 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
                  : 'text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer'
              }`}
              title="Next page"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            {currentPage < totalPages - 1 && (
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

      {confirmModal}
    </div>
  );
};
