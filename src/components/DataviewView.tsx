'use client';

import React, { useState, useMemo } from 'react';
import {
  Database,
  Code,
  Rows,
  LayoutGrid,
  Table as TableIcon,
  CheckSquare,
  ArrowUpRight,
  RefreshCw,
  Search,
  Sparkles,
  FileText,
  Tag,
  Folder,
  Calendar,
  Pin,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Note } from '@/types/note';
import { useKeep } from '@/context/KeepContext';
import {
  parseDataviewQuery,
  executeDataviewQuery,
  DataviewViewType,
  DATAVIEW_TEMPLATES,
} from '@/lib/dataviewEngine';
import { resolveLocalMediaUrl } from '@/lib/formatUtils';

export interface DataviewViewProps {
  query: string;
  onUpdateQuery?: (newQuery: string) => void;
  isEditable?: boolean;
  defaultEditMode?: boolean;
  currentNoteId?: string;
  className?: string;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const ONE_MIN = 60 * 1000;
  const ONE_HOUR = 60 * ONE_MIN;
  const ONE_DAY = 24 * ONE_HOUR;

  if (diff < ONE_MIN) return 'Just now';
  if (diff < ONE_HOUR) return `${Math.floor(diff / ONE_MIN)}m ago`;
  if (diff < ONE_DAY) return `${Math.floor(diff / ONE_HOUR)}h ago`;
  if (diff < 7 * ONE_DAY) {
    const days = Math.floor(diff / ONE_DAY);
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const DataviewView: React.FC<DataviewViewProps> = ({
  query,
  onUpdateQuery,
  isEditable = true,
  defaultEditMode = false,
  currentNoteId,
  className = '',
}) => {
  const { notes, setEditingNote, updateNote } = useKeep();
  const [isEditingQuery, setIsEditingQuery] = useState(defaultEditMode);
  const [queryDraft, setQueryDraft] = useState(query);
  const [filterText, setFilterText] = useState('');
  const [manualViewType, setManualViewType] = useState<DataviewViewType | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);

  // Parse query
  const parsed = useMemo(() => {
    try {
      return parseDataviewQuery(query);
    } catch (err) {
      console.warn('Failed parsing dataview query:', err);
      return parseDataviewQuery('NOTION');
    }
  }, [query]);

  // Active view type: manual override or query-specified view
  const activeViewType: DataviewViewType = manualViewType || parsed.viewType;

  // Execute query against all notes
  const queryResult = useMemo(() => {
    const res = executeDataviewQuery(parsed, notes, currentNoteId);
    return res;
  }, [parsed, notes, currentNoteId]);

  // Filter notes by search text inside dataview
  const displayNotes = useMemo(() => {
    if (!filterText.trim()) return queryResult.notes;
    const q = filterText.toLowerCase();
    return queryResult.notes.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.category && n.category.toLowerCase().includes(q)) ||
        (n.labels && n.labels.some((l) => l.toLowerCase().includes(q))) ||
        (n.content && n.content.toLowerCase().includes(q))
    );
  }, [queryResult.notes, filterText]);

  // Filter tasks if in task view
  const displayTasks = useMemo(() => {
    if (!queryResult.tasks) return [];
    if (!filterText.trim()) return queryResult.tasks;
    const q = filterText.toLowerCase();
    return queryResult.tasks.filter(
      (t) => t.text.toLowerCase().includes(q) || t.noteTitle.toLowerCase().includes(q)
    );
  }, [queryResult.tasks, filterText]);

  const handleSaveQuery = () => {
    if (onUpdateQuery) {
      onUpdateQuery(queryDraft);
    }
    setIsEditingQuery(false);
  };

  const handleSelectTemplate = (tplQuery: string) => {
    setQueryDraft(tplQuery);
    if (onUpdateQuery) {
      onUpdateQuery(tplQuery);
    }
    setShowTemplates(false);
    setIsEditingQuery(false);
  };

  const handleToggleTask = (task: { noteId: string; id: string; completed: boolean }, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetNote = notes.find((n) => n.id === task.noteId);
    if (!targetNote || !targetNote.todos) return;

    const updatedTodos = targetNote.todos.map((t) =>
      t.id === task.id ? { ...t, completed: !task.completed } : t
    );
    updateNote(task.noteId, { todos: updatedTodos });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`my-3 rounded-2xl border border-stone-200/90 dark:border-stone-700/80 bg-white dark:bg-[#1e1f22] shadow-xs overflow-hidden select-none transition-all ${className}`}
    >
      {/* Notion-style Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-stone-50/80 dark:bg-[#25262b] border-b border-stone-200/80 dark:border-stone-700/60 text-xs">
        {/* Left: Dataview Pill + View Mode Switcher */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold text-[11px] tracking-wide border border-purple-500/20">
            <Database className="w-3 h-3 text-purple-500" />
            <span>DATAVIEW</span>
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center gap-0.5 bg-stone-200/60 dark:bg-stone-800/80 p-0.5 rounded-lg border border-black/[0.04] dark:border-white/[0.04]">
            <button
              type="button"
              onClick={() => setManualViewType('notion')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeViewType === 'notion' || activeViewType === 'list'
                  ? 'bg-white dark:bg-[#2c2d30] text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title="Notion List view"
            >
              <Rows className="w-3 h-3" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setManualViewType('gallery')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeViewType === 'gallery'
                  ? 'bg-white dark:bg-[#2c2d30] text-amber-600 dark:text-amber-400 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title="Gallery Cards view"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setManualViewType('table')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeViewType === 'table'
                  ? 'bg-white dark:bg-[#2c2d30] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title="Table view"
            >
              <TableIcon className="w-3 h-3" />
              <span>Table</span>
            </button>
            {queryResult.tasks && queryResult.tasks.length > 0 && (
              <button
                type="button"
                onClick={() => setManualViewType('task')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeViewType === 'task'
                    ? 'bg-white dark:bg-[#2c2d30] text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
                title="Tasks view"
              >
                <CheckSquare className="w-3 h-3" />
                <span>Tasks</span>
              </button>
            )}
          </div>

          {/* Matches Count */}
          <span className="text-[11px] text-stone-400 dark:text-stone-500 font-medium px-1">
            {activeViewType === 'task'
              ? `${displayTasks.length} task${displayTasks.length === 1 ? '' : 's'}`
              : `${displayNotes.length} note${displayNotes.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {/* Right: Quick Search Filter + Edit Query Toggle */}
        <div className="flex items-center gap-1.5">
          {/* Quick Filter */}
          {!isEditingQuery && (
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-stone-400 absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter results…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-24 sm:w-32 pl-6 pr-2 py-0.5 text-[11px] bg-stone-100 dark:bg-stone-800/80 rounded-md border border-stone-200/70 dark:border-stone-700/50 outline-none text-stone-700 dark:text-stone-300 placeholder:text-stone-400 focus:w-40 transition-all"
              />
            </div>
          )}

          {/* Templates Menu */}
          {isEditable && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                title="Dataview templates & examples"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span className="hidden sm:inline">Templates</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>

              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#202124] rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 z-50 py-1 divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                    Dataview Query Templates
                  </div>
                  {DATAVIEW_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.query)}
                      className="w-full text-left px-3 py-2 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 text-stone-800 dark:text-stone-200 transition-colors flex flex-col gap-0.5"
                    >
                      <span className="text-xs font-semibold">{tpl.name}</span>
                      <span className="text-[10.5px] text-stone-400">{tpl.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Toggle Code / Results */}
          {isEditable && (
            <button
              type="button"
              onClick={() => {
                if (isEditingQuery) {
                  handleSaveQuery();
                } else {
                  setQueryDraft(query);
                  setIsEditingQuery(true);
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                isEditingQuery
                  ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold shadow-2xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
              }`}
              title={isEditingQuery ? 'Save and run query' : 'Edit Dataview query rules'}
            >
              <Code className="w-3 h-3" />
              <span>{isEditingQuery ? 'Run Query' : 'Edit Query'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Query Code Editor View */}
      {isEditingQuery ? (
        <div className="p-3 bg-stone-900 text-stone-100 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[11px] text-stone-400">
            <span>Obsidian Dataview Query (TABLE, LIST, TASK, NOTION, FROM #tag, WHERE ...)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(queryDraft);
                  setCopiedQuery(true);
                  setTimeout(() => setCopiedQuery(false), 1500);
                }}
                className="hover:text-stone-200 text-stone-400"
              >
                {copiedQuery ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <textarea
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            rows={5}
            placeholder="TABLE category, labels&#10;FROM #work&#10;WHERE isPinned&#10;SORT updatedAt DESC"
            className="w-full bg-black/40 text-emerald-400 font-mono text-xs p-2.5 rounded-lg border border-white/10 outline-none resize-y focus:border-amber-400 transition-colors"
          />
          <div className="flex items-center justify-between pt-2 mt-2">
            <span className="text-[10.5px] text-stone-400">
              Tip: Supports <code className="text-amber-400">TABLE</code>, <code className="text-amber-400">LIST</code>, <code className="text-amber-400">TASK</code>, <code className="text-amber-400">GALLERY</code>, <code className="text-amber-400">FROM #tag</code>, <code className="text-amber-400">WHERE isPinned</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingQuery(false)}
                className="px-2.5 py-1 text-xs text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuery}
                className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors"
              >
                Apply Rules
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Rendered Notion Style Results */
        <div className="p-2 sm:p-3">
          {/* ================= 1. NOTION LIST VIEW ================= */}
          {(activeViewType === 'notion' || activeViewType === 'list') && (
            <div className="space-y-0.5">
              {displayNotes.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400 dark:text-stone-500">
                  <p>No notes matched the Dataview rules.</p>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => setIsEditingQuery(true)}
                      className="mt-1.5 text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Adjust query rules →
                    </button>
                  )}
                </div>
              ) : (
                displayNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setEditingNote(note)}
                    className="group flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:bg-black/[0.06] cursor-pointer transition-colors"
                  >
                    {/* Left: Icon + Title + Category */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-stone-400 dark:text-stone-400 shrink-0">
                        {note.isList ? (
                          <CheckSquare className="w-4 h-4 text-amber-500" />
                        ) : (
                          <FileText className="w-4 h-4 text-stone-400 group-hover:text-amber-500 transition-colors" />
                        )}
                      </span>

                      <span className="text-[14px] font-medium text-stone-800 dark:text-stone-100 truncate tracking-[-0.01em] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {note.title || <span className="text-stone-400 italic">Untitled note</span>}
                      </span>

                      {note.isPinned && (
                        <Pin className="w-3 h-3 text-amber-500 shrink-0 fill-current" />
                      )}

                      {note.category && (
                        <span className="hidden sm:inline-flex text-[10.5px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-medium shrink-0">
                          {note.category}
                        </span>
                      )}

                      {note.labels && note.labels.length > 0 && (
                        <div className="hidden md:flex items-center gap-1 shrink-0">
                          {note.labels.slice(0, 2).map((lbl) => (
                            <span
                              key={lbl}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0 font-medium"
                            >
                              #{lbl}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Timestamp + Arrow Button */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[11px] text-stone-400 dark:text-stone-500 font-mono">
                        {formatRelativeTime(note.updatedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNote(note);
                        }}
                        className="p-1 rounded text-stone-400 opacity-0 group-hover:opacity-100 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-black/[0.06] dark:hover:bg-white/10 transition-all"
                        title="Open note in tab"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ================= 2. NOTION GALLERY CARDS VIEW ================= */}
          {activeViewType === 'gallery' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {displayNotes.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-stone-400 dark:text-stone-500">
                  <p>No notes matched the Dataview rules.</p>
                </div>
              ) : (
                displayNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setEditingNote(note)}
                    className="group p-3 rounded-xl border border-stone-200/80 dark:border-stone-700/70 hover:border-amber-500/50 bg-stone-50/50 dark:bg-[#25262a] hover:bg-amber-500/[0.03] dark:hover:bg-amber-500/[0.05] cursor-pointer transition-all flex flex-col justify-between min-h-[105px] shadow-2xs hover:shadow-xs"
                  >
                    <div>
                      {/* Top: Icon + Title */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs font-semibold text-stone-800 dark:text-stone-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {note.title || 'Untitled'}
                        </span>
                        {note.isPinned && (
                          <Pin className="w-2.5 h-2.5 text-amber-500 fill-current ml-auto shrink-0" />
                        )}
                      </div>

                      {/* Content snippet */}
                      <p className="text-[11.5px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                        {note.isList
                          ? `${note.todos?.length || 0} checklist items`
                          : note.content?.replace(/<[^>]+>/g, '').trim() || 'Empty page'}
                      </p>
                    </div>

                    {/* Bottom Meta */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-black/[0.04] dark:border-white/[0.05] text-[10.5px]">
                      {note.category ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 font-medium truncate max-w-[100px]">
                          {note.category}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-stone-400 font-mono">
                        {formatRelativeTime(note.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ================= 3. NOTION DATABASE TABLE VIEW ================= */}
          {activeViewType === 'table' && (
            <div className="overflow-x-auto border border-stone-200/80 dark:border-stone-700/70 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100/80 dark:bg-stone-800/80 border-b border-stone-200/80 dark:border-stone-700/70 text-stone-500 dark:text-stone-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Labels</th>
                    <th className="py-2 px-3">Updated</th>
                    <th className="py-2 px-2 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                  {displayNotes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-stone-400 dark:text-stone-500">
                        No notes matched the Dataview rules.
                      </td>
                    </tr>
                  ) : (
                    displayNotes.map((note) => (
                      <tr
                        key={note.id}
                        onClick={() => setEditingNote(note)}
                        className="hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.06] cursor-pointer transition-colors group"
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-500 transition-colors shrink-0" />
                            <span className="font-medium text-stone-800 dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate max-w-[200px] sm:max-w-xs">
                              {note.title || 'Untitled'}
                            </span>
                            {note.isPinned && (
                              <Pin className="w-2.5 h-2.5 text-amber-500 fill-current shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-stone-600 dark:text-stone-400">
                          {note.category ? (
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[11px] font-medium">
                              {note.category}
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-stone-600 dark:text-stone-400">
                          {note.labels && note.labels.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {note.labels.map((lbl) => (
                                <span
                                  key={lbl}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
                                >
                                  #{lbl}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-stone-500 dark:text-stone-400 font-mono text-[11px]">
                          {formatRelativeTime(note.updatedAt)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNote(note);
                            }}
                            className="p-1 rounded text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= 4. NOTION TASK CHECKLIST VIEW ================= */}
          {activeViewType === 'task' && (
            <div className="space-y-1">
              {displayTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400 dark:text-stone-500">
                  <p>No tasks matched the Dataview rules.</p>
                </div>
              ) : (
                displayTasks.map((task) => (
                  <div
                    key={`${task.noteId}-${task.id}`}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => handleToggleTask(task, e as any)}
                      className="mt-1 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[13.5px] leading-snug transition-colors ${
                          task.completed
                            ? 'line-through text-stone-400 dark:text-stone-500'
                            : 'text-stone-800 dark:text-stone-200'
                        }`}
                      >
                        {task.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-stone-400">
                        <span
                          onClick={() => {
                            const found = notes.find((n) => n.id === task.noteId);
                            if (found) setEditingNote(found);
                          }}
                          className="hover:underline hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer font-medium"
                        >
                          {task.noteTitle}
                        </span>
                        {task.category && (
                          <span className="px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 font-medium">
                            {task.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
