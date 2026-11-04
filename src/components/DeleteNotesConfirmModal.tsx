'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw } from 'lucide-react';

interface DeleteNotesConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'category' | 'label';
  targetName: string;
  noteCount?: number;
  onConfirm: (permanent: boolean) => Promise<void>;
}

export const DeleteNotesConfirmModal: React.FC<DeleteNotesConfirmModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetName,
  noteCount,
  onConfirm,
}) => {
  const [deleteMode, setDeleteMode] = useState<'trash' | 'permanent'>('trash');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(deleteMode === 'permanent');
      onClose();
    } catch (err) {
      console.error('Delete notes error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#28292c] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-700 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 leading-tight">
                Delete all notes in {targetType === 'category' ? 'category' : 'label'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate max-w-[260px]">
                Target: <span className="font-semibold text-stone-700 dark:text-stone-200">&quot;{targetName}&quot;</span>
                {noteCount !== undefined && ` (${noteCount} ${noteCount === 1 ? 'note' : 'notes'})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Options */}
        <div className="p-4 sm:p-5 space-y-3.5">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            How would you like to delete the notes associated with{' '}
            <strong className="text-stone-900 dark:text-stone-100">&quot;{targetName}&quot;</strong>?
          </p>

          <div className="space-y-2.5">
            {/* Option 1: Move to Trash */}
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                deleteMode === 'trash'
                  ? 'border-amber-500/80 bg-amber-500/5 dark:bg-amber-500/10'
                  : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/40'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                value="trash"
                checked={deleteMode === 'trash'}
                onChange={() => setDeleteMode('trash')}
                className="mt-0.5 accent-amber-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-stone-800 dark:text-stone-200 block">
                  Move to Trash (Recommended)
                </span>
                <span className="text-stone-500 dark:text-stone-400">
                  Notes are kept in Trash so you can restore them anytime if deleted by mistake.
                </span>
              </div>
            </label>

            {/* Option 2: Delete Permanently */}
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                deleteMode === 'permanent'
                  ? 'border-red-500/80 bg-red-500/5 dark:bg-red-500/10'
                  : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/40'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                value="permanent"
                checked={deleteMode === 'permanent'}
                onChange={() => setDeleteMode('permanent')}
                className="mt-0.5 accent-red-600 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Delete Permanently
                </span>
                <span className="text-stone-500 dark:text-stone-400">
                  Completely and irreversibly erases all notes from local database. Cannot be undone.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3 sm:p-4 bg-stone-50 dark:bg-[#202124] border-t border-stone-200 dark:border-stone-700 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs flex items-center gap-1.5 transition-all ${
              deleteMode === 'permanent'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
            }`}
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteMode === 'permanent' ? 'Permanently Delete All' : 'Move All to Trash'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
