'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  X,
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  ChevronLeft,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { NoteVersion } from '@/types/note';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getNoteColorClasses } from '@/lib/constants';

export const NoteVersionModal: React.FC = () => {
  const {
    versionHistoryNote,
    setVersionHistoryNote,
    restoreNoteVersion,
    createNoteSnapshot,
    deleteNoteVersion,
  } = useKeep();

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [snapshotSummary, setSnapshotSummary] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'timeline' | 'preview'>('timeline');

  const versions: NoteVersion[] = useMemo(() => {
    if (!versionHistoryNote?.versions) return [];
    // Sort versions newest first
    return [...versionHistoryNote.versions].sort((a, b) => b.timestamp - a.timestamp);
  }, [versionHistoryNote]);

  // Default to selecting newest version or active version
  const activeVersion = useMemo(() => {
    if (!versions.length) return null;
    if (selectedVersionId) {
      const found = versions.find((v) => v.id === selectedVersionId);
      if (found) return found;
    }
    return versions[0];
  }, [versions, selectedVersionId]);

  if (!versionHistoryNote) return null;

  const handleRestore = async (version: NoteVersion) => {
    if (!versionHistoryNote) return;
    await restoreNoteVersion(versionHistoryNote.id, version.id);
    setActionMessage(`Restored version from ${new Date(version.timestamp).toLocaleTimeString()}`);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleCreateManualSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionHistoryNote) return;
    const summary = snapshotSummary.trim() || 'Manual checkpoint';
    await createNoteSnapshot(versionHistoryNote.id, summary);
    setSnapshotSummary('');
    setIsCreatingSnapshot(false);
    setActionMessage('Created manual version snapshot');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleDelete = async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!versionHistoryNote) return;
    if (confirm('Are you sure you want to delete this version from history?')) {
      await deleteNoteVersion(versionHistoryNote.id, versionId);
      if (selectedVersionId === versionId) {
        setSelectedVersionId(null);
      }
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (isToday) {
      return `Today at ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`;
  };

  const getRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const previewColorClasses = activeVersion
    ? getNoteColorClasses(activeVersion.color, activeVersion.theme)
    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700';

  return (
    <div
      onClick={() => setVersionHistoryNote(null)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-6 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 flex flex-col overflow-hidden h-[92vh] sm:h-[780px] max-h-[96vh] sm:max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-base sm:text-lg text-stone-900 dark:text-stone-100 truncate">
                  Version History
                </h3>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium shrink-0">
                  {versions.length}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[160px] sm:max-w-md">
                {versionHistoryNote.title || 'Untitled note'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isCreatingSnapshot ? (
              <button
                type="button"
                onClick={() => setIsCreatingSnapshot(true)}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors shrink-0"
                title="Create a named checkpoint of the current note state"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Snapshot</span>
                <span className="sm:hidden">Snapshot</span>
              </button>
            ) : (
              <form onSubmit={handleCreateManualSnapshot} className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  placeholder="Snapshot name…"
                  value={snapshotSummary}
                  onChange={(e) => setSnapshotSummary(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-amber-400 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none w-28 sm:w-48"
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-xs rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingSnapshot(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setVersionHistoryNote(null)}
              className="p-1.5 sm:p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              title="Close version history"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex sm:hidden border-b border-black/[0.06] dark:border-white/[0.08] bg-stone-100/70 dark:bg-stone-900/60 p-1.5 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('timeline')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs transition-all ${
              mobileTab === 'timeline'
                ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Revisions ({versions.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            disabled={!activeVersion}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs transition-all ${
              mobileTab === 'preview'
                ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Preview & Restore
          </button>
        </div>

        {actionMessage && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Modal Main Content: Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Versions Timeline */}
          <div
            className={`${
              mobileTab === 'timeline' ? 'flex' : 'hidden'
            } sm:flex w-full sm:w-80 border-r border-stone-200 dark:border-stone-800 flex-col bg-stone-50/30 dark:bg-stone-900/20 shrink-0`}
          >
            <div className="p-3 border-b border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center justify-between shrink-0">
              <span>Saved Versions</span>
              <span className="font-mono text-[11px]">{versions.length} total</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {versions.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
                  No previous versions recorded yet. As you edit this note, revisions will be stored automatically.
                </div>
              ) : (
                versions.map((ver, idx) => {
                  const isSelected = activeVersion?.id === ver.id;
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={ver.id}
                      onClick={() => {
                        setSelectedVersionId(ver.id);
                        setMobileTab('preview');
                      }}
                      className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/80 text-stone-900 dark:text-stone-100'
                          : 'border-stone-200/80 dark:border-stone-800 hover:bg-stone-100/70 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-stone-850 dark:text-stone-100 flex items-center gap-1.5">
                          {isLatest ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          ) : (
                            <Calendar className="w-3 h-3 text-stone-400" />
                          )}
                          <span>{getRelativeTime(ver.timestamp)}</span>
                        </span>

                        <span className="text-[10px] text-stone-400 font-mono">
                          {new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300 font-medium truncate mb-1">
                        {ver.title || (ver.content ? ver.content.replace(/<[^>]+>/g, '').slice(0, 30) : 'Untitled')}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-black/5 dark:border-white/5 text-[11px] text-stone-500 dark:text-stone-400">
                        <span className="inline-flex items-center gap-1 truncate max-w-[175px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                          {ver.changeSummary?.startsWith('Auto') && (
                            <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                          )}
                          <span className="truncate">{ver.changeSummary || (isLatest ? 'Current state' : 'Edited note')}</span>
                        </span>

                        {versions.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDelete(ver.id, e)}
                            className="opacity-90 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded hover:bg-rose-500/10 text-stone-400 hover:text-rose-600 transition-opacity"
                            title="Delete this historical version"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Selected Version Preview & Restore Button */}
          <div
            className={`${
              mobileTab === 'preview' ? 'flex' : 'hidden'
            } sm:flex flex-1 flex-col overflow-hidden bg-white dark:bg-[#202124]`}
          >
            {activeVersion ? (
              <>
                {/* Version Preview Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-2.5 sm:py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-900/20 shrink-0">
                  <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileTab('timeline')}
                      className="sm:hidden inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-stone-300 py-1 px-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Revisions</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-stone-850 dark:text-stone-100">
                          {formatTimestamp(activeVersion.timestamp)}
                        </span>
                        <span className="text-[11px] text-stone-500 dark:text-stone-400 ml-1.5 hidden sm:inline">
                          • {activeVersion.changeSummary || 'Snapshot'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(activeVersion)}
                    className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-xl font-semibold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all active:scale-95 w-full sm:w-auto shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore this Version</span>
                  </button>
                </div>

                {/* Visual Note Preview Container */}
                <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
                  <div
                    className={`rounded-2xl p-4 sm:p-6 border shadow-xs transition-all min-h-[250px] sm:min-h-[350px] ${previewColorClasses}`}
                  >
                    {activeVersion.title && (
                      <h2
                        className="font-bold text-stone-900 dark:text-stone-100 mb-3 tracking-tight"
                        style={{ fontSize: 'calc(var(--note-font-size, 15px) * 1.25)' }}
                      >
                        {activeVersion.title}
                      </h2>
                    )}

                    {activeVersion.isList ? (
                      <div className="space-y-2" style={{ fontSize: 'var(--note-font-size, 15px)' }}>
                        {activeVersion.todos && activeVersion.todos.length > 0 ? (
                          activeVersion.todos.map((todo) => (
                            <div key={todo.id} className="flex items-start gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                readOnly
                                checked={todo.completed}
                                className="w-4 h-4 mt-0.5 rounded text-blue-600 accent-blue-600 shrink-0 pointer-events-none"
                              />
                              <span
                                className={`flex-1 min-w-0 break-words whitespace-pre-wrap ${
                                  todo.completed
                                    ? 'line-through text-stone-400 dark:text-stone-500'
                                    : 'text-stone-800 dark:text-stone-200'
                                }`}
                              >
                                {todo.text}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-stone-400 italic">No checklist items in this version</p>
                        )}
                      </div>
                    ) : (
                      <div className="leading-relaxed">
                        <MarkdownRenderer content={activeVersion.content} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400">
                <FileText className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-sm">Select a version from the timeline on the left to preview it.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
