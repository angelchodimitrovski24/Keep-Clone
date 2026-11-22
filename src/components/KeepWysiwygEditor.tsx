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
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { KeepFormattingBar } from './KeepFormattingBar';
import { GoogleKeepFormatCommand, convertMarkdownToHtml, convertHtmlToMarkdown } from '@/lib/formatUtils';
import { KeepMediaExtension } from '@/lib/keepMediaExtension';
import { DataviewExtension } from '@/lib/dataviewExtension';
import { NoteMentionExtension } from '@/lib/noteMentionExtension';
import { Note, NoteConnectionRole } from '@/types/note';
import { CONNECTION_ROLE_META, CONNECTION_ROLES_ORDER } from '@/lib/noteGraph';
import { searchLinkableNotesFromDB } from '@/lib/db';
import { useKeep } from '@/context/KeepContext';
import { importMhtmlIntoNote } from '@/lib/mhtmlParser';
import {
  extractClipboardPayload,
  copyFilesToLocalFolder,
} from '@/lib/localPaste';
import { Loader2, Link2, Plus, FileText, CheckSquare } from 'lucide-react';

export interface KeepWysiwygEditorHandle {
  handleFormat: (cmd: GoogleKeepFormatCommand) => void;
  focus: () => void;
  getHTML: () => string;
  insertLocalFiles: (files: File[], imageUrls?: string[]) => Promise<void>;
  insertContent: (text: string) => void;
  insertNoteMention: (target: { id: string; title: string; role?: NoteConnectionRole }) => void;
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
  onOpenMentionedNote?: (noteIdOrTitle: string) => void;
  onNoteMentionSelected?: (targetNote: Note, role: NoteConnectionRole) => void;
}

interface MentionPopupState {
  isOpen: boolean;
  query: string;
  range: { from: number; to: number };
  coords: { top: number; left: number; placeAbove: boolean };
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
    },
    ref
  ) => {
    const {
      notes,
      addNote,
      resolveNoteByTitleOrId,
      setEditingNote,
    } = useKeep();

    const [isCopyingFiles, setIsCopyingFiles] = useState(false);
    const editorInstanceRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const onOpenMentionedNoteRef = useRef(onOpenMentionedNote);
    const onNoteMentionSelectedRef = useRef(onNoteMentionSelected);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onOpenMentionedNoteRef.current = onOpenMentionedNote;
    }, [onOpenMentionedNote]);

    useEffect(() => {
      onNoteMentionSelectedRef.current = onNoteMentionSelected;
    }, [onNoteMentionSelected]);

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
        onChangeRef.current(activeEditor.getHTML());
        onNoteMentionSelectedRef.current?.(target, chosenRole);
      },
      []
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
    }, []);

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

            for (const file of savedFiles) {
              if (file.isImage) {
                nodesToInsert.push({
                  type: 'image',
                  attrs: {
                    src: file.serveUrl,
                    alt: file.fileName,
                    title: file.savedPath,
                  },
                });
                nodesToInsert.push({
                  type: 'paragraph',
                });
              } else {
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

            activeEditor.chain().focus().insertContent(nodesToInsert).run();
            onChangeRef.current(activeEditor.getHTML());
          }
        } catch (err) {
          console.error('Failed to paste and copy files to local folder:', err);
        } finally {
          setIsCopyingFiles(false);
        }
      },
      []
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
            onChangeRef.current(activeEditor.getHTML());
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
            onChangeRef.current(activeEditor.getHTML());
            return true;
          }
        }

        if (
          plainText &&
          (/(?:^|\n)\s*```/.test(plainText) ||
            /(?:^|\n)\s*#{1,4}\s+/.test(plainText) ||
            /(?:^|\n)\s*[-*+]\s+\[[ xX]\]/.test(plainText) ||
            /(?:^|\n)\s*[-*+]\s+/.test(plainText) ||
            (plainText.includes('|') && /\|?\s*:?-+:?\s*\|/.test(plainText)))
        ) {
          if (activeEditor) {
            nativeEvt.__keepPasteHandled = true;
            rawEvent.preventDefault();
            if ('stopPropagation' in rawEvent) {
              rawEvent.stopPropagation();
            }
            const html = convertMarkdownToHtml(plainText);
            activeEditor.chain().focus().insertContent(html).run();
            onChangeRef.current(activeEditor.getHTML());
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
            onChangeRef.current(activeEditor.getHTML());
            return true;
          }
        }

        return false;
      },
      [processAndInsertFiles]
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
        Image.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
            class: 'rounded-xl max-h-96 w-auto my-2 border border-black/10 dark:border-white/10 shadow-xs cursor-pointer',
          },
        }),
        KeepMediaExtension,
        DataviewExtension,
        NoteMentionExtension.configure({
          onOpenNote: async (noteIdOrTitle) => {
            if (onOpenMentionedNoteRef.current) {
              onOpenMentionedNoteRef.current(noteIdOrTitle);
              return;
            }
            const found = await resolveNoteByTitleOrId(noteIdOrTitle);
            if (found) setEditingNote(found);
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
        onChangeRef.current(editor.getHTML());
        evaluateMentionTrigger(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        evaluateMentionTrigger(editor);
      },
      editorProps: {
        attributes: {
          class: `w-full ${minHeightClass} outline-none text-stone-800 dark:text-stone-200 leading-relaxed`,
        },
        handleKeyDown: (view, event) => {
          const activePopup = mentionPopupRef.current;
          if (activePopup?.isOpen) {
            const cands = mentionCandidatesRef.current;
            const hasCreateOption = Boolean(activePopup.query.trim());
            const totalItems = cands.length + (hasCreateOption ? 1 : 0);

            if (event.key === 'Escape') {
              event.preventDefault();
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
                onChangeRef.current(editorInstanceRef.current.getHTML());
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

    // Synchronize external content changes (e.g. switching notes)
    useEffect(() => {
      if (editor) {
        const currentHtml = editor.getHTML();
        if (content !== currentHtml) {
          if (
            !content.trim() &&
            editor.getText().trim() === '' &&
            !currentHtml.includes('data-keep-media')
          ) {
            return;
          }

          const converted = convertMarkdownToHtml(content);
          if (converted !== currentHtml) {
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
          onChangeRef.current(editor.getHTML());
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [editor, processAndInsertFiles]
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
        <div className="flex-1 py-1 cursor-text" onClick={() => editor?.commands.focus()}>
          <EditorContent editor={editor} />
        </div>

        {/* Embedded formatting toolbar if opened */}
        {isFormattingOpen && (
          <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5">
            <KeepFormattingBar onFormat={handleFormat} />
          </div>
        )}

        {/* [[ Wiki-Link Live Autocomplete Portal */}
        {typeof document !== 'undefined' &&
          mentionPopup?.isOpen &&
          createPortal(
            <div
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
