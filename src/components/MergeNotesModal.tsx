'use client';

import React, { useState, useMemo } from 'react';
import {
  GitMerge,
  X,
  ArrowUp,
  ArrowDown,
  Trash2,
  Archive,
  CheckCircle2,
  Tag,
  Calendar,
  Layers,
  Sparkles,
  FileText,
  Eye,
  Sliders,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { Note } from '@/types/note';
import { NOTE_COLORS } from '@/lib/constants';
import { compileMergedNotePayload } from '@/lib/mergeNotes';

export const MergeNotesModal: React.FC = () => {
  const {
    notes,
    selectedNoteIds,
    clearSelection,
    addNote,
    updateNote,
    setEditingNote,
    isMergeNotesModalOpen,
    setIsMergeNotesModalOpen,
  } = useKeep();

  // Get selected notes in initial order
  const initialSelectedNotes = useMemo(() => {
    const idSet = new Set(selectedNoteIds);
    return notes.filter((n) => idSet.has(n.id));
  }, [notes, selectedNoteIds]);

  // Local state for ordered notes
  const [orderedNotes, setOrderedNotes] = useState<Note[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [includeTitles, setIncludeTitles] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeDates, setIncludeDates] = useState(true);
  const [includeDividers, setIncludeDividers] = useState(true);
  const [addMergedLabel, setAddMergedLabel] = useState(true);
  const [postMergeAction, setPostMergeAction] = useState<'keep' | 'archive' | 'trash'>('keep');
  const [activeTab, setActiveTab] = useState<'configure' | 'preview'>('configure');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync ordered notes when modal opens or selection changes
  React.useEffect(() => {
    if (isMergeNotesModalOpen) {
      setOrderedNotes(initialSelectedNotes);
      setCustomTitle('');
      setActiveTab('configure');
    }
  }, [isMergeNotesModalOpen, initialSelectedNotes]);

  if (!isMergeNotesModalOpen || orderedNotes.length === 0) return null;

  // Move a note up in the merge order
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setOrderedNotes((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Move a note down in the merge order
  const handleMoveDown = (index: number) => {
    if (index >= orderedNotes.length - 1) return;
    setOrderedNotes((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Remove a note from the merge list
  const handleRemoveFromMerge = (noteId: string) => {
    setOrderedNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  // Compute merged payload preview
  const mergedPayload = compileMergedNotePayload(orderedNotes, {
    customTitle: customTitle.trim() || undefined,
    includeTitles,
    includeLabels,
    includeDates,
    includeDividers,
    addMergedLabel,
  });

  const handleExecuteMerge = async () => {
    if (orderedNotes.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Create the new merged note
      const newNote = await addNote({
        id: `note-merged-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: mergedPayload.title,
        content: mergedPayload.content,
        isList: false,
        todos: [],
        color: mergedPayload.color,
        theme: 'none',
        category: mergedPayload.category,
        labels: mergedPayload.labels,
        isPinned: false,
        images: mergedPayload.images,
        drawings: mergedPayload.drawings,
        linkedNoteIds: mergedPayload.linkedNoteIds,
      });

      // 2. Handle post-merge action on original notes
      if (postMergeAction === 'archive') {
        for (const note of orderedNotes) {
          await updateNote(note.id, { isArchived: true, isPinned: false });
        }
      } else if (postMergeAction === 'trash') {
        for (const note of orderedNotes) {
          await updateNote(note.id, { isTrash: true, isPinned: false, trashedAt: Date.now() });
        }
      }

      // 3. Clean up selection and modal state
      clearSelection();
      setIsMergeNotesModalOpen(false);

      // 4. Open the newly merged note in the editor so user can immediately view/refine it
      if (newNote) {
        setEditingNote(newNote);
      }
    } catch (err) {
      console.error('Failed to merge notes:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 bg-stone-50 dark:bg-stone-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Merge Notes
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                  {orderedNotes.length} notes selected
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Combine multiple notes into a single cohesive note with headers, labels, and content
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMergeNotesModalOpen(false)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher: Configure vs Preview */}
        <div className="flex items-center px-5 pt-2.5 border-b border-black/10 dark:border-white/10 bg-stone-50/70 dark:bg-stone-850/70 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('configure')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'configure'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Configure &amp; Order
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview Merged Note
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'configure' ? (
            <>
              {/* Merged Note Title Input */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  New Merged Note Title
                </label>
                <input
                  type="text"
                  placeholder={mergedPayload.title}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Order of Notes to Merge */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-500" />
                    Notes Order (drag or use arrows to change sequence)
                  </label>
                  <span className="text-2xs text-stone-400">
                    Content will be appended in this order
                  </span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {orderedNotes.map((note, index) => {
                    const colorSwatch = NOTE_COLORS.find((c) => c.id === note.color)?.swatch || '#ffffff';
                    return (
                      <div
                        key={note.id}
                        className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 flex items-center justify-between gap-2.5 group transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-2xs font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div
                            className="w-3 h-3 rounded-full border border-stone-300 dark:border-stone-600 shrink-0"
                            style={{ backgroundColor: colorSwatch }}
                          />
                          <div className="min-w-0 flex-1 truncate">
                            <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                              {note.title || 'Untitled Note'}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              {note.labels && note.labels.length > 0 && (
                                <span className="text-2xs text-stone-500 dark:text-stone-400 truncate">
                                  {note.labels.map((l) => `#${l}`).join(' ')}
                                </span>
                              )}
                              {note.category && (
                                <span className="text-2xs text-blue-600 dark:text-blue-400 font-medium">
                                  📁 {typeof note.category === 'string' ? note.category : (note.category as any)?.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls: Up, Down, Remove */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === orderedNotes.length - 1}
                            className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          {orderedNotes.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFromMerge(note.id)}
                              className="p-1 rounded-md text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                              title="Exclude from merge"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Combined Labels Preview */}
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 space-y-2">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  Combined Labels ({mergedPayload.labels.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {mergedPayload.labels.map((l) => (
                    <span
                      key={l}
                      className="px-2.5 py-1 rounded-lg text-2xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                    >
                      #{l}
                    </span>
                  ))}
                </div>
                <label className="flex items-center gap-2 pt-1 text-xs text-stone-600 dark:text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addMergedLabel}
                    onChange={(e) => setAddMergedLabel(e.target.checked)}
                    className="w-3.5 h-3.5 rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Add <strong>#merged</strong> label to the new note</span>
                </label>
              </div>

              {/* Section Formatting Options */}
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 space-y-2 text-xs">
                <span className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-500" />
                  Section Options
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={includeTitles}
                      onChange={(e) => setIncludeTitles(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Include titles as headings (## Title)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={includeLabels}
                      onChange={(e) => setIncludeLabels(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Include labels in note sections</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={includeDates}
                      onChange={(e) => setIncludeDates(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Include note timestamps</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={includeDividers}
                      onChange={(e) => setIncludeDividers(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Add horizontal divider (---) between notes</span>
                  </label>
                </div>
              </div>

              {/* Original Notes Handling */}
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 space-y-2 text-xs">
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  After merging, what to do with original notes?
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { id: 'keep' as const, label: 'Keep originals', desc: 'Preserves all original notes' },
                    { id: 'archive' as const, label: 'Archive originals', desc: 'Moves originals to Archive' },
                    { id: 'trash' as const, label: 'Trash originals', desc: 'Moves originals to Trash' },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 cursor-pointer transition-all ${
                        postMergeAction === opt.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="postMergeAction"
                        checked={postMergeAction === opt.id}
                        onChange={() => setPostMergeAction(opt.id)}
                        className="w-3.5 h-3.5 text-blue-600"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Live Preview Tab */
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-850/40 space-y-3">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  {mergedPayload.title}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {mergedPayload.labels.map((l) => (
                    <span
                      key={l}
                      className="px-2 py-0.5 rounded-md text-2xs font-semibold bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300"
                    >
                      #{l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rendered HTML Preview */}
              <div
                className="max-h-80 overflow-y-auto p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: mergedPayload.content }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-black/10 dark:border-white/10 bg-stone-50 dark:bg-stone-850">
          <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>
              Merging <strong>{orderedNotes.length}</strong> notes into 1 new note
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMergeNotesModalOpen(false)}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-750 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={isSubmitting || orderedNotes.length < 2}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GitMerge className="w-4 h-4" />
              {isSubmitting ? 'Merging Notes...' : `Merge into New Note`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
