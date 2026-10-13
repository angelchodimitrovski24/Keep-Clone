'use client';

import React from 'react';
import {
  Pin,
  CheckCircle2,
  Circle,
  Bell,
  Trash2,
  CheckSquare,
} from 'lucide-react';
import { Note } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { NoteActions } from './NoteActions';
import { useKeep } from '@/context/KeepContext';
import { MarkdownRenderer } from './MarkdownRenderer';
import { toggleMarkdownCheckbox } from '@/lib/formatUtils';

interface NoteCardProps {
  note: Note;
  onClick?: () => void;
  onOpenDrawingModal?: (noteId: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onClick,
}) => {
  const {
    togglePinNote,
    toggleArchiveNote,
    trashNote,
    restoreNote,
    deleteNotePermanently,
    duplicateNote,
    updateNote,
    selectedNoteIds,
    toggleSelectNote,
  } = useKeep();

  const isSelected = selectedNoteIds.includes(note.id);
  const colorClasses = getNoteColorClasses(note.color, note.theme);

  const handleToggleTodo = (todoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = note.todos.map((t) =>
      t.id === todoId ? { ...t, completed: !t.completed } : t
    );
    updateNote(note.id, { todos: updated });
  };

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateNote(note.id, {
            images: [...(note.images || []), event.target!.result as string],
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleToggleLabel = (labelName: string) => {
    const exists = note.labels?.includes(labelName);
    const newLabels = exists
      ? note.labels.filter((l) => l !== labelName)
      : [...(note.labels || []), labelName];
    updateNote(note.id, { labels: newLabels });
  };

  const completedTodos = note.todos?.filter((t) => t.completed) || [];
  const activeTodos = note.todos?.filter((t) => !t.completed) || [];

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 cursor-default hover:shadow-lg break-inside-avoid mb-4 ${colorClasses} ${
        isSelected
          ? 'ring-2 ring-stone-900 dark:ring-stone-100 shadow-md'
          : 'hover:border-stone-400/80 dark:hover:border-stone-500'
      }`}
    >
      {/* Top action: Select Checkmark & Pin */}
      <div className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSelectNote(note.id);
          }}
          className={`p-1 rounded-full transition-colors ${
            isSelected
              ? 'text-stone-900 dark:text-stone-100 bg-white/80 dark:bg-black/80'
              : 'text-stone-500 bg-white/60 dark:bg-black/60 hover:text-stone-900'
          }`}
          title="Select note"
        >
          {isSelected ? (
            <CheckCircle2 className="w-5 h-5 fill-stone-900 text-white dark:fill-stone-100 dark:text-stone-900" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
      </div>

      {!note.isTrash && (
        <div className={`absolute top-2 right-2 z-10 transition-opacity ${note.isPinned ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100'}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePinNote(note.id);
            }}
            className={`p-1.5 rounded-full bg-white/60 dark:bg-black/60 hover:bg-white dark:hover:bg-black transition-colors ${
              note.isPinned
                ? 'text-amber-500 opacity-100'
                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
            title={note.isPinned ? 'Unpin note' : 'Pin note'}
          >
            <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>
        </div>
      )}

      {/* Render Images / Drawings */}
      {note.images && note.images.length > 0 && (
        <div
          className={`grid gap-0.5 bg-black/5 ${
            note.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {note.images.slice(0, 4).map((img, idx) => (
            <div key={idx} className="relative aspect-video max-h-48 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt="attachment"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {note.drawings && note.drawings.length > 0 && (
        <div className="grid gap-0.5 bg-black/5">
          {note.drawings.map((d) => (
            <div key={d.id} className="relative aspect-video max-h-40 overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.dataUrl} alt="drawing" className="w-full h-full object-contain" />
            </div>
          ))}
        </div>
      )}

      {/* Note Content */}
      <div className="p-4 pt-3 flex-1 flex flex-col justify-start">
        {note.title && (
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-base mb-1.5 tracking-tight line-clamp-2">
            {note.title}
          </h3>
        )}

        {/* List items view */}
        {note.isList ? (
          <div className="space-y-1.5 my-1 text-sm">
            {activeTodos.slice(0, 8).map((todo) => (
              <div
                key={todo.id}
                onClick={(e) => handleToggleTodo(todo.id, e)}
                className="flex items-center gap-2 text-stone-800 dark:text-stone-200 cursor-pointer"
              >
                <div className="w-4 h-4 rounded border border-stone-400 flex items-center justify-center shrink-0" />
                <span className="truncate">{todo.text}</span>
              </div>
            ))}

            {completedTodos.length > 0 && (
              <div className="pt-1 mt-1 border-t border-black/10 dark:border-white/10 text-xs text-stone-500">
                <span>+{completedTodos.length} completed items</span>
              </div>
            )}
          </div>
        ) : (
          note.content && (
            <div className="max-h-72 overflow-hidden text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-normal">
              <MarkdownRenderer
                content={note.content}
                onToggleCheckbox={(idx, checked) => {
                  const updated = toggleMarkdownCheckbox(note.content, idx, checked);
                  updateNote(note.id, { content: updated });
                }}
                onToggleHtmlCheckbox={(updatedHtml) => {
                  updateNote(note.id, { content: updatedHtml });
                }}
              />
            </div>
          )
        )}

        {/* Labels & Reminders badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-1">
          {note.reminder && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/5 dark:bg-white/10 text-stone-700 dark:text-stone-300">
              <Bell className="w-3 h-3 text-amber-500" />
              {new Date(note.reminder).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}

          {note.labels?.map((label) => (
            <span
              key={label}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/5 dark:bg-white/10 text-stone-700 dark:text-stone-300"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Note Action Toolbar */}
      <div className="px-2 py-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-between border-t border-black/5 dark:border-white/5 sm:border-transparent">
        <NoteActions
          note={note}
          isTrash={note.isTrash}
          onColorChange={(color) => updateNote(note.id, { color })}
          onThemeChange={(theme) => updateNote(note.id, { theme })}
          onArchiveToggle={() => toggleArchiveNote(note.id)}
          onDelete={() => trashNote(note.id)}
          onRestore={() => restoreNote(note.id)}
          onDeletePermanently={() => deleteNotePermanently(note.id)}
          onDuplicate={() => duplicateNote(note.id)}
          onAddImage={handleAddImage}
          onToggleChecklist={() =>
            updateNote(note.id, {
              isList: !note.isList,
              todos: note.isList
                ? []
                : note.content
                    .split('\n')
                    .filter((l) => l.trim())
                    .map((l, i) => ({ id: 'todo-' + i, text: l, completed: false })),
            })
          }
          onAddReminder={(reminder) => updateNote(note.id, { reminder })}
          onToggleLabel={handleToggleLabel}
        />
      </div>
    </div>
  );
};
