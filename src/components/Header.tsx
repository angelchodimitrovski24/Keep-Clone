'use client';

import React, { useRef } from 'react';
import {
  Menu,
  Search,
  LayoutGrid,
  Rows,
  Moon,
  Sun,
  X,
  Archive,
  Trash2,
  Palette,
  Copy,
  Settings as SettingsIcon,
  FileText,
  Bot,
  ArrowLeft,
  FolderOpen,
  Sparkles,
  GitMerge,
  Globe,
  FileSpreadsheet,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { NOTE_COLORS } from '@/lib/constants';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const {
    searchQuery,
    setSearchQuery,
    layoutMode,
    setLayoutMode,
    darkMode,
    setDarkMode,
    selectedNoteIds,
    clearSelection,
    batchArchive,
    batchTrash,
    batchDeletePermanently,
    batchColor,
    batchDuplicate,
    batchSetCategory,
    categories,
    currentFilter,
    setCurrentFilter,
    setEditingNote,
    setIsSettingsOpen,
    openGeneralAiChat,
    openBulkSummarize,
    setIsMergeNotesModalOpen,
    setIsWebExportModalOpen,
    setIsExcelExportModalOpen,
  } = useKeep();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMobileSearchActive, setIsMobileSearchActive] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isSelectionActive = selectedNoteIds.length > 0;

  // Selected State Header
  if (isSelectionActive) {
    return (
      <header className="sticky top-0 z-40 bg-stone-100 dark:bg-[#202124] border-b border-stone-300 dark:border-stone-700 px-2.5 sm:px-4 h-14 sm:h-16 flex items-center justify-between shadow-sm animate-in fade-in duration-150 overflow-x-auto no-scrollbar gap-2">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={clearSelection}
            className="p-1.5 sm:p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300"
            title="Clear selection"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="font-semibold text-stone-800 dark:text-stone-200 text-sm sm:text-base whitespace-nowrap">
            {selectedNoteIds.length} selected
          </span>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 text-stone-600 dark:text-stone-300 shrink-0">
          {/* Quick Color Change for Selection */}
          <div className="relative group p-2">
            <button
              type="button"
              className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700"
              title="Change color"
            >
              <Palette className="w-5 h-5" />
            </button>
            <div className="absolute right-0 top-full hidden group-hover:flex p-2 bg-white dark:bg-[#2d2e30] rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 gap-1.5 z-50">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => batchColor(c.id)}
                  className="w-5 h-5 rounded-full border border-stone-300"
                  style={{ backgroundColor: c.swatch }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Quick Category Assignment for Selection */}
          <div className="relative group p-2">
            <button
              type="button"
              className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700"
              title="Set category"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            <div className="absolute right-0 top-full hidden group-hover:flex flex-col p-2 bg-white dark:bg-[#2d2e30] rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 gap-1 z-50 min-w-44">
              <button
                type="button"
                onClick={() => batchSetCategory(null)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-xs text-stone-600 dark:text-stone-400"
              >
                None (Clear category)
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => batchSetCategory(c.name)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-xs flex items-center gap-2 text-stone-800 dark:text-stone-200"
                >
                  <span>{c.icon || '📁'}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {currentFilter !== 'trash' ? (
            <>
              {/* Bulk Summarize with Ollama AI */}
              <button
                type="button"
                onClick={() => openBulkSummarize(selectedNoteIds)}
                className="p-2 rounded-full flex items-center gap-1.5 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 cursor-pointer"
                title={`Summarize ${selectedNoteIds.length} selected notes in bulk (AI Agent)`}
              >
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold hidden md:inline">Bulk Summarize</span>
              </button>

              {/* Merge Notes into a new one */}
              <button
                type="button"
                onClick={() => setIsMergeNotesModalOpen(true)}
                disabled={selectedNoteIds.length < 2}
                className={`p-2 rounded-full flex items-center gap-1.5 transition-colors ${
                  selectedNoteIds.length >= 2
                    ? 'hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed text-stone-400'
                }`}
                title={
                  selectedNoteIds.length >= 2
                    ? `Merge ${selectedNoteIds.length} notes into a new one`
                    : 'Select at least 2 notes to merge'
                }
              >
                <GitMerge className="w-5 h-5" />
                <span className="text-xs font-bold hidden md:inline">Merge</span>
              </button>
              <button
                type="button"
                onClick={() => setIsWebExportModalOpen(true)}
                className="p-2 rounded-full flex items-center gap-1.5 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 cursor-pointer"
                title={`Export ${selectedNoteIds.length} selected notes as Web Page (Table of Contents + separate note pages)`}
              >
                <Globe className="w-5 h-5" />
                <span className="text-xs font-bold hidden md:inline">Export Web Page</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExcelExportModalOpen(true)}
                className="p-2 rounded-full flex items-center gap-1.5 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 cursor-pointer"
                title={`Export ${selectedNoteIds.length} selected notes to Excel (.xlsx / .csv)`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="text-xs font-bold hidden md:inline">Export Excel</span>
              </button>
              <button
                type="button"
                onClick={batchDuplicate}
                className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700"
                title="Clone selected notes"
              >
                <Copy className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={batchArchive}
                className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700"
                title="Archive selected"
              >
                <Archive className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={batchTrash}
                className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-red-500"
                title="Move to trash"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={batchDeletePermanently}
              className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-red-500"
              title="Delete forever"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>
    );
  }

  // Mobile Full-Width Search Header
  if (isMobileSearchActive) {
    return (
      <header className="sticky top-0 z-40 bg-white dark:bg-[#202124] border-b border-stone-200 dark:border-stone-800 px-2 sm:px-4 h-14 sm:h-16 flex items-center gap-2 animate-in fade-in duration-100">
        <button
          type="button"
          onClick={() => {
            setIsMobileSearchActive(false);
          }}
          className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors shrink-0"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-1 flex items-center bg-stone-100 dark:bg-[#2c2d30] border border-stone-300 dark:border-stone-600 rounded-xl transition-all shadow-xs">
          <div className="pl-3 pr-2 text-stone-500 pointer-events-none">
            <Search className="w-4 h-4 shrink-0" />
          </div>
          <input
            autoFocus
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim()) {
                setEditingNote(null);
                if (currentFilter === 'calendar' || currentFilter === 'stats') {
                  setCurrentFilter('notes');
                }
              }
            }}
            className="w-full py-2 text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 outline-none bg-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1.5 mr-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 shrink-0"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>
    );
  }

  // Clean, Decluttered Normal Header
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#202124]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
      {/* Brand logo & sidebar toggle */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
          title="Main menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => {
            setEditingNote(null);
            setCurrentFilter('notes');
            if (window.location.pathname.startsWith('/note/')) {
              window.history.pushState(null, '', '/');
            }
          }}
          className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400 flex items-center justify-center text-white shadow-md shadow-amber-400/20">
            <span className="font-black text-lg sm:text-xl leading-none">💡</span>
          </div>
          <span className="font-semibold text-base sm:text-lg text-stone-800 dark:text-stone-100 hidden sm:inline tracking-tight">
            Keep <span className="text-xs font-normal px-2 py-0.5 ml-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Local DB</span>
          </span>
        </div>
      </div>

      {/* Prominent Center Search Bar (Always visible & spacious on all screens) */}
      <div className="flex-1 min-w-[120px] max-w-2xl mx-1 sm:mx-4">
        <div
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 640) {
              setIsMobileSearchActive(true);
            }
          }}
          className="relative flex items-center w-full bg-stone-100 dark:bg-[#2c2d30] hover:bg-stone-200/70 dark:hover:bg-[#343538] focus-within:bg-white dark:focus-within:bg-[#202124] focus-within:shadow-md focus-within:border-stone-300 dark:focus-within:border-stone-600 border border-transparent rounded-xl transition-all cursor-pointer sm:cursor-auto"
        >
          <div className="pl-2.5 sm:pl-3.5 pr-1.5 sm:pr-2 text-stone-500 pointer-events-none">
            <Search className="w-4 h-4 shrink-0" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search notes... (Press / to focus)"
            value={searchQuery}
            onFocus={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 640) {
                setIsMobileSearchActive(true);
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim()) {
                setEditingNote(null);
                if (currentFilter === 'calendar' || currentFilter === 'stats') {
                  setCurrentFilter('notes');
                }
              }
            }}
            className="w-full py-1.5 sm:py-2.5 text-xs sm:text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 outline-none truncate bg-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery('');
              }}
              className="p-1 sm:p-1.5 mr-1.5 sm:mr-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 shrink-0"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Clean, Streamlined Action Controls */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 text-stone-600 dark:text-stone-300 shrink-0">
        {/* Layout Toggle (Grid / List / Notion) */}
        <button
          type="button"
          onClick={() => {
            const nextMode = layoutMode === 'grid' ? 'list' : layoutMode === 'list' ? 'notion' : 'grid';
            setLayoutMode(nextMode);
          }}
          className={`hidden sm:flex p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer ${
            layoutMode === 'notion' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
          }`}
          title={
            layoutMode === 'grid'
              ? 'Grid view (click for List)'
              : layoutMode === 'list'
              ? 'List view (click for Notion Page List)'
              : 'Notion List view (click for Grid)'
          }
        >
          {layoutMode === 'grid' ? (
            <LayoutGrid className="w-5 h-5" />
          ) : layoutMode === 'list' ? (
            <Rows className="w-5 h-5" />
          ) : (
            <FileText className="w-5 h-5" />
          )}
        </button>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Ollama Local AI Assistant & Chat */}
        <button
          type="button"
          onClick={openGeneralAiChat}
          className="p-1.5 sm:p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 flex items-center justify-center font-bold text-xs cursor-pointer"
          title="Ollama Local AI (Chat, Summarize, Attach Files & Ask Questions)"
        >
          <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Settings Dialog Toggle (Hosts all tools in organized tabs) */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
          title="Settings, Tools & Integrations Hub"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
