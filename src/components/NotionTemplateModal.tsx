'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  Tag,
  Search,
  Check,
  X,
  FileText,
  CheckSquare,
  ChevronRight,
  Layers,
  ArrowRight,
  Plus,
  CalendarDays,
  FolderKanban,
  FileCode,
  ListTodo,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { Note, NoteColor } from '@/types/note';
import { NOTE_COLORS } from '@/lib/constants';
import {
  getDaysRange,
  generateDailyStarterContent,
  generateKeywordHubContent,
  generateTopicSubpageContent,
  filterNotesByKeyword,
  filterNotesByDays,
} from '@/lib/notionTemplates';

type TemplateTab = 'date' | 'keyword' | 'presets';

export const NotionTemplateModal: React.FC = () => {
  const {
    notes,
    categories,
    labels,
    isNotionTemplateModalOpen,
    setIsNotionTemplateModalOpen,
    addNote,
    updateNote,
    setEditingNote,
  } = useKeep();

  // Active tab
  const [activeTab, setActiveTab] = useState<TemplateTab>('date');

  // --- Date Range State ---
  const [daysCount, setDaysCount] = useState<number>(1); // 1 = Today
  const [dateField, setDateField] = useState<'created' | 'updated'>('created');
  const [generateDailySubpages, setGenerateDailySubpages] = useState<boolean>(true);
  const [attachExistingDateNotes, setAttachExistingDateNotes] = useState<boolean>(true);
  const [customDaysInput, setCustomDaysInput] = useState<string>('7');
  const [selectedDateNoteIds, setSelectedDateNoteIds] = useState<string[]>([]);
  const [dateCustomTitle, setDateCustomTitle] = useState<string>('');

  // --- Keyword State ---
  const [keyword, setKeyword] = useState<string>('');
  const [keywordCustomTitle, setKeywordCustomTitle] = useState<string>('');
  const [selectedKeywordNoteIds, setSelectedKeywordNoteIds] = useState<string[]>([]);
  const [includeTopicRoadmap, setIncludeTopicRoadmap] = useState<boolean>(true);
  const [includeTopicMeetings, setIncludeTopicMeetings] = useState<boolean>(true);
  const [includeTopicTasks, setIncludeTopicTasks] = useState<boolean>(true);

  // Common Customization
  const [selectedColor, setSelectedColor] = useState<NoteColor>('default');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed days list
  const daysList = useMemo(() => getDaysRange(daysCount), [daysCount]);

  // Existing notes matching date range
  const matchingDateNotes = useMemo(() => {
    return filterNotesByDays(notes, daysCount, dateField);
  }, [notes, daysCount, dateField]);

  // Existing notes matching keyword
  const matchingKeywordNotes = useMemo(() => {
    return filterNotesByKeyword(notes, keyword);
  }, [notes, keyword]);

  // Popular keyword suggestion pills (from categories, labels, and top note keywords)
  const suggestionKeywords = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add(c.name));
    labels.forEach((l) => set.add(l.name));

    // Also pick prominent words from recent notes
    notes.slice(0, 20).forEach((n) => {
      if (n.title) {
        const words = n.title.split(/\s+/).filter((w) => w.length >= 4);
        words.slice(0, 2).forEach((w) => set.add(w.replace(/[^a-zA-Z0-9_-]/g, '')));
      }
    });

    ['Project', 'Meeting', 'Design', 'Weekly Plan', 'Documentation'].forEach((w) => set.add(w));
    return Array.from(set).filter(Boolean).slice(0, 10);
  }, [categories, labels, notes]);

  // Initialize selected notes when matching list changes
  React.useEffect(() => {
    setSelectedDateNoteIds(matchingDateNotes.map((n) => n.id));
  }, [matchingDateNotes]);

  React.useEffect(() => {
    setSelectedKeywordNoteIds(matchingKeywordNotes.map((n) => n.id));
  }, [matchingKeywordNotes]);

  if (!isNotionTemplateModalOpen) return null;

  // Compute effective titles
  const effectiveDateTitle =
    dateCustomTitle.trim() ||
    (daysCount === 1
      ? `📅 Today's Notes — ${daysList[0]?.dayLabel || 'Daily Hub'}`
      : `📅 ${daysCount}-Day Hub — ${daysList[daysList.length - 1]?.shortLabel || ''} to ${daysList[0]?.shortLabel || ''}`);

  const effectiveKeywordTitle =
    keywordCustomTitle.trim() || (keyword.trim() ? `📁 ${keyword.trim()} Hub` : '📁 Project Knowledge Hub');

  // Total subpages to create/link preview
  const dateSubpagesCount =
    (generateDailySubpages ? daysList.length : 0) +
    (attachExistingDateNotes ? selectedDateNoteIds.length : 0);

  const keywordSubpagesCount =
    (includeTopicRoadmap ? 1 : 0) +
    (includeTopicMeetings ? 1 : 0) +
    (includeTopicTasks ? 1 : 0) +
    selectedKeywordNoteIds.length;

  const handleToggleDateNote = (id: string) => {
    setSelectedDateNoteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleKeywordNote = (id: string) => {
    setSelectedKeywordNoteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Submission handler
  const handleCreateHub = async () => {
    setIsSubmitting(true);
    try {
      if (activeTab === 'date') {
        // 1. Create Parent Note
        const parentContent =
          daysCount === 1
            ? `## 📅 Today's Notes Hub\n\n- **Date**: ${daysList[0]?.dayLabel || 'Today'}\n- **Sub-pages**: ${dateSubpagesCount}\n\nUse the sub-pages below to navigate today's focus, logs, and linked notes.`
            : `## 📅 ${daysCount}-Day Notes Hub\n\n- **Timeframe**: ${daysList[daysList.length - 1]?.dayLabel} — ${daysList[0]?.dayLabel}\n- **Sub-pages & Logs**: ${dateSubpagesCount}\n\nAll notes and daily logs for this period are organized in the sub-pages below.`;

        const parent = await addNote({
          title: effectiveDateTitle,
          content: parentContent,
          color: selectedColor,
          category: selectedCategory,
          noteType: 'notion',
          childNoteIds: [],
        });

        if (!parent) return;

        const allChildIds: string[] = [];

        // 2. Generate daily subpages if checked
        if (generateDailySubpages) {
          for (const day of daysList) {
            const sub = await addNote({
              title: day.dayLabel,
              content: generateDailyStarterContent(day.dayLabel),
              parentNoteId: parent.id,
              noteType: 'notion',
              category: selectedCategory,
            });
            if (sub) {
              allChildIds.push(sub.id);
            }
          }
        }

        // 3. Attach existing notes
        if (attachExistingDateNotes) {
          for (const existingId of selectedDateNoteIds) {
            allChildIds.push(existingId);
            await updateNote(existingId, { parentNoteId: parent.id });
          }
        }

        // 4. Update parent note childNoteIds
        await updateNote(parent.id, { childNoteIds: allChildIds });

        setIsNotionTemplateModalOpen(false);
        setEditingNote({ ...parent, childNoteIds: allChildIds });
      } else if (activeTab === 'keyword') {
        const kw = keyword.trim() || 'General';
        const parentContent = generateKeywordHubContent(kw, keywordSubpagesCount);

        const parent = await addNote({
          title: effectiveKeywordTitle,
          content: parentContent,
          color: selectedColor,
          category: selectedCategory,
          noteType: 'notion',
          childNoteIds: [],
        });

        if (!parent) return;

        const allChildIds: string[] = [];

        // 2. Add topic subpages if enabled
        if (includeTopicRoadmap) {
          const sub = await addNote({
            title: 'Overview & Roadmap',
            content: generateTopicSubpageContent('Overview & Roadmap'),
            parentNoteId: parent.id,
            noteType: 'notion',
            category: selectedCategory,
          });
          if (sub) allChildIds.push(sub.id);
        }

        if (includeTopicMeetings) {
          const sub = await addNote({
            title: 'Meeting Notes & Decisions',
            content: generateTopicSubpageContent('Meeting Notes & Decisions'),
            parentNoteId: parent.id,
            noteType: 'notion',
            category: selectedCategory,
          });
          if (sub) allChildIds.push(sub.id);
        }

        if (includeTopicTasks) {
          const sub = await addNote({
            title: 'Tasks & Action Items',
            content: generateTopicSubpageContent('Tasks & Action Items'),
            parentNoteId: parent.id,
            noteType: 'notion',
            category: selectedCategory,
          });
          if (sub) allChildIds.push(sub.id);
        }

        // 3. Attach matching existing notes
        for (const existingId of selectedKeywordNoteIds) {
          if (!allChildIds.includes(existingId)) {
            allChildIds.push(existingId);
            await updateNote(existingId, { parentNoteId: parent.id });
          }
        }

        // 4. Update parent note
        await updateNote(parent.id, { childNoteIds: allChildIds });

        setIsNotionTemplateModalOpen(false);
        setEditingNote({ ...parent, childNoteIds: allChildIds });
      }
    } catch (err) {
      console.error('Failed to create Notion template note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => setIsNotionTemplateModalOpen(false)}
      className="keep-backdrop-anim fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-[#202124] rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-700 flex flex-col overflow-hidden max-h-[92vh] h-[780px] transition-all"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-stone-50/50 dark:bg-stone-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Create Notion-Style Hub Note
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Generate a parent note with structured sub-pages by Date or Keyword
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsNotionTemplateModalOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-black/[0.05] dark:border-white/[0.05] bg-stone-50/20 dark:bg-stone-900/20 shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('date')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'date'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Today / Days Hub</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('keyword')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'keyword'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Per Keyword Hub</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5">
          {/* ================= DATE TAB ================= */}
          {activeTab === 'date' && (
            <div className="space-y-4">
              {/* Range Presets */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
                  Select Timeframe
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDaysCount(1)}
                    className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                      daysCount === 1
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-900 dark:text-amber-100 shadow-xs'
                        : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">Today's Notes</span>
                    <span className="text-[11px] text-stone-400 mt-0.5">1 Day (Today)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDaysCount(3)}
                    className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                      daysCount === 3
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-900 dark:text-amber-100 shadow-xs'
                        : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">3 Days</span>
                    <span className="text-[11px] text-stone-400 mt-0.5">Past 3 days</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDaysCount(7)}
                    className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                      daysCount === 7
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-900 dark:text-amber-100 shadow-xs'
                        : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">7 Days (Week)</span>
                    <span className="text-[11px] text-stone-400 mt-0.5">Full week hub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDaysCount(14)}
                    className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                      daysCount === 14
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-900 dark:text-amber-100 shadow-xs'
                        : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">14 Days (Bi-week)</span>
                    <span className="text-[11px] text-stone-400 mt-0.5">Sprint / 2 weeks</span>
                  </button>
                </div>

                {/* Custom days counter */}
                <div className="flex items-center gap-3 mt-2.5 pt-2">
                  <span className="text-xs text-stone-500 dark:text-stone-400">Or specify custom days:</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 5, 7, 10, 14, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDaysCount(num)}
                        className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
                          daysCount === num
                            ? 'bg-amber-500 text-stone-950 font-semibold'
                            : 'bg-black/[0.04] dark:bg-white/[0.06] text-stone-600 dark:text-stone-300 hover:bg-black/[0.08]'
                        }`}
                      >
                        {num}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sub-page Options */}
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.07] space-y-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Sub-pages To Include
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={generateDailySubpages}
                    onChange={(e) => setGenerateDailySubpages(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                      Generate day-by-day sub-pages ({daysList.length} pages)
                    </span>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Creates Notion sub-pages for {daysCount === 1 ? 'Today' : `each of the ${daysCount} days`} with
                      starter checklists, daily priorities, and notes log.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={attachExistingDateNotes}
                    onChange={(e) => setAttachExistingDateNotes(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                      Attach existing workspace notes ({matchingDateNotes.length} found)
                    </span>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Automatically link notes {dateField} in this timeframe as sub-pages.
                    </p>
                  </div>
                </label>

                {/* Date criteria radio */}
                <div className="flex items-center gap-4 pt-1 pl-6 text-xs text-stone-500">
                  <span>Match notes by:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dateField"
                      checked={dateField === 'created'}
                      onChange={() => setDateField('created')}
                      className="text-amber-500"
                    />
                    <span>Created date</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dateField"
                      checked={dateField === 'updated'}
                      onChange={() => setDateField('updated')}
                      className="text-amber-500"
                    />
                    <span>Updated date</span>
                  </label>
                </div>
              </div>

              {/* List of matching existing notes (if attach checked and > 0) */}
              {attachExistingDateNotes && matchingDateNotes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-stone-500 px-1">
                    <span>
                      Matching notes ({selectedDateNoteIds.length} of {matchingDateNotes.length} selected):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDateNoteIds.length === matchingDateNotes.length) {
                          setSelectedDateNoteIds([]);
                        } else {
                          setSelectedDateNoteIds(matchingDateNotes.map((n) => n.id));
                        }
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      {selectedDateNoteIds.length === matchingDateNotes.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-black/[0.06] dark:border-white/[0.07] p-1.5">
                    {matchingDateNotes.map((n) => {
                      const isSelected = selectedDateNoteIds.includes(n.id);
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleToggleDateNote(n.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                            isSelected
                              ? 'bg-amber-500/10 text-amber-900 dark:text-amber-100'
                              : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleDateNote(n.id)}
                              className="rounded text-amber-500"
                            />
                            <span className="truncate font-medium">{n.title || 'Untitled note'}</span>
                            {n.category && (
                              <span className="text-[10px] px-1.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 shrink-0">
                                {n.category}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-400 shrink-0 ml-2">
                            {new Date(dateField === 'created' ? n.createdAt : n.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Title Customization */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Parent Note Title
                </label>
                <input
                  type="text"
                  placeholder={effectiveDateTitle}
                  value={dateCustomTitle}
                  onChange={(e) => setDateCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* ================= KEYWORD TAB ================= */}
          {activeTab === 'keyword' && (
            <div className="space-y-4">
              {/* Keyword Input & suggestions */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Keyword / Topic
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter keyword (e.g. Project, Design, Meeting, Client, Bug)..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Keyword quick suggestion chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-xs text-stone-400">Suggestions:</span>
                  {suggestionKeywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setKeyword(kw)}
                      className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
                        keyword.toLowerCase() === kw.toLowerCase()
                          ? 'bg-amber-500 text-stone-950 font-semibold'
                          : 'bg-black/[0.04] dark:bg-white/[0.06] text-stone-600 dark:text-stone-300 hover:bg-black/[0.08]'
                      }`}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Starter Topic Sub-pages Checkboxes */}
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.07] space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Starter Topic Sub-pages
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.02] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTopicRoadmap}
                      onChange={(e) => setIncludeTopicRoadmap(e.target.checked)}
                      className="rounded text-amber-500"
                    />
                    <span className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate">
                      Overview & Roadmap
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.02] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTopicMeetings}
                      onChange={(e) => setIncludeTopicMeetings(e.target.checked)}
                      className="rounded text-amber-500"
                    />
                    <span className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate">
                      Meeting Decisions
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.02] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTopicTasks}
                      onChange={(e) => setIncludeTopicTasks(e.target.checked)}
                      className="rounded text-amber-500"
                    />
                    <span className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate">
                      Tasks & Action Items
                    </span>
                  </label>
                </div>
              </div>

              {/* Matching existing notes for this keyword */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500 px-1">
                  <span>
                    Existing notes matching &ldquo;{keyword || '...'}&rdquo; ({matchingKeywordNotes.length} found):
                  </span>
                  {matchingKeywordNotes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedKeywordNoteIds.length === matchingKeywordNotes.length) {
                          setSelectedKeywordNoteIds([]);
                        } else {
                          setSelectedKeywordNoteIds(matchingKeywordNotes.map((n) => n.id));
                        }
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      {selectedKeywordNoteIds.length === matchingKeywordNotes.length ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>

                {matchingKeywordNotes.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-black/[0.06] dark:border-white/[0.07] p-1.5">
                    {matchingKeywordNotes.map((n) => {
                      const isSelected = selectedKeywordNoteIds.includes(n.id);
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleToggleKeywordNote(n.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                            isSelected
                              ? 'bg-amber-500/10 text-amber-900 dark:text-amber-100'
                              : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleKeywordNote(n.id)}
                              className="rounded text-amber-500"
                            />
                            <span className="truncate font-medium">{n.title || 'Untitled note'}</span>
                            {n.category && (
                              <span className="text-[10px] px-1.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 shrink-0">
                                {n.category}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-400 line-clamp-1 max-w-[120px] truncate ml-2">
                            {n.content?.replace(/<[^>]+>/g, '').slice(0, 30) || 'No text'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-stone-400 rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08]">
                    {keyword.trim()
                      ? 'No existing notes match this keyword yet. Sub-pages will be created from starter templates.'
                      : 'Type a keyword above to search matching notes.'}
                  </div>
                )}
              </div>

              {/* Title Customization */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Parent Note Title
                </label>
                <input
                  type="text"
                  placeholder={effectiveKeywordTitle}
                  value={keywordCustomTitle}
                  onChange={(e) => setKeywordCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-stone-800 dark:text-stone-200 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-stone-50/50 dark:bg-stone-900/40 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
            <span>Will create Notion hub with </span>
            <strong className="text-stone-800 dark:text-stone-200">
              {activeTab === 'date' ? dateSubpagesCount : keywordSubpagesCount} sub-page
              {(activeTab === 'date' ? dateSubpagesCount : keywordSubpagesCount) === 1 ? '' : 's'}
            </strong>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsNotionTemplateModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-stone-600 dark:text-stone-300 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateHub}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-xs transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create Notion Note'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
