'use client';

import React, {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { KeepFormattingBar } from './KeepFormattingBar';
import { GoogleKeepFormatCommand, convertMarkdownToHtml } from '@/lib/formatUtils';
import { KeepMediaExtension } from '@/lib/keepMediaExtension';
import {
  extractClipboardPayload,
  copyFilesToLocalFolder,
} from '@/lib/localPaste';
import { Loader2 } from 'lucide-react';

export interface KeepWysiwygEditorHandle {
  handleFormat: (cmd: GoogleKeepFormatCommand) => void;
  focus: () => void;
  getHTML: () => string;
  insertLocalFiles: (files: File[], imageUrls?: string[]) => Promise<void>;
  insertContent: (text: string) => void;
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
    },
    ref
  ) => {
    const [isCopyingFiles, setIsCopyingFiles] = useState(false);
    const editorInstanceRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Convert any raw markdown to proper HTML for initial Tiptap load
    const initialHtml = convertMarkdownToHtml(content);

    const processAndInsertFiles = useCallback(
      async (files: File[], imageUrls: string[] = []) => {
        if (files.length === 0 && imageUrls.length === 0) return;

        try {
          setIsCopyingFiles(true);
          // Synchronously starts FormData upload before any await
          const savedFiles = await copyFilesToLocalFolder(files, undefined, imageUrls);
          const activeEditor = editorInstanceRef.current;

          if (savedFiles.length > 0 && activeEditor) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nodesToInsert: any[] = [];

            for (const file of savedFiles) {
              if (file.isImage) {
                // Rendered image directly
                nodesToInsert.push({
                  type: 'image',
                  attrs: {
                    src: file.serveUrl,
                    alt: file.fileName,
                    title: file.savedPath,
                  },
                });
                // Empty paragraph to allow continuing to write
                nodesToInsert.push({
                  type: 'paragraph',
                });
              } else {
                // Non-image file attachment: insert rich media block + markdown link
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
        // Prevent double handling of the same event
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

        // If currently focused inside a code block, insert raw text directly into the code block
        // to prevent ProseMirror from splitting the code block or inserting separate paragraphs
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

        // Intercept pasted markdown code blocks, tables, headings or markdown content
        if (
          plainText &&
          (/(?:^|\n)\s*```/.test(plainText) ||
            /(?:^|\n)\s*#{1,4}\s+/.test(plainText) ||
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
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: initialHtml,
      autofocus: autoFocus ? 'end' : false,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        onChangeRef.current(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: `w-full ${minHeightClass} outline-none text-stone-800 dark:text-stone-200 leading-relaxed`,
        },
        handleKeyDown: (view, event) => {
          if (event.key === 'Tab' && view.state.selection.$from.parent.type.name === 'codeBlock') {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText('  '));
            return true;
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
    // Catches Ctrl+V even when the user hasn't clicked inside the paragraph yet!
    useEffect(() => {
      if (!listenWindowPaste) return;

      const onWindowPaste = (e: ClipboardEvent) => {
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
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [editor, processAndInsertFiles]
    );

    return (
      <div
        className={`w-full flex flex-col relative ${className}`}
        onPasteCapture={(e) => {
          handleClipboardDataTransfer(e.clipboardData, e);
        }}
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
      </div>
    );
  }
);

KeepWysiwygEditor.displayName = 'KeepWysiwygEditor';
