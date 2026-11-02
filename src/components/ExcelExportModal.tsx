'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Tag,
  Folder,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  FileText,
  Table as TableIcon,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { Note } from '@/types/note';
import {
  generateXlsxBlob,
  generateCsvBlob,
  downloadFile,
  ExcelExportColumnConfig,
  cleanNoteContentForExcel,
  formatNoteLabels,
} from '@/lib/excelExport';

type ExportScope = 'all' | 'selected' | 'labels' | 'categories';

export const ExcelExportModal: React.FC = () => {
  const {
    isExcelExportModalOpen,
    setIsExcelExportModalOpen,
    notes,
    categories,
    labels,
    selectedNoteIds,
  } = useKeep();

  const [scope, setScope] = useState<ExportScope>('all');
  const [selectedLabelNames, setSelectedLabelNames] = useState<string[]>([]);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const [chosenNoteIds, setChosenNoteIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

  // Column toggles (Default: exactly the 3 requested columns)
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeContent, setIncludeContent] = useState(true);
  const [includeCategory, setIncludeCategory] = useState(false);
  const [includeCreatedAt, setIncludeCreatedAt] = useState(false);
  const [includeUpdatedAt, setIncludeUpdatedAt] = useState(false);

  const [fileName, setFileName] = useState('keep-notes-export');
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active notes (exclude trash by default)
  const activeNotes = useMemo(() => {
    return notes
      .filter((n) => !n.isTrash)
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [notes]);

  // Extract all existing labels from notes and context
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    labels.forEach((l) => set.add(l.name));
    activeNotes.forEach((n) => (n.labels || []).forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [labels, activeNotes]);

  // Extract all categories from context and notes
  const allCategories = useMemo(() => {
    const list: Array<{ name: string; icon?: string }> = [];
    const seen = new Set<string>();
    categories.forEach((c) => {
      seen.add(c.name);
      list.push({ name: c.name, icon: c.icon });
    });
    activeNotes.forEach((n) => {
      if (n.category && !seen.has(n.category)) {
        seen.add(n.category);
        list.push({ name: n.category });
      }
    });
    return list;
  }, [categories, activeNotes]);

  // When modal opens, set initial scope
  useEffect(() => {
    if (isExcelExportModalOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);

      // If user had notes selected via checkboxes, default to 'selected'
      if (selectedNoteIds.length > 0) {
        setScope('selected');
        setChosenNoteIds([...selectedNoteIds]);
        setFileName(`selected-notes-${selectedNoteIds.length}`);
      } else {
        setScope('all');
        setChosenNoteIds(activeNotes.map((n) => n.id));
        setFileName('all-notes-export');
      }

      // Pre-select first category / label if available
      if (allLabels.length > 0) {
        setSelectedLabelNames([allLabels[0]]);
      }
      if (allCategories.length > 0) {
        setSelectedCategoryNames([allCategories[0].name]);
      }
    }
  }, [isExcelExportModalOpen]);

  // Update chosenNoteIds when scope or label/category filters change
  useEffect(() => {
    if (!isExcelExportModalOpen) return;

    if (scope === 'all') {
      setChosenNoteIds(activeNotes.map((n) => n.id));
      setFileName('all-notes-export');
    } else if (scope === 'selected') {
      if (selectedNoteIds.length > 0) {
        setChosenNoteIds([...selectedNoteIds]);
        setFileName(`selected-notes-${selectedNoteIds.length}`);
      } else {
        setChosenNoteIds([]);
      }
    } else if (scope === 'labels') {
      const matching = activeNotes.filter((n) =>
        n.labels?.some((l) => selectedLabelNames.includes(l))
      );
      setChosenNoteIds(matching.map((n) => n.id));
      const labelTag = selectedLabelNames.slice(0, 2).join('-') || 'labels';
      setFileName(`notes-by-label-${labelTag}`);
    } else if (scope === 'categories') {
      const matching = activeNotes.filter(
        (n) => n.category && selectedCategoryNames.includes(n.category)
      );
      setChosenNoteIds(matching.map((n) => n.id));
      const catTag = selectedCategoryNames.slice(0, 2).join('-') || 'categories';
      setFileName(`notes-by-category-${catTag}`);
    }
  }, [scope, selectedLabelNames, selectedCategoryNames, activeNotes, selectedNoteIds, isExcelExportModalOpen]);

  // Final notes to export based on chosen IDs
  const finalNotesToExport = useMemo(() => {
    const set = new Set(chosenNoteIds);
    return activeNotes.filter((n) => set.has(n.id));
  }, [activeNotes, chosenNoteIds]);

  // Filtered notes list for modal checklist display
  const displayNotes = useMemo(() => {
    let list = activeNotes;
    if (scope === 'labels') {
      list = activeNotes.filter((n) =>
        n.labels?.some((l) => selectedLabelNames.includes(l))
      );
    } else if (scope === 'categories') {
      list = activeNotes.filter(
        (n) => n.category && selectedCategoryNames.includes(n.category)
      );
    } else if (scope === 'selected' && selectedNoteIds.length > 0) {
      const selSet = new Set(selectedNoteIds);
      list = activeNotes.filter((n) => selSet.has(n.id));
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter((n) => {
        const matchesTitle = n.title?.toLowerCase().includes(q);
        const matchesContent = n.content?.toLowerCase().includes(q);
        const matchesLabels = n.labels?.some((l) => l.toLowerCase().includes(q));
        const matchesCategory = n.category?.toLowerCase().includes(q);
        return matchesTitle || matchesContent || matchesLabels || matchesCategory;
      });
    }

    return list;
  }, [activeNotes, scope, selectedLabelNames, selectedCategoryNames, selectedNoteIds, searchFilter]);

  const handleToggleLabel = (labelName: string) => {
    setSelectedLabelNames((prev) =>
      prev.includes(labelName)
        ? prev.filter((l) => l !== labelName)
        : [...prev, labelName]
    );
  };

  const handleToggleCategory = (catName: string) => {
    setSelectedCategoryNames((prev) =>
      prev.includes(catName)
        ? prev.filter((c) => c !== catName)
        : [...prev, catName]
    );
  };

  const handleToggleNote = (noteId: string) => {
    setChosenNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const handleSelectAllDisplayed = () => {
    const ids = displayNotes.map((n) => n.id);
    setChosenNoteIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAllDisplayed = () => {
    const displayedSet = new Set(displayNotes.map((n) => n.id));
    setChosenNoteIds((prev) => prev.filter((id) => !displayedSet.has(id)));
  };

  const handleExport = async () => {
    if (finalNotesToExport.length === 0) {
      setErrorMessage('No notes selected for export. Please select at least one note.');
      return;
    }

    if (!includeTitle && !includeLabels && !includeContent && !includeCategory && !includeCreatedAt && !includeUpdatedAt) {
      setErrorMessage('Please check at least one column to export.');
      return;
    }

    try {
      setIsExporting(true);
      setErrorMessage(null);

      const columnsConfig: ExcelExportColumnConfig = {
        includeTitle,
        includeLabels,
        includeContent,
        includeCategory,
        includeCreatedAt,
        includeUpdatedAt,
      };

      const dateStamp = new Date().toISOString().slice(0, 10);
      const cleanBase = (fileName.trim() || 'keep-notes-export')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (exportFormat === 'xlsx') {
        const xlsxBlob = await generateXlsxBlob({
          notes: finalNotesToExport,
          columns: columnsConfig,
        });
        downloadFile(xlsxBlob, `${cleanBase}-${dateStamp}.xlsx`);
        setSuccessMessage(`Successfully exported ${finalNotesToExport.length} notes into Excel (.xlsx)!`);
      } else {
        const csvBlob = generateCsvBlob({
          notes: finalNotesToExport,
          columns: columnsConfig,
        });
        downloadFile(csvBlob, `${cleanBase}-${dateStamp}.csv`);
        setSuccessMessage(`Successfully exported ${finalNotesToExport.length} notes into CSV (.csv)!`);
      }

      setTimeout(() => {
        setIsExcelExportModalOpen(false);
        setSuccessMessage(null);
      }, 1400);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(err?.message || 'Failed to generate Excel export');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isExcelExportModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1e1f23] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-[#1a1b1e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Export Notes to Excel
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  .xlsx & .csv
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Export all notes, selected notes, selected labels, or selected categories into an organized spreadsheet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsExcelExportModalOpen(false)}
            disabled={isExporting}
            className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Scope Selection (All, Selected, Labels, Categories) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">
              Choose What to Export
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Option 1: All Notes */}
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold">All Notes</span>
                <span className="text-[11px] text-stone-500">({activeNotes.length} notes)</span>
              </button>

              {/* Option 2: Selected Notes */}
              <button
                type="button"
                onClick={() => setScope('selected')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                  scope === 'selected'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold">Selected Notes</span>
                <span className="text-[11px] text-stone-500">
                  ({selectedNoteIds.length > 0 ? `${selectedNoteIds.length} chosen` : '0 selected'})
                </span>
              </button>

              {/* Option 3: By Label */}
              <button
                type="button"
                onClick={() => setScope('labels')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                  scope === 'labels'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold">Selected Labels</span>
                <span className="text-[11px] text-stone-500">({allLabels.length} available)</span>
              </button>

              {/* Option 4: By Category */}
              <button
                type="button"
                onClick={() => setScope('categories')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                  scope === 'categories'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <Folder className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold">Selected Categories</span>
                <span className="text-[11px] text-stone-500">({allCategories.length} categories)</span>
              </button>
            </div>
          </div>

          {/* Scope Sub-Pickers (when labels or categories scope is active) */}
          {scope === 'labels' && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#18191c] border border-stone-200 dark:border-stone-800 space-y-2.5 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                <span>Select Labels to Include:</span>
                <span className="text-[11px] font-normal text-stone-500">
                  {selectedLabelNames.length} selected
                </span>
              </span>
              {allLabels.length === 0 ? (
                <p className="text-xs text-stone-400">No labels created yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allLabels.map((l) => {
                    const isSelected = selectedLabelNames.includes(l);
                    const count = activeNotes.filter((n) => n.labels?.includes(l)).length;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => handleToggleLabel(l)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:border-emerald-500'
                        }`}
                      >
                        <span>#{l}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20' : 'bg-stone-100 dark:bg-stone-700'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {scope === 'categories' && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#18191c] border border-stone-200 dark:border-stone-800 space-y-2.5 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                <span>Select Categories to Include:</span>
                <span className="text-[11px] font-normal text-stone-500">
                  {selectedCategoryNames.length} selected
                </span>
              </span>
              {allCategories.length === 0 ? (
                <p className="text-xs text-stone-400">No categories created yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allCategories.map((c) => {
                    const isSelected = selectedCategoryNames.includes(c.name);
                    const count = activeNotes.filter((n) => n.category === c.name).length;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleToggleCategory(c.name)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:border-emerald-500'
                        }`}
                      >
                        <span>{c.icon || '📁'}</span>
                        <span>{c.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20' : 'bg-stone-100 dark:bg-stone-700'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Column Selection (Note Title, Note Labels, Note Content) */}
          <div className="p-4 rounded-2xl bg-stone-50/80 dark:bg-[#18191c] border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                Columns in Excel File
              </label>
              <span className="text-[11px] text-stone-500">
                Requested columns are selected by default
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Note Title */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTitle}
                  onChange={(e) => setIncludeTitle(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Note Title</div>
                  <div className="text-[10px] text-stone-400">Column A</div>
                </div>
              </label>

              {/* Note Labels */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeLabels}
                  onChange={(e) => setIncludeLabels(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Note Labels</div>
                  <div className="text-[10px] text-stone-400">Column B</div>
                </div>
              </label>

              {/* Note Content */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeContent}
                  onChange={(e) => setIncludeContent(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Note Content</div>
                  <div className="text-[10px] text-stone-400">Column C</div>
                </div>
              </label>
            </div>

            {/* Optional Extra Columns */}
            <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 flex flex-wrap items-center gap-4 text-xs text-stone-600 dark:text-stone-400">
              <span className="font-semibold text-[11px] text-stone-500 uppercase">Optional Columns:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCategory}
                  onChange={(e) => setIncludeCategory(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>Category</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCreatedAt}
                  onChange={(e) => setIncludeCreatedAt(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>Created Date</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUpdatedAt}
                  onChange={(e) => setIncludeUpdatedAt(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>Last Updated</span>
              </label>
            </div>
          </div>

          {/* 3. Notes Preview & Fine-Tuning List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Notes Included in Export ({finalNotesToExport.length})
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllDisplayed}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-stone-300 dark:text-stone-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllDisplayed}
                  className="text-stone-500 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Quick Search inside modal */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search notes in this list..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs text-stone-800 dark:text-stone-200 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Notes Checklist */}
            <div className="min-h-[140px] max-h-[220px] overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-800 p-2 space-y-1 bg-stone-50/50 dark:bg-[#151619]">
              {displayNotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  No notes match your selection.
                </div>
              ) : (
                displayNotes.map((note) => {
                  const isChecked = chosenNoteIds.includes(note.id);
                  const previewLabels = formatNoteLabels(note);
                  const previewText = cleanNoteContentForExcel(note).slice(0, 90);

                  return (
                    <div
                      key={note.id}
                      onClick={() => handleToggleNote(note.id)}
                      className={`p-2.5 rounded-xl flex items-start gap-3 cursor-pointer transition-colors border ${
                        isChecked
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
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
                          <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs truncate ${isChecked ? 'text-emerald-950 dark:text-emerald-200 font-bold' : 'text-stone-800 dark:text-stone-200 font-medium'}`}>
                            {note.title || 'Untitled Note'}
                          </span>
                          {note.category && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 shrink-0">
                              📁 {note.category}
                            </span>
                          )}
                        </div>

                        {previewLabels && (
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 truncate mt-0.5">
                            🏷️ {previewLabels}
                          </div>
                        )}

                        {previewText && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                            {previewText}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Format & Filename */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                Export Format
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExportFormat('xlsx')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    exportFormat === 'xlsx'
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    exportFormat === 'csv'
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>CSV (.csv)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="keep-notes-export"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="mx-6 mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-50/70 dark:bg-[#1a1b1e]">
          <span className="text-xs text-stone-500 dark:text-stone-400">
            Exporting <strong>{finalNotesToExport.length}</strong> note{finalNotesToExport.length === 1 ? '' : 's'} with <strong>
              {[includeTitle, includeLabels, includeContent, includeCategory, includeCreatedAt, includeUpdatedAt].filter(Boolean).length}
            </strong> columns
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsExcelExportModalOpen(false)}
              disabled={isExporting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || finalNotesToExport.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-sm transition-all hover:shadow cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {exportFormat === 'xlsx'
                  ? `Download Excel (.xlsx)`
                  : `Download CSV (.csv)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
