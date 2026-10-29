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
  Printer,
  Search,
  Plus,
  FileText,
  Globe,
  ClipboardCopy,
} from 'lucide-react';
import { Note, NoteColor, NoteBackgroundTheme } from '@/types/note';
import { NOTE_COLORS, NOTE_THEMES } from '@/lib/constants';
import { useKeep } from '@/context/KeepContext';
import { copyNoteToClipboard } from '@/lib/formatUtils';

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
  onPrint?: () => void;
  onCopyContent?: () => void;
  onToggleSubpages?: () => void;
  hasSubpages?: boolean;
  showFormattingToggle?: boolean;
  isFormattingOpen?: boolean;
  onToggleFormatting?: () => void;
  isTrash?: boolean;
  className?: string;
  compact?: boolean;
  menuPlacement?: 'top' | 'bottom' | 'auto';
  menuAlign?: 'left' | 'right';
  onMenuOpenChange?: (open: boolean) => void;
  onImportMhtml?: (file: File) => void;
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
  onImportMhtml,
  onToggleChecklist,
  onAddReminder,
  onToggleLabel,
  onSelectCategory,
  onEncrypt,
  onLinkNote,
  onOpenVersions,
  onStartReading,
  onPrint,
  onCopyContent,
  onToggleSubpages,
  hasSubpages = false,
  showFormattingToggle = false,
  isFormattingOpen = false,
  onToggleFormatting,
  isTrash = false,
  className = '',
  compact = false,
  menuPlacement = 'auto',
  menuAlign = 'right',
  onMenuOpenChange,
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
  const [copiedToast, setCopiedToast] = useState(false);

  const handleCopyTitleAndContent = async () => {
    if (onCopyContent) {
      onCopyContent();
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
      return;
    }

    const success = await copyNoteToClipboard(note);
    if (success) {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // Notify parent whenever any action menu / picker opens or closes
  useEffect(() => {
    const isAnyOpen = showMenu || showColorPicker || showReminderPicker || showLabelPicker || showCategoryPicker;
    onMenuOpenChange?.(isAnyOpen);
  }, [showMenu, showColorPicker, showReminderPicker, showLabelPicker, showCategoryPicker, onMenuOpenChange]);

  const labelQuery = newLabelText.trim().toLowerCase();
  const filteredLabels = labelQuery
    ? labels.filter((lbl) => lbl.name.toLowerCase().includes(labelQuery))
    : labels;
  const exactMatchExists = labelQuery
    ? labels.some((lbl) => lbl.name.toLowerCase() === labelQuery)
    : false;
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>(
    menuPlacement === 'bottom' ? 'bottom' : 'top'
  );
  const [dynamicMaxHeight, setDynamicMaxHeight] = useState<number | undefined>(undefined);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const updateDropdownPlacement = (btnElement?: HTMLElement | null) => {
    const el = btnElement || moreBtnRef.current;
    const rect = el?.getBoundingClientRect();

    if (!rect) {
      if (menuPlacement === 'bottom') setDropdownPosition('bottom');
      else setDropdownPosition('top');
      return;
    }

    const margin = 16;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    let pos: 'top' | 'bottom' = 'bottom';
    if (menuPlacement === 'bottom') {
      pos = 'bottom';
    } else if (menuPlacement === 'top') {
      if (spaceAbove < 220 && spaceBelow > spaceAbove + 60) {
        pos = 'bottom';
      } else {
        pos = 'top';
      }
    } else {
      if (spaceAbove >= 240) {
        pos = 'top';
      } else if (spaceBelow >= 240) {
        pos = 'bottom';
      } else {
        pos = spaceAbove >= spaceBelow ? 'top' : 'bottom';
      }
    }

    setDropdownPosition(pos);
    const availableSpace = pos === 'top'
      ? Math.max(200, Math.floor(rect.top - 16))
      : Math.max(200, Math.floor(window.innerHeight - rect.bottom - 16));

    setDynamicMaxHeight(Math.min(460, availableSpace));
  };

  const verticalPositionClass = dropdownPosition === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-2';
  const alignClass = menuAlign === 'left' ? 'left-0' : 'right-0';

  useEffect(() => {
    if (showMenu) {
      if (moreBtnRef.current) {
        updateDropdownPlacement(moreBtnRef.current);
      }
      requestAnimationFrame(() => {
        if (moreMenuRef.current) {
          moreMenuRef.current.scrollTop = 0;
        }
      });
    }
  }, [showMenu]);

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
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mhtmlInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // If click/touch is inside the mobile bottom sheet portal, ignore
      if (sheetRef.current && sheetRef.current.contains(target)) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target)) {
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

  const iconBtnClass =
    'w-8 h-8 flex items-center justify-center rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:bg-black/[0.12] dark:active:bg-white/[0.15] transition-all duration-150 shrink-0';
  const activeIconBtnClass =
    'w-8 h-8 flex items-center justify-center rounded-full bg-black/[0.1] dark:bg-white/[0.16] text-stone-900 dark:text-stone-100 transition-all duration-150 shrink-0';

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
          className={iconBtnClass}
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
          className={iconBtnClass}
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
            updateDropdownPlacement(e.currentTarget);
            setShowReminderPicker(!showReminderPicker);
            setShowColorPicker(false);
            setShowMenu(false);
            setShowLabelPicker(false);
          }}
          className={showReminderPicker ? activeIconBtnClass : iconBtnClass}
          title="Remind me"
        >
          <Bell className="w-4 h-4" />
        </button>

        {!isMobile && showReminderPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ maxHeight: dynamicMaxHeight ? `${dynamicMaxHeight}px` : undefined }}
            className={`absolute left-0 ${verticalPositionClass} w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#202124] rounded-xl keep-elevation-2 border border-black/[0.08] dark:border-stone-700/60 z-50 text-[13.5px] font-normal shadow-xl overflow-y-auto overscroll-contain`}
          >
            <p className="text-xs font-medium px-2.5 py-1 text-stone-500 tracking-wide uppercase">
              Set Reminder
            </p>
            <div className="flex flex-col gap-0.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  const todayEve = new Date();
                  todayEve.setHours(20, 0, 0, 0);
                  onAddReminder?.(todayEve.toISOString());
                  setShowReminderPicker(false);
                }}
                className="text-left px-2.5 py-2 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] rounded-lg transition-colors text-stone-800 dark:text-stone-200"
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
                className="text-left px-2.5 py-2 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] rounded-lg transition-colors text-stone-800 dark:text-stone-200"
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
                className="text-left px-2.5 py-2 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] rounded-lg transition-colors text-stone-800 dark:text-stone-200"
              >
                Next week (8:00 AM)
              </button>
              <div className="pt-2 mt-1 border-t border-black/[0.06] dark:border-white/[0.08]">
                <input
                  type="datetime-local"
                  onChange={(e) => {
                    if (e.target.value) {
                      onAddReminder?.(new Date(e.target.value).toISOString());
                      setShowReminderPicker(false);
                    }
                  }}
                  className="w-full text-xs p-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none text-stone-800 dark:text-stone-200"
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
            updateDropdownPlacement(e.currentTarget);
            setShowColorPicker(!showColorPicker);
            setShowReminderPicker(false);
            setShowMenu(false);
            setShowLabelPicker(false);
          }}
          className={showColorPicker ? activeIconBtnClass : iconBtnClass}
          title="Background options"
        >
          <Palette className="w-4 h-4" />
        </button>

        {!isMobile && showColorPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ maxHeight: dynamicMaxHeight ? `${dynamicMaxHeight}px` : undefined }}
            className={`absolute left-0 ${verticalPositionClass} w-72 max-w-[calc(100vw-2rem)] p-3 bg-white dark:bg-[#202124] rounded-xl keep-elevation-2 border border-black/[0.08] dark:border-stone-700/60 z-50 shadow-xl overflow-y-auto overscroll-contain`}
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
                  className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border border-black/15 dark:border-white/20 transition-transform hover:scale-110 flex items-center justify-center ${
                    note.color === c.id ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-[#202124]' : ''
                  }`}
                  style={{ backgroundColor: c.swatch }}
                />
              ))}
            </div>

            {onThemeChange && (
              <>
                <p className="text-xs font-medium text-stone-500 mb-2 px-1 border-t border-black/[0.06] dark:border-white/[0.08] pt-2">
                  Themes
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {NOTE_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.name}
                      onClick={() => onThemeChange(t.id)}
                      className={`h-9 sm:h-8 flex items-center justify-center text-lg sm:text-base rounded-lg border border-black/[0.08] dark:border-white/[0.1] hover:scale-105 transition-all ${
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
            className={iconBtnClass}
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
          <input
            ref={mhtmlInputRef}
            type="file"
            accept=".mhtml,.mht,multipart/related,message/rfc822"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && onImportMhtml) {
                onImportMhtml(f);
              }
              e.target.value = '';
            }}
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
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-150 font-bold text-sm leading-none shrink-0 ${
            isFormattingOpen
              ? 'bg-amber-100 text-stone-900 dark:bg-amber-900/60 dark:text-amber-200'
              : 'hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:bg-black/[0.12] dark:active:bg-white/[0.15] text-stone-700 dark:text-stone-200'
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
          className={compact ? iconBtnClass : `hidden sm:inline-flex ${iconBtnClass}`}
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
      {!compact && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`hidden md:inline-flex ${iconBtnClass} hover:text-red-600 dark:hover:text-red-400`}
          title="Delete note"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Encrypt / Lock action */}
      {!compact && onEncrypt && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEncrypt();
          }}
          className={`hidden sm:inline-flex ${
            note.isEncrypted
              ? 'w-8 h-8 flex items-center justify-center rounded-full text-amber-600 dark:text-amber-400 bg-amber-500/15 shrink-0'
              : iconBtnClass
          }`}
          title={note.isEncrypted ? 'Note is encrypted with AES-256 (Settings)' : 'Encrypt note with AES-256 (Password protect)'}
        >
          <Lock className="w-4 h-4" />
        </button>
      )}

      {/* Link Note action */}
      {!compact && onLinkNote && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLinkNote();
          }}
          className={`hidden md:inline-flex ${iconBtnClass}`}
          title="Link to another note"
        >
          <Link2 className="w-4 h-4" />
        </button>
      )}

      {/* Clone Note action */}
      {!compact && onDuplicate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className={`hidden md:inline-flex ${iconBtnClass}`}
          title="Clone note (Make a copy)"
        >
          <Copy className="w-4 h-4" />
        </button>
      )}

      {/* Copy note title and content */}
      {!compact && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyTitleAndContent();
          }}
          className={`hidden md:inline-flex ${iconBtnClass}`}
          title="Copy note title and content"
        >
          {copiedToast ? <Check className="w-4 h-4 text-emerald-500" /> : <ClipboardCopy className="w-4 h-4" />}
        </button>
      )}

      {/* Share Note action */}
      {!compact && onShare && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className={`hidden sm:inline-flex ${iconBtnClass}`}
          title="Share note (Short link & images)"
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}

      {/* Print Note action directly on toolbar */}
      {onPrint && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrint();
          }}
          className={compact ? `hidden sm:inline-flex ${iconBtnClass}` : iconBtnClass}
          title="Print note"
        >
          <Printer className="w-4 h-4" />
        </button>
      )}

      {/* More Options dropdown (...) */}
      <div className="relative">
        <button
          ref={moreBtnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateDropdownPlacement(e.currentTarget);
            setShowMenu(!showMenu);
            setShowColorPicker(false);
            setShowReminderPicker(false);
            setShowLabelPicker(false);
            setShowCategoryPicker(false);
          }}
          className={showMenu ? activeIconBtnClass : iconBtnClass}
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {!isMobile && showMenu && (
          <div
            ref={moreMenuRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ maxHeight: dynamicMaxHeight ? `${dynamicMaxHeight}px` : undefined }}
            className={`absolute ${alignClass} ${verticalPositionClass} w-56 max-w-[calc(100vw-2rem)] py-1.5 bg-white dark:bg-[#202124] rounded-xl keep-elevation-2 border border-black/[0.08] dark:border-stone-700/60 z-50 text-[13.5px] font-normal overflow-y-auto overscroll-contain shadow-xl`}
          >
            {onSelectCategory && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowCategoryPicker(true);
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Folder className="w-4 h-4 text-blue-500" />
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
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Tag className="w-4 h-4 text-emerald-500" />
                Change labels
              </button>
            )}

            {onToggleChecklist && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onToggleChecklist();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                {note.isList ? 'Show plain text' : 'Show checkboxes'}
              </button>
            )}

            {onToggleSubpages && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onToggleSubpages();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <FileText className="w-4 h-4 text-amber-500" />
                {hasSubpages ? 'Sub-pages (Notion)' : 'Add Notion sub-pages'}
              </button>
            )}
            {onImportMhtml && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  mhtmlInputRef.current?.click();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Globe className="w-4 h-4 text-blue-500" />
                Import MHTML into note
              </button>
            )}


            <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

            {onEncrypt && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onEncrypt();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
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
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Link2 className="w-4 h-4 text-purple-500" />
                Link to note
              </button>
            )}

            {onOpenVersions && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onOpenVersions();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <div className="flex items-center gap-3">
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
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-emerald-600 dark:text-emerald-400 transition-colors"
              >
                <Timer className="w-4 h-4" />
                <span>Start reading stopwatch</span>
              </button>
            )}

            {(onDuplicate || onArchiveToggle || onShare || onPrint || onDelete) && (
              <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
            )}

            {onPrint && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onPrint();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Printer className="w-4 h-4 text-stone-500" />
                <span>Print note</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                handleCopyTitleAndContent();
                setTimeout(() => setShowMenu(false), 300);
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
            >
              {copiedToast ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>Copy title & content</span>
                </>
              )}
            </button>

            {onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onDuplicate();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Clone note (Make a copy)
              </button>
            )}

            {onArchiveToggle && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onArchiveToggle();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
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
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Share2 className="w-4 h-4 text-amber-500" />
                Share note (Short link)
              </button>
            )}
            {onImportMhtml && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  mhtmlInputRef.current?.click();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200 transition-colors"
              >
                <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Import MHTML into note</span>
              </button>
            )}


            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-red-600 dark:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete note
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
            style={{ maxHeight: dynamicMaxHeight ? `${dynamicMaxHeight}px` : undefined }}
            className={`absolute ${alignClass} ${verticalPositionClass} w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#202124] rounded-xl keep-elevation-2 border border-black/[0.08] dark:border-stone-700/60 z-50 text-[13.5px] overflow-y-auto overscroll-contain shadow-xl`}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryPicker(false);
                    setShowMenu(true);
                  }}
                  className="p-1 -ml-1 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Back to options"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Select Category</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(false)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Done
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-0.5 mb-2">
              {/* None Option */}
              <button
                type="button"
                onClick={() => {
                  onSelectCategory?.(null);
                  setShowCategoryPicker(false);
                }}
                className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  !note.category
                    ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-semibold'
                    : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-600 dark:text-stone-400'
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
                    className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-semibold'
                        : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-stone-800 dark:text-stone-200'
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

            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
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
            style={{ maxHeight: dynamicMaxHeight ? `${dynamicMaxHeight}px` : undefined }}
            className={`absolute ${alignClass} ${verticalPositionClass} w-64 max-w-[calc(100vw-2rem)] p-2.5 bg-white dark:bg-[#202124] rounded-xl keep-elevation-2 border border-black/[0.08] dark:border-stone-700/60 z-50 text-[13.5px] overflow-y-auto overscroll-contain shadow-xl`}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowLabelPicker(false);
                    setShowMenu(true);
                  }}
                  className="p-1 -ml-1 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Back to options"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Label note</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLabelPicker(false)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Done
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-0.5 mb-2">
              {filteredLabels.length === 0 && labelQuery && (
                <div className="text-center py-3 text-stone-400 dark:text-stone-500 text-xs">
                  No matching labels
                </div>
              )}

              {filteredLabels.map((lbl) => {
                const isSelected = note.labels?.includes(lbl.name);
                return (
                  <label
                    key={lbl.id}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] rounded-lg cursor-pointer transition-colors text-stone-800 dark:text-stone-200"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleLabel?.(lbl.name)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 accent-blue-600"
                    />
                    <span className="truncate">{lbl.name}</span>
                  </label>
                );
              })}

              {!exactMatchExists && labelQuery && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const trimmed = newLabelText.trim();
                    await createLabel(trimmed);
                    onToggleLabel?.(trimmed);
                    setNewLabelText('');
                  }}
                  className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-blue-600 dark:text-blue-400 font-medium text-xs rounded-lg transition-colors mt-1"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Create &quot;{newLabelText.trim()}&quot;</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter label name"
                value={newLabelText}
                onChange={(e) => setNewLabelText(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newLabelText.trim()) {
                    e.preventDefault();
                    const trimmed = newLabelText.trim();
                    const exact = labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
                    if (exact) {
                      onToggleLabel?.(exact.name);
                    } else {
                      await createLabel(trimmed);
                      onToggleLabel?.(trimmed);
                    }
                    setNewLabelText('');
                  }
                }}
                className="w-full text-xs pl-7 pr-7 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-none outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              {newLabelText && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewLabelText('');
                  }}
                  className="absolute right-2 p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
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
            data-portal="true"
            className="keep-backdrop-anim fixed inset-0 z-[1000] bg-black/50 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => {
              setShowMenu(false);
              setShowCategoryPicker(false);
              setShowLabelPicker(false);
              setShowColorPicker(false);
              setShowReminderPicker(false);
            }}
          >
            <div
              ref={sheetRef}
              data-portal="true"
              className="keep-sheet-anim keep-sheet-shadow w-full max-h-[85vh] bg-white dark:bg-[#202124] rounded-t-[28px] border-t border-black/[0.06] dark:border-white/[0.08] flex flex-col overflow-hidden pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Drag handle pill */}
              <div className="w-8 h-1 bg-stone-300 dark:bg-stone-600 rounded-full mx-auto mt-2.5 mb-1.5 shrink-0" />

              {/* 1. Mobile 3-Dots Menu */}
              {showMenu && (
                <>
                  <div className="px-6 py-3.5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
                    <span className="text-[15px] font-medium text-stone-900 dark:text-stone-100 tracking-[0.1px]">
                      Note Options
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMenu(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="overflow-y-auto py-1.5">
                    <div>
                      {onArchiveToggle && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onArchiveToggle();
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
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
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <Share2 className="w-5 h-5 text-amber-500 shrink-0" />
                          <span>Share note (Short link & images)</span>
                        </button>
                      )}

                      {onPrint && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onPrint();
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <Printer className="w-5 h-5 text-stone-500 shrink-0" />
                          <span>Print note</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          handleCopyTitleAndContent();
                          setTimeout(() => setShowMenu(false), 300);
                        }}
                        className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                      >
                        {copiedToast ? (
                          <>
                            <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <ClipboardCopy className="w-5 h-5 text-stone-500 shrink-0" />
                            <span>Copy title & content</span>
                          </>
                        )}
                      </button>

                      {onDuplicate && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onDuplicate();
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <Copy className="w-5 h-5 text-stone-500 shrink-0" />
                          <span>Make a copy</span>
                        </button>
                      )}
                    </div>

                    <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

                    <div>
                      {onSelectCategory && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            setShowCategoryPicker(true);
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <div className="flex items-center gap-4 min-w-0">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            setShowLabelPicker(true);
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <div className="flex items-center gap-4 min-w-0">
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
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <CheckSquare className="w-5 h-5 text-stone-500 shrink-0" />
                          <span>{note.isList ? 'Show plain text' : 'Show checkboxes'}</span>
                        </button>
                      )}

                      {onToggleSubpages && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onToggleSubpages();
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                          <span>{hasSubpages ? 'Sub-pages (Notion)' : 'Add Notion sub-pages'}</span>
                        </button>
                      )}

                      {onLinkNote && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onLinkNote();
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <Link2 className="w-5 h-5 text-purple-500 shrink-0" />
                          <span>Link to note</span>
                        </button>
                      )}
                    </div>

                    <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

                    <div>
                      {onEncrypt && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onEncrypt();
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
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
                          className="w-full text-left px-6 py-3.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <div className="flex items-center gap-4">
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
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] text-emerald-600 dark:text-emerald-400 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <Timer className="w-5 h-5 shrink-0" />
                          <span>Start reading stopwatch</span>
                        </button>
                      )}
                    </div>

                    {onDelete && (
                      <>
                        <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            onDelete();
                          }}
                          className="w-full text-left px-6 py-3.5 flex items-center gap-4 hover:bg-red-500/10 active:bg-red-500/15 text-red-600 dark:text-red-400 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                        >
                          <Trash2 className="w-5 h-5 shrink-0" />
                          <span>Delete note</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* 2. Mobile Category Picker */}
              {showCategoryPicker && (
                <>
                  <div className="px-4 py-3 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCategoryPicker(false);
                        setShowMenu(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 py-1.5 px-2.5 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <span className="text-[15px] font-medium text-stone-900 dark:text-stone-100 tracking-[0.1px]">
                      Select Category
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCategoryPicker(false);
                      }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      Done
                    </button>
                  </div>

                  <div className="overflow-y-auto py-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCategory?.(null);
                        setShowCategoryPicker(false);
                      }}
                      className={`w-full text-left flex items-center justify-between px-6 py-3.5 text-[14.5px] font-normal tracking-[0.15px] transition-colors ${
                        !note.category
                          ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-medium'
                          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-stone-800 dark:text-stone-200'
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
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCategory?.(cat.name);
                            setShowCategoryPicker(false);
                          }}
                          className={`w-full text-left flex items-center justify-between px-6 py-3.5 text-[14.5px] font-normal tracking-[0.15px] transition-colors ${
                            isSelected
                              ? 'bg-amber-100/70 text-stone-900 dark:bg-amber-950/70 dark:text-amber-200 font-medium'
                              : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-stone-800 dark:text-stone-200'
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

                  <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCategoryPicker(false);
                        setIsCategoryModalOpen(true);
                      }}
                      className="w-full py-2.5 text-center text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-full transition-colors"
                    >
                      + Manage Categories
                    </button>
                  </div>
                </>
              )}

              {/* 3. Mobile Labels Picker */}
              {showLabelPicker && (
                <>
                  <div className="px-4 py-3 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLabelPicker(false);
                        setShowMenu(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 py-1.5 px-2.5 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <span className="text-[15px] font-medium text-stone-900 dark:text-stone-100 tracking-[0.1px]">
                      Label Note
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLabelPicker(false);
                      }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      Done
                    </button>
                  </div>

                  <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
                    <div className="flex items-center gap-2 relative">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Enter label name"
                        value={newLabelText}
                        onChange={(e) => setNewLabelText(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newLabelText.trim()) {
                            e.preventDefault();
                            const trimmed = newLabelText.trim();
                            const exact = labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
                            if (exact) {
                              onToggleLabel?.(exact.name);
                            } else {
                              await createLabel(trimmed);
                              onToggleLabel?.(trimmed);
                            }
                            setNewLabelText('');
                          }
                        }}
                        className="flex-1 text-xs pl-9 pr-7 py-2.5 rounded-full bg-stone-100 dark:bg-stone-800 border-none outline-none text-stone-800 dark:text-stone-200"
                      />
                      {newLabelText && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewLabelText('');
                          }}
                          className="absolute right-24 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (newLabelText.trim()) {
                            const trimmed = newLabelText.trim();
                            const exact = labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
                            if (exact) {
                              onToggleLabel?.(exact.name);
                            } else {
                              await createLabel(trimmed);
                              onToggleLabel?.(trimmed);
                            }
                            setNewLabelText('');
                          }
                        }}
                        disabled={!newLabelText.trim()}
                        className="px-4 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium rounded-full disabled:opacity-40 transition-colors shrink-0"
                      >
                        {exactMatchExists ? 'Toggle' : '+ Add'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto py-1">
                    {filteredLabels.length === 0 && labelQuery && (
                      <div className="text-center py-6 text-stone-400 text-xs">
                        No matching labels
                      </div>
                    )}

                    {filteredLabels.map((lbl) => {
                      const isSelected = note.labels?.includes(lbl.name);
                      return (
                        <div
                          key={lbl.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLabel?.(lbl.name);
                          }}
                          className="flex items-center justify-between px-6 py-3.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-stone-400 font-medium">#</span>
                            <span className="text-[14.5px] font-normal text-stone-800 dark:text-stone-200 tracking-[0.15px]">
                              {lbl.name}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 rounded text-blue-600 focus:ring-0 pointer-events-none accent-blue-600"
                          />
                        </div>
                      );
                    })}

                    {!exactMatchExists && labelQuery && (
                      <div
                        onClick={async (e) => {
                          e.stopPropagation();
                          const trimmed = newLabelText.trim();
                          await createLabel(trimmed);
                          onToggleLabel?.(trimmed);
                          setNewLabelText('');
                        }}
                        className="flex items-center gap-3 px-6 py-3.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] cursor-pointer text-blue-600 dark:text-blue-400 font-medium text-[14px] transition-colors"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>Create &quot;{newLabelText.trim()}&quot;</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 4. Mobile Color & Theme Picker */}
              {showColorPicker && (
                <>
                  <div className="px-6 py-3.5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
                    <span className="text-[15px] font-medium text-stone-900 dark:text-stone-100 tracking-[0.1px]">
                      Background & Themes
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(false)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      Done
                    </button>
                  </div>

                  <div className="overflow-y-auto px-6 py-4 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                        Colors
                      </p>
                      <div className="grid grid-cols-6 gap-3">
                        {NOTE_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            title={c.name}
                            onClick={() => onColorChange(c.id)}
                            className={`w-10 h-10 rounded-full border border-black/15 dark:border-white/20 transition-transform active:scale-90 flex items-center justify-center mx-auto ${
                              note.color === c.id ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-[#202124]' : ''
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
                      <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                          Themes
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                          {NOTE_THEMES.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              title={t.name}
                              onClick={() => onThemeChange(t.id)}
                              className={`h-12 flex flex-col items-center justify-center text-xl rounded-xl border border-black/[0.08] dark:border-white/[0.1] active:scale-95 transition-all ${
                                note.theme === t.id
                                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/40'
                                  : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
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
                  <div className="px-6 py-3.5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
                    <span className="text-[15px] font-medium text-stone-900 dark:text-stone-100 tracking-[0.1px]">
                      Set Reminder
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReminderPicker(false)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      Done
                    </button>
                  </div>

                  <div className="overflow-y-auto py-1">
                    <button
                      type="button"
                      onClick={() => {
                        const todayEve = new Date();
                        todayEve.setHours(20, 0, 0, 0);
                        onAddReminder?.(todayEve.toISOString());
                        setShowReminderPicker(false);
                      }}
                      className="w-full text-left px-6 py-3.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
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
                      className="w-full text-left px-6 py-3.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
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
                      className="w-full text-left px-6 py-3.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-stone-800 dark:text-stone-200 text-[14.5px] font-normal tracking-[0.15px] transition-colors"
                    >
                      <span>Next week</span>
                      <span className="text-xs text-stone-400">8:00 AM</span>
                    </button>

                    <div className="pt-3 pb-2 px-6 border-t border-black/[0.06] dark:border-white/[0.08]">
                      <span className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-2">
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
                        className="w-full text-sm p-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none text-stone-800 dark:text-stone-200"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Floating Copied Toast */}
      {mounted && copiedToast && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl bg-stone-900/90 dark:bg-stone-100/90 backdrop-blur-md text-white dark:text-stone-900 shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 border border-white/10 dark:border-black/10 pointer-events-none">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>Note title and content copied to clipboard</span>
        </div>,
        document.body
      )}
    </div>
  );
};
