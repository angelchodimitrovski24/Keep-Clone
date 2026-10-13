'use client';

import React, { useMemo } from 'react';
import { useKeep } from '@/context/KeepContext';
import { NoteCard } from './NoteCard';
import { Note } from '@/types/note';
import { Trash2 } from 'lucide-react';

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
    currentFilter,
    selectedLabel,
    selectedCategory,
    searchQuery,
    layoutMode,
    emptyTrash,
  } = useKeep();

  // Filter notes based on current view & search query
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
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
    });
  }, [notes, currentFilter, selectedLabel, selectedCategory, searchQuery]);

  // Separate pinned vs unpinned notes (relevant for notes and category view)
  const isNotesOrCategory = currentFilter === 'notes' || currentFilter === 'category';
  const pinnedNotes = useMemo(
    () => (isNotesOrCategory ? filteredNotes.filter((n) => n.isPinned) : []),
    [filteredNotes, isNotesOrCategory]
  );

  const unpinnedNotes = useMemo(
    () => (isNotesOrCategory ? filteredNotes.filter((n) => !n.isPinned) : filteredNotes),
    [filteredNotes, isNotesOrCategory]
  );

  const gridLayoutClasses =
    layoutMode === 'grid'
      ? 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4'
      : 'max-w-2xl mx-auto flex flex-col gap-3';

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

      {/* Empty State */}
      {filteredNotes.length === 0 && (
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

      {/* Pinned Section */}
      {pinnedNotes.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 px-2">
            Pinned
          </p>
          <div className={gridLayoutClasses}>
            {pinnedNotes.map((note) => (
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
      {unpinnedNotes.length > 0 && (
        <div>
          {pinnedNotes.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 px-2">
              Others
            </p>
          )}
          <div className={gridLayoutClasses}>
            {unpinnedNotes.map((note) => (
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
    </div>
  );
};
