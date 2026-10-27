'use client';

import React, { useState, useMemo } from 'react';
import {
  CalendarRange,
  X,
  CalendarPlus,
  Clock,
  CheckCircle2,
  ListTodo,
  FileText,
  FileCode,
  Search,
  Check,
  Filter,
  Sparkles,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { Note, NoteColor } from '@/types/note';
import { NOTE_COLORS } from '@/lib/constants';
import {
  DateFilterField,
  DateRangePreset,
  DATE_RANGE_OPTIONS,
  filterNotesByDateRange,
  compileNotesToPayload,
} from '@/lib/dateCompile';

export const CreateNoteByDateModal: React.FC = () => {
  const {
    notes,
    isDateCompileModalOpen,
    setIsDateCompileModalOpen,
    setIsNotionTemplateModalOpen,
    addNote,
    setEditingNote,
    setSearchQuery,
  } = useKeep();

  const [dateField, setDateField] = useState<DateFilterField>('created');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last_7_days');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [compileStyle, setCompileStyle] = useState<'full' | 'summary' | 'todos'>('full');
  const [noteColor, setNoteColor] = useState<NoteColor>('default');
  const [includeMeta, setIncludeMeta] = useState(true);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [hasManuallySelected, setHasManuallySelected] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute all matching notes for the selected preset and field
  const matchingNotes: Note[] = useMemo(() => {
    return filterNotesByDateRange(notes, dateField, datePreset, includeArchived);
  }, [notes, dateField, datePreset, includeArchived]);

  // Compute count badges for each range in real-time
  const rangeCounts = useMemo(() => {
    const counts: Record<DateRangePreset, number> = {} as Record<DateRangePreset, number>;
    DATE_RANGE_OPTIONS.forEach((opt) => {
      counts[opt.id] = filterNotesByDateRange(notes, dateField, opt.id, includeArchived).length;
    });
    return counts;
  }, [notes, dateField, includeArchived]);

  // Sync selected notes whenever matching notes change (unless user manually modified selection)
  const activeSelectedIds = useMemo(() => {
    if (!hasManuallySelected) {
      return matchingNotes.map((n) => n.id);
    }
    // Filter out IDs that no longer match
    const matchingIdSet = new Set(matchingNotes.map((n) => n.id));
    return selectedNoteIds.filter((id) => matchingIdSet.has(id));
  }, [matchingNotes, hasManuallySelected, selectedNoteIds]);

  // Filtered matching notes based on inline search
  const visibleMatchingNotes = useMemo(() => {
    if (!filterSearch.trim()) return matchingNotes;
    const q = filterSearch.toLowerCase().trim();
    return matchingNotes.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (n.category && n.category.toLowerCase().includes(q)) ||
        (n.labels && n.labels.some((l) => l.toLowerCase().includes(q)))
    );
  }, [matchingNotes, filterSearch]);

  if (!isDateCompileModalOpen) return null;

  const currentPresetObj = DATE_RANGE_OPTIONS.find((p) => p.id === datePreset);
  const effectiveTitle =
    customTitle.trim() ||
    `${currentPresetObj?.label || 'Notes'} (${dateField === 'created' ? 'Created' : 'Updated'})`;

  const handleToggleNoteSelection = (noteId: string) => {
    setHasManuallySelected(true);
    setSelectedNoteIds((prev) => {
      const base = hasManuallySelected ? prev : matchingNotes.map((n) => n.id);
      return base.includes(noteId) ? base.filter((id) => id !== noteId) : [...base, noteId];
    });
  };

  const handleSelectAll = () => {
    setHasManuallySelected(true);
    setSelectedNoteIds(matchingNotes.map((n) => n.id));
  };

  const handleDeselectAll = () => {
    setHasManuallySelected(true);
    setSelectedNoteIds([]);
  };

  const handleCreateNote = async () => {
    const finalNotesToCompile = matchingNotes.filter((n) => activeSelectedIds.includes(n.id));
    if (finalNotesToCompile.length === 0) return;

    setIsSubmitting(true);
    try {
      const payload = compileNotesToPayload(finalNotesToCompile, dateField, datePreset, {
        customTitle: effectiveTitle,
        style: compileStyle,
        includeMeta,
        color: noteColor,
      });

      const newNote = await addNote(payload);
      setIsDateCompileModalOpen(false);

      // Open new note immediately for the user
      if (newNote) {
        setEditingNote(newNote);
      }
    } catch (err) {
      console.error('Failed to create date compilation note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterViewInGrid = () => {
    const presetLabel = currentPresetObj?.shortLabel || '';
    setSearchQuery(presetLabel);
    setIsDateCompileModalOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-portal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          setIsDateCompileModalOpen(false);
        }
      }}
      className="keep-backdrop-anim keep-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-[#202124] rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-700 flex flex-col overflow-hidden max-h-[92vh] h-[820px] transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-stone-50/50 dark:bg-stone-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Create Note from Date Range
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Compile notes created or updated in a timeframe into a new note
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDateCompileModalOpen(false);
                setIsNotionTemplateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-colors"
              title="Switch to Notion-style Template Hub"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Notion Hub Template</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDateCompileModalOpen(false);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5">
          {/* 1. Date Field Selector: Created vs Updated */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              1. Choose Date Criterion
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDateField('created')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  dateField === 'created'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/80 shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] text-stone-700 dark:text-stone-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    dateField === 'created'
                      ? 'bg-blue-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                  }`}
                >
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">Created Date</div>
                  <div className="text-[11px] opacity-75 truncate">When notes were first created</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDateField('updated')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  dateField === 'updated'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/80 shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] text-stone-700 dark:text-stone-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    dateField === 'updated'
                      ? 'bg-blue-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">Updated Date</div>
                  <div className="text-[11px] opacity-75 truncate">When notes were last edited</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Time Range Selector: The 8 options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider">
                2. Choose Time Range
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600"
                />
                <span>Include archived notes</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DATE_RANGE_OPTIONS.map((opt) => {
                const isSelected = datePreset === opt.id;
                const count = rangeCounts[opt.id] || 0;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDatePreset(opt.id);
                      setHasManuallySelected(false);
                    }}
                    className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/80 shadow-xs'
                        : 'border-stone-200 dark:border-stone-800 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1.5 leading-snug">{opt.label}</div>
                    <div className="flex items-center justify-between mt-auto">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          count > 0
                            ? isSelected
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-stone-200 dark:bg-stone-700 font-medium'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                        }`}
                      >
                        {count} {count === 1 ? 'note' : 'notes'}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Matching Notes Preview & Selection */}
          <div className="border border-stone-200/90 dark:border-stone-800 rounded-2xl p-3 sm:p-4 bg-stone-50/40 dark:bg-stone-900/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  Matching Notes
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
                  {activeSelectedIds.length} of {matchingNotes.length} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select all
                </button>
                <span className="text-stone-300 dark:text-stone-600">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
                >
                  Deselect all
                </button>
              </div>
            </div>

            {/* Filter Search */}
            {matchingNotes.length > 4 && (
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter matching notes by title or content..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none text-stone-800 dark:text-stone-200"
                />
              </div>
            )}

            {/* Scrollable Notes List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {visibleMatchingNotes.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400">
                  {matchingNotes.length === 0
                    ? `No notes found ${dateField === 'created' ? 'created' : 'updated'} in the ${currentPresetObj?.shortLabel.toLowerCase()}.`
                    : 'No notes match your filter query.'}
                </div>
              ) : (
                visibleMatchingNotes.map((n) => {
                  const isChecked = activeSelectedIds.includes(n.id);
                  const ts = dateField === 'created' ? n.createdAt : (n.updatedAt || n.createdAt);

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleToggleNoteSelection(n.id)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                        isChecked
                          ? 'border-blue-400/80 bg-white dark:bg-stone-800/90 shadow-2xs'
                          : 'border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-stone-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 mt-0.5 rounded text-blue-600 accent-blue-600 pointer-events-none shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold truncate ${
                              isChecked
                                ? 'text-stone-900 dark:text-stone-100'
                                : 'text-stone-500 dark:text-stone-400'
                            }`}
                          >
                            {n.title || 'Untitled Note'}
                          </span>
                          {n.category && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium shrink-0">
                              {n.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {new Date(ts).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          •{' '}
                          {n.content
                            ? n.content.replace(/<[^>]+>/g, '').slice(0, 70)
                            : n.todos && n.todos.length > 0
                            ? `${n.todos.length} checklist item${n.todos.length === 1 ? '' : 's'}`
                            : 'Empty note'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Compilation Options */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              3. Output Customization
            </label>

            {/* Note Title Input */}
            <div className="mb-3">
              <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                New Note Title
              </label>
              <input
                type="text"
                value={customTitle}
                placeholder={effectiveTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none text-stone-800 dark:text-stone-200 font-medium"
              />
            </div>

            {/* Format Style Segmented Tabs */}
            <div className="mb-3">
              <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1.5">
                Compilation Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCompileStyle('full')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    compileStyle === 'full'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-semibold'
                      : 'border-stone-200 dark:border-stone-800 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <FileText className="w-4 h-4 mb-1" />
                  <span className="text-xs">Full Content</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompileStyle('summary')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    compileStyle === 'summary'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-semibold'
                      : 'border-stone-200 dark:border-stone-800 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <FileCode className="w-4 h-4 mb-1" />
                  <span className="text-xs">Index & Links</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompileStyle('todos')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    compileStyle === 'todos'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-semibold'
                      : 'border-stone-200 dark:border-stone-800 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <ListTodo className="w-4 h-4 mb-1" />
                  <span className="text-xs">Task Checklist</span>
                </button>
              </div>
            </div>

            {/* Note Color Swatches */}
            <div>
              <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1.5">
                Note Color
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {NOTE_COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => setNoteColor(c.id)}
                    className={`w-6 h-6 rounded-full border border-black/15 dark:border-white/20 transition-transform flex items-center justify-center ${
                      noteColor === c.id ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.swatch }}
                  >
                    {noteColor === c.id && <Check className="w-3.5 h-3.5 text-stone-800 dark:text-stone-200" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-stone-50/50 dark:bg-stone-900/40 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleFilterViewInGrid}
              disabled={matchingNotes.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              title="Search and filter notes matching this range in the grid"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Browse in Grid</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDateCompileModalOpen(false);
              }}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCreateNote}
              disabled={activeSelectedIds.length === 0 || isSubmitting}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Creating note…'
                  : `Create Note (${activeSelectedIds.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
