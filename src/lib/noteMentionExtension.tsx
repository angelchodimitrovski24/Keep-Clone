'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Note, NoteConnectionRole } from '@/types/note';
import { CONNECTION_ROLE_META, stripHtmlToPlain } from './noteGraph';
import { findNoteByTitleOrIdFromDB, getNoteByIdFromDB } from './db';

export interface NoteMentionExtensionOptions {
  onOpenNote?: (noteIdOrTitle: string, fallbackTitle?: string) => void;
}

const NoteMentionNodeView: React.FC<NodeViewProps> = ({ node, extension }) => {
  const {
    noteId = '',
    noteTitle = 'Untitled Note',
    role = 'related',
  } = node.attrs as {
    noteId: string;
    noteTitle: string;
    role: NoteConnectionRole;
  };

  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const [lookupStatus, setLookupStatus] = useState<'checking' | 'exists' | 'missing'>('checking');
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = CONNECTION_ROLE_META[role] || CONNECTION_ROLE_META.related;

  useEffect(() => {
    let cancelled = false;
    const checkExists = async () => {
      try {
        let found: Note | undefined;
        if (noteId) {
          found = await getNoteByIdFromDB(noteId);
        }
        if (!found && noteTitle) {
          found = await findNoteByTitleOrIdFromDB(noteTitle);
        }
        if (cancelled) return;
        if (found && !found.isTrash) {
          setPreviewNote(found);
          setLookupStatus('exists');
        } else {
          setPreviewNote(null);
          setLookupStatus('missing');
        }
      } catch {
        if (!cancelled) {
          setPreviewNote(null);
          setLookupStatus('missing');
        }
      }
    };
    checkExists();
    return () => {
      cancelled = true;
    };
  }, [noteId, noteTitle]);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(async () => {
      setIsHovered(true);
      try {
        let found: Note | undefined;
        if (noteId) {
          found = await getNoteByIdFromDB(noteId);
        }
        if (!found && noteTitle) {
          found = await findNoteByTitleOrIdFromDB(noteTitle);
        }
        if (found && !found.isTrash) {
          setPreviewNote(found);
          setLookupStatus('exists');
        } else {
          setPreviewNote(null);
          setLookupStatus('missing');
        }
      } catch {
        // non-fatal preview lookup
      }
    }, 220);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const opts = extension.options as NoteMentionExtensionOptions;
    opts.onOpenNote?.(noteId || noteTitle, noteTitle);
  };

  const snippet = previewNote
    ? previewNote.isEncrypted
      ? '🔒 Encrypted note'
      : previewNote.isList
      ? `${previewNote.todos.length} checklist items`
      : stripHtmlToPlain(previewNote.content || '').slice(0, 120) || 'Empty note'
    : null;

  const isMissing = lookupStatus === 'missing';

  return (
    <NodeViewWrapper
      as="span"
      data-note-mention="true"
      className="relative inline-flex align-baseline mx-0.5 select-none"
      contentEditable={false}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        className={`keep-note-chip inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[0.84em] font-medium cursor-pointer transition-all hover:shadow-xs text-left ${meta.badgeClass} ${
          isMissing ? 'keep-note-chip-unresolved' : ''
        }`}
        title={
          isMissing
            ? `Create & open note: ${noteTitle}`
            : `Open note: ${previewNote?.title || noteTitle} (${meta.shortLabel})`
        }
      >
        <span className="text-[0.9em] leading-none shrink-0">{meta.emoji}</span>
        <span className="break-words">
          {previewNote?.title || noteTitle || 'Untitled Note'}
        </span>
      </button>

      {isHovered && (previewNote || isMissing) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 bottom-full mb-1.5 z-50 w-64 p-2.5 rounded-xl bg-white dark:bg-[#242528] border border-stone-200 dark:border-stone-700 shadow-xl text-left pointer-events-none animate-in fade-in duration-100"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 break-words">
              {previewNote ? previewNote.title || 'Untitled Note' : noteTitle || 'Untitled Note'}
            </span>
            {previewNote?.category && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 shrink-0">
                {previewNote.category}
              </span>
            )}
          </div>
          {previewNote ? (
            <>
              {snippet && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-snug">
                  {snippet}
                </p>
              )}
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
                <span>{meta.emoji} {meta.shortLabel}</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">Click to open ↗</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug">
                Note doesn&apos;t exist yet.
              </p>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
                <span>{meta.emoji} Unresolved link</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">Click to create ↗</span>
              </div>
            </>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const NoteMentionExtension = Node.create<NoteMentionExtensionOptions>({
  name: 'noteMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      onOpenNote: undefined,
    };
  },

  addAttributes() {
    return {
      noteId: {
        default: '',
        parseHTML: (el) =>
          el.getAttribute('data-note-id') || el.getAttribute('data-note-link-id') || '',
        renderHTML: (attrs) => (attrs.noteId ? { 'data-note-id': attrs.noteId } : {}),
      },
      noteTitle: {
        default: 'Untitled Note',
        parseHTML: (el) => {
          const explicit =
            el.getAttribute('data-note-title') || el.getAttribute('data-note-link-title');
          if (explicit) return explicit;
          return (el.textContent || '').replace(/^[🔗➡️📌🏠]\s*/u, '').trim() || 'Untitled Note';
        },
        renderHTML: (attrs) => ({
          'data-note-title': attrs.noteTitle || 'Untitled Note',
          'data-note-link-title': attrs.noteTitle || 'Untitled Note',
        }),
      },
      role: {
        default: 'related',
        parseHTML: (el) => {
          const raw = el.getAttribute('data-note-role');
          if (raw === 'part_of' || raw === 'next' || raw === 'source' || raw === 'related') {
            return raw;
          }
          return 'related';
        },
        renderHTML: (attrs) => ({ 'data-note-role': attrs.role || 'related' }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-note-mention="true"]' },
      { tag: 'span.keep-note-link[data-note-link-title]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const title = HTMLAttributes['data-note-title'] || 'Untitled Note';
    const role = HTMLAttributes['data-note-role'] || 'related';
    const icon =
      role === 'next' ? '➡️' : role === 'source' ? '📌' : role === 'part_of' ? '🏠' : '🔗';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-note-mention': 'true',
        class: 'keep-note-chip',
      }),
      `${icon} ${title}`,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]$/,
        handler: ({ state, range, match }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name === 'codeBlock') {
            return null;
          }
          if (
            state.schema.marks.code &&
            state.doc.rangeHasMark(range.from, range.to, state.schema.marks.code)
          ) {
            return null;
          }

          const raw1 = match[1] || '';
          const raw2 = match[2] || '';
          const hasId = Boolean(raw2);
          const noteId = hasId ? raw1.trim() : '';
          const noteTitle = (hasId ? raw2 : raw1).trim();
          if (!noteTitle) {
            return null;
          }

          const node = this.type.create({
            noteId,
            noteTitle,
            role: 'related',
          });
          state.tr.replaceWith(range.from, range.to, node).scrollIntoView();
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteMentionNodeView);
  },
});
