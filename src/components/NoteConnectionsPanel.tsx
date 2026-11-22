'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  Map as MapIcon,
  Plus,
  Sparkles,
  X,
  Home,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { Note, NoteConnectionRole } from '@/types/note';
import { NoteLinkTarget } from '@/lib/noteLinks';
import {
  CONNECTION_ROLE_META,
  SuggestedConnection,
  computeSuggestedConnections,
  suggestConnectionsWithOllama,
} from '@/lib/noteGraph';
import { getAllActiveNotesForStructureFromDB } from '@/lib/db';

interface NoteConnectionsPanelProps {
  note: Note;
  ancestors: Note[];
  outgoing: NoteLinkTarget[];
  backlinks: NoteLinkTarget[];
  prevNotes: NoteLinkTarget[];
  nextNotes: NoteLinkTarget[];
  sources: NoteLinkTarget[];
  onNavigateToNote: (noteId: string) => void;
  onOpenLinkModal: (defaultRole: NoteConnectionRole) => void;
  onDisconnect: (targetId: string, role?: NoteConnectionRole | 'all') => void;
  onConnectSuggested: (targetNote: Note, role: NoteConnectionRole) => void;
  onOpenInMap: () => void;
}

export const NoteConnectionsPanel: React.FC<NoteConnectionsPanelProps> = ({
  note,
  ancestors,
  outgoing,
  backlinks,
  prevNotes,
  nextNotes,
  sources,
  onNavigateToNote,
  onOpenLinkModal,
  onDisconnect,
  onConnectSuggested,
  onOpenInMap,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localSuggestions, setLocalSuggestions] = useState<SuggestedConnection[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedConnection[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const parentNote = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;

  const alreadyConnectedIds = useMemo(() => {
    const ids = new Set<string>([note.id]);
    if (note.parentNoteId) ids.add(note.parentNoteId);
    for (const cid of note.childNoteIds || []) ids.add(cid);
    for (const o of outgoing) ids.add(o.id);
    for (const b of backlinks) ids.add(b.id);
    for (const a of ancestors) ids.add(a.id);
    return ids;
  }, [note.id, note.parentNoteId, note.childNoteIds, outgoing, backlinks, ancestors]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getAllActiveNotesForStructureFromDB(400)
        .then((candidates) => {
          if (cancelled) return;
          const computed = computeSuggestedConnections(note, candidates, alreadyConnectedIds, 4);
          setLocalSuggestions(computed);
        })
        .catch(() => {});
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [note, alreadyConnectedIds]);

  const handleRunAiSuggest = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    setShowSuggestions(true);
    try {
      const candidates = await getAllActiveNotesForStructureFromDB(200);
      const res = await suggestConnectionsWithOllama(note, candidates, alreadyConnectedIds);
      if (res.error) {
        setAiError(res.error);
      } else {
        setAiSuggestions(res.suggestions);
      }
    } finally {
      setIsLoadingAi(false);
    }
  };

  const relatedOutgoing = useMemo(
    () => outgoing.filter((o) => o.role !== 'next' && o.role !== 'source'),
    [outgoing]
  );

  const regularBacklinks = useMemo(
    () => backlinks.filter((b) => b.role !== 'next'),
    [backlinks]
  );

  const visibleSuggestions = useMemo(() => {
    const merged = new Map<string, SuggestedConnection>();
    for (const s of [...aiSuggestions, ...localSuggestions]) {
      if (!alreadyConnectedIds.has(s.note.id) && !dismissedIds.has(s.note.id) && !merged.has(s.note.id)) {
        merged.set(s.note.id, s);
      }
    }
    return Array.from(merged.values()).slice(0, 4);
  }, [aiSuggestions, localSuggestions, alreadyConnectedIds, dismissedIds]);

  const hasAnyConnections = Boolean(
    parentNote ||
      prevNotes.length > 0 ||
      nextNotes.length > 0 ||
      sources.length > 0 ||
      relatedOutgoing.length > 0 ||
      regularBacklinks.length > 0
  );

  return (
    <div className="pt-3 pb-1 border-t border-black/5 dark:border-white/5 space-y-3">
      {/* 1. Thread Sequence Stepper (<- Prev | Next ->) */}
      {(prevNotes.length > 0 || nextNotes.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] border border-emerald-500/20">
          <div className="flex items-center gap-1.5 flex-wrap">
            {prevNotes.map((p) => (
              <div
                key={`prev-${p.id}`}
                className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-stone-800 border border-emerald-500/25 shadow-2xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onNavigateToNote(p.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  title={`Previous step: ${p.title}`}
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider opacity-70">Prev:</span>
                  <span className="truncate max-w-[160px] font-semibold">{p.title || 'Untitled'}</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            {nextNotes.map((n) => (
              <div
                key={`next-${n.id}`}
                className="inline-flex items-center rounded-lg bg-white dark:bg-stone-800 border border-emerald-500/25 shadow-2xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onNavigateToNote(n.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  title={`Next step: ${n.title}`}
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-70">Next:</span>
                  <span className="truncate max-w-[160px] font-semibold">{n.title || 'Untitled'}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => onDisconnect(n.id, 'next')}
                  className="px-1.5 py-1 text-stone-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Remove next link"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Panel Header & 1-Click Role Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
          <Link2 className="w-3.5 h-3.5 text-amber-500" />
          <span>Connections &amp; Structure</span>
          {visibleSuggestions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold normal-case tracking-normal border transition-colors cursor-pointer ${
                showSuggestions
                  ? 'bg-amber-500 text-stone-950 border-amber-500'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <Lightbulb className="w-3 h-3" />
              <span>{visibleSuggestions.length} suggested</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {!parentNote && (
            <button
              type="button"
              onClick={() => onOpenLinkModal('part_of')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/25 transition-colors cursor-pointer"
              title="File this note inside a Hub"
            >
              <Home className="w-3 h-3" />
              <span>File in Hub</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenLinkModal('next')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
            title="Connect a Next Step note"
          >
            <Plus className="w-3 h-3 text-emerald-500" />
            <span>Next</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenLinkModal('source')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
            title="Attach a Source or Ticket note"
          >
            <Plus className="w-3 h-3 text-blue-500" />
            <span>Source</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenLinkModal('related')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
            title="Connect a Related note"
          >
            <Plus className="w-3 h-3 text-purple-500" />
            <span>Related</span>
          </button>
          <button
            type="button"
            onClick={handleRunAiSuggest}
            disabled={isLoadingAi}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Ask local Ollama AI for connection & Hub suggestions"
          >
            {isLoadingAi ? (
              <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
            ) : (
              <Sparkles className="w-3 h-3 text-amber-500" />
            )}
            <span className="hidden sm:inline">AI Suggest</span>
          </button>
          <button
            type="button"
            onClick={onOpenInMap}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
            title="View this note's neighborhood in Visual Map"
          >
            <MapIcon className="w-3 h-3 text-amber-500" />
            <span className="hidden sm:inline">Map</span>
          </button>
        </div>
      </div>

      {/* 3. Connected Neighborhood Groups */}
      {hasAnyConnections && (
        <div className="space-y-2">
          {/* Part of Hub */}
          {parentNote && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mr-1">
                🏠 Part of:
              </span>
              <div className="inline-flex items-center rounded-lg bg-amber-500/10 border border-amber-500/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onNavigateToNote(parentNote.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-500/15 transition-colors cursor-pointer"
                >
                  <span>{parentNote.isHub ? '🏠' : '📄'}</span>
                  <span>{parentNote.title || 'Parent Note'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDisconnect(parentNote.id, 'part_of')}
                  className="px-1.5 py-1 text-amber-700/60 dark:text-amber-300/60 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Remove from parent Hub"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mr-1">
                📌 Sources ({sources.length}):
              </span>
              {sources.map((src) => (
                <div
                  key={`src-${src.id}`}
                  className="inline-flex items-center rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/50 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => onNavigateToNote(src.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                  >
                    <span>📌</span>
                    <span>{src.title || 'Untitled note'}</span>
                    {src.category && src.category !== note.category && (
                      <span className="text-[10px] px-1 rounded bg-blue-100/80 dark:bg-blue-900/60">
                        {src.category}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisconnect(src.id, 'source')}
                    className="px-1.5 py-1 text-blue-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Unlink source"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Related Outgoing */}
          {relatedOutgoing.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mr-1">
                🔗 Related ({relatedOutgoing.length}):
              </span>
              {relatedOutgoing.map((target) => (
                <div
                  key={`rel-${target.id}`}
                  className="inline-flex items-center rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => onNavigateToNote(target.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-200/70 dark:hover:bg-stone-700/70 transition-colors cursor-pointer"
                  >
                    <span>{target.isHub ? '🏠' : '🔗'}</span>
                    <span>{target.title || 'Untitled note'}</span>
                    {target.category && target.category !== note.category && (
                      <span className="text-[10px] px-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                        {target.category}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisconnect(target.id, 'all')}
                    className="px-1.5 py-1 text-stone-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Unlink note"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Backlinks */}
          {regularBacklinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mr-1">
                ↩ Referenced in ({regularBacklinks.length}):
              </span>
              {regularBacklinks.map((source) => (
                <button
                  key={`back-${source.id}`}
                  type="button"
                  onClick={() => onNavigateToNote(source.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors border border-purple-200/50 dark:border-purple-800/40 cursor-pointer"
                >
                  <span className="text-purple-500 font-bold text-[10px]">↩</span>
                  <span>{source.title || 'Untitled note'}</span>
                  {source.category && source.category !== note.category && (
                    <span className="text-[10px] px-1 rounded bg-purple-100/80 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300">
                      {source.category}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Suggested Connections Drawer */}
      {showSuggestions && (
        <div className="p-2.5 rounded-xl bg-amber-500/[0.05] dark:bg-amber-500/[0.07] border border-amber-500/20 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Suggested Connections</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-stone-400 hover:text-stone-600 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {aiError && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg">
              {aiError}
            </p>
          )}

          {visibleSuggestions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {visibleSuggestions.map((s) => {
                const roleMeta = CONNECTION_ROLE_META[s.suggestedRole];
                return (
                  <div
                    key={s.note.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800/90 border border-stone-200/80 dark:border-stone-700/80 shadow-2xs"
                  >
                    <div
                      onClick={() => onNavigateToNote(s.note.id)}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="text-xs font-medium text-stone-900 dark:text-stone-100 truncate hover:underline">
                        {s.note.isHub ? '🏠 ' : ''}
                        {s.note.title || 'Untitled Note'}
                      </div>
                      <div className="text-[10px] text-stone-400 truncate">
                        {s.reason} • {roleMeta.emoji} {roleMeta.shortLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onConnectSuggested(s.note, s.suggestedRole)}
                        className="px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-stone-950 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        + Connect
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedIds((prev) => new Set([...prev, s.note.id]))
                        }
                        className="p-1 text-stone-400 hover:text-stone-600 rounded cursor-pointer"
                        title="Dismiss suggestion"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              No automatic suggestions right now. Try clicking &ldquo;AI Suggest&rdquo; or type <code className="px-1 rounded bg-black/5 dark:bg-white/10">[[</code> in the editor.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
