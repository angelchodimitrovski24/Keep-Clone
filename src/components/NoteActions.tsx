'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Palette,
  Image as ImageIcon,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Bell,
  Trash2,
  Copy,
  Tag,
  CheckSquare,
  RotateCcw,
  Lock,
  Link2,
  Folder,
  History,
  Timer,
  Share2,
} from 'lucide-react';
import { Note, NoteColor, NoteBackgroundTheme } from '@/types/note';
import { NOTE_COLORS, NOTE_THEMES } from '@/lib/constants';
import { useKeep } from '@/context/KeepContext';

interface NoteActionsProps {
  note: Partial<Note>;
  onColorChange: (color: NoteColor) => void;
  onThemeChange?: (theme: NoteBackgroundTheme) => void;
  onArchiveToggle?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onDeletePermanently?: () => void;
  onDuplicate?: () => void;
  onShare?: () => void;
  onAddImage?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleChecklist?: () => void;
  onAddReminder?: (dateStr: string) => void;
  onToggleLabel?: (labelName: string) => void;
  onSelectCategory?: (categoryName: string | null) => void;
  onEncrypt?: () => void;
  onLinkNote?: () => void;
  onOpenVersions?: () => void;
  onStartReading?: () => void;
  showFormattingToggle?: boolean;
  isFormattingOpen?: boolean;
  onToggleFormatting?: () => void;
  isTrash?: boolean;
  className?: string;
}

export const NoteActions: React.FC<NoteActionsProps> = ({
  note,
  onColorChange,
  onThemeChange,
  onArchiveToggle,
  onDelete,
  onRestore,
  onDeletePermanently,
  onDuplicate,
  onShare,
  onAddImage,
  onToggleChecklist,
  onAddReminder,
  onToggleLabel,
  onSelectCategory,
  onEncrypt,
  onLinkNote,
  onOpenVersions,
  onStartReading,
  showFormattingToggle = false,
  isFormattingOpen = false,
  onToggleFormatting,
  isTrash = false,
  className = '',
}) => {
  const { labels, categories, createLabel, setIsCategoryModalOpen } = useKeep();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
        setShowReminderPicker(false);
        setShowLabelPicker(false);
        setShowCategoryPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // If the note is in Trash, only show Restore and Delete Forever
  if (isTrash) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeletePermanently?.();
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition-colors"
          title="Delete forever"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRestore?.();
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition-colors"
          title="Restore note"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-0.5 sm:gap-1 text-stone-600 dark:text-stone-300 ${className}`}
    >
      {/* Reminder button */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowReminderPicker(!showReminderPicker);
            setShowColorPicker(false);
            setShowMenu(false);
            setShowLabelPicker(false);
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="Remind me"
        >
          <Bell className="w-4 h-4" />
        </button>

        {showReminderPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#2d2e30] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-sm"
          >
            <p className="text-xs font-semibold px-2 py-1 text-stone-500 uppercase tracking-wider">
              Set Reminder
            </p>
            <div className="flex flex-col gap-1 mt-1">
              <button
                type="button"
                onClick={() => {
                  const todayEve = new Date();
                  todayEve.setHours(20, 0, 0, 0);
                  onAddReminder?.(todayEve.toISOString());
                  setShowReminderPicker(false);
                }}
                className="text-left px-2.5 py-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-md transition-colors"
              >
                Later today (8:00 PM)
              </button>
              <button
                type="button"
                onClick={() => {
                  const tmrw = new Date();
                  tmrw.setDate(tmrw.getDate() + 1);
                  tmrw.setHours(8, 0, 0, 0);
                  onAddReminder?.(tmrw.toISOString());
                  setShowReminderPicker(false);
                }}
                className="text-left px-2.5 py-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-md transition-colors"
              >
                Tomorrow (8:00 AM)
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  nextWeek.setHours(8, 0, 0, 0);
                  onAddReminder?.(nextWeek.toISOString());
                  setShowReminderPicker(false);
                }}
                className="text-left px-2.5 py-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-md transition-colors"
              >
                Next week (8:00 AM)
              </button>
              <div className="pt-2 mt-1 border-t border-stone-200 dark:border-stone-700">
                <input
                  type="datetime-local"
                  onChange={(e) => {
                    if (e.target.value) {
                      onAddReminder?.(new Date(e.target.value).toISOString());
                      setShowReminderPicker(false);
                    }
                  }}
                  className="w-full text-xs p-1.5 rounded bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Color Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowColorPicker(!showColorPicker);
            setShowReminderPicker(false);
            setShowMenu(false);
            setShowLabelPicker(false);
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="Background options"
        >
          <Palette className="w-4 h-4" />
        </button>

        {showColorPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 bottom-full mb-2 w-72 max-w-[calc(100vw-2rem)] p-3 bg-white dark:bg-[#2d2e30] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <p className="text-xs font-medium text-stone-500 mb-2 px-1">Colors</p>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.name}
                  onClick={() => {
                    onColorChange(c.id);
                  }}
                  className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border border-stone-300 dark:border-stone-600 transition-transform hover:scale-110 flex items-center justify-center ${
                    note.color === c.id ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: c.swatch }}
                />
              ))}
            </div>

            {onThemeChange && (
              <>
                <p className="text-xs font-medium text-stone-500 mb-2 px-1 border-t border-stone-200 dark:border-stone-700 pt-2">
                  Themes
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {NOTE_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.name}
                      onClick={() => onThemeChange(t.id)}
                      className={`h-9 sm:h-8 flex items-center justify-center text-lg sm:text-base rounded-lg border border-stone-200 dark:border-stone-700 hover:scale-105 transition-all ${
                        note.theme === t.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      {t.icon}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image attachment */}
      {onAddImage && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Add image or file attachment"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.json,.zip,.mp3,.mp4,.wav,*"
            multiple
            className="hidden"
            onChange={onAddImage}
          />
        </>
      )}

      {/* Google Keep "A" Formatting Toggle Button */}
      {showFormattingToggle && onToggleFormatting && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFormatting();
            setShowColorPicker(false);
            setShowReminderPicker(false);
            setShowMenu(false);
            setShowLabelPicker(false);
          }}
          className={`p-2 sm:p-1.5 rounded-full transition-colors flex items-center justify-center font-bold text-sm leading-none ${
            isFormattingOpen
              ? 'bg-amber-100 text-stone-900 dark:bg-amber-900/60 dark:text-amber-200'
              : 'hover:bg-black/10 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200'
          }`}
          title="Toggle text formatting toolbar"
        >
          <span className="underline decoration-2 underline-offset-2">A</span>
        </button>
      )}

      {/* Archive / Unarchive */}
      {onArchiveToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchiveToggle();
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={note.isArchived ? 'Unarchive' : 'Archive'}
        >
          {note.isArchived ? (
            <ArchiveRestore className="w-4 h-4" />
          ) : (
            <Archive className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Delete / Trash note directly */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 hover:text-red-600 transition-colors"
          title="Delete note"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Encrypt / Lock action */}
      {onEncrypt && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEncrypt();
          }}
          className={`p-2 sm:p-1.5 rounded-full transition-colors ${
            note.isEncrypted
              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/15'
              : 'hover:bg-black/10 dark:hover:bg-white/10'
          }`}
          title={note.isEncrypted ? 'Note is encrypted with AES-256 (Settings)' : 'Encrypt note with AES-256 (Password protect)'}
        >
          <Lock className="w-4 h-4" />
        </button>
      )}

      {/* Link Note action */}
      {onLinkNote && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLinkNote();
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="Link to another note"
        >
          <Link2 className="w-4 h-4" />
        </button>
      )}

      {/* Clone Note action */}
      {onDuplicate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="Clone note (Make a copy)"
        >
          <Copy className="w-4 h-4" />
        </button>
      )}

      {/* Share Note action */}
      {onShare && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="Share note (Short link & images)"
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}

      {/* More Options dropdown (...) */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
            setShowColorPicker(false);
            setShowReminderPicker(false);
            setShowLabelPicker(false);
          }}
          className="p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 bottom-full mb-2 w-52 py-1.5 bg-white dark:bg-[#2d2e30] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-sm font-medium animate-in fade-in zoom-in-95 duration-100"
          >
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onShare();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200"
              >
                <Share2 className="w-4 h-4 text-amber-500" />
                Share note (Short link)
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700 text-red-600 dark:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                Delete note
              </button>
            )}

            {onEncrypt && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onEncrypt();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <Lock className="w-4 h-4 text-amber-500" />
                {note.isEncrypted ? 'Encryption Settings (AES-256)' : 'Encrypt Note (AES-256)'}
              </button>
            )}

            {onLinkNote && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onLinkNote();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <Link2 className="w-4 h-4" />
                Link to note
              </button>
            )}

            {onSelectCategory && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowCategoryPicker(true);
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <Folder className="w-4 h-4" />
                Change category
              </button>
            )}

            {onToggleLabel && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowLabelPicker(true);
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <Tag className="w-4 h-4" />
                Change labels
              </button>
            )}

            {onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onDuplicate();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <Copy className="w-4 h-4" />
                Clone note (Make a copy)
              </button>
            )}

            {onOpenVersions && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenVersions();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-amber-500" />
                  <span>Version history</span>
                </div>
                {note.versions && note.versions.length > 1 && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold px-1.5 py-0.5 rounded-full">
                    {note.versions.length}
                  </span>
                )}
              </button>
            )}

            {onStartReading && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onStartReading();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700 text-emerald-600 dark:text-emerald-400"
              >
                <Timer className="w-4 h-4" />
                <span>Start reading stopwatch</span>
              </button>
            )}

            {onToggleChecklist && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onToggleChecklist();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <CheckSquare className="w-4 h-4" />
                {note.isList ? 'Show plain text' : 'Show checkboxes'}
              </button>
            )}
          </div>
        )}

        {/* Category Picker submenu */}
        {showCategoryPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#2d2e30] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-sm animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200 dark:border-stone-700">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Select Category</span>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(false)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Done
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 mb-2">
              {/* None Option */}
              <button
                type="button"
                onClick={() => {
                  onSelectCategory?.(null);
                  setShowCategoryPicker(false);
                }}
                className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  !note.category
                    ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-semibold'
                    : 'hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400'
                }`}
              >
                <span>None (No category)</span>
                {!note.category && <span>✓</span>}
              </button>

              {categories.map((cat) => {
                const isSelected = note.category === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectCategory?.(cat.name);
                      setShowCategoryPicker(false);
                    }}
                    className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-semibold'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{cat.icon || '📁'}</span>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      />
                      <span>{cat.name}</span>
                    </div>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryPicker(false);
                  setIsCategoryModalOpen(true);
                }}
                className="w-full text-center text-xs font-semibold py-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
              >
                + Manage Categories
              </button>
            </div>
          </div>
        )}

        {/* Labels Picker submenu */}
        {showLabelPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#2d2e30] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-sm animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200 dark:border-stone-700">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Label note</span>
              <button
                type="button"
                onClick={() => setShowLabelPicker(false)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Done
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
              {labels.map((lbl) => {
                const isSelected = note.labels?.includes(lbl.name);
                return (
                  <label
                    key={lbl.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleLabel?.(lbl.name)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="truncate">{lbl.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 pt-2 border-t border-stone-200 dark:border-stone-700">
              <input
                type="text"
                placeholder="Create label..."
                value={newLabelText}
                onChange={(e) => setNewLabelText(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newLabelText.trim()) {
                    e.preventDefault();
                    await createLabel(newLabelText.trim());
                    onToggleLabel?.(newLabelText.trim());
                    setNewLabelText('');
                  }
                }}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border-none outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
