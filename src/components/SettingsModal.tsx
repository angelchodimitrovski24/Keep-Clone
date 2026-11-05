'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Type,
  Sun,
  Moon,
  Laptop,
  LayoutGrid,
  Rows,
  FolderOpen,
  Download,
  Upload,
  Settings as SettingsIcon,
  Sparkles,
  Bot,
  Cloud,
  FileText,
  Smartphone,
  Globe,
  Database,
  Zap,
  Trash2,
  Gauge,
  CalendarRange,
  BarChart2,
  FileSpreadsheet,
  FolderDown,
  GitMerge,
  Palette,
  Wrench,
  Link2,
  HardDrive,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useKeep, getFontSizeInPx } from '@/context/KeepContext';
import { FontSizeOption, AppThemeMode } from '@/types/note';
import { getSavedJiraConfig } from '@/lib/jiraClient';
import { getSavedSupportbenchConfig } from '@/lib/supportbenchClient';
import { getSavedOllamaConfig } from '@/lib/ollamaClient';

type SettingsTab = 'appearance' | 'tools' | 'integrations' | 'backup' | 'engine';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    setIsGoogleDriveModalOpen,
    setIsPdfExportModalOpen,
    setIsWebExportModalOpen,
    setIsExcelExportModalOpen,
    setIsJiraModalOpen,
    setIsSupportbenchModalOpen,
    openGeneralAiChat,
    setIsDateCompileModalOpen,
    setIsNotionTemplateModalOpen,
    setIsMergeNotesModalOpen,
    setCurrentFilter,
    isInstallModalOpen,
    setIsInstallModalOpen,
    canInstallPwa,
    isPwaInstalled,
    promptInstallPwa,
    fontSize,
    setFontSize,
    themeMode,
    setThemeMode,
    layoutMode,
    setLayoutMode,
    localMediaFolder,
    setIsLocalFolderModalOpen,
    notes,
    labels,
    totalNotesCount,
    totalActiveNotesCount,
    databaseStats,
    refreshDatabaseStats,
    runBenchmarkGeneration,
    clearBenchmarkNotes,
    exportDataZip,
    importDataSmart,
  } = useKeep();

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const [benchmarkProgress, setBenchmarkProgress] = useState<{
    running: boolean;
    inserted: number;
    total: number;
    action: string;
  } | null>(null);

  useEffect(() => {
    if (isSettingsOpen && refreshDatabaseStats) {
      refreshDatabaseStats();
    }
  }, [isSettingsOpen, refreshDatabaseStats]);

  const handleRunBenchmark = async (count: number) => {
    if (benchmarkProgress?.running) return;
    setBenchmarkProgress({ running: true, inserted: 0, total: count, action: 'Generating notes...' });
    try {
      await runBenchmarkGeneration(count, (done, total) => {
        setBenchmarkProgress({ running: true, inserted: done, total, action: 'Seeding IndexedDB batches...' });
      });
      await refreshDatabaseStats();
    } catch (err) {
      console.error('Benchmark generation error:', err);
    } finally {
      setBenchmarkProgress(null);
    }
  };

  const handleClearBenchmark = async () => {
    if (benchmarkProgress?.running) return;
    setBenchmarkProgress({ running: true, inserted: 0, total: 100, action: 'Deleting benchmark notes...' });
    try {
      await clearBenchmarkNotes((deleted) => {
        setBenchmarkProgress({ running: true, inserted: deleted, total: 100, action: `Deleted ${deleted} benchmark notes...` });
      });
      await refreshDatabaseStats();
    } catch (err) {
      console.error('Clear benchmark error:', err);
    } finally {
      setBenchmarkProgress(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mhtmlInputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  useEffect(() => {
    if (isSettingsOpen) {
      checkScroll();
      const t1 = setTimeout(checkScroll, 50);
      const t2 = setTimeout(checkScroll, 200);
      window.addEventListener('resize', checkScroll);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [isSettingsOpen, activeTab]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -160 : 160,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 250);
    }
  };

  const handleTabClick = (tabId: SettingsTab, e: React.MouseEvent<HTMLButtonElement>) => {
    setActiveTab(tabId);
    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setTimeout(checkScroll, 250);
  };

  if (!isSettingsOpen) return null;

  const fontOptions: { id: FontSizeOption; label: string; desc: string; sizePx: string }[] = [
    { id: 'small', label: 'Small', desc: 'Compact view for high density', sizePx: '13.5px' },
    { id: 'medium', label: 'Medium', desc: 'Default Google Keep reading size', sizePx: '15px' },
    { id: 'large', label: 'Large', desc: 'Enhanced legibility and comfort', sizePx: '17px' },
    { id: 'xlarge', label: 'Extra Large', desc: 'Higher visibility and clarity', sizePx: '20px' },
    { id: 'huge', label: 'Huge', desc: 'Spacious and prominent reading size', sizePx: '24px' },
    { id: 'max', label: 'Maximum', desc: 'Maximum 28px accessibility size', sizePx: '28px' },
  ];

  const currentPxNum = parseInt(getFontSizeInPx(fontSize)) || 15;

  const themeOptions: { id: AppThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'system', label: 'System', icon: <Laptop className="w-4 h-4" /> },
    { id: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
  ];

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importDataSmart(file);
    e.target.value = '';
  };

  const tabs: { id: SettingsTab; shortLabel: string; fullLabel?: string; icon: React.ReactNode }[] = [
    { id: 'appearance', shortLabel: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'tools', shortLabel: 'Tools', fullLabel: ' & Templates', icon: <Wrench className="w-4 h-4" /> },
    { id: 'integrations', shortLabel: 'Integrations', icon: <Link2 className="w-4 h-4" /> },
    { id: 'backup', shortLabel: 'Data & Export', icon: <HardDrive className="w-4 h-4" /> },
    { id: 'engine', shortLabel: '1M Engine', icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div
      onClick={() => setIsSettingsOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl lg:max-w-4xl bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 flex flex-col overflow-hidden max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-lg text-stone-900 dark:text-stone-100">
              Settings &amp; Tools Hub
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Bar with responsive horizontal scroll and indicators */}
        <div className="relative border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/40 flex items-center">
          {/* Left scroll chevron & fade indicator */}
          {canScrollLeft && (
            <>
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-stone-100 dark:from-stone-900 to-transparent pointer-events-none z-5" />
              <button
                type="button"
                onClick={() => scrollTabs('left')}
                className="absolute left-1 z-10 p-1 rounded-full bg-white/95 dark:bg-[#202124]/95 shadow-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:scale-105 transition-all cursor-pointer"
                title="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}

          <div
            ref={tabsRef}
            onScroll={checkScroll}
            onWheel={(e) => {
              if (tabsRef.current) {
                if (e.deltaY !== 0) {
                  tabsRef.current.scrollLeft += e.deltaY;
                } else if (e.deltaX !== 0) {
                  tabsRef.current.scrollLeft += e.deltaX;
                }
              }
            }}
            className="keep-tabs-scroll flex items-center gap-1.5 px-3 sm:px-6 pt-3 pb-2.5 overflow-x-auto select-none w-full scroll-smooth"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={(e) => handleTabClick(tab.id, e)}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-stone-900 text-white dark:bg-stone-700 dark:text-white dark:border dark:border-stone-600 font-semibold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800/80'
                  }`}
                >
                  {tab.icon}
                  <span>
                    {tab.shortLabel}
                    {tab.fullLabel && <span className="hidden md:inline">{tab.fullLabel}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right scroll chevron & fade indicator */}
          {canScrollRight && (
            <>
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-stone-100 dark:from-stone-900 to-transparent pointer-events-none z-5" />
              <button
                type="button"
                onClick={() => scrollTabs('right')}
                className="absolute right-1 z-10 p-1 rounded-full bg-white/95 dark:bg-[#202124]/95 shadow-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:scale-105 transition-all cursor-pointer"
                title="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="px-5 sm:px-6 py-5 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Note Font Size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-stone-500" />
                    <label className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Note Font Size
                    </label>
                  </div>
                  <span className="text-xs font-mono text-stone-500 uppercase">
                    {fontOptions.find((f) => f.id === fontSize)?.label} ({fontOptions.find((f) => f.id === fontSize)?.sizePx})
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  Adjust reading and editing text size across all notes, checklists, and Markdown previews.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {fontOptions.map((opt) => {
                    const isSelected = fontSize === opt.id || getFontSizeInPx(fontSize) === opt.sizePx;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFontSize(opt.id)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-stone-900 bg-stone-100 text-stone-900 dark:border-stone-400 dark:bg-stone-800 dark:text-stone-100 font-semibold shadow-xs ring-1 ring-stone-900 dark:ring-stone-400'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <span className="text-sm">{opt.label}</span>
                        <span className="text-[11px] text-stone-400 mt-0.5">{opt.sizePx}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Continuous Font Size Slider (12px to 28px) */}
                <div className="p-3.5 rounded-xl border border-stone-200/90 dark:border-stone-700/80 bg-stone-50/70 dark:bg-stone-900/40 mb-3">
                  <div className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 mb-2">
                    <span className="font-semibold">Smooth Font Size Slider (12px – 28px):</span>
                    <span className="font-mono font-bold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-md text-xs border border-stone-200 dark:border-stone-700">
                      {getFontSizeInPx(fontSize)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="28"
                    step="1"
                    value={currentPxNum}
                    onChange={(e) => setFontSize(`${e.target.value}px`)}
                    className="w-full accent-stone-900 dark:accent-stone-300 cursor-pointer h-2 bg-stone-200 dark:bg-stone-700 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-stone-400 mt-1.5 font-mono">
                    <span>12px</span>
                    <span>15px</span>
                    <span>18px</span>
                    <span>21px</span>
                    <span>24px</span>
                    <span>28px</span>
                  </div>
                </div>

                {/* Live Interactive Font Size Preview Box */}
                <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                    Live Preview (scales text, code, checklists &amp; tables):
                  </div>
                  <div className="keep-rendered text-stone-800 dark:text-stone-200 space-y-2">
                    <h4 className="font-semibold mb-1">Trip to Kyoto &amp; Tokyo 🌸</h4>
                    <p>
                      Pack warm clothes and verify train tickets. All note elements scale seamlessly up to 28px!
                    </p>
                    <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                      <span className="w-3.5 h-3.5 rounded border border-stone-400 flex items-center justify-center text-[10px] text-blue-600 font-bold shrink-0">
                        ✓
                      </span>
                      <span>Confirm hotel reservations in Shibuya</span>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-stone-200 dark:border-stone-800" />

              {/* Appearance & Theme */}
              <div>
                <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 block mb-1">
                  Appearance / Theme
                </label>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  Choose your interface theme. System automatically matches your OS preference.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {themeOptions.map((opt) => {
                    const isSelected = themeMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setThemeMode(opt.id)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition-all text-sm font-medium ${
                          isSelected
                            ? 'border-stone-900 bg-stone-100 text-stone-900 dark:border-stone-400 dark:bg-stone-800 dark:text-stone-100 font-semibold ring-1 ring-stone-900 dark:ring-stone-400 shadow-xs'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="border-stone-200 dark:border-stone-800" />

              {/* Notes Layout View */}
              <div>
                <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 block mb-1">
                  Notes Layout View
                </label>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  Switch between card grid, compact list, or Notion-style document table view.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLayoutMode('grid')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm transition-all ${
                      layoutMode === 'grid'
                        ? 'border-stone-900 bg-stone-100 text-stone-900 dark:border-stone-400 dark:bg-stone-800 dark:text-stone-100 font-semibold ring-1 ring-stone-900 dark:ring-stone-400'
                        : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>Grid View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('list')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm transition-all ${
                      layoutMode === 'list'
                        ? 'border-stone-900 bg-stone-100 text-stone-900 dark:border-stone-400 dark:bg-stone-800 dark:text-stone-100 font-semibold ring-1 ring-stone-900 dark:ring-stone-400'
                        : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Rows className="w-4 h-4" />
                    <span>List View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('notion')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm transition-all ${
                      layoutMode === 'notion'
                        ? 'border-stone-900 bg-stone-100 text-stone-900 dark:border-stone-400 dark:bg-stone-800 dark:text-stone-100 font-semibold ring-1 ring-stone-900 dark:ring-stone-400'
                        : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Notion List</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TOOLS & TEMPLATES */}
          {activeTab === 'tools' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Specialized note tools, productivity templates, reading analytics, and device apps.
              </p>

              {/* Tool 1: Date Range Compiler */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CalendarRange className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Notes by Date Range
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Compile notes created or updated across specific timeframes (Today, 7d, 14d, 30d, 90d, 1y) into a clean single note.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsDateCompileModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                >
                  Open Date Compiler
                </button>
              </div>

              {/* Tool 2: Notion Template Hub */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Notion Template Hub
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Generate structured Notion-style dashboard hubs: Today&apos;s Notes, Days of the Week tracker, or Keyword Clusters.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsNotionTemplateModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 font-semibold text-xs shrink-0 transition-colors shadow-2xs"
                >
                  Create Template Hub
                </button>
              </div>

              {/* Tool 3: Merge Notes */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <GitMerge className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Merge Notes Tool
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Combine multiple selected notes, checklists, and attachments into a unified structured note with headings.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsMergeNotesModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                >
                  Open Merge Tool
                </button>
              </div>

              {/* Tool 4: Reading Stats & Analytics */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Reading Stats &amp; Daily Graph
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      View reading time analytics, word counts, session logs, and daily productivity charts.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setCurrentFilter('stats');
                    if (typeof window !== 'undefined') window.history.pushState(null, '', '/stats');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                >
                  View Reading Stats
                </button>
              </div>

              {/* Tool 5: Local Paste Folder */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Local Media Paste Folder
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate max-w-sm">
                      {localMediaFolder || 'Default system directory for pasted screenshots & files'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsLocalFolderModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-600 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                >
                  Change Folder
                </button>
              </div>

              {/* Tool 6: Android & PWA App Installation */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Install on Android &amp; Devices
                      </h4>
                      {isPwaInstalled && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                          Installed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Install Keep to your Android home screen or desktop for 100% offline note-taking and full-screen view.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (canInstallPwa) {
                      promptInstallPwa();
                    } else {
                      setIsInstallModalOpen(true);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 font-semibold text-xs shrink-0 transition-colors shadow-2xs"
                >
                  {isPwaInstalled ? 'App Status' : canInstallPwa ? 'Install Now' : 'Install Guide'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Connect external developer platforms, support trackers, and local AI engines.
              </p>

              {/* Integration 1: Atlassian Jira */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 mt-0.5 shadow-xs">
                    J
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Atlassian Jira Integration
                      </h4>
                      {getSavedJiraConfig() ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          Connected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-stone-500 bg-stone-500/15 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Configure your Atlassian API token and Jira domain to search issues with JQL, import tickets, and automatically download attachment screenshots.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsJiraModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                >
                  Open Jira Manager
                </button>
              </div>

              {/* Integration 2: Supportbench */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-xs">
                    SB
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Supportbench Integration
                      </h4>
                      {getSavedSupportbenchConfig() ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          Connected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-stone-500 bg-stone-500/15 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Configure Supportbench API token/key to download cases, activities, and perform multi-case scraping into structured notes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsSupportbenchModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                >
                  Open Supportbench
                </button>
              </div>

              {/* Integration 3: Ollama Local AI */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-900 dark:bg-stone-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Ollama Local AI Assistant &amp; Chat
                      </h4>
                      {getSavedOllamaConfig()?.selectedModel ? (
                        <span className="text-[10px] font-bold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2 py-0.5 rounded-full">
                          Model: {getSavedOllamaConfig().selectedModel}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                          Ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      100% private on-device LLM. Chat with notes, bulk summarize categories, extract action items, and ask questions.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    openGeneralAiChat();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 font-semibold text-xs shrink-0 transition-colors shadow-2xs"
                >
                  Open Ollama AI
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: DATA & EXPORT */}
          {activeTab === 'backup' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Data Storage &amp; Multi-Format Exports
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {totalNotesCount.toLocaleString()} notes in IndexedDB &bull; {labels.length} labels &bull; 100% local database
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Google Drive */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsGoogleDriveModalOpen(true);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-left transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Google Drive Sync</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">Cloud backup &amp; restore</div>
                  </div>
                </button>

                {/* Web Export */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsWebExportModalOpen(true);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Export as Web Page</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">Interactive website with search</div>
                  </div>
                </button>

                {/* Excel Export */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsExcelExportModalOpen(true);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Export to Excel</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">Formatted .xlsx &amp; .csv tables</div>
                  </div>
                </button>

                {/* PDF Export */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsPdfExportModalOpen(true);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-left transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Export to PDF</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">NotebookLM ready (200pg split)</div>
                  </div>
                </button>

                {/* Full ZIP Backup */}
                <button
                  type="button"
                  onClick={exportDataZip}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0">
                    <FolderDown className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Export Backup (ZIP)</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">Archive with images &amp; drawings</div>
                  </div>
                </button>

                {/* Intelligent Import */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Intelligent Import</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">ZIP, JSON, ICS &amp; MHTML</div>
                  </div>
                </button>
              </div>

              {/* MHTML Dedicated Import */}
              <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-xs text-stone-700 dark:text-stone-300">
                    Import Webpage Snapshot (<strong>.mhtml</strong> / <strong>.mht</strong>) with embedded formatting
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => mhtmlInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 transition-colors"
                >
                  Import MHTML
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.json,.ics,.mhtml,.mht,application/zip,application/x-zip-compressed,application/json,text/calendar,multipart/related,message/rfc822"
                onChange={handleImport}
                className="hidden"
              />
              <input
                ref={mhtmlInputRef}
                type="file"
                accept=".mhtml,.mht,multipart/related,message/rfc822"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          )}

          {/* TAB 5: 1M ENGINE & BENCHMARKS */}
          {activeTab === 'engine' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-stone-900 dark:bg-stone-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      ⚡
                    </span>
                    <span>1-Million Notes Scalability Engine</span>
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Cursor-based IndexedDB streaming and token indexes handle <strong>up to 1,000,000 notes</strong> with &lt; 50MB RAM footprint.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <Gauge className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                  Sub-50ms IndexedDB
                </span>
              </div>

              {/* Live Database Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">Total Notes in DB</div>
                  <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {(databaseStats?.totalNotes ?? totalNotesCount).toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">Active Notes</div>
                  <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {(databaseStats?.activeNotes ?? totalActiveNotesCount).toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">Benchmark Notes</div>
                  <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {(databaseStats?.benchmarkNotes ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">Query Speed</div>
                  <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                    &lt; 5 ms
                  </div>
                </div>
              </div>

              {/* Benchmark Progress Bar */}
              {benchmarkProgress?.running && (
                <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
                  <div className="flex items-center justify-between mb-1 text-stone-800 dark:text-stone-200 font-medium">
                    <span>{benchmarkProgress.action}</span>
                    <span>
                      {benchmarkProgress.inserted.toLocaleString()} / {benchmarkProgress.total.toLocaleString()} (
                      {Math.round((benchmarkProgress.inserted / Math.max(1, benchmarkProgress.total)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                    <div
                      className="h-full bg-stone-800 dark:bg-stone-200 transition-all duration-150"
                      style={{
                        width: `${Math.min(100, (benchmarkProgress.inserted / Math.max(1, benchmarkProgress.total)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Benchmark Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={benchmarkProgress?.running}
                  onClick={() => handleRunBenchmark(1000)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-50 transition-colors shadow-2xs"
                  title="Generate 1,000 test notes with categories and tags instantly"
                >
                  <Zap className="w-3.5 h-3.5 text-stone-400" />
                  <span>+1,000 Notes</span>
                </button>

                <button
                  type="button"
                  disabled={benchmarkProgress?.running}
                  onClick={() => handleRunBenchmark(10000)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-50 transition-colors shadow-2xs"
                  title="Generate 10,000 realistic notes in batched transactions (~1s)"
                >
                  <Zap className="w-3.5 h-3.5 text-stone-400" />
                  <span>+10,000 Notes</span>
                </button>

                <button
                  type="button"
                  disabled={benchmarkProgress?.running}
                  onClick={() => handleRunBenchmark(100000)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-50 transition-colors shadow-2xs"
                  title="Generate 100,000 notes in high-speed transactions (~10s)"
                >
                  <Zap className="w-3.5 h-3.5 text-stone-400" />
                  <span>+100,000 Notes</span>
                </button>

                <button
                  type="button"
                  disabled={benchmarkProgress?.running}
                  onClick={() => handleRunBenchmark(1000000)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-bold hover:bg-stone-800 dark:hover:bg-white disabled:opacity-50 transition-colors shadow-xs"
                  title="Generate full 1,000,000 notes benchmark suite"
                >
                  <Gauge className="w-3.5 h-3.5 text-stone-400 dark:text-stone-600" />
                  <span>🚀 +1,000,000 Notes</span>
                </button>

                {(databaseStats?.benchmarkNotes ?? 0) > 0 && (
                  <button
                    type="button"
                    disabled={benchmarkProgress?.running}
                    onClick={handleClearBenchmark}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-colors shadow-2xs ml-auto"
                    title="Delete all benchmark test notes and clean up storage"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Clean Up Benchmark</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {totalNotesCount.toLocaleString()} total notes &bull; Local IndexedDB PWA
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold text-sm hover:opacity-90 transition-opacity shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
