'use client';

import React, { useState } from 'react';
import { Timer, Play, Pause, Square, BarChart2, X, Check } from 'lucide-react';
import { useKeep } from '@/context/KeepContext';

function formatStopwatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDurationHms(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const ActiveStopwatchDock: React.FC = () => {
  const {
    activeStopwatch,
    pauseReadingStopwatch,
    resumeReadingStopwatch,
    stopAndSaveReadingStopwatch,
    discardReadingStopwatch,
    setEditingNote,
    notes,
    setCurrentFilter,
  } = useKeep();

  const [savedToast, setSavedToast] = useState<string | null>(null);

  if (!activeStopwatch && !savedToast) return null;

  const handleStop = async () => {
    const session = await stopAndSaveReadingStopwatch();
    if (session) {
      setSavedToast(`Saved ${formatDurationHms(session.durationSeconds)}!`);
      setTimeout(() => setSavedToast(null), 3500);
    }
  };

  const handleOpenNote = () => {
    if (!activeStopwatch) return;
    const target = notes.find((n) => n.id === activeStopwatch.noteId);
    if (target) {
      setEditingNote(target);
    }
  };

  const handleGoToStats = () => {
    setCurrentFilter('stats');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/stats');
    }
  };

  if (savedToast) {
    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1.5rem)] animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-emerald-700 text-white shadow-2xl border border-emerald-500/40 font-medium text-xs sm:text-sm">
          <Check className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>Reading session saved successfully: <strong>{savedToast}</strong></span>
          <button
            type="button"
            onClick={handleGoToStats}
            className="ml-1.5 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>View Stats</span>
          </button>
        </div>
      </div>
    );
  }

  if (!activeStopwatch) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1.5rem)] animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-2 sm:gap-3.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-stone-900/95 dark:bg-[#202124]/95 text-white shadow-2xl border border-emerald-500/40 backdrop-blur-md">
        {/* Pulsing Beacon & Icon */}
        <div className="relative flex items-center shrink-0">
          <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1.5">
            {activeStopwatch.isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 ${
                activeStopwatch.isRunning ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <Timer className="w-4 h-4 text-emerald-400 shrink-0 hidden xs:block" />
        </div>

        {/* Note Title & Live Time */}
        <div className="flex flex-col min-w-0">
          <button
            type="button"
            onClick={handleOpenNote}
            className="text-left text-xs font-semibold text-stone-200 hover:text-white truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[220px] transition-colors leading-tight"
            title={`Reading "${activeStopwatch.noteTitle}" - Click to open note`}
          >
            {activeStopwatch.noteTitle || 'Untitled Note'}
          </button>
          <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold text-xs sm:text-sm tracking-tight leading-none mt-0.5">
            <span>{formatStopwatchTime(activeStopwatch.elapsedSeconds)}</span>
            {!activeStopwatch.isRunning && (
              <span className="text-[10px] text-amber-400 uppercase font-sans font-bold tracking-wider">(Paused)</span>
            )}
          </div>
        </div>

        {/* Pause / Resume Button */}
        {activeStopwatch.isRunning ? (
          <button
            type="button"
            onClick={pauseReadingStopwatch}
            className="p-1.5 rounded-xl hover:bg-white/10 text-stone-300 hover:text-white transition-colors shrink-0"
            title="Pause stopwatch"
          >
            <Pause className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={resumeReadingStopwatch}
            className="p-1.5 rounded-xl hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors shrink-0"
            title="Resume stopwatch"
          >
            <Play className="w-4 h-4 fill-current" />
          </button>
        )}

        {/* Stop and Save Button */}
        <button
          type="button"
          onClick={handleStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0"
          title="Stop reading and save time"
        >
          <Square className="w-3 h-3 fill-current" />
          <span>Stop & Save</span>
        </button>

        {/* View Stats Button */}
        <button
          type="button"
          onClick={handleGoToStats}
          className="p-1.5 rounded-xl hover:bg-white/10 text-stone-400 hover:text-stone-200 transition-colors shrink-0 hidden sm:flex"
          title="Go to Reading Stats page"
        >
          <BarChart2 className="w-4 h-4" />
        </button>

        {/* Discard / Close Button */}
        <button
          type="button"
          onClick={discardReadingStopwatch}
          className="p-1.5 rounded-xl hover:bg-red-500/20 text-stone-400 hover:text-red-400 transition-colors shrink-0"
          title="Discard stopwatch without saving"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
