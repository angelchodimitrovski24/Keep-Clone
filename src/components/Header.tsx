'use client';

import React, { useRef } from 'react';
import {
  Menu,
  Search,
  LayoutGrid,
  Rows,
  Moon,
  Sun,
  RefreshCw,
  X,
  Archive,
  Trash2,
  Palette,
  Download,
  Upload,
  FolderDown,
  FolderOpen,
  Copy,
  Settings as SettingsIcon,
  Timer,
  Play,
  Pause,
  Cloud,
  FileText,
  Smartphone,
  BarChart2,
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
    exportDataZip,
    importDataSmart,
    currentFilter,
    setCurrentFilter,
    localMediaFolder,
    setIsLocalFolderModalOpen,
    setIsSettingsOpen,
    setIsGoogleDriveModalOpen,
    setIsPdfExportModalOpen,
    isInstallModalOpen,
    setIsInstallModalOpen,
    canInstallPwa,
    isPwaInstalled,
    promptInstallPwa,
    activeStopwatch,
    pauseReadingStopwatch,
    resumeReadingStopwatch,
    stopAndSaveReadingStopwatch,
  } = useKeep();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await importDataSmart(file);
    // Reset file input
    e.target.value = '';
  };

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

  // Normal Header
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#202124]/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
      {/* Brand logo & sidebar toggle */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
          title="Main menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400 flex items-center justify-center text-white shadow-md shadow-amber-400/20">
            <span className="font-black text-lg sm:text-xl leading-none">💡</span>
          </div>
          <span className="font-semibold text-base sm:text-lg text-stone-800 dark:text-stone-100 hidden sm:inline tracking-tight">
            Keep <span className="text-xs font-normal px-2 py-0.5 ml-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Local DB</span>
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-1 min-w-0 max-w-2xl mx-1 sm:mx-2">
        <div className="relative flex items-center w-full bg-stone-100 dark:bg-[#2c2d30] hover:bg-stone-200/70 dark:hover:bg-[#343538] focus-within:bg-white dark:focus-within:bg-[#202124] focus-within:shadow-md focus-within:border-stone-300 dark:focus-within:border-stone-600 border border-transparent rounded-xl transition-all">
          <div className="pl-2.5 sm:pl-3.5 pr-1.5 sm:pr-2 text-stone-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-1.5 sm:py-2.5 text-xs sm:text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 outline-none truncate"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 sm:p-1.5 mr-1.5 sm:mr-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-0.5 sm:gap-1 text-stone-600 dark:text-stone-300 shrink-0">
        {/* Active Reading Stopwatch Live Bar */}
        {activeStopwatch && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 mr-1 sm:mr-2 text-xs font-medium animate-in fade-in">
            <span className="relative flex h-2 w-2">
              {activeStopwatch.isRunning && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${activeStopwatch.isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="hidden md:inline max-w-[110px] truncate" title={activeStopwatch.noteTitle}>
              {activeStopwatch.noteTitle}
            </span>
            <span className="font-mono font-bold tracking-tight">
              {Math.floor(activeStopwatch.elapsedSeconds / 60).toString().padStart(2, '0')}:{(activeStopwatch.elapsedSeconds % 60).toString().padStart(2, '0')}
            </span>
            {activeStopwatch.isRunning ? (
              <button
                type="button"
                onClick={pauseReadingStopwatch}
                className="p-1 hover:bg-emerald-500/20 rounded-full transition-colors"
                title="Pause stopwatch"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeReadingStopwatch}
                className="p-1 hover:bg-emerald-500/20 rounded-full transition-colors"
                title="Resume stopwatch"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await stopAndSaveReadingStopwatch();
              }}
              className="px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
              title="Stop and save reading session"
            >
              Stop
            </button>
          </div>
        )}
        {/* Choose Local Paste Folder (Desktop / Tablet) */}
        <button
          type="button"
          onClick={() => setIsLocalFolderModalOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-400/15 hover:bg-amber-400/25 text-amber-800 dark:text-amber-300 border border-amber-400/30 transition-colors text-xs font-medium mr-0.5 sm:mr-1 shrink-0"
          title={
            localMediaFolder
              ? `Local Paste Folder: ${localMediaFolder} (Click to change)`
              : 'Choose local folder for pasted images & files'
          }
        >
          <FolderOpen className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="hidden md:inline max-w-[120px] truncate">
            {localMediaFolder
              ? localMediaFolder.split(/[\\/]/).filter(Boolean).pop() || 'Local Folder'
              : 'Choose Folder'}
          </span>
        </button>

        {/* Layout Toggle */}
        <button
          type="button"
          onClick={() => setLayoutMode(layoutMode === 'grid' ? 'list' : 'grid')}
          className="p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0"
          title={layoutMode === 'grid' ? 'List view' : 'Grid view'}
        >
          {layoutMode === 'grid' ? (
            <Rows className="w-5 h-5" />
          ) : (
            <LayoutGrid className="w-5 h-5" />
          )}
        </button>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Reading Stats & Graph per Day */}
        <button
          type="button"
          onClick={() => {
            if (currentFilter === 'stats') {
              setCurrentFilter('notes');
              if (typeof window !== 'undefined') window.history.pushState(null, '', '/');
            } else {
              setCurrentFilter('stats');
              if (typeof window !== 'undefined') window.history.pushState(null, '', '/stats');
            }
          }}
          className={`p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 ${
            currentFilter === 'stats'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
              : 'text-stone-600 dark:text-stone-300'
          }`}
          title="Reading Stats & Daily Graph"
        >
          <BarChart2 className="w-5 h-5" />
        </button>

        {/* Install on Android & Mobile Toggle */}
        <button
          type="button"
          onClick={() => {
            if (canInstallPwa) {
              promptInstallPwa();
            } else {
              setIsInstallModalOpen(true);
            }
          }}
          className={`p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 ${
            isPwaInstalled
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
          title={isPwaInstalled ? 'App is installed on your device ✓' : 'Install on Android / Mobile (1-tap offline app)'}
        >
          <Smartphone className="w-5 h-5" />
        </button>

        {/* Settings Dialog Toggle */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 sm:p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0"
          title="Settings (Font size, Theme, Backup)"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>

        {/* Google Drive Cloud Backup & Restore */}
        <button
          type="button"
          onClick={() => setIsGoogleDriveModalOpen(true)}
          className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-blue-600 dark:text-blue-400 hidden sm:flex"
          title="Google Drive Cloud Backup & Restore (Export & Import)"
        >
          <Cloud className="w-5 h-5" />
        </button>

        {/* Export Notes to PDF (NotebookLM Ready) */}
        <button
          type="button"
          onClick={() => setIsPdfExportModalOpen(true)}
          className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-red-600 dark:text-red-400 hidden sm:flex"
          title="Export notes to PDF (NotebookLM ready with 200-page auto-splitting)"
        >
          <FileText className="w-5 h-5" />
        </button>

        {/* Export Backup Bundle (ZIP) */}
        <button
          type="button"
          onClick={exportDataZip}
          className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors hidden md:flex"
          title="Export notes backup archive (ZIP with images and files)"
        >
          <FolderDown className="w-5 h-5" />
        </button>

        {/* Intelligent Import Backup */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors hidden md:flex"
          title="Intelligent import backup (ZIP or JSON)"
        >
          <Upload className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.json,application/zip,application/x-zip-compressed,application/json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>
    </header>
  );
};
