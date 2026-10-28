'use client';

import React from 'react';
import {
  X,
  Plus,
  FileText,
  Lightbulb,
  Calendar,
  BarChart2,
  Archive,
  Trash2,
  Tag,
  Folder,
} from 'lucide-react';
import { Note } from '@/types/note';
import { ViewFilter } from '@/types/note';
import { NOTE_COLORS } from '@/lib/constants';

interface NoteTabsBarProps {
  openTabIds: string[];
  activeTabId: string | null;
  notes: Note[];
  currentFilter: ViewFilter;
  selectedCategory: string | null;
  selectedLabel: string | null;
  onSelectMainTab: () => void;
  onSelectNoteTab: (noteId: string) => void;
  onCloseNoteTab: (noteId: string) => void;
  onNewNoteTab: () => void;
}

export const NoteTabsBar: React.FC<NoteTabsBarProps> = ({
  openTabIds,
  activeTabId,
  notes,
  currentFilter,
  selectedCategory,
  selectedLabel,
  onSelectMainTab,
  onSelectNoteTab,
  onCloseNoteTab,
  onNewNoteTab,
}) => {
  const getMainViewLabel = () => {
    if (currentFilter === 'calendar') return 'Calendar';
    if (currentFilter === 'stats') return 'Reading Stats';
    if (currentFilter === 'archive') return 'Archive';
    if (currentFilter === 'trash') return 'Trash';
    if (currentFilter === 'label' && selectedLabel) return `#${selectedLabel}`;
    if (currentFilter === 'category' && selectedCategory) return selectedCategory;
    return 'All Notes';
  };

  const getMainViewIcon = () => {
    if (currentFilter === 'calendar') return <Calendar className="w-3.5 h-3.5 text-blue-500" />;
    if (currentFilter === 'stats') return <BarChart2 className="w-3.5 h-3.5 text-purple-500" />;
    if (currentFilter === 'archive') return <Archive className="w-3.5 h-3.5 text-stone-500" />;
    if (currentFilter === 'trash') return <Trash2 className="w-3.5 h-3.5 text-red-500" />;
    if (currentFilter === 'label') return <Tag className="w-3.5 h-3.5 text-amber-500" />;
    if (currentFilter === 'category') return <Folder className="w-3.5 h-3.5 text-emerald-500" />;
    return <Lightbulb className="w-3.5 h-3.5 text-amber-500" />;
  };

  return (
    <div className="w-full bg-stone-100/90 dark:bg-[#1f2022] border-b border-stone-200 dark:border-stone-800 px-2 sm:px-4 pt-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0 select-none">
      <div className="flex items-center gap-1 min-w-0">
        {/* Main View Tab (e.g. All Notes, Calendar, etc.) */}
        <button
          type="button"
          onClick={onSelectMainTab}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-xs font-semibold transition-all border-t border-x cursor-pointer shrink-0 ${
            activeTabId === null
              ? 'bg-white dark:bg-[#18191a] text-stone-900 dark:text-stone-100 border-stone-200 dark:border-stone-700/80 shadow-2xs'
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
          }`}
          title={`View ${getMainViewLabel()}`}
        >
          {getMainViewIcon()}
          <span>{getMainViewLabel()}</span>
        </button>

        {/* Note Tabs */}
        {openTabIds.map((id) => {
          const note = notes.find((n) => n.id === id);
          if (!note) return null;
          const isActive = activeTabId === id;
          const colorObj = NOTE_COLORS.find((c) => c.id === note.color);
          const hasCustomColor = colorObj && colorObj.id !== 'default';

          return (
            <div
              key={id}
              onClick={() => onSelectNoteTab(id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-xs font-medium transition-all border-t border-x cursor-pointer shrink-0 max-w-[220px] ${
                isActive
                  ? 'bg-white dark:bg-[#18191a] text-stone-900 dark:text-stone-100 border-stone-200 dark:border-stone-700/80 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
              }`}
              title={note.title || 'Untitled Note'}
            >
              {/* Color swatch or icon */}
              {hasCustomColor ? (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: colorObj.swatch }}
                />
              ) : (
                <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-500' : 'text-stone-400'}`} />
              )}

              {/* Note Title */}
              <span className="truncate flex-1">
                {note.title?.trim() || <span className="italic text-stone-400">Untitled</span>}
              </span>

              {/* Close Tab Button (✕) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseNoteTab(id);
                }}
                className="p-0.5 -mr-1 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/10 dark:hover:bg-white/15 transition-colors shrink-0"
                title="Close tab"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Open New Note Tab Button (+) */}
        <button
          type="button"
          onClick={onNewNoteTab}
          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title="New note in new tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
