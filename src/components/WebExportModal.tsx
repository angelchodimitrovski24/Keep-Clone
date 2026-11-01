'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Globe,
  FileText,
  Download,
  Eye,
  CheckSquare,
  Square,
  Search,
  Layers,
  Sparkles,
  CheckCircle2,
  FolderArchive,
  Image as ImageIcon,
  Tag,
  Folder,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { Note } from '@/types/note';
import {
  generateSinglePageWebExport,
  generateMultiPageWebExportZip,
  triggerFileDownload,
} from '@/lib/webExport';

export const WebExportModal: React.FC = () => {
  const {
    isWebExportModalOpen,
    setIsWebExportModalOpen,
    notes,
    categories,
    labels,
    selectedNoteIds,
    clearSelection,
    searchQuery,
    currentFilter,
    selectedCategory,
    selectedLabel,
  } = useKeep();

  const [exportFormat, setExportFormat] = useState<'single-html' | 'multi-page-zip'>('single-html');
  const [siteTitle, setSiteTitle] = useState('My Notes - Web Export');
  const [embedImages, setEmbedImages] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [defaultTheme, setDefaultTheme] = useState<'system' | 'light' | 'dark'>('system');

  // Candidate note filter selections
  const [chosenNoteIds, setChosenNoteIds] = useState<string[]>([]);
  const [modalSearchFilter, setModalSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Generation status
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; stage: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active notes (excluding trash by default)
  const activeNotes = useMemo(() => {
    return notes
      .filter((n) => !n.isTrash)
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [notes]);

  // Notes matching current Keep search query or view filter
  const currentFilteredNotes = useMemo(() => {
    return activeNotes.filter((note) => {
      if (currentFilter === 'archive') {
        if (!note.isArchived) return false;
      } else {
        if (note.isArchived) return false;
      }
      if (selectedLabel && !note.labels?.includes(selectedLabel)) return false;
      if (selectedCategory && note.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = note.title?.toLowerCase().includes(q);
        const matchesContent = note.content?.toLowerCase().includes(q);
        const matchesLabels = note.labels?.some((l) => l.toLowerCase().includes(q));
        const matchesCategory = note.category?.toLowerCase().includes(q);
        return matchesTitle || matchesContent || matchesLabels || matchesCategory;
      }
      return true;
    });
  }, [activeNotes, currentFilter, selectedLabel, selectedCategory, searchQuery]);

  // When modal opens, initialize selected notes:
  // 1. If notes were explicitly selected in the header toolbar -> select those!
  // 2. Otherwise if search query / filters are active -> select current filtered notes!
  // 3. Otherwise -> select all active notes!
  useEffect(() => {
    if (isWebExportModalOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setProgress(null);

      if (selectedNoteIds.length > 0) {
        setChosenNoteIds([...selectedNoteIds]);
        setSiteTitle(`Selected Notes (${selectedNoteIds.length}) - Web Export`);
      } else if (searchQuery.trim() || selectedCategory || selectedLabel) {
        const ids = currentFilteredNotes.map((n) => n.id);
        setChosenNoteIds(ids);
        const criteriaName = searchQuery.trim()
          ? `"${searchQuery.trim()}"`
          : selectedCategory
          ? selectedCategory
          : selectedLabel
          ? `#${selectedLabel}`
          : 'Filtered';
        setSiteTitle(`Notes - ${criteriaName} - Web Export`);
      } else {
        setChosenNoteIds(activeNotes.map((n) => n.id));
        setSiteTitle('Google Keep Notes - Web Export');
      }
    }
  }, [isWebExportModalOpen]);

  // Notes to be exported
  const selectedNotesToExport = useMemo(() => {
    const set = new Set(chosenNoteIds);
    return activeNotes.filter((n) => set.has(n.id));
  }, [activeNotes, chosenNoteIds]);

  // Modal note list with internal search filtering
  const displayNotesList = useMemo(() => {
    return activeNotes.filter((note) => {
      if (categoryFilter !== 'all' && note.category !== categoryFilter) {
        return false;
      }
      if (modalSearchFilter.trim()) {
        const q = modalSearchFilter.toLowerCase();
        const matchesTitle = note.title?.toLowerCase().includes(q);
        const matchesContent = note.content?.toLowerCase().includes(q);
        const matchesLabels = note.labels?.some((l) => l.toLowerCase().includes(q));
        return matchesTitle || matchesContent || matchesLabels;
      }
      return true;
    });
  }, [activeNotes, categoryFilter, modalSearchFilter]);

  const handleToggleNote = (noteId: string) => {
    setChosenNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const handleSelectAllDisplayed = () => {
    const displayedIds = displayNotesList.map((n) => n.id);
    setChosenNoteIds((prev) => Array.from(new Set([...prev, ...displayedIds])));
  };

  const handleDeselectAllDisplayed = () => {
    const displayedSet = new Set(displayNotesList.map((n) => n.id));
    setChosenNoteIds((prev) => prev.filter((id) => !displayedSet.has(id)));
  };

  const handleSelectOnlySearchOrFiltered = () => {
    setChosenNoteIds(currentFilteredNotes.map((n) => n.id));
  };

  const handlePreview = async () => {
    if (selectedNotesToExport.length === 0) {
      setErrorMessage('Please select at least one note to preview.');
      return;
    }

    try {
      setIsPreviewing(true);
      setErrorMessage(null);
      setProgress({ current: 0, total: selectedNotesToExport.length, stage: 'Preparing web page preview...' });

      const html = await generateSinglePageWebExport({
        siteTitle,
        notes: selectedNotesToExport,
        categories,
        labels,
        embedImages,
        includeCategories,
        includeLabels,
        includeTimestamps,
        defaultTheme,
        onProgress: setProgress,
      });

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setSuccessMessage('Preview opened in new tab! You can explore the Table of Contents and individual note pages.');
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('Preview error:', err);
      setErrorMessage(err?.message || 'Failed to generate preview');
    } finally {
      setIsPreviewing(false);
      setProgress(null);
    }
  };

  const handleExport = async () => {
    if (selectedNotesToExport.length === 0) {
      setErrorMessage('Please select at least one note to export.');
      return;
    }

    try {
      setIsExporting(true);
      setErrorMessage(null);
      setProgress({ current: 0, total: selectedNotesToExport.length, stage: 'Starting export...' });

      const dateStamp = new Date().toISOString().slice(0, 10);
      const cleanFileName = (siteTitle || 'notes-export')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (exportFormat === 'single-html') {
        const html = await generateSinglePageWebExport({
          siteTitle,
          notes: selectedNotesToExport,
          categories,
          labels,
          embedImages,
          includeCategories,
          includeLabels,
          includeTimestamps,
          defaultTheme,
          onProgress: setProgress,
        });

        triggerFileDownload(html, `${cleanFileName}-${dateStamp}.html`, 'text/html');
        setSuccessMessage(`Successfully exported ${selectedNotesToExport.length} notes as a standalone Web Page (.html)!`);
      } else {
        const zipBlob = await generateMultiPageWebExportZip({
          siteTitle,
          notes: selectedNotesToExport,
          categories,
          labels,
          embedImages,
          includeCategories,
          includeLabels,
          includeTimestamps,
          onProgress: setProgress,
        });

        triggerFileDownload(zipBlob, `${cleanFileName}-${dateStamp}.zip`, 'application/zip');
        setSuccessMessage(`Successfully exported ${selectedNotesToExport.length} notes as a Multi-Page Web Site (.zip)!`);
      }

      setTimeout(() => {
        setIsWebExportModalOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(err?.message || 'Failed to export web page');
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  if (!isWebExportModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1e1f23] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/60 dark:bg-[#1a1b1e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Export Notes as Web Page
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  TOC + Individual Note Pages
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Generate an interactive, offline web page with a Table of Contents sidebar and each note as its own separate page.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsWebExportModalOpen(false)}
            disabled={isExporting || isPreviewing}
            className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split into Settings & Note Selection */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Export Options & Formatting (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Website Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                Web Page Title
              </label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                placeholder="My Notes Web Export"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Export Format Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                <div
                  onClick={() => setExportFormat('single-html')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    exportFormat === 'single-html'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                        Single Interactive Web Page (.html)
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white">Recommended</span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                        Single self-contained file with Table of Contents sidebar, real-time search, theme toggle, and hash navigation to each note page. Works 100% offline.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setExportFormat('multi-page-zip')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    exportFormat === 'multi-page-zip'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <FolderArchive className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        Multi-Page Web Site (.zip)
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                        ZIP archive with <code>index.html</code> (Contents list) and separate <code>notes/note-*.html</code> files for each note.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customization Options */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#18191c] border border-stone-200 dark:border-stone-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1">
                Content & Styling Options
              </span>

              <label className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={embedImages}
                  onChange={(e) => setEmbedImages(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span><strong>Embed images as Base64</strong> (100% portable offline)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCategories}
                  onChange={(e) => setIncludeCategories(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span>Include Category Badges & Filters</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeLabels}
                  onChange={(e) => setIncludeLabels(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span>Include Label / Tag Pills</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTimestamps}
                  onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span>Include Created & Last Edited Timestamps</span>
              </label>
            </div>
          </div>

          {/* Right Column: Note Selection List (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Select Notes to Export
                </label>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                  {chosenNoteIds.length} of {activeNotes.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllDisplayed}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-stone-300 dark:text-stone-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllDisplayed}
                  className="text-stone-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Quick Filter from current search query if active */}
            {(searchQuery.trim() || selectedCategory || selectedLabel) && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300">
                <span>
                  Filter active: <strong>{searchQuery.trim() ? `"${searchQuery.trim()}"` : selectedCategory || `#${selectedLabel}`}</strong> ({currentFilteredNotes.length} notes)
                </span>
                <button
                  type="button"
                  onClick={handleSelectOnlySearchOrFiltered}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                >
                  Select these {currentFilteredNotes.length}
                </button>
              </div>
            )}

            {/* Modal Internal Search & Category Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={modalSearchFilter}
                  onChange={(e) => setModalSearchFilter(e.target.value)}
                  placeholder="Filter by title, tag, or text..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs text-stone-800 dark:text-stone-200 outline-none focus:border-amber-500"
                />
              </div>

              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs text-stone-800 dark:text-stone-200 outline-none"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Scrollable Notes Checklist */}
            <div className="flex-1 min-h-[300px] max-h-[360px] overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-800 p-2 space-y-1 bg-stone-50/50 dark:bg-[#151619]">
              {displayNotesList.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  No notes match your filter.
                </div>
              ) : (
                displayNotesList.map((note) => {
                  const isChecked = chosenNoteIds.includes(note.id);
                  const previewSnippet = (note.content || '').replace(/<[^>]+>/g, ' ').slice(0, 100);

                  return (
                    <div
                      key={note.id}
                      onClick={() => handleToggleNote(note.id)}
                      className={`p-2.5 rounded-xl flex items-start gap-3 cursor-pointer transition-colors border ${
                        isChecked
                          ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                          : 'bg-white dark:bg-[#1a1b1f] border-transparent hover:border-stone-200 dark:hover:border-stone-700'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 text-stone-400 focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleNote(note.id);
                        }}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-amber-500 fill-amber-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold truncate ${isChecked ? 'text-amber-950 dark:text-amber-200 font-bold' : 'text-stone-800 dark:text-stone-200'}`}>
                            {note.title || 'Untitled Note'}
                          </span>
                          {note.category && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 shrink-0">
                              📁 {note.category}
                            </span>
                          )}
                        </div>

                        {previewSnippet && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                            {previewSnippet}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-400">
                          {note.updatedAt && (
                            <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                          )}
                          {note.labels && note.labels.length > 0 && (
                            <span>• #{note.labels.slice(0, 3).join(' #')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Status / Error Messages */}
        {errorMessage && (
          <div className="mx-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Progress Display */}
        {progress && (
          <div className="mx-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-amber-600" />
            <span>{progress.stage} ({progress.current}/{progress.total})</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-50/60 dark:bg-[#1a1b1e]">
          <span className="text-xs text-stone-500 dark:text-stone-400">
            Exporting <strong>{selectedNotesToExport.length}</strong> note{selectedNotesToExport.length === 1 ? '' : 's'}
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsWebExportModalOpen(false)}
              disabled={isExporting || isPreviewing}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {/* Preview Button */}
            <button
              type="button"
              onClick={handlePreview}
              disabled={isExporting || isPreviewing || selectedNotesToExport.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Preview the interactive web page in a new browser tab"
            >
              {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              <span>Preview</span>
            </button>

            {/* Export & Download Button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || isPreviewing || selectedNotesToExport.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center justify-center gap-1.5 shadow-sm transition-all hover:shadow cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>
                {exportFormat === 'single-html' ? 'Export as Web Page (.html)' : 'Export Website (.zip)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
