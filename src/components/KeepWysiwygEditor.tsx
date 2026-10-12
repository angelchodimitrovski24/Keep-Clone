'use client';

import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { KeepFormattingBar } from './KeepFormattingBar';
import { GoogleKeepFormatCommand, convertMarkdownToHtml } from '@/lib/formatUtils';

export interface KeepWysiwygEditorHandle {
  handleFormat: (cmd: GoogleKeepFormatCommand) => void;
  focus: () => void;
  getHTML: () => string;
}

export interface KeepWysiwygEditorProps {
  content: string;
  onChange: (htmlOrText: string) => void;
  placeholder?: string;
  isFormattingOpen?: boolean;
  className?: string;
  minHeightClass?: string;
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
    },
    ref
  ) => {
    // Convert any raw markdown to proper HTML for initial Tiptap load
    const initialHtml = convertMarkdownToHtml(content);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2],
          },
        }),
        Underline,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: initialHtml,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: `w-full ${minHeightClass} outline-none text-sm text-stone-800 dark:text-stone-200 leading-relaxed`,
        },
      },
    });

    // Synchronize external content changes (e.g. switching notes)
    useEffect(() => {
      if (editor) {
        const currentHtml = editor.getHTML();
        if (content !== currentHtml) {
          // If content is empty and editor is empty, skip
          if (!content.trim() && editor.getText().trim() === '') return;

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
      }),
      [editor]
    );

    return (
      <div className={`w-full flex flex-col ${className}`}>
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

