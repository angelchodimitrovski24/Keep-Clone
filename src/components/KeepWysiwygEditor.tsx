'use client';

import React, {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { textblockTypeInputRule } from '@tiptap/core';
import { TextSelection, NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { KeepFormattingBar } from './KeepFormattingBar';
import { SlashCommandMenu } from './SlashCommandMenu';
import {
  filterSlashCommands,
  SlashAnchorRect,
  SlashCommandItem,
  SlashContextFlags,
  SlashNoteActionId,
} from '@/lib/slashCommands';
import { GoogleKeepFormatCommand, convertMarkdownToHtml, convertHtmlToMarkdown } from '@/lib/formatUtils';
import { KeepMediaExtension } from '@/lib/keepMediaExtension';
import { ImageGalleryExtension } from '@/lib/imageGalleryExtension';
import { GalleryImageItem } from '@/lib/imageGalleryUtils';
import { DataviewExtension } from '@/lib/dataviewExtension';
import { NoteMentionExtension } from '@/lib/noteMentionExtension';
import { SubpageBlockExtension } from '@/lib/subpageBlockExtension';
import { getMovableEditorBlocks, moveEditorBlock } from '@/lib/editorBlockDrag';
import { Note, NoteConnectionRole } from '@/types/note';
import { CONNECTION_ROLE_META, CONNECTION_ROLES_ORDER } from '@/lib/noteGraph';
import { searchLinkableNotesFromDB } from '@/lib/db';
import { useKeep } from '@/context/KeepContext';
import { importMhtmlIntoNote } from '@/lib/mhtmlParser';
import {
  extractClipboardPayload,
  copyFilesToLocalFolder,
} from '@/lib/localPaste';
import { Loader2, Link2, Plus, FileText, CheckSquare, GripVertical } from 'lucide-react';

export interface KeepWysiwygEditorHandle {
  handleFormat: (cmd: GoogleKeepFormatCommand) => void;
  focus: () => void;
  getHTML: () => string;
  insertLocalFiles: (files: File[], imageUrls?: string[]) => Promise<void>;
  insertContent: (text: string) => void;
  insertNoteMention: (target: { id: string; title: string; role?: NoteConnectionRole }) => void;
  bindNoteMentionId: (noteTitleOrId: string, resolvedNoteId: string) => boolean;
}

export interface KeepWysiwygEditorProps {
  content: string;
  onChange: (htmlOrText: string) => void;
  placeholder?: string;
  isFormattingOpen?: boolean;
  className?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  listenWindowPaste?: boolean;
  currentNoteId?: string;
  defaultCategoryForNewLink?: string | null;
  onOpenMentionedNote?: (noteIdOrTitle: string, fallbackTitle?: string) => void;
  onNoteMentionSelected?: (targetNote: Note, role: NoteConnectionRole) => void;
  enableSlashMenu?: boolean;
  availableSlashActions?: SlashNoteActionId[];
  slashContextFlags?: SlashContextFlags;
  onSlashNoteAction?: (actionId: SlashNoteActionId, anchorRect: SlashAnchorRect) => void;
  onCreateInlineSubpage?: (input: {
    title?: string;
    existingNote?: Note;
  }) => Promise<{ id: string; title: string; isList?: boolean } | null>;
  onAfterInsertInlineSubpage?: (
    sub: { id: string; title: string },
    updatedHtml: string
  ) => void | Promise<void>;
}

interface MentionPopupState {
  isOpen: boolean;
  query: string;
  range: { from: number; to: number };
  coords: { top: number; left: number; placeAbove: boolean };
}

interface SlashPopupState {
  isOpen: boolean;
  query: string;
  range: { from: number; to: number };
  coords: SlashAnchorRect;
}

interface SubpageCreatorState {
  isOpen: boolean;
  insertPos: number;
  coords: SlashAnchorRect;
}

export const KeepWysiwygEditor = forwardRef<KeepWysiwygEditorHandle, KeepWysiwygEditorProps>(
  (
    {
      content,
      onChange,
      placeholder = 'Take a note…',
      isFormattingOpen = false,
      className = '',
      minHeightClass = 'min-h-[180px]',
      autoFocus = false,
      listenWindowPaste = true,
      currentNoteId,
      defaultCategoryForNewLink,
      onOpenMentionedNote,
      onNoteMentionSelected,
      enableSlashMenu = true,
      availableSlashActions,
      slashContextFlags,
      onSlashNoteAction,
      onCreateInlineSubpage,
      onAfterInsertInlineSubpage,
    },
    ref
  ) => {
    const {
      notes,
      addNote,
      resolveOrCreateLinkedNote,
      connectNotes,
      setEditingNote,
    } = useKeep();

    const [isCopyingFiles, setIsCopyingFiles] = useState(false);
    const editorInstanceRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const onOpenMentionedNoteRef = useRef(onOpenMentionedNote);
    const onNoteMentionSelectedRef = useRef(onNoteMentionSelected);
    const onSlashNoteActionRef = useRef(onSlashNoteAction);
    const onCreateInlineSubpageRef = useRef(onCreateInlineSubpage);
    const onAfterInsertInlineSubpageRef = useRef(onAfterInsertInlineSubpage);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onOpenMentionedNoteRef.current = onOpenMentionedNote;
    }, [onOpenMentionedNote]);

    useEffect(() => {
      onNoteMentionSelectedRef.current = onNoteMentionSelected;
    }, [onNoteMentionSelected]);

    useEffect(() => {
      onSlashNoteActionRef.current = onSlashNoteAction;
    }, [onSlashNoteAction]);

    useEffect(() => {
      onCreateInlineSubpageRef.current = onCreateInlineSubpage;
    }, [onCreateInlineSubpage]);

    useEffect(() => {
      onAfterInsertInlineSubpageRef.current = onAfterInsertInlineSubpage;
    }, [onAfterInsertInlineSubpage]);

    // Cursor-anchored Inline Sub-page Creator State
    const [subpageCreator, setSubpageCreator] = useState<SubpageCreatorState | null>(null);
    const subpageCreatorRef = useRef<SubpageCreatorState | null>(null);
    const lastEmittedHtmlRef = useRef<string>(content);
    const emitChange = useCallback((html: string) => {
      lastEmittedHtmlRef.current = html;
      onChangeRef.current(html);
    }, []);
    const [subpageTitleInput, setSubpageTitleInput] = useState('');
    const [subpageSelectedIdx, setSubpageSelectedIdx] = useState(-1);
    const [dbSubpageMatches, setDbSubpageMatches] = useState<Note[] | null>(null);
    const subpageInputRef = useRef<HTMLInputElement>(null);
    const isCreatingSubpageRef = useRef(false);

    useEffect(() => {
      if (!subpageCreator?.isOpen) {
        setDbSubpageMatches(null);
        return;
      }
      const q = subpageTitleInput.trim();
      if (!q) {
        setDbSubpageMatches(null);
        return;
      }
      let cancelled = false;
      const timer = setTimeout(() => {
        searchLinkableNotesFromDB({
          query: q,
          excludeNoteIds: currentNoteId ? [currentNoteId] : [],
          limit: 8,
        })
          .then((res) => {
            if (!cancelled) setDbSubpageMatches(res);
          })
          .catch(() => {});
      }, 120);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [subpageCreator?.isOpen, subpageTitleInput, currentNoteId]);

    const subpageCandidates = useMemo(() => {
      if (!subpageCreator?.isOpen) return [];
      const q = subpageTitleInput.trim().toLowerCase();
      if (!q) return [];
      const map = new Map<string, Note>();
      const source = dbSubpageMatches ? [...dbSubpageMatches, ...notes] : notes;
      for (const n of source) {
        if (n.isTrash || n.id === currentNoteId || map.has(n.id)) continue;
        const titleOk = Boolean(n.title && n.title.toLowerCase().includes(q));
        const catOk = Boolean(n.category && n.category.toLowerCase().includes(q));
        if (!titleOk && !catOk) continue;
        map.set(n.id, n);
        if (map.size >= 6) break;
      }
      return Array.from(map.values());
    }, [subpageCreator?.isOpen, subpageTitleInput, dbSubpageMatches, notes, currentNoteId]);

    useEffect(() => {
      if (!subpageCreator?.isOpen) return;
      const handleOutsideMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-subpage-menu="true"]')) return;
        subpageCreatorRef.current = null;
        setSubpageCreator(null);
        setSubpageTitleInput('');
        setSubpageSelectedIdx(-1);
      };
      document.addEventListener('mousedown', handleOutsideMouseDown);
      return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
    }, [subpageCreator?.isOpen]);

    const commitInlineSubpage = useCallback(
      async (options: { title?: string; existingNote?: Note }) => {
        const activeEditor = editorInstanceRef.current;
        const creator = subpageCreatorRef.current;
        const createFn = onCreateInlineSubpageRef.current;
        if (!activeEditor || !creator || !createFn || isCreatingSubpageRef.current) return;

        isCreatingSubpageRef.current = true;
        subpageCreatorRef.current = null;
        setSubpageCreator(null);
        setSubpageTitleInput('');
        setSubpageSelectedIdx(-1);

        try {
          const created = await createFn(options);
          if (!created) return;

          const docSize = activeEditor.state.doc.content.size;
          const clampedPos = Math.max(0, Math.min(creator.insertPos, docSize));
          const $pos = activeEditor.state.doc.resolve(clampedPos);

          const subpageAttrs = {
            noteId: created.id,
            noteTitle: created.title || 'Untitled',
            isList: Boolean(created.isList),
          };
          const subpageNode = {
            type: 'subpageBlock',
            attrs: subpageAttrs,
          };

          // Check if cursor is inside a checklist/bullet/ordered list item
          let itemDepth = -1;
          for (let d = $pos.depth; d >= 1; d--) {
            const typeName = $pos.node(d).type.name;
            if (typeName === 'taskItem' || typeName === 'listItem') {
              itemDepth = d;
              break;
            }
          }

          if (itemDepth >= 2) {
            const listDepth = itemDepth - 1;
            const listNode = $pos.node(listDepth);
            const itemNode = $pos.node(itemDepth);
            const itemIndex = $pos.index(listDepth);
            const isItemEmpty = itemNode.textContent.trim().length === 0;
            const listFrom = $pos.before(listDepth);
            const listTo = $pos.after(listDepth);

            const beforeItems: unknown[] = [];
            for (let i = 0; i < (isItemEmpty ? itemIndex : itemIndex + 1); i++) {
              beforeItems.push(listNode.child(i).toJSON());
            }
            const afterItems: unknown[] = [];
            for (let i = itemIndex + 1; i < listNode.childCount; i++) {
              afterItems.push(listNode.child(i).toJSON());
            }

            const replacement: Record<string, unknown>[] = [];
            if (beforeItems.length > 0) {
              replacement.push({
                type: listNode.type.name,
                attrs: listNode.attrs,
                content: beforeItems,
              });
            }
            replacement.push(subpageNode);
            if (afterItems.length > 0) {
              replacement.push({
                type: listNode.type.name,
                attrs: listNode.attrs,
                content: afterItems,
              });
            } else {
              replacement.push({ type: 'paragraph' });
            }

            activeEditor
              .chain()
              .insertContentAt({ from: listFrom, to: listTo }, replacement)
              .run();
          } else {
            const schema = activeEditor.state.schema;
            const subBlockType = schema.nodes.subpageBlock;
            const paraType = schema.nodes.paragraph;
            if (subBlockType && paraType) {
              const subBlockNode = subBlockType.create(subpageAttrs);
              const paraNode = paraType.create();
              if ($pos.depth >= 1) {
                const topBlock = $pos.node(1);
                const fromBlock = $pos.before(1);
                const toBlock = $pos.after(1);
                const isBlockEmpty =
                  topBlock.type.name === 'paragraph' &&
                  topBlock.textContent.trim().length === 0 &&
                  topBlock.childCount === 0;

                if (isBlockEmpty) {
                  const tr = activeEditor.state.tr.replaceWith(fromBlock, toBlock, [
                    subBlockNode,
                    paraNode,
                  ]);
                  const nextCursor = Math.min(
                    fromBlock + subBlockNode.nodeSize + 1,
                    tr.doc.content.size
                  );
                  tr.setSelection(TextSelection.near(tr.doc.resolve(nextCursor), 1));
                  activeEditor.view.dispatch(tr.scrollIntoView());
                } else {
                  const tr = activeEditor.state.tr.insert(toBlock, [
                    subBlockNode,
                    paraNode,
                  ]);
                  const nextCursor = Math.min(
                    toBlock + subBlockNode.nodeSize + 1,
                    tr.doc.content.size
                  );
                  tr.setSelection(TextSelection.near(tr.doc.resolve(nextCursor), 1));
                  activeEditor.view.dispatch(tr.scrollIntoView());
                }
              } else {
                const tr = activeEditor.state.tr.insert(clampedPos, [
                  subBlockNode,
                  paraNode,
                ]);
                const nextCursor = Math.min(
                  clampedPos + subBlockNode.nodeSize + 1,
                  tr.doc.content.size
                );
                tr.setSelection(TextSelection.near(tr.doc.resolve(nextCursor), 1));
                activeEditor.view.dispatch(tr.scrollIntoView());
              }
            }
          }

          requestAnimationFrame(() => {
            if (!activeEditor.isDestroyed) {
              activeEditor.view.focus();
            }
          });

          const updatedHtml = activeEditor.getHTML();
          emitChange(updatedHtml);
          await onAfterInsertInlineSubpageRef.current?.(
            { id: created.id, title: created.title },
            updatedHtml
          );
        } finally {
          isCreatingSubpageRef.current = false;
        }
      },
      [emitChange]
    );

    // Block Drag & Drop (Notion-style left gutter handle)
    const editorCanvasRef = useRef<HTMLDivElement>(null);
    const [hoveredBlock, setHoveredBlock] = useState<{
      index: number;
      top: number;
      label: string;
    } | null>(null);
    const [blockDragState, setBlockDragState] = useState<{
      sourceIndex: number;
      label: string;
      dropBoundaryIndex: number;
      indicatorTop: number;
    } | null>(null);
    const hideHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isDraggingBlockRef = useRef(false);

    useEffect(() => {
      return () => {
        if (hideHoverTimerRef.current) clearTimeout(hideHoverTimerRef.current);
      };
    }, []);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingBlockRef.current) return;
      const activeEditor = editorInstanceRef.current;
      const canvasEl = editorCanvasRef.current;
      if (!activeEditor || !canvasEl) return;
      if (hideHoverTimerRef.current) {
        clearTimeout(hideHoverTimerRef.current);
        hideHoverTimerRef.current = null;
      }

      const canvasRect = canvasEl.getBoundingClientRect();
      const blocks = getMovableEditorBlocks(activeEditor);
      if (blocks.length === 0) {
        setHoveredBlock(null);
        return;
      }

      let matched = blocks.find(
        (b) => e.clientY >= b.rect.top - 4 && e.clientY <= b.rect.bottom + 4
      );
      if (!matched) {
        let bestDist = 18;
        for (const b of blocks) {
          const dist = Math.min(
            Math.abs(e.clientY - b.rect.top),
            Math.abs(e.clientY - b.rect.bottom)
          );
          if (dist < bestDist) {
            bestDist = dist;
            matched = b;
          }
        }
      }

      if (!matched) {
        setHoveredBlock(null);
        return;
      }

      const top = matched.rect.top - canvasRect.top;
      setHoveredBlock((prev) =>
        prev && prev.index === matched.index && Math.abs(prev.top - top) < 2
          ? prev
          : { index: matched.index, top, label: matched.label }
      );
    }, []);

    const startBlockDrag = useCallback(
      (sourceIndex: number, label: string, e: React.PointerEvent<HTMLButtonElement>) => {
        const activeEditor = editorInstanceRef.current;
        const canvasEl = editorCanvasRef.current;
        if (!activeEditor || !canvasEl) return;

        e.preventDefault();
        e.stopPropagation();

        isDraggingBlockRef.current = true;
        setHoveredBlock(null);

        const computeDrop = (clientY: number) => {
          const canvasRect = canvasEl.getBoundingClientRect();
          const blocks = getMovableEditorBlocks(activeEditor);
          if (blocks.length === 0) {
            return { boundary: 0, indicatorTop: 0 };
          }
          for (const b of blocks) {
            const mid = b.rect.top + b.rect.height / 2;
            if (clientY < mid) {
              return { boundary: b.index, indicatorTop: b.rect.top - canvasRect.top };
            }
          }
          const last = blocks[blocks.length - 1];
          return {
            boundary: blocks.length,
            indicatorTop: last.rect.bottom - canvasRect.top,
          };
        };

        let latestDrop = computeDrop(e.clientY);
        setBlockDragState({
          sourceIndex,
          label,
          dropBoundaryIndex: latestDrop.boundary,
          indicatorTop: latestDrop.indicatorTop,
        });

        const handleMove = (moveEvent: PointerEvent) => {
          latestDrop = computeDrop(moveEvent.clientY);
          setBlockDragState({
            sourceIndex,
            label,
            dropBoundaryIndex: latestDrop.boundary,
            indicatorTop: latestDrop.indicatorTop,
          });
        };

        const handleUp = () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleUp);
          window.removeEventListener('pointercancel', handleUp);
          isDraggingBlockRef.current = false;
          setBlockDragState(null);

          if (
            latestDrop.boundary !== sourceIndex &&
            latestDrop.boundary !== sourceIndex + 1
          ) {
            if (moveEditorBlock(activeEditor, sourceIndex, latestDrop.boundary)) {
              emitChange(activeEditor.getHTML());
            }
          }
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);
      },
      [emitChange]
    );

    // [[ Wiki-Link Live Autocomplete Popup State
    const [mentionPopup, setMentionPopup] = useState<MentionPopupState | null>(null);
    const [mentionRole, setMentionRole] = useState<NoteConnectionRole>('related');
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState<number>(0);
    const [dbMentionMatches, setDbMentionMatches] = useState<Note[] | null>(null);

    const mentionPopupRef = useRef<MentionPopupState | null>(null);
    const mentionRoleRef = useRef<NoteConnectionRole>('related');
    const mentionSelectedIndexRef = useRef<number>(0);
    const mentionCandidatesRef = useRef<Note[]>([]);

    useEffect(() => {
      mentionPopupRef.current = mentionPopup;
    }, [mentionPopup]);

    useEffect(() => {
      mentionRoleRef.current = mentionRole;
    }, [mentionRole]);

    useEffect(() => {
      mentionSelectedIndexRef.current = mentionSelectedIndex;
    }, [mentionSelectedIndex]);

    // / Slash Command Menu State
    const [slashPopup, setSlashPopup] = useState<SlashPopupState | null>(null);
    const [slashSelectedIndex, setSlashSelectedIndex] = useState<number>(0);

    const slashPopupRef = useRef<SlashPopupState | null>(null);
    const slashSelectedIndexRef = useRef<number>(0);
    const slashCandidatesRef = useRef<SlashCommandItem[]>([]);
    const executeSlashRef = useRef<(item: SlashCommandItem) => void>(() => {});

    useEffect(() => {
      slashPopupRef.current = slashPopup;
    }, [slashPopup]);

    useEffect(() => {
      slashSelectedIndexRef.current = slashSelectedIndex;
    }, [slashSelectedIndex]);

    const supportedNoteActionsSet = useMemo(() => {
      const s = new Set<SlashNoteActionId>(availableSlashActions || []);
      s.add('wiki-link');
      return s;
    }, [availableSlashActions]);

    const slashCandidates = useMemo(() => {
      if (!slashPopup?.isOpen) return [];
      return filterSlashCommands(slashPopup.query, supportedNoteActionsSet, slashContextFlags);
    }, [slashPopup?.isOpen, slashPopup?.query, supportedNoteActionsSet, slashContextFlags]);

    useEffect(() => {
      slashCandidatesRef.current = slashCandidates;
      setSlashSelectedIndex((prev) =>
        slashCandidates.length === 0 ? 0 : Math.min(prev, slashCandidates.length - 1)
      );
    }, [slashCandidates]);

    useEffect(() => {
      setSlashSelectedIndex(0);
    }, [slashPopup?.query, slashPopup?.isOpen]);

    // Close floating slash menu when clicking outside
    useEffect(() => {
      if (!slashPopup?.isOpen) return;
      const handleOutsideMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-slash-menu="true"]')) return;
        setSlashPopup(null);
      };
      document.addEventListener('mousedown', handleOutsideMouseDown);
      return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
    }, [slashPopup?.isOpen]);

    // Fetch live DB matches when [[ popup is open
    useEffect(() => {
      if (!mentionPopup?.isOpen) {
        setDbMentionMatches(null);
        return;
      }
      let cancelled = false;
      const q = mentionPopup.query;
      const timer = setTimeout(() => {
        searchLinkableNotesFromDB({
          query: q,
          excludeNoteIds: currentNoteId ? [currentNoteId] : [],
          limit: 12,
        })
          .then((res) => {
            if (!cancelled) setDbMentionMatches(res);
          })
          .catch(() => {});
      }, q ? 60 : 0);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [mentionPopup?.isOpen, mentionPopup?.query, currentNoteId]);

    const mentionCandidates = useMemo(() => {
      if (!mentionPopup?.isOpen) return [];
      const q = mentionPopup.query.trim().toLowerCase();
      const map = new Map<string, Note>();
      const source = dbMentionMatches ? [...dbMentionMatches, ...notes] : notes;
      for (const n of source) {
        if (n.isTrash || n.id === currentNoteId || map.has(n.id)) continue;
        if (q) {
          const titleOk = Boolean(n.title && n.title.toLowerCase().includes(q));
          const catOk = Boolean(n.category && n.category.toLowerCase().includes(q));
          const labelOk = Boolean(n.labels && n.labels.some((l) => l.toLowerCase().includes(q)));
          const contentOk = Boolean(n.content && n.content.toLowerCase().includes(q));
          if (!titleOk && !catOk && !labelOk && !contentOk) continue;
        }
        map.set(n.id, n);
        if (map.size >= 10) break;
      }
      return Array.from(map.values());
    }, [mentionPopup?.isOpen, mentionPopup?.query, dbMentionMatches, notes, currentNoteId]);

    useEffect(() => {
      mentionCandidatesRef.current = mentionCandidates;
      setMentionSelectedIndex(0);
    }, [mentionCandidates]);

    const insertMentionFromPopup = useCallback(
      (target: Note, roleOverride?: NoteConnectionRole) => {
        const activeEditor = editorInstanceRef.current;
        const popup = mentionPopupRef.current;
        const chosenRole = roleOverride || mentionRoleRef.current;
        if (!activeEditor || !popup) return;

        activeEditor
          .chain()
          .focus()
          .deleteRange(popup.range)
          .insertContent([
            {
              type: 'noteMention',
              attrs: {
                noteId: target.id,
                noteTitle: target.title || 'Untitled Note',
                role: chosenRole,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run();

        setMentionPopup(null);
        emitChange(activeEditor.getHTML());
        onNoteMentionSelectedRef.current?.(target, chosenRole);
      },
      [emitChange]
    );

    const createAndLinkFromPopup = useCallback(
      async (rawTitle: string, roleOverride?: NoteConnectionRole) => {
        const trimmed = rawTitle.trim();
        if (!trimmed) return;
        const chosenRole = roleOverride || mentionRoleRef.current;
        const created = await addNote({
          title: trimmed,
          content: '',
          category: defaultCategoryForNewLink !== undefined ? defaultCategoryForNewLink : undefined,
          linkedNoteIds: currentNoteId ? [currentNoteId] : [],
        });
        if (created) {
          insertMentionFromPopup(created, chosenRole);
        }
      },
      [addNote, defaultCategoryForNewLink, currentNoteId, insertMentionFromPopup]
    );

    const insertMentionRef = useRef(insertMentionFromPopup);
    const createAndLinkRef = useRef(createAndLinkFromPopup);
    useEffect(() => {
      insertMentionRef.current = insertMentionFromPopup;
    }, [insertMentionFromPopup]);
    useEffect(() => {
      createAndLinkRef.current = createAndLinkFromPopup;
    }, [createAndLinkFromPopup]);

    const bindNoteMentionIdInEditor = useCallback(
      (noteTitleOrId: string, resolvedNoteId: string): boolean => {
        const activeEditor = editorInstanceRef.current;
        if (!activeEditor || !resolvedNoteId) return false;
        const targetKey = (noteTitleOrId || '').trim().toLowerCase();
        if (!targetKey) return false;

        let modified = false;
        const { tr } = activeEditor.state;
        activeEditor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'noteMention') {
            const curId = (node.attrs.noteId || '').trim();
            const curTitle = (node.attrs.noteTitle || '').trim().toLowerCase();
            if (!curId && curTitle === targetKey) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                noteId: resolvedNoteId,
              });
              modified = true;
            }
          }
        });

        if (modified) {
          activeEditor.view.dispatch(tr);
          emitChange(activeEditor.getHTML());
        }
        return modified;
      },
      [emitChange]
    );

    const evaluateMentionTrigger = useCallback((activeEditor: Editor) => {
      if (!activeEditor.isFocused) {
        return;
      }
      const { selection } = activeEditor.state;
      if (!selection.empty) {
        setMentionPopup(null);
        return;
      }
      const { $from } = selection;
      if ($from.parent.type.name === 'codeBlock') {
        setMentionPopup(null);
        return;
      }
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\uFFFC');
      const textAfter = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, '\n', '\uFFFC');

      // Handle wrapping existing text when user typed ]] first and then [[ before it
      if (
        textBefore.endsWith('[[') &&
        !textBefore.endsWith('[[[') &&
        !activeEditor.isActive('code')
      ) {
        const afterMatch = textAfter.match(/^([^[\]\n\uFFFC]+)\]\]/);
        if (afterMatch) {
          const inner = afterMatch[1];
          const pipeIdx = inner.indexOf('|');
          const noteId = pipeIdx !== -1 ? inner.slice(0, pipeIdx).trim() : '';
          const noteTitle = (pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : inner).trim();
          if (noteTitle) {
            const from = $from.pos - 2;
            const to = $from.pos + afterMatch[0].length;
            setMentionPopup(null);
            activeEditor
              .chain()
              .focus()
              .insertContentAt(
                { from, to },
                {
                  type: 'noteMention',
                  attrs: { noteId, noteTitle, role: 'related' },
                }
              )
              .run();
            emitChange(activeEditor.getHTML());
            return;
          }
        }
      }

      const match = textBefore.match(/\[\[([^\]\n\uFFFC]{0,60})$/);
      if (!match) {
        if (mentionPopupRef.current) setMentionPopup(null);
        return;
      }

      const query = match[1];
      const rangeFrom = $from.pos - match[0].length;
      const rangeTo = $from.pos;

      let top = 120;
      let left = 40;
      let placeAbove = false;
      try {
        const coords = activeEditor.view.coordsAtPos($from.pos);
        const spaceBelow = window.innerHeight - coords.bottom;
        placeAbove = spaceBelow < 280 && coords.top > 280;
        top = placeAbove ? Math.max(12, coords.top - 8) : Math.min(window.innerHeight - 280, coords.bottom + 6);
        left = Math.max(12, Math.min(window.innerWidth - 340, coords.left));
      } catch {
        // ignore coords errors
      }

      setMentionPopup({
        isOpen: true,
        query,
        range: { from: rangeFrom, to: rangeTo },
        coords: { top, left, placeAbove },
      });
    }, [emitChange]);

    const evaluateSlashTrigger = useCallback(
      (activeEditor: Editor) => {
        if (!enableSlashMenu || !activeEditor.isFocused) {
          if (slashPopupRef.current) setSlashPopup(null);
          return;
        }
        const { selection } = activeEditor.state;
        if (!selection.empty) {
          if (slashPopupRef.current) setSlashPopup(null);
          return;
        }
        const { $from } = selection;
        if ($from.parent.type.name === 'codeBlock') {
          if (slashPopupRef.current) setSlashPopup(null);
          return;
        }
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\uFFFC');
        if (/\[\[([^\]\n\uFFFC]{0,60})$/.test(textBefore)) {
          if (slashPopupRef.current) setSlashPopup(null);
          return;
        }

        const slashMatch = textBefore.match(/(?:^|\s)(\/([^\n\/\uFFFC]{0,28}))$/);
        if (!slashMatch) {
          if (slashPopupRef.current) setSlashPopup(null);
          return;
        }

        const query = slashMatch[2];
        // Dismiss immediately if user typed "/ " (e.g. prose separator "yes / no")
        if (query.startsWith(' ')) {
          if (slashPopupRef.current) setSlashPopup(null);
          return;
        }

        const rangeFrom = $from.pos - slashMatch[1].length;
        const rangeTo = $from.pos;

        let coords: SlashAnchorRect = {
          left: 48,
          right: 60,
          top: 120,
          bottom: 142,
        };
        try {
          const c = activeEditor.view.coordsAtPos($from.pos);
          coords = {
            left: c.left,
            right: c.right,
            top: c.top,
            bottom: c.bottom,
          };
        } catch {
          // ignore coords errors
        }

        setSlashPopup({
          isOpen: true,
          query,
          range: { from: rangeFrom, to: rangeTo },
          coords,
        });
      },
      [enableSlashMenu]
    );

    const executeSlashCommand = useCallback(
      (item: SlashCommandItem) => {
        const activeEditor = editorInstanceRef.current;
        const popup = slashPopupRef.current;
        if (!activeEditor || !popup) return;

        const anchorRect = popup.coords;
        const { from, to } = popup.range;
        setSlashPopup(null);
        slashPopupRef.current = null;

        if (item.id === 'wiki-link') {
          activeEditor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent('[[')
            .run();
          emitChange(activeEditor.getHTML());
          evaluateMentionTrigger(activeEditor);
          return;
        }

        if (item.id === 'subpage' && onCreateInlineSubpageRef.current) {
          activeEditor.chain().deleteRange({ from, to }).run();
          emitChange(activeEditor.getHTML());
          const clampedPos = Math.max(0, Math.min(from, activeEditor.state.doc.content.size));
          let coords = anchorRect;
          try {
            const c = activeEditor.view.coordsAtPos(
              Math.max(1, Math.min(clampedPos, activeEditor.state.doc.content.size))
            );
            if (c && (c.top > 0 || c.left > 0)) {
              coords = { left: c.left, right: c.right, top: c.top, bottom: c.bottom };
            }
          } catch {
            // fallback to slash anchorRect
          }
          const nextCreator: SubpageCreatorState = {
            isOpen: true,
            insertPos: clampedPos,
            coords,
          };
          subpageCreatorRef.current = nextCreator;
          setSubpageTitleInput('');
          setSubpageSelectedIdx(-1);
          setSubpageCreator(nextCreator);
          setTimeout(() => {
            subpageInputRef.current?.focus();
          }, 15);
          return;
        }

        if (item.kind === 'note') {
          activeEditor.chain().focus().deleteRange({ from, to }).run();
          emitChange(activeEditor.getHTML());
          onSlashNoteActionRef.current?.(item.id as SlashNoteActionId, anchorRect);
          return;
        }

        const chain = activeEditor.chain().focus().deleteRange({ from, to });
        switch (item.id) {
          case 'text':
            chain.clearNodes().setParagraph().run();
            break;
          case 'h1':
            chain.toggleHeading({ level: 1 }).run();
            break;
          case 'h2':
            chain.toggleHeading({ level: 2 }).run();
            break;
          case 'h3':
            chain.toggleHeading({ level: 3 }).run();
            break;
          case 'h4':
            chain.toggleHeading({ level: 4 }).run();
            break;
          case 'bullet-list':
            chain.toggleBulletList().run();
            break;
          case 'number-list':
            chain.toggleOrderedList().run();
            break;
          case 'task-list':
            chain.toggleTaskList().run();
            break;
          case 'quote':
            chain.toggleBlockquote().run();
            break;
          case 'divider':
            chain.setHorizontalRule().run();
            break;
          case 'code-block':
            chain.toggleCodeBlock().run();
            break;
          case 'table':
            chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            break;
          case 'dataview':
            chain
              .insertContent({
                type: 'dataview',
                attrs: {
                  query: 'NOTION\nWHERE !isArchived\nSORT updatedAt DESC\nLIMIT 10',
                },
              })
              .run();
            break;
          case 'bold':
            chain.toggleBold().run();
            break;
          case 'italic':
            chain.toggleItalic().run();
            break;
          case 'underline':
            chain.toggleUnderline().run();
            break;
          case 'inline-code':
            chain.toggleCode().run();
            break;
          case 'clear-format':
            chain.unsetAllMarks().clearNodes().run();
            break;
        }
        emitChange(activeEditor.getHTML());
      },
      [evaluateMentionTrigger, emitChange]
    );

    useEffect(() => {
      executeSlashRef.current = executeSlashCommand;
    }, [executeSlashCommand]);

    // Convert any raw markdown to proper HTML for initial Tiptap load
    const initialHtml = convertMarkdownToHtml(content);

    const processAndInsertFiles = useCallback(
      async (files: File[], imageUrls: string[] = []) => {
        if (files.length === 0 && imageUrls.length === 0) return;

        const mhtmlFiles = files.filter((f) =>
          f.name.toLowerCase().endsWith('.mhtml') ||
          f.name.toLowerCase().endsWith('.mht') ||
          f.type.includes('message/rfc822') ||
          f.type.includes('multipart/related')
        );
        const regularFiles = files.filter((f) => !mhtmlFiles.includes(f));

        for (const mf of mhtmlFiles) {
          try {
            await importMhtmlIntoNote({
              file: mf,
              onInsertEditorContent: (html) => {
                editorInstanceRef.current?.chain().focus().insertContent(html).run();
              },
            });
          } catch (err) {
            console.warn('Failed inserting MHTML into WYSIWYG editor:', err);
          }
        }

        if (regularFiles.length === 0 && imageUrls.length === 0) return;

        try {
          setIsCopyingFiles(true);
          // Synchronously starts FormData upload before any await
          const savedFiles = await copyFilesToLocalFolder(regularFiles, undefined, imageUrls);
          const activeEditor = editorInstanceRef.current;

          if (savedFiles.length > 0 && activeEditor) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nodesToInsert: any[] = [];
            const imageBatch: GalleryImageItem[] = [];

            const flushImageBatch = () => {
              if (imageBatch.length >= 2) {
                nodesToInsert.push({
                  type: 'imageGallery',
                  attrs: { images: [...imageBatch] },
                });
                nodesToInsert.push({ type: 'paragraph' });
              } else if (imageBatch.length === 1) {
                const single = imageBatch[0];
                nodesToInsert.push({
                  type: 'image',
                  attrs: {
                    src: single.src,
                    alt: single.alt,
                    title: single.title,
                  },
                });
                nodesToInsert.push({ type: 'paragraph' });
              }
              imageBatch.length = 0;
            };

            for (const file of savedFiles) {
              if (file.isImage) {
                imageBatch.push({
                  src: file.serveUrl,
                  alt: file.fileName,
                  title: file.savedPath,
                });
              } else {
                flushImageBatch();
                nodesToInsert.push({
                  type: 'keepMedia',
                  attrs: {
                    isImage: false,
                    fileName: file.fileName,
                    savedPath: file.savedPath,
                    serveUrl: file.serveUrl,
                    markdownLink: file.markdownLink,
                    fileSize: file.size,
                  },
                });
                nodesToInsert.push({
                  type: 'paragraph',
                });
              }
            }
            flushImageBatch();

            activeEditor.chain().focus().insertContent(nodesToInsert).run();
            emitChange(activeEditor.getHTML());
          }
        } catch (err) {
          console.error('Failed to paste and copy files to local folder:', err);
        } finally {
          setIsCopyingFiles(false);
        }
      },
      [emitChange]
    );

    const handleClipboardDataTransfer = useCallback(
      (
        clipboardData: DataTransfer | null,
        rawEvent: Event | React.SyntheticEvent
      ): boolean => {
        const nativeEvt = ('nativeEvent' in rawEvent ? rawEvent.nativeEvent : rawEvent) as Event & {
          __keepPasteHandled?: boolean;
        };
        if (nativeEvt.__keepPasteHandled) return true;

        const { files, imageUrls } = extractClipboardPayload(clipboardData);
        if (files.length > 0 || imageUrls.length > 0) {
          nativeEvt.__keepPasteHandled = true;
          rawEvent.preventDefault();
          if ('stopPropagation' in rawEvent) {
            rawEvent.stopPropagation();
          }
          processAndInsertFiles(files, imageUrls);
          return true;
        }

        const activeEditor = editorInstanceRef.current;
        const plainText = clipboardData?.getData('text/plain');

        if (activeEditor && activeEditor.isFocused && plainText) {
          const isInsideCodeBlock =
            activeEditor.isActive('codeBlock') ||
            activeEditor.state.selection.$from.parent.type.name === 'codeBlock';

          if (isInsideCodeBlock) {
            nativeEvt.__keepPasteHandled = true;
            rawEvent.preventDefault();
            if ('stopPropagation' in rawEvent) {
              rawEvent.stopPropagation();
            }
            const { from, to } = activeEditor.state.selection;
            activeEditor.view.dispatch(activeEditor.state.tr.insertText(plainText, from, to));
            emitChange(activeEditor.getHTML());
            return true;
          }
        }

        const htmlText = clipboardData?.getData('text/html');

        const isHtmlPayload = Boolean(
          (plainText && /<(?:p|h[1-6]|ul|ol|li|table|div|blockquote|b|strong|i|em|a|code|pre|hr|span)[^>]*>/i.test(plainText)) ||
          (htmlText && !/<meta/i.test(htmlText) && /<(?:p|h[1-6]|ul|ol|li|table|div|blockquote|b|strong|i|em|a|code|pre|hr)[^>]*>/i.test(htmlText))
        );

        if (isHtmlPayload) {
          const rawHtml = (plainText && /<[a-z][\s\S]*>/i.test(plainText))
            ? plainText
            : (htmlText || plainText || '');
          const markdown = convertHtmlToMarkdown(rawHtml);
          const html = convertMarkdownToHtml(markdown);

          if (activeEditor) {
            nativeEvt.__keepPasteHandled = true;
            rawEvent.preventDefault();
            if ('stopPropagation' in rawEvent) {
              rawEvent.stopPropagation();
            }
            activeEditor.chain().focus().insertContent(html).run();
            emitChange(activeEditor.getHTML());
            return true;
          }
        }

        if (
          plainText &&
          (/(?:^|\n)\s*```/.test(plainText) ||
            /(?:^|\n)\s*#{1,4}\s+/.test(plainText) ||
            /(?:^|\n)\s*[-*+]\s+\[[ xX]\]/.test(plainText) ||
            /(?:^|\n)\s*[-*+]\s+/.test(plainText) ||
            (plainText.includes('|') && /\|?\s*:?-+:?\s*\|/.test(plainText)) ||
            /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/.test(plainText))
        ) {
          if (activeEditor) {
            nativeEvt.__keepPasteHandled = true;
            rawEvent.preventDefault();
            if ('stopPropagation' in rawEvent) {
              rawEvent.stopPropagation();
            }
            let html = convertMarkdownToHtml(plainText);
            if (!plainText.includes('\n') && /^<p>[\s\S]*<\/p>$/.test(html) && (html.match(/<p>/g) || []).length === 1) {
              html = html.slice(3, -4);
            }
            activeEditor.chain().focus().insertContent(html).run();
            emitChange(activeEditor.getHTML());
            return true;
          }
        }

        if (plainText) {
          if (activeEditor) {
            nativeEvt.__keepPasteHandled = true;
            rawEvent.preventDefault();
            if ('stopPropagation' in rawEvent) {
              rawEvent.stopPropagation();
            }
            activeEditor.chain().focus().insertContent(plainText).run();
            emitChange(activeEditor.getHTML());
            return true;
          }
        }

        return false;
      },
      [processAndInsertFiles, emitChange]
    );

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4],
          },
          codeBlock: false,
        }),
        CodeBlock.extend({
          addInputRules() {
            return [
              textblockTypeInputRule({
                find: /^(`{3,}|~{3,})([a-zA-Z0-9_#+-]*)\s$/,
                type: this.type,
                getAttributes: (match) => ({ language: match[2] || '' }),
              }),
            ];
          },
          parseHTML() {
            return [
              { tag: 'pre', preserveWhitespace: 'full' },
              { tag: 'div.notion-code-block', preserveWhitespace: 'full' },
              { tag: 'div.notion-code', preserveWhitespace: 'full' },
              { tag: 'div[class*="notion-code"]', preserveWhitespace: 'full' },
              { tag: 'div[class*="code-block"]', preserveWhitespace: 'full' },
              { tag: 'div[class*="codeblock"]', preserveWhitespace: 'full' },
              { tag: 'div[class*="highlight"]', preserveWhitespace: 'full' },
            ];
          },
        }),
        Table.configure({
          resizable: false,
          HTMLAttributes: {
            class: 'keep-table',
          },
        }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Image.extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              ungrouped: {
                default: false,
                parseHTML: (el) => el.getAttribute('data-ungrouped') === 'true',
                renderHTML: (attrs) => (attrs.ungrouped ? { 'data-ungrouped': 'true' } : {}),
              },
            };
          },
        }).configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
            class: 'rounded-xl max-h-96 w-auto my-2 border border-black/10 dark:border-white/10 shadow-xs cursor-pointer',
          },
        }),
        ImageGalleryExtension,
        KeepMediaExtension,
        DataviewExtension,
        NoteMentionExtension.configure({
          onOpenNote: async (noteIdOrTitle, fallbackTitle) => {
            if (onOpenMentionedNoteRef.current) {
              onOpenMentionedNoteRef.current(noteIdOrTitle, fallbackTitle);
              return;
            }
            const res = await resolveOrCreateLinkedNote(noteIdOrTitle, {
              fallbackTitle,
              category: defaultCategoryForNewLink !== undefined ? defaultCategoryForNewLink : undefined,
            });
            if (res) {
              bindNoteMentionIdInEditor(fallbackTitle || noteIdOrTitle, res.note.id);
              if (res.created && currentNoteId) {
                await connectNotes(currentNoteId, res.note.id, 'related');
              }
              setEditingNote(res.note);
            }
          },
        }),
        SubpageBlockExtension.configure({
          onOpenSubpage: async (noteIdOrTitle) => {
            if (onOpenMentionedNoteRef.current) {
              onOpenMentionedNoteRef.current(noteIdOrTitle);
              return;
            }
            const res = await resolveOrCreateLinkedNote(noteIdOrTitle);
            if (res) setEditingNote(res.note);
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: initialHtml,
      autofocus: autoFocus ? 'end' : false,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        emitChange(editor.getHTML());
        evaluateMentionTrigger(editor);
        evaluateSlashTrigger(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        evaluateMentionTrigger(editor);
        evaluateSlashTrigger(editor);
      },
      editorProps: {
        attributes: {
          class: `w-full ${minHeightClass} outline-none text-stone-800 dark:text-stone-200 leading-relaxed`,
        },
        handleKeyDown: (view, event) => {
          // Guard NodeSelection on subpageBlock/imageGallery so Enter or typing moves to a paragraph below instead of overwriting
          const sel = view.state.selection;
          if (
            sel instanceof NodeSelection &&
            (sel.node?.type.name === 'subpageBlock' || sel.node?.type.name === 'imageGallery')
          ) {
            if (
              event.key === 'Enter' ||
              (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
            ) {
              const afterPos = sel.to;
              const paraType = view.state.schema.nodes.paragraph;
              if (paraType) {
                const $after = view.state.doc.resolve(afterPos);
                const nextNode = $after.nodeAfter;
                let tr = view.state.tr;
                if (!nextNode || nextNode.type.name !== 'paragraph') {
                  tr = tr.insert(afterPos, paraType.create());
                }
                const targetCursor = Math.min(afterPos + 1, tr.doc.content.size);
                tr = tr.setSelection(TextSelection.near(tr.doc.resolve(targetCursor), 1));
                view.dispatch(tr.scrollIntoView());
                if (event.key === 'Enter') {
                  event.preventDefault();
                  return true;
                }
              }
            }
          }

          const activePopup = mentionPopupRef.current;
          if (activePopup?.isOpen) {
            const cands = mentionCandidatesRef.current;
            const hasCreateOption = Boolean(activePopup.query.trim());
            const totalItems = cands.length + (hasCreateOption ? 1 : 0);

            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setMentionPopup(null);
              return true;
            }
            if (event.key === 'ArrowDown') {
              if (totalItems > 0) {
                event.preventDefault();
                setMentionSelectedIndex((prev) => (prev + 1) % totalItems);
              }
              return true;
            }
            if (event.key === 'ArrowUp') {
              if (totalItems > 0) {
                event.preventDefault();
                setMentionSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
              }
              return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              const idx = mentionSelectedIndexRef.current;
              if (idx >= 0 && idx < cands.length) {
                event.preventDefault();
                insertMentionRef.current(cands[idx]);
                return true;
              }
              if (hasCreateOption && idx === cands.length) {
                event.preventDefault();
                createAndLinkRef.current(activePopup.query);
                return true;
              }
            }
          }

          const activeSlash = slashPopupRef.current;
          if (activeSlash?.isOpen) {
            const cands = slashCandidatesRef.current;
            const totalItems = cands.length;

            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setSlashPopup(null);
              slashPopupRef.current = null;
              return true;
            }
            if (event.key === 'ArrowDown') {
              if (totalItems > 0) {
                event.preventDefault();
                setSlashSelectedIndex((prev) => (prev + 1) % totalItems);
              }
              return true;
            }
            if (event.key === 'ArrowUp') {
              if (totalItems > 0) {
                event.preventDefault();
                setSlashSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
              }
              return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              const idx = slashSelectedIndexRef.current;
              const target = cands[idx] || cands[0];
              if (target) {
                event.preventDefault();
                executeSlashRef.current(target);
                return true;
              }
            }
          }

          if (event.key === 'Tab' && view.state.selection.$from.parent.type.name === 'codeBlock') {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText('  '));
            return true;
          }

          if (event.key === 'Enter') {
            const { selection } = view.state;
            const { $from } = selection;
            if ($from.parent.type.name === 'paragraph') {
              const text = $from.parent.textContent;
              const match = text.match(/^(`{3,}|~{3,})([a-zA-Z0-9_#+-]*)$/);
              if (match) {
                event.preventDefault();
                const lang = match[2] || '';
                if (lang.toLowerCase() === 'dataview' || lang.toLowerCase() === 'dataviewjs' || lang.toLowerCase() === 'notion') {
                  const dataviewType = view.state.schema.nodes.dataview;
                  if (dataviewType) {
                    const from = $from.start();
                    const to = $from.end();
                    view.dispatch(
                      view.state.tr
                        .replaceWith(from, to, dataviewType.create({ query: 'NOTION\nWHERE !isArchived\nSORT updatedAt DESC\nLIMIT 10' }))
                    );
                    return true;
                  }
                }

                const codeBlockType = view.state.schema.nodes.codeBlock;
                if (codeBlockType) {
                  const from = $from.start();
                  const to = $from.end();
                  view.dispatch(
                    view.state.tr
                      .setBlockType(from, to, codeBlockType, { language: lang })
                      .delete(from, to)
                  );
                  return true;
                }
              }
            }
          }

          return false;
        },
        handlePaste: (view, event) => {
          if (view.state.selection.$from.parent.type.name === 'codeBlock') {
            const text = event.clipboardData?.getData('text/plain');
            if (text) {
              event.preventDefault();
              const { from, to } = view.state.selection;
              view.dispatch(view.state.tr.insertText(text, from, to));
              if (editorInstanceRef.current) {
                emitChange(editorInstanceRef.current.getHTML());
              }
              return true;
            }
          }
          return handleClipboardDataTransfer(event.clipboardData, event);
        },
        handleDrop: (_view, event) => {
          return handleClipboardDataTransfer(event.dataTransfer, event);
        },
      },
    });

    useEffect(() => {
      editorInstanceRef.current = editor;
    }, [editor]);

    // Global window paste listener when this editor is active
    useEffect(() => {
      if (!listenWindowPaste) return;

      const onWindowPaste = (e: ClipboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            (target.isContentEditable && !target.closest('.ProseMirror')))
        ) {
          return;
        }

        handleClipboardDataTransfer(e.clipboardData, e);
      };

      window.addEventListener('paste', onWindowPaste);
      return () => {
        window.removeEventListener('paste', onWindowPaste);
      };
    }, [listenWindowPaste, handleClipboardDataTransfer]);

    // Synchronize external content changes (e.g. switching notes or restoring versions)
    useEffect(() => {
      if (editor) {
        if (content === lastEmittedHtmlRef.current) {
          return;
        }
        const currentHtml = editor.getHTML();
        if (content !== currentHtml) {
          if (
            !content.trim() &&
            editor.getText().trim() === '' &&
            !currentHtml.includes('data-keep-media') &&
            !currentHtml.includes('data-keep-subpage')
          ) {
            return;
          }

          const converted = convertMarkdownToHtml(content);
          if (converted !== currentHtml) {
            lastEmittedHtmlRef.current = content;
            editor.commands.setContent(converted, { emitUpdate: false });
          }
        }
      }
    }, [content, editor]);

    const handleFormat = (cmd: GoogleKeepFormatCommand) => {
      if (!editor) return;

      switch (cmd) {
        case 'h1':
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case 'h2':
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case 'normal':
          editor.chain().focus().setParagraph().run();
          break;
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'underline':
          editor.chain().focus().toggleUnderline().run();
          break;
        case 'bullet-list':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'number-list':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'checkbox-list':
          editor.chain().focus().toggleTaskList().run();
          break;
        case 'code':
          editor.chain().focus().toggleCode().run();
          break;
        case 'code-block':
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case 'dataview':
          editor.chain().focus().insertContent({
            type: 'dataview',
            attrs: {
              query: 'NOTION\nWHERE !isArchived\nSORT updatedAt DESC\nLIMIT 10',
            },
          }).run();
          break;
        case 'clear':
          editor.chain().focus().unsetAllMarks().clearNodes().run();
          break;
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        handleFormat,
        focus: () => editor?.commands.focus(),
        getHTML: () => editor?.getHTML() || '',
        insertLocalFiles: processAndInsertFiles,
        insertContent: (text: string) => editor?.commands.insertContent(text),
        insertNoteMention: (target) => {
          if (!editor) return;
          editor
            .chain()
            .focus()
            .insertContent([
              {
                type: 'noteMention',
                attrs: {
                  noteId: target.id,
                  noteTitle: target.title || 'Untitled Note',
                  role: target.role || 'related',
                },
              },
              { type: 'text', text: ' ' },
            ])
            .run();
          emitChange(editor.getHTML());
        },
        bindNoteMentionId: bindNoteMentionIdInEditor,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [editor, processAndInsertFiles, emitChange, bindNoteMentionIdInEditor]
    );

    return (
      <div
        className={`w-full flex flex-col relative ${className}`}
        onDropCapture={(e) => {
          handleClipboardDataTransfer(e.dataTransfer, e);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
          }
        }}
      >
        {/* Copying indicator badge */}
        {isCopyingFiles && (
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-medium w-fit animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Copying pasted file(s) to local folder…
          </div>
        )}

        {/* WYSIWYG Editable Canvas */}
        <div
          ref={editorCanvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => {
            if (!isDraggingBlockRef.current) {
              hideHoverTimerRef.current = setTimeout(() => setHoveredBlock(null), 150);
            }
          }}
          className="flex-1 py-1 cursor-text relative"
          onClick={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest?.('[data-keep-subpage="true"], [data-note-mention="true"], [data-block-drag-handle="true"], [data-keep-gallery-ui="true"]')) {
              return;
            }
            editor?.commands.focus();
          }}
        >
          {hoveredBlock && !blockDragState && (
            <button
              type="button"
              data-block-drag-handle="true"
              data-block-index={hoveredBlock.index}
              title={`Drag to move "${hoveredBlock.label}" up or down`}
              onMouseEnter={() => {
                if (hideHoverTimerRef.current) {
                  clearTimeout(hideHoverTimerRef.current);
                  hideHoverTimerRef.current = null;
                }
              }}
              onMouseLeave={() => {
                hideHoverTimerRef.current = setTimeout(() => setHoveredBlock(null), 120);
              }}
              onPointerDown={(e) => startBlockDrag(hoveredBlock.index, hoveredBlock.label, e)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={{ top: `${Math.max(0, hoveredBlock.top + 2)}px` }}
              className="absolute -left-4 sm:-left-7 z-20 w-5 h-6 flex items-center justify-center rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-grab active:cursor-grabbing transition-colors select-none touch-none"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}

          {blockDragState && (
            <div
              data-block-drop-indicator="true"
              style={{ top: `${blockDragState.indicatorTop}px` }}
              className="pointer-events-none absolute left-0 right-0 z-30 flex items-center"
            >
              <div className="w-2 h-2 -ml-1 rounded-full bg-blue-500 shadow-xs" />
              <div className="flex-1 h-[2px] bg-blue-500 shadow-xs" />
            </div>
          )}

          <EditorContent editor={editor} />
        </div>

        {/* Embedded formatting toolbar if opened */}
        {isFormattingOpen && (
          <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5">
            <KeepFormattingBar onFormat={handleFormat} />
          </div>
        )}

        {/* / Slash Command Floating Menu */}
        {slashPopup?.isOpen && !mentionPopup?.isOpen && (
          <SlashCommandMenu
            query={slashPopup.query}
            items={slashCandidates}
            selectedIndex={slashSelectedIndex}
            coords={slashPopup.coords}
            flags={slashContextFlags}
            onSelect={executeSlashCommand}
            onHoverIndex={setSlashSelectedIndex}
            onClose={() => {
              setSlashPopup(null);
              slashPopupRef.current = null;
              editor?.commands.focus();
            }}
          />
        )}

        {/* Cursor-anchored Inline Sub-page Creator Portal */}
        {typeof document !== 'undefined' &&
          subpageCreator?.isOpen &&
          createPortal(
            <div
              data-subpage-menu="true"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: `${Math.max(12, Math.min(subpageCreator.coords.left, window.innerWidth - 340))}px`,
                top:
                  window.innerHeight - subpageCreator.coords.bottom < 240 &&
                  subpageCreator.coords.top > 240
                    ? undefined
                    : `${Math.min(window.innerHeight - 240, subpageCreator.coords.bottom + 6)}px`,
                bottom:
                  window.innerHeight - subpageCreator.coords.bottom < 240 &&
                  subpageCreator.coords.top > 240
                    ? `${window.innerHeight - subpageCreator.coords.top + 6}px`
                    : undefined,
                zIndex: 130,
              }}
              className="w-[330px] max-w-[92vw] rounded-xl bg-white dark:bg-[#202124] border border-black/[0.08] dark:border-stone-700/80 shadow-2xl overflow-hidden text-stone-800 dark:text-stone-200 animate-in fade-in duration-100"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (subpageSelectedIdx >= 0 && subpageSelectedIdx < subpageCandidates.length) {
                    commitInlineSubpage({ existingNote: subpageCandidates[subpageSelectedIdx] });
                    return;
                  }
                  const raw = (subpageInputRef.current?.value ?? subpageTitleInput).trim() || 'Untitled';
                  commitInlineSubpage({ title: raw });
                }}
                className="flex items-center gap-2 px-2.5 py-2 border-b border-black/[0.06] dark:border-white/[0.07]"
              >
                <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  ref={subpageInputRef}
                  type="text"
                  autoFocus
                  placeholder="New sub-page title or search..."
                  value={subpageTitleInput}
                  onChange={(e) => {
                    setSubpageTitleInput(e.target.value);
                    setSubpageSelectedIdx(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      const pos = subpageCreator.insertPos;
                      subpageCreatorRef.current = null;
                      setSubpageCreator(null);
                      setSubpageTitleInput('');
                      setSubpageSelectedIdx(-1);
                      editorInstanceRef.current?.chain().focus(pos).run();
                    } else if (e.key === 'ArrowDown') {
                      if (subpageCandidates.length > 0) {
                        e.preventDefault();
                        setSubpageSelectedIdx((prev) =>
                          prev < subpageCandidates.length - 1 ? prev + 1 : -1
                        );
                      }
                    } else if (e.key === 'ArrowUp') {
                      if (subpageCandidates.length > 0) {
                        e.preventDefault();
                        setSubpageSelectedIdx((prev) =>
                          prev > -1 ? prev - 1 : subpageCandidates.length - 1
                        );
                      }
                    }
                  }}
                  className="flex-1 min-w-0 bg-transparent text-[13.5px] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-none border-none"
                />
                <button
                  type="submit"
                  onMouseDown={(e) => e.preventDefault()}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 transition-colors shrink-0 cursor-pointer"
                >
                  {subpageSelectedIdx >= 0 ? 'Link' : 'Add'}
                </button>
              </form>

              {subpageCandidates.length > 0 && (
                <div className="max-h-48 overflow-y-auto divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                  <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-stone-400">
                    Link existing page
                  </div>
                  {subpageCandidates.map((cand, idx) => {
                    const active = subpageSelectedIdx === idx;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          commitInlineSubpage({ existingNote: cand });
                        }}
                        className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                          active
                            ? 'bg-black/[0.05] dark:bg-white/[0.08] text-stone-900 dark:text-white'
                            : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate flex-1">{cand.title || 'Untitled'}</span>
                        <span className="text-[10px] text-stone-400">Link ↵</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="px-2.5 py-1.5 bg-stone-50/70 dark:bg-stone-900/40 text-[11px] text-stone-400 flex items-center justify-between">
                <span>Adds sub-page right at cursor</span>
                <span className="font-mono text-[10px]">esc</span>
              </div>
            </div>,
            document.body
          )}

        {/* [[ Wiki-Link Live Autocomplete Portal */}
        {typeof document !== 'undefined' &&
          mentionPopup?.isOpen &&
          createPortal(
            <div
              data-mention-menu="true"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: `${mentionPopup.coords.left}px`,
                top: mentionPopup.coords.placeAbove ? undefined : `${mentionPopup.coords.top}px`,
                bottom: mentionPopup.coords.placeAbove
                  ? `${window.innerHeight - mentionPopup.coords.top}px`
                  : undefined,
                zIndex: 130,
              }}
              className="w-[320px] max-w-[92vw] rounded-2xl bg-white dark:bg-[#202124] border border-stone-200 dark:border-stone-700 shadow-2xl overflow-hidden text-stone-800 dark:text-stone-200 animate-in fade-in duration-100"
            >
              {/* Header + Quick Role Selector */}
              <div className="px-3 py-2 bg-stone-50 dark:bg-stone-900/60 border-b border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Link note {mentionPopup.query ? `matching "${mentionPopup.query}"` : ''}</span>
                  </span>
                  <span className="text-[10px] font-normal text-stone-400">↑↓ Enter • Esc</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {CONNECTION_ROLES_ORDER.map((r) => {
                    const meta = CONNECTION_ROLE_META[r];
                    const active = mentionRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMentionRole(r);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors cursor-pointer ${
                          active
                            ? meta.badgeClass + ' font-semibold shadow-2xs'
                            : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                        }`}
                      >
                        <span>{meta.emoji}</span>
                        <span>{meta.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Candidate Notes List */}
              <div className="max-h-56 overflow-y-auto divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {mentionCandidates.map((cand, idx) => {
                  const active = mentionSelectedIndex === idx;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        insertMentionFromPopup(cand);
                      }}
                      onMouseEnter={() => setMentionSelectedIndex(idx)}
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-950 dark:text-amber-100'
                          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="text-stone-400 shrink-0">
                        {cand.isHub ? (
                          <span className="text-xs">🏠</span>
                        ) : cand.isList ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {cand.title || 'Untitled Note'}
                        </div>
                        {cand.category && (
                          <div className="text-[10px] text-stone-400 truncate">{cand.category}</div>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                        ↵
                      </span>
                    </button>
                  );
                })}

                {mentionCandidates.length === 0 && !mentionPopup.query.trim() && (
                  <div className="px-3 py-4 text-center text-xs text-stone-400">
                    Type a note title to search or create…
                  </div>
                )}

                {mentionPopup.query.trim() && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      createAndLinkFromPopup(mentionPopup.query);
                    }}
                    onMouseEnter={() => setMentionSelectedIndex(mentionCandidates.length)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer ${
                      mentionSelectedIndex === mentionCandidates.length
                        ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 font-semibold'
                        : 'bg-stone-50/70 dark:bg-stone-900/40 text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">
                      Create &amp; link &ldquo;{mentionPopup.query.trim()}&rdquo;
                    </span>
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);

KeepWysiwygEditor.displayName = 'KeepWysiwygEditor';
