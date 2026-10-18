'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  CheckSquare,
  Info,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import {
  exportNotesToPdf,
  downloadBlob,
  PdfExportProgress,
  PdfExportResult,
} from '@/lib/pdfExport';

export const PdfExportModal: React.FC = () => {
  const {
    isPdfExportModalOpen,
    setIsPdfExportModalOpen,
    notes,
    labels,
    categories,
  } = useKeep();

  const [includeActive, setIncludeActive] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [includeTrash, setIncludeTrash] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<PdfExportProgress | null>(null);
  const [result, setResult] = useState<PdfExportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Group note counts
  const activeCount = useMemo(
    () => notes.filter((n) => !n.isArchived && !n.isTrash).length,
    [notes]
  );
  const archivedCount = useMemo(
    () => notes.filter((n) => n.isArchived && !n.isTrash).length,
    [notes]
  );
  const trashCount = useMemo(
    () => notes.filter((n) => n.isTrash).length,
    [notes]
  );

  // Filter notes to be exported based on choices
  const candidateNotes = useMemo(() => {
    return notes.filter((note) => {
      if (note.isTrash) return includeTrash;
      if (note.isArchived) return includeArchived;
      return includeActive;
    });
  }, [notes, includeActive, includeArchived, includeTrash]);

  const handleClose = () => {
    if (isGenerating) return; // Prevent closing mid-generation
    setIsPdfExportModalOpen(false);
    setProgress(null);
    setResult(null);
    setErrorMessage(null);
  };

  const handleStartExport = async () => {
    if (candidateNotes.length === 0) {
      setErrorMessage('No notes selected for export. Please select at least one note filter.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const exportResult = await exportNotesToPdf(
        candidateNotes,
        labels,
        categories,
        (p) => setProgress(p)
      );
      setResult(exportResult);
    } catch (err: unknown) {
      console.error('Failed to export notes to PDF:', err);
      const msg = err instanceof Error ? err.message : 'An unknown error occurred during PDF generation.';
      setErrorMessage(msg);
      setProgress({
        currentNote: 0,
        totalNotes: candidateNotes.length,
        status: `Error: ${msg}`,
        stage: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isPdfExportModalOpen) return null;

  const progressPercent =
    progress && progress.totalNotes > 0
      ? Math.min(100, Math.round((progress.currentNote / progress.totalNotes) * 100))
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Export Notes to PDF
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                  NotebookLM Ready
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Full-fidelity document export with images, drawings, and automated 200-page splitting
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* NotebookLM compliance notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-300">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sm">Automated 200-Page Splitting for NotebookLM</p>
              <p className="text-blue-700/90 dark:text-blue-300/90 leading-relaxed">
                Google NotebookLM accepts PDF sources of up to 200 pages. If your exported notes exceed 200 pages,
                this tool automatically breaks the document into separate 200-page PDF parts and bundles them in a ZIP archive.
              </p>
            </div>
          </div>

          {/* Configuration Selection */}
          {!result && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Select Notes to Include
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Active notes */}
                <label
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    includeActive
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                  } ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={includeActive}
                    onChange={(e) => setIncludeActive(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 dark:border-gray-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Active Notes</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activeCount} notes</p>
                  </div>
                </label>

                {/* Archived notes */}
                <label
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    includeArchived
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                  } ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 dark:border-gray-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Archived</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{archivedCount} notes</p>
                  </div>
                </label>

                {/* Trashed notes */}
                <label
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    includeTrash
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                  } ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={includeTrash}
                    onChange={(e) => setIncludeTrash(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 dark:border-gray-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Trash</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{trashCount} notes</p>
                  </div>
                </label>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span>Images & canvas drawings</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Checklists & timestamps</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50">
                  <Layers className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  <span>Labels, tags & categories</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-sm">Export Failed</p>
                <p className="text-red-700 dark:text-red-300 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Progress Section */}
          {isGenerating && progress && (
            <div className="space-y-3 p-5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  <span>{progress.status}</span>
                </div>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {progress.stage === 'rendering' ? `${progressPercent}%` : ''}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-300"
                  style={{
                    width:
                      progress.stage === 'rendering'
                        ? `${progressPercent}%`
                        : progress.stage === 'splitting' || progress.stage === 'zipping'
                        ? '100%'
                        : '5%',
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                <span>
                  Note {progress.currentNote} of {progress.totalNotes}
                </span>
                <span className="capitalize">{progress.stage}…</span>
              </div>
            </div>
          )}

          {/* Result Section */}
          {result && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">PDF Export Complete!</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-0.5">
                    Successfully processed {result.totalNotes} note{result.totalNotes === 1 ? '' : 's'} across{' '}
                    <span className="font-bold">{result.totalPages} pages</span>.
                  </p>
                </div>
              </div>

              {/* Single File Case (<= 200 pages) */}
              {!result.isSplit && result.parts.length === 1 && (
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {result.parts[0].filename}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {result.parts[0].pageCount} pages • Ready for NotebookLM import
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadBlob(result.parts[0].blob, result.parts[0].filename)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow hover:shadow-md transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              )}

              {/* Multi-Part Case (> 200 pages) */}
              {result.isSplit && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        Split into {result.parts.length} Documents (Max 200 Pages Each)
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                        Download all documents at once in a single ZIP file, or download individual parts below.
                      </p>
                    </div>
                    {result.zipBlob && result.zipFilename && (
                      <button
                        onClick={() => downloadBlob(result.zipBlob!, result.zipFilename!)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow hover:shadow-md transition-all flex-shrink-0 ml-4"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download All as ZIP</span>
                      </button>
                    )}
                  </div>

                  {/* List of individual parts */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {result.parts.map((part) => (
                      <div
                        key={part.filename}
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-gray-100/60 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {part.partNumber}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {part.filename}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {part.pageRangeStr} • {part.pageCount} pages
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => downloadBlob(part.blob, part.filename)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium text-xs transition-colors flex-shrink-0"
                          title={`Download ${part.filename}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/90">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {!result ? (
              <span>
                Selected: <strong className="text-gray-700 dark:text-gray-200">{candidateNotes.length}</strong> notes
              </span>
            ) : (
              <span>Ready for import into Google NotebookLM</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {result ? (
              <>
                <button
                  onClick={() => {
                    setResult(null);
                    setProgress(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Configure Again</span>
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white rounded-xl transition-colors"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleClose}
                  disabled={isGenerating}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartExport}
                  disabled={isGenerating || candidateNotes.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 rounded-xl shadow hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating PDF…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Export to PDF</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
