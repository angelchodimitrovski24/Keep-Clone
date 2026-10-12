'use client';

import React, { useState, useRef } from 'react';
import {
  CheckSquare,
  Image as ImageIcon,
  PenTool,
  Pin,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { NoteActions } from './NoteActions';
import { KeepFormattingBar } from './KeepFormattingBar';
import { KeepWysiwygEditor, KeepWysiwygEditorHandle } from './KeepWysiwygEditor';
import { NoteColor, NoteBackgroundTheme, TodoItem, NoteDrawing } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { GoogleKeepFormatCommand } from '@/lib/formatUtils';
import { extractFilesFromClipboard } from '@/lib/localPaste';

interface CreateNoteBarProps {
  onOpenDrawingModal?: () => void;
}

export const CreateNoteBar: React.FC<CreateNoteBarProps> = ({ onOpenDrawingModal }) => {
  const { addNote, selectedLabel } = useKeep();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isList, setIsList] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoInput, setNewTodoInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [color, setColor] = useState<NoteColor>('default');
  const [theme, setTheme] = useState<NoteBackgroundTheme>('none');
  const [labels, setLabels] = useState<string[]>([]);
  const [reminder, setReminder] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [drawings, setDrawings] = useState<NoteDrawing[]>([]);
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<KeepWysiwygEditorHandle>(null);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setIsList(false);
    setTodos([]);
    setNewTodoInput('');
    setIsPinned(false);
    setColor('default');
    setTheme('none');
    setLabels([]);
    setReminder(null);
    setImages([]);
    setDrawings([]);
    setIsFormattingOpen(false);
    setIsExpanded(false);
  };

  const handleSaveAndClose = async () => {
    // Only save if note has any actual content
    const hasTodos = todos.some((t) => t.text.trim().length > 0);
    const hasText = title.trim().length > 0 || content.trim().length > 0;
    const hasMedia = images.length > 0 || drawings.length > 0;

    if (hasText || hasTodos || hasMedia) {
      const finalTodos = newTodoInput.trim()
        ? [...todos, { id: 'todo-' + Date.now(), text: newTodoInput.trim(), completed: false }]
        : todos;

      await addNote({
        title: title.trim(),
        content: content.trim(),
        isList,
        todos: finalTodos,
        color,
        theme,
        labels: labels.length > 0 ? labels : selectedLabel ? [selectedLabel] : [],
        isPinned,
        reminder,
        images,
        drawings,
      });
    }
    resetForm();
  };

  // Convert uploaded image to base64
  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddTodoItem = () => {
    if (newTodoInput.trim()) {
      setTodos((prev) => [
        ...prev,
        { id: 'todo-' + Date.now(), text: newTodoInput.trim(), completed: false },
      ]);
      setNewTodoInput('');
    }
  };

  const handleToggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleRemoveTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleLabel = (labelName: string) => {
    setLabels((prev) =>
      prev.includes(labelName) ? prev.filter((l) => l !== labelName) : [...prev, labelName]
    );
  };

  const handleFormatText = (cmd: GoogleKeepFormatCommand) => {
    editorRef.current?.handleFormat(cmd);
  };

  const colorClasses = getNoteColorClasses(color, theme);

  if (!isExpanded) {
    return (
      <div className="w-full max-w-2xl mx-auto mb-8 px-4">
        <div
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#202124] rounded-xl shadow-md border border-stone-200 dark:border-stone-700/80 cursor-text hover:shadow-lg transition-all text-stone-500 dark:text-stone-400"
        >
          <span className="font-medium text-sm">Take a note…</span>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setIsList(true);
                setIsExpanded(true);
              }}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300"
              title="New list"
            >
              <CheckSquare className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(true);
                onOpenDrawingModal?.();
              }}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300"
              title="New note with drawing"
            >
              <PenTool className="w-5 h-5" />
            </button>
            <label
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer"
              title="New note with image"
            >
              <ImageIcon className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddImage(e);
                  setIsExpanded(true);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 px-4" ref={containerRef}>
      <div
        onPaste={(e) => {
          if (e.defaultPrevented || isList) return;
          const files = extractFilesFromClipboard(e.clipboardData);
          if (files.length > 0) {
            e.preventDefault();
            editorRef.current?.insertLocalFiles(files);
          }
        }}
        onDragOver={(e) => {
          if (!isList && e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (e.defaultPrevented || isList) return;
          const files = extractFilesFromClipboard(e.dataTransfer);
          if (files.length > 0) {
            e.preventDefault();
            editorRef.current?.insertLocalFiles(files);
          }
        }}
        className={`rounded-2xl shadow-xl border relative transition-all ${colorClasses}`}
      >
        {/* Attached Images */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-2 bg-black/5">
            {images.map((img, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden max-h-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="Attachment" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Header & Pin */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent font-semibold text-stone-900 dark:text-stone-100 text-base placeholder:text-stone-500 outline-none"
          />
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'text-amber-500 hover:bg-black/10'
                : 'text-stone-400 hover:bg-black/10'
            }`}
            title={isPinned ? 'Unpin note' : 'Pin note'}
          >
            <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Content body: List or Text */}
        <div className="px-4 py-2">
          {isList ? (
            <div className="space-y-2">
              {todos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggleTodo(todo.id)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={todo.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTodos((prev) =>
                        prev.map((t) => (t.id === todo.id ? { ...t, text: val } : t))
                      );
                    }}
                    className={`flex-1 bg-transparent text-sm outline-none ${
                      todo.completed ? 'line-through text-stone-400 dark:text-stone-500' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1 border-t border-stone-200/50 dark:border-stone-700/50">
                <Plus className="w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="List item"
                  value={newTodoInput}
                  onChange={(e) => setNewTodoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTodoItem();
                    }
                  }}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
                />
              </div>
            </div>
          ) : (
            <KeepWysiwygEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              placeholder="Take a note…"
              minHeightClass="min-h-[100px]"
            />
          )}

          {/* Labels chips */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {labels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/10 dark:bg-white/10"
                >
                  {lbl}
                  <button
                    type="button"
                    onClick={() => handleToggleLabel(lbl)}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Reminder chip */}
          {reminder && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              <span>⏰ {new Date(reminder).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <button
                type="button"
                onClick={() => setReminder(null)}
                className="hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Google Keep Authentic Formatting Bar (H1, H2, Aa, B, I, U, Clear) */}
        {!isList && isFormattingOpen && (
          <div className="px-4 py-1.5 border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2">
            <KeepFormattingBar onFormat={handleFormatText} />
          </div>
        )}

        {/* Footer toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-black/5 dark:border-white/5">
          <NoteActions
            note={{ color, theme, isList, labels, reminder }}
            onColorChange={setColor}
            onThemeChange={setTheme}
            onAddImage={handleAddImage}
            onToggleChecklist={() => setIsList(!isList)}
            onAddReminder={(r) => setReminder(r)}
            onToggleLabel={handleToggleLabel}
            showFormattingToggle={!isList}
            isFormattingOpen={isFormattingOpen}
            onToggleFormatting={() => setIsFormattingOpen(!isFormattingOpen)}
          />

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-4 py-1.5 text-sm font-medium rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-stone-800 dark:text-stone-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
