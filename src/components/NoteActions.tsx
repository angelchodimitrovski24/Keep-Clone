'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  X,
  ChevronLeft,
  ChevronRight,
  Check,
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
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
        setShowReminderPicker(false);
        setShowLabelPicker(false);
        setShowCategoryPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
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

        {!isMobile && showReminderPicker && (
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

        {!isMobile && showColorPicker && (
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
          className="hidden sm:inline-flex p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
          className="hidden md:inline-flex p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 hover:text-red-600 transition-colors"
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
          className={`hidden sm:inline-flex p-2 sm:p-1.5 rounded-full transition-colors ${
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
          className="hidden md:inline-flex p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
          className="hidden md:inline-flex p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
          className="hidden sm:inline-flex p-2 sm:p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
            setShowCategoryPicker(false);
          }}
          className={`p-2 sm:p-1.5 rounded-full transition-colors ${
            showMenu
              ? 'bg-black/15 dark:bg-white/20 text-stone-900 dark:text-stone-100'
              : 'hover:bg-black/10 dark:hover:bg-white/10'
          }`}
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {!isMobile && showMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute right-0 bottom-full mb-2 w-56 max-w-[calc(100vw-2rem)] py-1.5 bg-white dark:bg-[#2d2e30] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-sm font-medium animate-in fade-in zoom-in-95 duration-100 max-h-[70vh] overflow-y-auto"
          >
            {onArchiveToggle && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onArchiveToggle();
                }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 flex items-center gap-2.5 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200"
              >
                {note.isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 text-amber-500" />
                    Unarchive note
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    Archive note
                  </>
                )}
              </button>
            )}

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
        {!isMobile && showCategoryPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute right-0 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#2d2e30] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-sm animate-in fade-in zoom-in-95 duration-100 max-h-[70vh] overflow-y-auto"
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
        {!isMobile && showLabelPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute right-0 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#2d2e30] rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-sm animate-in fade-in zoom-in-95 duration-100 max-h-[70vh] overflow-y-auto"
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

      {/* Native Mobile Bottom Sheet (For Android & Small Screens < 640px) */}
      {mounted &&
        isMobile &&
        typeof document !== 'undefined' &&
        (showMenu || showCategoryPicker || showLabelPicker || showColorPicker || showReminderPicker) &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
            onClick={() => {
              setShowMenu(false);
              setShowCategoryPicker(false);
              setShowLabelPicker(false);
              setShowColorPicker(false);
              setShowReminderPicker(false);
            }}
          >
            <div
              className="w-full max-h-[85vh] bg-white dark:bg-[#202124] rounded-t-3xl shadow-2xl border-t border-stone-200/80 dark:border-stone-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle pill */}
              <div className="w-10 h-1 bg-stone-300 dark:bg-stone-600 rounded-full mx-auto mt-3 mb-1 shrink-0" />

              {/* 1. Mobile 3-Dots Menu */}
              {showMenu && (
                <>
                  <div className="px-5 py-3 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 shrink-0">
                    <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Note Options
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMenu(false)}
                      className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="overflow-y-auto px-3 py-2 space-y-1 divide-y divide-stone-100/60 dark:divide-stone-800/40">
                    <div className="space-y-1 pb-1">
                      {onArchiveToggle && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onArchiveToggle();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          {note.isArchived ? (
                            <>
                              <ArchiveRestore className="w-5 h-5 text-amber-500 shrink-0" />
                              <span>Unarchive note</span>
                            </>
                          ) : (
                            <>
                              <Archive className="w-5 h-5 text-stone-500 shrink-0" />
                              <span>Archive note</span>
                            </>
                          )}
                        </button>
                      )}

                      {onShare && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onShare();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <Share2 className="w-5 h-5 text-amber-500 shrink-0" />
                          <span>Share note (Short link & images)</span>
                        </button>
                      )}

                      {onDuplicate && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onDuplicate();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <Copy className="w-5 h-5 text-stone-500 shrink-0" />
                          <span>Make a copy</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1 py-1">
                      {onSelectCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            setShowCategoryPicker(true);
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <Folder className="w-5 h-5 text-blue-500 shrink-0" />
                            <span className="truncate">
                              {note.category ? `Category: ${note.category}` : 'Change category'}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                        </button>
                      )}

                      {onToggleLabel && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            setShowLabelPicker(true);
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <Tag className="w-5 h-5 text-emerald-500 shrink-0" />
                            <span className="truncate">
                              {note.labels && note.labels.length > 0
                                ? `Labels (${note.labels.length})`
                                : 'Change labels'}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                        </button>
                      )}

                      {onToggleChecklist && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onToggleChecklist();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <CheckSquare className="w-5 h-5 text-stone-500 shrink-0" />
                          <span>{note.isList ? 'Show plain text' : 'Show checkboxes'}</span>
                        </button>
                      )}

                      {onLinkNote && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onLinkNote();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <Link2 className="w-5 h-5 text-purple-500 shrink-0" />
                          <span>Link to note</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1 py-1">
                      {onEncrypt && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onEncrypt();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <Lock className="w-5 h-5 text-amber-500 shrink-0" />
                          <span>
                            {note.isEncrypted
                              ? 'Encryption Settings (AES-256)'
                              : 'Encrypt Note (AES-256)'}
                          </span>
                        </button>
                      )}

                      {onOpenVersions && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onOpenVersions();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-sm transition-colors"
                        >
                          <div className="flex items-center gap-3.5">
                            <History className="w-5 h-5 text-amber-500 shrink-0" />
                            <span>Version history</span>
                          </div>
                          {note.versions && note.versions.length > 1 && (
                            <span className="text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full">
                              {note.versions.length} versions
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
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-medium text-sm transition-colors"
                        >
                          <Timer className="w-5 h-5 shrink-0" />
                          <span>Start reading stopwatch</span>
                        </button>
                      )}
                    </div>

                    {onDelete && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onDelete();
                          }}
                          className="w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3.5 hover:bg-red-50 dark:hover:bg-red-950/40 active:bg-red-100 text-red-600 dark:text-red-400 font-medium text-sm transition-colors"
                        >
                          <Trash2 className="w-5 h-5 shrink-0" />
                          <span>Delete note</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 2. Mobile Category Picker */}
              {showCategoryPicker && (
                <>
                  <div className="px-4 py-3 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryPicker(false);
                        setShowMenu(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 py-1 px-2 rounded-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Select Category
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCategoryPicker(false)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg"
                    >
                      Done
                    </button>
                  </div>

                  <div className="overflow-y-auto px-3 py-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory?.(null);
                        setShowCategoryPicker(false);
                      }}
                      className={`w-full text-left flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-medium transition-colors ${
                        !note.category
                          ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-semibold'
                          : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <span>None (No category)</span>
                      {!note.category && <Check className="w-4 h-4 text-amber-600" />}
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
                          className={`w-full text-left flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-semibold'
                              : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base">{cat.icon || '📁'}</span>
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: cat.color || '#3b82f6' }}
                            />
                            <span>{cat.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-3 border-t border-stone-100 dark:border-stone-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryPicker(false);
                        setIsCategoryModalOpen(true);
                      }}
                      className="w-full py-2.5 text-center text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors"
                    >
                      + Manage Categories
                    </button>
                  </div>
                </>
              )}

              {/* 3. Mobile Labels Picker */}
              {showLabelPicker && (
                <>
                  <div className="px-4 py-3 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLabelPicker(false);
                        setShowMenu(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 py-1 px-2 rounded-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Label Note
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLabelPicker(false)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg"
                    >
                      Done
                    </button>
                  </div>

                  <div className="p-3 border-b border-stone-100 dark:border-stone-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Create new label..."
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
                        className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 border-none outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (newLabelText.trim()) {
                            await createLabel(newLabelText.trim());
                            onToggleLabel?.(newLabelText.trim());
                            setNewLabelText('');
                          }
                        }}
                        disabled={!newLabelText.trim()}
                        className="px-3.5 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold rounded-xl disabled:opacity-40"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto px-3 py-2 space-y-1">
                    {labels.length === 0 ? (
                      <div className="text-center py-6 text-stone-400 text-xs">
                        No labels created yet.
                      </div>
                    ) : (
                      labels.map((lbl) => {
                        const isSelected = note.labels?.includes(lbl.name);
                        return (
                          <label
                            key={lbl.id}
                            className="flex items-center justify-between px-4 py-3.5 rounded-2xl hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-stone-400 font-semibold">#</span>
                              <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                                {lbl.name}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleLabel?.(lbl.name)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
                            />
                          </label>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* 4. Mobile Color & Theme Picker */}
              {showColorPicker && (
                <>
                  <div className="px-5 py-3 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 shrink-0">
                    <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Background & Themes
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(false)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg"
                    >
                      Done
                    </button>
                  </div>

                  <div className="overflow-y-auto px-4 py-3 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                        Colors
                      </p>
                      <div className="grid grid-cols-6 gap-3">
                        {NOTE_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            title={c.name}
                            onClick={() => onColorChange(c.id)}
                            className={`w-10 h-10 rounded-full border border-stone-300 dark:border-stone-600 transition-transform active:scale-90 flex items-center justify-center mx-auto ${
                              note.color === c.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                            }`}
                            style={{ backgroundColor: c.swatch }}
                          >
                            {note.color === c.id && (
                              <Check className="w-4 h-4 text-stone-800 dark:text-stone-200" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {onThemeChange && (
                      <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                          Themes
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                          {NOTE_THEMES.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              title={t.name}
                              onClick={() => onThemeChange(t.id)}
                              className={`h-12 flex flex-col items-center justify-center text-xl rounded-xl border border-stone-200 dark:border-stone-700 active:scale-95 transition-all ${
                                note.theme === t.id
                                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/40'
                                  : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                              }`}
                            >
                              <span>{t.icon}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 5. Mobile Reminder Picker */}
              {showReminderPicker && (
                <>
                  <div className="px-5 py-3 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 shrink-0">
                    <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Set Reminder
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReminderPicker(false)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg"
                    >
                      Done
                    </button>
                  </div>

                  <div className="overflow-y-auto px-3 py-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        const todayEve = new Date();
                        todayEve.setHours(20, 0, 0, 0);
                        onAddReminder?.(todayEve.toISOString());
                        setShowReminderPicker(false);
                      }}
                      className="w-full text-left px-4 py-3.5 rounded-2xl flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm font-medium transition-colors"
                    >
                      <span>Later today</span>
                      <span className="text-xs text-stone-400">8:00 PM</span>
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
                      className="w-full text-left px-4 py-3.5 rounded-2xl flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm font-medium transition-colors"
                    >
                      <span>Tomorrow</span>
                      <span className="text-xs text-stone-400">8:00 AM</span>
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
                      className="w-full text-left px-4 py-3.5 rounded-2xl flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm font-medium transition-colors"
                    >
                      <span>Next week</span>
                      <span className="text-xs text-stone-400">8:00 AM</span>
                    </button>

                    <div className="pt-3 pb-2 px-2 border-t border-stone-100 dark:border-stone-800">
                      <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
                        Pick date & time
                      </span>
                      <input
                        type="datetime-local"
                        onChange={(e) => {
                          if (e.target.value) {
                            onAddReminder?.(new Date(e.target.value).toISOString());
                            setShowReminderPicker(false);
                          }
                        }}
                        className="w-full text-sm p-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
