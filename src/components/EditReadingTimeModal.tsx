'use client';

import React, { useState, useEffect } from 'react';
import { Clock, X, Trash2, Check, RotateCcw } from 'lucide-react';

interface EditReadingTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialSeconds: number;
  onSave: (newSeconds: number) => Promise<void>;
  onDeleteStats?: () => Promise<void>;
  isSession?: boolean;
}

export const EditReadingTimeModal: React.FC<EditReadingTimeModalProps> = ({
  isOpen,
  onClose,
  title,
  initialSeconds,
  onSave,
  onDeleteStats,
  isSession = false,
}) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const h = Math.floor(initialSeconds / 3600);
      const m = Math.floor((initialSeconds % 3600) / 60);
      const s = initialSeconds % 60;
      setHours(h);
      setMinutes(m);
      setSeconds(s);
      setConfirmDeleteOpen(false);
    }
  }, [isOpen, initialSeconds]);

  if (!isOpen) return null;

  const totalCalculatedSeconds = Math.max(0, hours * 3600 + minutes * 60 + seconds);

  const handleQuickAddMinutes = (mins: number) => {
    const newTotal = totalCalculatedSeconds + mins * 60;
    setHours(Math.floor(newTotal / 3600));
    setMinutes(Math.floor((newTotal % 3600) / 60));
    setSeconds(newTotal % 60);
  };

  const handleResetToZero = () => {
    setHours(0);
    setMinutes(0);
    setSeconds(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(totalCalculatedSeconds);
    onClose();
  };

  const handleDelete = async () => {
    if (!onDeleteStats) return;
    setIsDeleting(true);
    try {
      await onDeleteStats();
      onClose();
    } finally {
      setIsDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                {isSession ? 'Edit Session Duration' : 'Edit Note Reading Time'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[260px]">
                {title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {confirmDeleteOpen ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 font-bold text-sm">
              <Trash2 className="w-5 h-5" />
              <span>Delete Time Stats for this Note?</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              This will permanently reset the reading time for <strong>&quot;{title}&quot;</strong> to 0 and delete all its recorded reading sessions.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                {isDeleting ? 'Deleting…' : 'Yes, Delete Stats'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Hours, Minutes, Seconds Input Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">
                  Hours
                </label>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-center text-lg font-mono font-bold bg-stone-100 dark:bg-stone-800 rounded-xl border border-transparent focus:border-emerald-500 outline-none text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">
                  Minutes
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 text-center text-lg font-mono font-bold bg-stone-100 dark:bg-stone-800 rounded-xl border border-transparent focus:border-emerald-500 outline-none text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">
                  Seconds
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 text-center text-lg font-mono font-bold bg-stone-100 dark:bg-stone-800 rounded-xl border border-transparent focus:border-emerald-500 outline-none text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            {/* Quick Adjustment Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-stone-400 mr-1">Quick Add:</span>
              <button
                type="button"
                onClick={() => handleQuickAddMinutes(5)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddMinutes(15)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddMinutes(30)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
              >
                +30m
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddMinutes(60)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
              >
                +1h
              </button>
              <button
                type="button"
                onClick={handleResetToZero}
                className="ml-auto px-2 py-1 text-xs font-medium rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-1 transition-colors"
                title="Reset time to 0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset 0</span>
              </button>
            </div>

            {/* Total Duration Preview Banner */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center justify-between">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                New Total Reading Time:
              </span>
              <span className="font-mono font-bold text-sm sm:text-base text-emerald-700 dark:text-emerald-300">
                {hours > 0 ? `${hours}h ` : ''}
                {minutes}m {seconds}s
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
              {onDeleteStats ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Stats</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
