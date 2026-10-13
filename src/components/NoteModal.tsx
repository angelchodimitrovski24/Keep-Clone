'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Pin,
  X,
  Plus,
  Trash2,
  Check,
  Bell,
  Clock,
  ChevronDown,
  ChevronRight,
  Link2,
  Lock,
  Eye,
  EyeOff,
  History,
} from 'lucide-react';
import { Note, NoteColor, NoteBackgroundTheme, TodoItem, NoteDrawing } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { NoteActions } from './NoteActions';
import { KeepFormattingBar } from './KeepFormattingBar';
import { KeepWysiwygEditor, KeepWysiwygEditorHandle } from './KeepWysiwygEditor';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useKeep } from '@/context/KeepContext';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';
import { GoogleKeepFormatCommand } from '@/lib/formatUtils';
import { extractClipboardPayload, copyFilesToLocalFolder } from '@/lib/localPaste';
import { EncryptNoteModal } from './EncryptNoteModal';
import { LinkNoteModal } from './LinkNoteModal';
import { getBidirectionalLinks } from '@/lib/noteLinks';
import { getUnlockedNote } from '@/lib/encryptionSession';
import { NoteThemeArtwork } from './NoteThemeArtwork';

interface NoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDrawingModal?: (noteId: string) => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  note,
  isOpen,
  onClose,
  onOpenDrawingModal,
}) => {
  const {
    notes,
    updateNote,
    toggleArchiveNote,
    trashNote,
    duplicateNote,
    setEditingNote,
    categories,
    unlockedCategoryNames,
    setUnlockCategoryModalTarget,
    setVersionHistoryNote,
  } = useKeep();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isList, setIsList] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoInput, setNewTodoInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [color, setColor] = useState<NoteColor>('default');
  const [theme, setTheme] = useState<NoteBackgroundTheme>('none');
  const [category, setCategory] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [reminder, setReminder] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [drawings, setDrawings] = useState<NoteDrawing[]>([]);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [showCompletedTodos, setShowCompletedTodos] = useState(true);
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const editorRef = useRef<KeepWysiwygEditorHandle | null>(null);

  const categoryObj = useMemo(
    () => (note?.category ? categories.find((c) => c.name === note.category) : null),
    [note?.category, categories]
  );

  const isCategoryLocked = useMemo(() => {
    if (!categoryObj?.isLocked) return false;
    return !unlockedCategoryNames.includes(categoryObj.name.toLowerCase());
  }, [categoryObj, unlockedCategoryNames]);

  // Sync state when note opens
  useEffect(() => {
    if (note) {
      const unlocked = note.isEncrypted ? getUnlockedNote(note.id) : undefined;
      setTitle(unlocked?.title || note.title || '');
      setContent(unlocked?.content || note.content || '');
      setIsList(note.isList || false);
      setTodos(unlocked?.todos || note.todos || []);
      setIsPinned(note.isPinned || false);
      setColor(note.color || 'default');
      setTheme(note.theme || 'none');
      setCategory(note.category || null);
      setLabels(note.labels || []);
      setReminder(note.reminder || null);
      setImages(unlocked?.images || note.images || []);
      setDrawings(note.drawings || []);
      setLinkedNoteIds(note.linkedNoteIds || []);
      setIsFormattingOpen(false);
      setIsPreviewMode(false);
    }
  }, [note]);

  const currentNoteForLinks = useMemo(
    () => ({
      ...(note || ({} as Note)),
      title,
      content,
      linkedNoteIds,
    }),
    [note, title, content, linkedNoteIds]
  );

  const { outgoing, backlinks } = useMemo(
    () => (note ? getBidirectionalLinks(currentNoteForLinks, notes) : { outgoing: [], backlinks: [] }),
    [currentNoteForLinks, notes, note]
  );


  if (!isOpen || !note) return null;

  const handleSaveAndClose = async () => {
    const rawContent = editorRef.current?.getHTML() || content;
    const latestContent = renderMarkdownTablesInHtml(rawContent);
    const finalTodos = newTodoInput.trim()
      ? [...todos, { id: 'todo-' + Date.now(), text: newTodoInput.trim(), completed: false }]
      : todos;

    await updateNote(note.id, {
      title: title.trim(),
      content: latestContent.trim(),
      isList,
      todos: finalTodos,
      color,
      theme,
      category: category || null,
      labels,
      isPinned,
      reminder,
      images,
      drawings,
      linkedNoteIds,
    });
    onClose();
  };

  const handleAddTodo = () => {
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

  const handleToggleChecklist = () => {
    if (isList) {
      // Convert list items to HTML
      const htmlFromTodos = todos
        .map((t) =>
          t.completed
            ? `<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>${t.text}</p></div></li></ul>`
            : `<p>${t.text}</p>`
        )
        .join('');
      setContent(htmlFromTodos || content);
      setIsList(false);
    } else {
      // Convert current content into todos
      if (typeof window !== 'undefined') {
        const div = document.createElement('div');
        div.innerHTML = content;
        const taskItems = div.querySelectorAll('li[data-type="taskItem"]');
        if (taskItems.length > 0) {
          const newTodos: TodoItem[] = Array.from(taskItems).map((item, idx) => ({
            id: 'todo-' + Date.now() + '-' + idx,
            text: item.querySelector('div')?.textContent?.trim() || item.textContent?.trim() || '',
            completed: item.getAttribute('data-checked') === 'true',
          }));
          setTodos(newTodos);
          setIsList(true);
          return;
        }

        const text = div.innerText || div.textContent || content;
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        const newTodos: TodoItem[] = lines.map((line, idx) => {
          const isChecked = /^\[x\]/i.test(line.trim()) || /^-\s*\[x\]/i.test(line.trim());
          const cleanText = line
            .replace(/^[-*+]\s+\[[ xX]\]\s*/, '')
            .replace(/^\[[ xX]\]\s*/, '')
            .replace(/^[-*+]\s+/, '')
            .trim();
          return {
            id: 'todo-' + Date.now() + '-' + idx,
            text: cleanText,
            completed: isChecked,
          };
        });
        setTodos(newTodos.length > 0 ? newTodos : todos);
        setIsList(true);
      }
    }
  };

  const handleFormatText = (cmd: GoogleKeepFormatCommand) => {
    editorRef.current?.handleFormat(cmd);
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    e.target.value = '';

    if (editorRef.current) {
      await editorRef.current.insertLocalFiles(filesArray);
    } else {
      try {
        const saved = await copyFilesToLocalFolder(filesArray);
        if (saved.length > 0) {
          const htmlBlocks = saved
            .map((f) =>
              f.isImage
                ? `<p class="font-mono text-xs text-stone-400 my-1">${f.markdownLink}</p><img src="${f.serveUrl}" alt="${f.fileName}" class="rounded-xl max-h-96 w-auto my-2 border border-black/10 dark:border-white/10" /><p></p>`
                : `<div data-keep-media="true" data-is-image="false" data-file-name="${f.fileName}" data-saved-path="${f.savedPath}" data-serve-url="${f.serveUrl}" data-markdown-link="${f.markdownLink}" data-file-size="${f.size}"><div class="keep-media-md">${f.markdownLink}</div><a href="${f.serveUrl}" target="_blank" rel="noopener noreferrer" class="keep-media-file-link">📎 ${f.fileName}</a></div><p></p>`
            )
            .join('');
          setContent((prev) => prev + htmlBlocks);
        }
      } catch (err) {
        console.error('Failed to add image to local folder:', err);
      }
    }
  };

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const colorClasses = getNoteColorClasses(color, theme);

  return (
    <div
      onClick={handleSaveAndClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 md:p-10 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPaste={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (e.defaultPrevented || isList || (e.nativeEvent as any)?.__keepPasteHandled) return;
          const { files, imageUrls } = extractClipboardPayload(e.clipboardData);
          if (files.length > 0 || imageUrls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e.nativeEvent as any).__keepPasteHandled = true;
            e.preventDefault();
            editorRef.current?.insertLocalFiles(files, imageUrls);
          }
        }}
        onDragOver={(e) => {
          if (!isList && e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (e.defaultPrevented || isList || (e.nativeEvent as any)?.__keepPasteHandled) return;
          const { files, imageUrls } = extractClipboardPayload(e.dataTransfer);
          if (files.length > 0 || imageUrls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e.nativeEvent as any).__keepPasteHandled = true;
            e.preventDefault();
            editorRef.current?.insertLocalFiles(files, imageUrls);
          }
        }}
        className={`w-full max-w-3xl min-h-[460px] max-h-[92vh] rounded-2xl shadow-2xl border flex flex-col transition-all duration-150 relative overflow-hidden ${colorClasses}`}
      >
        {/* Themed Background Illustration */}
        <NoteThemeArtwork theme={theme} isModal={true} />
        {/* Images Gallery */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-1 p-2 bg-black/5 max-h-60 overflow-y-auto shrink-0">
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

        {/* Drawings Gallery */}
        {drawings.length > 0 && (
          <div className="grid grid-cols-2 gap-1 p-2 bg-black/5 max-h-48 overflow-y-auto shrink-0">
            {drawings.map((d, idx) => (
              <div key={d.id} className="relative group rounded-lg overflow-hidden bg-white max-h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.dataUrl} alt="drawing" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => setDrawings((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Header: Title & Pin */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0 gap-3">
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent font-semibold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-none"
              style={{ fontSize: 'calc(var(--note-font-size, 15px) * 1.25)' }}
            />
            {note.isEncrypted && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <Lock className="w-3 h-3" /> Encrypted
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const rawContent = editorRef.current?.getHTML() || content;
                const latestContent = renderMarkdownTablesInHtml(rawContent);
                const currentSnapshotNote: Note = {
                  ...note,
                  title: title.trim(),
                  content: latestContent.trim(),
                  todos,
                  isList,
                  color,
                  theme,
                };
                setVersionHistoryNote(currentSnapshotNote);
              }}
              className="p-2 rounded-full transition-colors text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/10 relative"
              title={`Version history (${note.versions?.length || 1} versions)`}
            >
              <History className="w-5 h-5" />
              {note.versions && note.versions.length > 1 && (
                <span className="absolute -top-0.5 -right-0.5 px-1 bg-amber-500 text-white text-[9px] font-bold rounded-full min-w-3.5 text-center leading-tight">
                  {note.versions.length}
                </span>
              )}
            </button>
            {!isList && (
              <button
                type="button"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`p-2 rounded-full transition-colors ${
                  isPreviewMode
                    ? 'text-amber-600 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400'
                    : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/10'
                }`}
                title={isPreviewMode ? 'Switch to Edit mode' : 'Preview markdown rendering (tables, links, etc.)'}
              >
                {isPreviewMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`p-2 rounded-full transition-colors ${
                isPinned
                  ? 'text-amber-500 hover:bg-black/10'
                  : 'text-stone-400 hover:bg-black/10'
              }`}
              title={isPinned ? 'Unpin note' : 'Pin note'}
            >
              <Pin className={`w-5 h-5 ${isPinned ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Note Body or Locked Category Prompt */}
        {isCategoryLocked && categoryObj ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xs"
              style={{
                backgroundColor: categoryObj.color ? `${categoryObj.color}25` : 'rgba(245, 158, 11, 0.15)',
                color: categoryObj.color || '#f59e0b',
              }}
            >
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center justify-center gap-1.5">
                <span>{categoryObj.icon || '📁'}</span>
                <span>Category &quot;{categoryObj.name}&quot; is Locked</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm">
                This note belongs to a password protected category. Enter the category password to view and edit its content.
              </p>
            </div>
            {categoryObj.lockHint && (
              <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 px-3 py-1 rounded-full">
                Hint: {categoryObj.lockHint}
              </span>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setUnlockCategoryModalTarget(categoryObj)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                Unlock Category
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 overflow-y-auto flex-1 flex flex-col justify-between space-y-4">
          <div>
            {isList ? (
              <div className="space-y-2">
                {/* Active Interactive Checkboxes */}
                {activeTodos.map((todo) => (
                  <div key={todo.id} className="flex items-center gap-3 group">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // Add new empty todo item right below
                          const newId = 'todo-' + Date.now();
                          setTodos((prev) => {
                            const index = prev.findIndex((t) => t.id === todo.id);
                            const updated = [...prev];
                            updated.splice(index + 1, 0, { id: newId, text: '', completed: false });
                            return updated;
                          });
                        }
                      }}
                      className="flex-1 bg-transparent outline-none text-stone-800 dark:text-stone-200"
                      style={{ fontSize: 'var(--note-font-size, 15px)' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-600 p-1 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add item row */}
                <div className="flex items-center gap-3 pt-1.5">
                  <Plus className="w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="List item"
                    value={newTodoInput}
                    onChange={(e) => setNewTodoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTodo();
                      }
                    }}
                    className="flex-1 bg-transparent outline-none placeholder:text-stone-400 text-stone-800 dark:text-stone-200"
                    style={{ fontSize: 'var(--note-font-size, 15px)' }}
                  />
                </div>

                {/* Completed items accordion */}
                {completedTodos.length > 0 && (
                  <div className="pt-4 border-t border-black/10 dark:border-white/10 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowCompletedTodos(!showCompletedTodos)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2"
                    >
                      {showCompletedTodos ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {completedTodos.length} Completed Items
                    </button>

                    {showCompletedTodos && (
                      <div className="space-y-2 pl-2">
                        {completedTodos.map((todo) => (
                          <div key={todo.id} className="flex items-center gap-3 group">
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => handleToggleTodo(todo.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
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
                              className="flex-1 bg-transparent line-through text-stone-400 dark:text-stone-500 outline-none"
                              style={{ fontSize: 'var(--note-font-size, 15px)' }}
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
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : isPreviewMode ? (
              <div className="min-h-[240px] py-1 text-stone-800 dark:text-stone-200 leading-relaxed overflow-x-auto">
                <MarkdownRenderer
                  content={content}
                  onOpenLinkedNote={(titleOrId) => {
                    const q = titleOrId.toLowerCase().trim();
                    const found = notes.find(
                      (n) => n.id.toLowerCase() === q || (n.title && n.title.toLowerCase() === q)
                    );
                    if (found) {
                      handleSaveAndClose();
                      setEditingNote(found);
                    }
                  }}
                />
              </div>
            ) : (
              <KeepWysiwygEditor
                ref={editorRef}
                content={content}
                onChange={setContent}
                placeholder="Take a note…"
                minHeightClass="min-h-[240px]"
                autoFocus={true}
                listenWindowPaste={true}
              />
            )}
          </div>

          {/* Bidirectional Linked Notes & Backlinks */}
          {(outgoing.length > 0 || backlinks.length > 0) && (
            <div className="pt-3 pb-1 border-t border-black/5 dark:border-white/5 space-y-2.5">
              {outgoing.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-blue-500" />
                    Outgoing Links ({outgoing.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {outgoing.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={async () => {
                          await handleSaveAndClose();
                          const targetNote = notes.find((n) => n.id === target.id);
                          if (targetNote) setEditingNote(targetNote);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-200/50 dark:border-blue-800/40"
                      >
                        <Link2 className="w-3 h-3 text-blue-500" />
                        {target.title || 'Untitled note'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {backlinks.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="text-purple-500 font-bold">↩</span>
                    Backlinks / Referenced In ({backlinks.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {backlinks.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={async () => {
                          await handleSaveAndClose();
                          const sourceNote = notes.find((n) => n.id === source.id);
                          if (sourceNote) setEditingNote(sourceNote);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors border border-purple-200/50 dark:border-purple-800/40"
                      >
                        <span className="text-purple-500 font-bold text-[10px]">↩</span>
                        {source.title || 'Untitled note'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chips & Timestamp */}
          <div className="pt-2">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {reminder && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  <Bell className="w-3.5 h-3.5" />
                  {new Date(reminder).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <button
                    type="button"
                    onClick={() => setReminder(null)}
                    className="hover:text-red-500 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Category chip */}
              {category && (() => {
                const catObj = categories.find((c) => c.name === category);
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs"
                    style={{
                      backgroundColor: catObj?.color ? `${catObj.color}20` : 'rgba(59, 130, 246, 0.15)',
                      color: catObj?.color || '#3b82f6',
                      border: `1px solid ${catObj?.color ? `${catObj.color}40` : 'rgba(59, 130, 246, 0.3)'}`,
                    }}
                  >
                    <span>{catObj?.icon || '📁'}</span>
                    <span>{category}</span>
                    <button
                      type="button"
                      onClick={() => setCategory(null)}
                      className="hover:opacity-75 ml-0.5"
                      title="Remove category"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })()}

              {labels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-black/10 dark:bg-white/10 text-stone-800 dark:text-stone-200"
                >
                  {lbl}
                  <button
                    type="button"
                    onClick={() => setLabels((prev) => prev.filter((l) => l !== lbl))}
                    className="hover:text-red-500 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="text-[11px] text-stone-400 dark:text-stone-500 flex items-center justify-end gap-1">
              <Clock className="w-3 h-3" />
              Edited {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Google Keep Authentic Formatting Bar (H1, H2, Aa, B, I, U, Lists, Clear) */}
        {!isList && isFormattingOpen && (
          <div className="px-6 py-2 border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2">
            <KeepFormattingBar onFormat={handleFormatText} />
          </div>
        )}

        {/* Footer toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 shrink-0">
          <NoteActions
            note={{ color, theme, isList, labels, reminder, category }}
            onColorChange={setColor}
            onThemeChange={setTheme}
            onSelectCategory={setCategory}
            onAddImage={handleAddImage}
            onArchiveToggle={() => {
              toggleArchiveNote(note.id);
              onClose();
            }}
            onDelete={() => {
              trashNote(note.id);
              onClose();
            }}
            onDuplicate={async () => {
              await handleSaveAndClose();
              await duplicateNote(note.id);
            }}
            onToggleChecklist={handleToggleChecklist}
            onAddReminder={setReminder}
            onToggleLabel={(lbl) =>
              setLabels((prev) =>
                prev.includes(lbl) ? prev.filter((l) => l !== lbl) : [...prev, lbl]
              )
            }
            onEncrypt={() => setShowEncryptModal(true)}
            onLinkNote={() => setShowLinkModal(true)}
            showFormattingToggle={!isList}
            isFormattingOpen={isFormattingOpen}
            onToggleFormatting={() => setIsFormattingOpen(!isFormattingOpen)}
          />

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity shadow-sm"
          >
            Close
          </button>
        </div>
      </>
    )}
  </div>

      {/* Encrypt Settings Dialog */}
      <EncryptNoteModal
        note={{
          ...note,
          title,
          content,
          todos,
          images,
        }}
        isOpen={showEncryptModal}
        onClose={() => setShowEncryptModal(false)}
        onEncrypted={async (updates) => {
          await updateNote(note.id, updates);
          setShowEncryptModal(false);
          onClose();
        }}
        onDecryptedPermanently={async () => {
          await updateNote(note.id, {
            isEncrypted: false,
            encryptedData: null,
            content,
            todos,
            images,
          });
          setShowEncryptModal(false);
        }}
      />

      {/* Link to another note Modal */}
      <LinkNoteModal
        currentNoteId={note.id}
        notes={notes}
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSelectNote={(target) => {
          const linkSyntax = `[[${target.title || 'Untitled Note'}]]`;
          if (!isList) {
            editorRef.current?.insertContent(` ${linkSyntax} `);
            setContent((prev) => `${prev} ${linkSyntax}`);
          } else {
            setContent((prev) => `${prev}\n${linkSyntax}`);
          }
          setLinkedNoteIds((prev) => Array.from(new Set([...prev, target.id])));
        }}
      />
    </div>
  );
};
