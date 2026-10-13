'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, FileText, Folder, Tag, Timer, Image as ImageIcon, X } from 'lucide-react';
import { ImportResult } from '@/lib/backupZip';

interface ImportSummaryModalProps {
  result: ImportResult | null;
  onClose: () => void;
}

export const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#202124] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs ${
                result.success
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}
            >
              {result.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                {result.success ? 'Intelligent Import Complete' : 'Import Failed'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {result.success ? 'Data merged without duplicating unchanged items' : 'An error occurred during import'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detailed Stats Cards */}
        {result.success && (
          <div className="space-y-3">
            {/* Notes row */}
            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/80 dark:border-stone-700/60">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-800 dark:text-stone-200 mb-2">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>Notes Reconciliation</span>
                </span>
                <span className="font-mono text-stone-500">
                  {result.notesAdded + result.notesUpdated + result.notesSkipped} total
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white dark:bg-stone-900/50 p-2 rounded-lg border border-stone-200/60 dark:border-stone-700/40">
                  <span className="block font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                    +{result.notesAdded}
                  </span>
                  <span className="text-[10px] text-stone-400">New added</span>
                </div>
                <div className="bg-white dark:bg-stone-900/50 p-2 rounded-lg border border-stone-200/60 dark:border-stone-700/40">
                  <span className="block font-bold text-blue-600 dark:text-blue-400 font-mono text-sm">
                    {result.notesUpdated}
                  </span>
                  <span className="text-[10px] text-stone-400">Updated</span>
                </div>
                <div className="bg-white dark:bg-stone-900/50 p-2 rounded-lg border border-stone-200/60 dark:border-stone-700/40">
                  <span className="block font-bold text-stone-500 font-mono text-sm">
                    {result.notesSkipped}
                  </span>
                  <span className="text-[10px] text-stone-400">Unchanged</span>
                </div>
              </div>
            </div>

            {/* Other entities */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                  <Folder className="w-3.5 h-3.5 text-purple-500" />
                  <span>Categories</span>
                </span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  +{result.categoriesAdded}
                </span>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span>Labels</span>
                </span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  +{result.labelsAdded}
                </span>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                  <Timer className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Read Sessions</span>
                </span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  +{result.sessionsAdded}
                </span>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                  <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
                  <span>Media Extracted</span>
                </span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {result.mediaExtracted}
                </span>
              </div>
            </div>
          </div>
        )}

        {!result.success && (
          <p className="text-xs text-stone-600 dark:text-stone-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/40">
            {result.message}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold text-xs hover:opacity-90 transition-opacity shadow-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
