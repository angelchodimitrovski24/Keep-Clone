'use client';

import React, { useEffect, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ArrowUpRight, CheckSquare, FileText } from 'lucide-react';
import { Note } from '@/types/note';
import { getNoteByIdFromDB } from './db';

export interface SubpageBlockExtensionOptions {
  onOpenSubpage?: (noteIdOrTitle: string) => void;
}

const SubpageBlockNodeView: React.FC<NodeViewProps> = ({ node, extension }) => {
  const {
    noteId = '',
    noteTitle = 'Untitled',
    isList = false,
  } = node.attrs as {
    noteId: string;
    noteTitle: string;
    isList?: boolean;
  };

  const [resolvedNote, setResolvedNote] = useState<Note | null>(null);

  useEffect(() => {
    let active = true;
    if (!noteId) return;
    getNoteByIdFromDB(noteId)
      .then((found) => {
        if (active && found && !found.isTrash) {
          setResolvedNote(found);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [noteId]);

  const displayTitle = resolvedNote?.title ?? noteTitle ?? 'Untitled';
  const showChecklistIcon = resolvedNote ? Boolean(resolvedNote.isList) : Boolean(isList);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const targetIdOrTitle = noteId || displayTitle;
    if ((e.ctrlKey || e.metaKey) && noteId) {
      window.open(`/note/${encodeURIComponent(noteId)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    const opts = extension.options as SubpageBlockExtensionOptions;
    opts.onOpenSubpage?.(targetIdOrTitle);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1 && noteId) {
      e.preventDefault();
      e.stopPropagation();
      window.open(`/note/${encodeURIComponent(noteId)}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      className="my-1 select-none"
      contentEditable={false}
    >
      <div
        role="button"
        tabIndex={0}
        data-keep-subpage="true"
        data-note-id={noteId}
        data-note-title={displayTitle}
        onClick={handleOpen}
        onAuxClick={handleAuxClick}
        onMouseDown={(e) => {
          // Stop ProseMirror selection/drag from swallowing clicks on the sub-page row
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            const opts = extension.options as SubpageBlockExtensionOptions;
            opts.onOpenSubpage?.(noteId || displayTitle);
          }
        }}
        className="group inline-flex w-full items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:bg-black/[0.06] cursor-pointer transition-colors"
        title={`Open "${displayTitle || 'Untitled'}" in new tab (Ctrl+click for browser tab)`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-stone-400 dark:text-stone-400 shrink-0">
            {showChecklistIcon ? (
              <CheckSquare className="w-4 h-4 text-stone-400" />
            ) : (
              <FileText className="w-4 h-4 text-stone-400" />
            )}
          </span>
          <span className="text-[14.5px] font-medium text-stone-800 dark:text-stone-100 truncate tracking-[-0.01em] underline decoration-stone-300 dark:decoration-stone-600 underline-offset-[4px]">
            {displayTitle || (
              <span className="text-stone-400 dark:text-stone-500 italic no-underline">Untitled</span>
            )}
          </span>
        </div>
        <ArrowUpRight className="w-4 h-4 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
      </div>
    </NodeViewWrapper>
  );
};

export const SubpageBlockExtension = Node.create<SubpageBlockExtensionOptions>({
  name: 'subpageBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      onOpenSubpage: undefined,
    };
  },

  addAttributes() {
    return {
      noteId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-note-id') || '',
        renderHTML: (attrs) => (attrs.noteId ? { 'data-note-id': attrs.noteId } : {}),
      },
      noteTitle: {
        default: 'Untitled',
        parseHTML: (el) =>
          el.getAttribute('data-note-title') ||
          (el.textContent || '').replace(/^📄\s*/u, '').trim() ||
          'Untitled',
        renderHTML: (attrs) => ({
          'data-note-title': attrs.noteTitle || 'Untitled',
        }),
      },
      isList: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-is-list') === 'true',
        renderHTML: (attrs) => ({
          'data-is-list': attrs.isList ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-keep-subpage="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const title = HTMLAttributes['data-note-title'] || 'Untitled';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-keep-subpage': 'true',
        class: 'keep-subpage-row',
      }),
      `📄 ${title}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubpageBlockNodeView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return Boolean(target?.closest?.('[data-keep-subpage="true"]'));
      },
    });
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('subpageTrailingParagraph'),
        appendTransaction: (_transactions, _oldState, newState) => {
          const lastChild = newState.doc.lastChild;
          if (lastChild && lastChild.type.name === 'subpageBlock') {
            const paragraphType = newState.schema.nodes.paragraph;
            if (paragraphType) {
              return newState.tr.insert(newState.doc.content.size, paragraphType.create());
            }
          }
          return null;
        },
      }),
    ];
  },
});
