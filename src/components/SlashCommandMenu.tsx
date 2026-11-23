'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArrowRight,
  Bell,
  Bold,
  BookOpen,
  CalendarRange,
  Check,
  CheckSquare,
  Clock,
  Code,
  Copy,
  Database,
  Eye,
  FilePlus,
  FileText,
  Folder,
  Globe,
  History,
  Home,
  Image as ImageIcon,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListOrdered,
  Lock,
  Map as MapIcon,
  Minus,
  Network,
  Palette,
  PenTool,
  Pin,
  Printer,
  Quote,
  RemoveFormatting,
  Share2,
  Sparkles,
  SquareCode,
  Table as TableIcon,
  Tag,
  Timer,
  Trash2,
  Type,
  Underline,
  Files,
} from 'lucide-react';
import {
  SLASH_GROUP_LABELS,
  SLASH_GROUP_ORDER,
  SlashCommandGroup,
  SlashCommandItem,
  SlashContextFlags,
} from '@/lib/slashCommands';

interface SlashCommandMenuProps {
  query: string;
  items: SlashCommandItem[];
  selectedIndex: number;
  coords: { left: number; top: number; bottom: number; right: number };
  flags?: SlashContextFlags;
  onSelect: (item: SlashCommandItem) => void;
  onHoverIndex: (index: number) => void;
  onClose: () => void;
}

function renderCommandIcon(iconKey: string) {
  const cls = 'w-4 h-4 text-stone-600 dark:text-stone-300 shrink-0';
  switch (iconKey) {
    case 'text':
      return <span className="font-serif text-[15px] font-medium text-stone-700 dark:text-stone-200 leading-none">T</span>;
    case 'h1':
      return <span className="font-sans text-[12px] font-bold tracking-tight text-stone-700 dark:text-stone-200 leading-none">H<sub className="text-[9px]">1</sub></span>;
    case 'h2':
      return <span className="font-sans text-[12px] font-bold tracking-tight text-stone-700 dark:text-stone-200 leading-none">H<sub className="text-[9px]">2</sub></span>;
    case 'h3':
      return <span className="font-sans text-[12px] font-bold tracking-tight text-stone-700 dark:text-stone-200 leading-none">H<sub className="text-[9px]">3</sub></span>;
    case 'h4':
      return <span className="font-sans text-[12px] font-bold tracking-tight text-stone-700 dark:text-stone-200 leading-none">H<sub className="text-[9px]">4</sub></span>;
    case 'bullet':
      return <List className={cls} />;
    case 'numbered':
      return <ListOrdered className={cls} />;
    case 'todo':
    case 'checklist':
      return <CheckSquare className={cls} />;
    case 'quote':
      return <Quote className={cls} />;
    case 'divider':
      return <Minus className={cls} />;
    case 'codeblock':
      return <SquareCode className={cls} />;
    case 'code':
      return <Code className={cls} />;
    case 'table':
      return <TableIcon className={cls} />;
    case 'dataview':
      return <Database className={cls} />;
    case 'subpage':
      return <FilePlus className={cls} />;
    case 'subpages':
      return <Files className={cls} />;
    case 'link':
    case 'link2':
      return <Link2 className={cls} />;
    case 'home':
      return <Home className={cls} />;
    case 'arrow-right':
      return <ArrowRight className={cls} />;
    case 'book':
      return <BookOpen className={cls} />;
    case 'network':
      return <Network className={cls} />;
    case 'map':
      return <MapIcon className={cls} />;
    case 'image':
      return <ImageIcon className={cls} />;
    case 'drawing':
      return <PenTool className={cls} />;
    case 'globe':
      return <Globe className={cls} />;
    case 'template':
      return <LayoutTemplate className={cls} />;
    case 'calendar':
      return <CalendarRange className={cls} />;
    case 'folder':
      return <Folder className={cls} />;
    case 'tag':
      return <Tag className={cls} />;
    case 'palette':
      return <Palette className={cls} />;
    case 'bell':
      return <Bell className={cls} />;
    case 'format':
      return <Type className={cls} />;
    case 'timer':
      return <Timer className={cls} />;
    case 'clock':
      return <Clock className={cls} />;
    case 'sparkles':
      return <Sparkles className={cls} />;
    case 'extract':
      return <FileText className={cls} />;
    case 'eye':
      return <Eye className={cls} />;
    case 'history':
      return <History className={cls} />;
    case 'lock':
      return <Lock className={cls} />;
    case 'pin':
      return <Pin className={cls} />;
    case 'share':
      return <Share2 className={cls} />;
    case 'copy':
      return <Copy className={cls} />;
    case 'duplicate':
      return <Files className={cls} />;
    case 'print':
      return <Printer className={cls} />;
    case 'archive':
      return <Archive className={cls} />;
    case 'trash':
      return <Trash2 className="w-4 h-4 text-red-500 shrink-0" />;
    case 'close':
      return <Check className={cls} />;
    case 'bold':
      return <Bold className={cls} />;
    case 'italic':
      return <Italic className={cls} />;
    case 'underline':
      return <Underline className={cls} />;
    case 'clear':
      return <RemoveFormatting className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  query,
  items,
  selectedIndex,
  coords,
  flags,
  onSelect,
  onHoverIndex,
  onClose,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeEl = itemRefs.current[selectedIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, items.length]);

  if (typeof document === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuWidth = Math.min(312, vw - 20);
  const estimatedHeight = Math.min(390, Math.max(160, items.length * 36 + 86));

  const left = Math.max(10, Math.min(coords.left, vw - menuWidth - 10));
  const spaceBelow = vh - coords.bottom - 12;
  const placeAbove = spaceBelow < 220 && coords.top > spaceBelow;
  const top = placeAbove
    ? Math.max(10, coords.top - estimatedHeight - 6)
    : Math.min(coords.bottom + 6, Math.max(10, vh - estimatedHeight - 10));
  const maxListHeight = placeAbove
    ? Math.max(140, coords.top - 54)
    : Math.max(140, Math.min(340, vh - (coords.bottom + 54)));

  const hasQuery = query.trim().length > 0;

  // Build grouped structure when idle; flat ranked list when typing search query
  const groupedSections: Array<{ group: SlashCommandGroup | null; entries: Array<{ item: SlashCommandItem; flatIndex: number }> }> = [];
  if (!hasQuery) {
    let flatIdx = 0;
    for (const grp of SLASH_GROUP_ORDER) {
      const grpItems = items.filter((it) => it.group === grp);
      if (grpItems.length > 0) {
        groupedSections.push({
          group: grp,
          entries: grpItems.map((it) => ({ item: it, flatIndex: flatIdx++ })),
        });
      }
    }
  } else {
    groupedSections.push({
      group: null,
      entries: items.map((it, idx) => ({ item: it, flatIndex: idx })),
    });
  }

  return createPortal(
    <>
      {/* Subtle Notion inline "/Type to search" cue beside caret when query is empty */}
      {query === '' && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(vw - 120, Math.max(8, coords.right + 2))}px`,
            top: `${Math.max(6, coords.top - 1)}px`,
            zIndex: 9998,
          }}
          className="pointer-events-none select-none px-1.5 py-0.5 rounded bg-stone-100/95 dark:bg-stone-800/95 text-[13px] text-stone-400 dark:text-stone-500 font-normal leading-snug"
        >
          Type to search
        </div>
      )}

      {/* Floating Notion Slash Menu */}
      <div
        data-slash-menu="true"
        onMouseDown={(e) => {
          // Keep ProseMirror selection intact while clicking buttons
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          width: `${menuWidth}px`,
          zIndex: 9999,
        }}
        className="bg-white dark:bg-[#232427] rounded-xl border border-black/[0.08] dark:border-white/[0.1] shadow-[0_12px_36px_rgba(0,0,0,0.14)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col select-none animate-in fade-in zoom-in-95 duration-100"
      >
        {hasQuery && (
          <div className="px-3 py-1.5 border-b border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
            <span className="truncate">
              Searching <span className="font-medium text-stone-700 dark:text-stone-200">/{query}</span>
            </span>
            <span>{items.length}</span>
          </div>
        )}

        <div
          ref={listRef}
          style={{ maxHeight: `${maxListHeight}px` }}
          className="overflow-y-auto overscroll-contain py-1 px-1"
        >
          {items.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-stone-400 dark:text-stone-500">
              No matching blocks or actions for &ldquo;/{query}&rdquo;
            </div>
          ) : (
            groupedSections.map((section, sIdx) => (
              <div
                key={section.group || 'search-results'}
                className={sIdx > 0 ? 'mt-1.5 pt-1.5 border-t border-black/[0.06] dark:border-white/[0.07]' : ''}
              >
                {section.group && (
                  <div className="px-2.5 pt-1 pb-1 text-[11px] font-medium text-stone-400 dark:text-stone-500">
                    {SLASH_GROUP_LABELS[section.group]}
                  </div>
                )}

                {section.entries.map(({ item, flatIndex }) => {
                  const isActive = flatIndex === selectedIndex;
                  const label = item.getLabel ? item.getLabel(flags) : item.label;
                  const desc = item.getDescription ? item.getDescription(flags) : item.description;

                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        itemRefs.current[flatIndex] = el;
                      }}
                      type="button"
                      onMouseEnter={() => onHoverIndex(flatIndex)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(item);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-black/[0.06] dark:bg-white/[0.09] text-stone-900 dark:text-stone-100'
                          : 'text-stone-700 dark:text-stone-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0">
                        {renderCommandIcon(item.iconKey)}
                      </span>
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-[13.5px] font-normal truncate">{label}</span>
                        {desc && !item.shortcut && (
                          <span className="text-[11px] text-stone-400 dark:text-stone-500 truncate hidden sm:inline">
                            · {desc}
                          </span>
                        )}
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.shortcut && (
                        <span className="text-[11px] font-mono text-stone-400 dark:text-stone-500 shrink-0 pl-1">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Bottom Esc Hint Footer */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="w-full px-3 py-1.5 border-t border-black/[0.06] dark:border-white/[0.07] bg-stone-50/70 dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 transition-colors cursor-pointer"
        >
          <span>Close menu</span>
          <span className="font-mono text-[10.5px]">esc</span>
        </button>
      </div>
    </>,
    document.body
  );
};
