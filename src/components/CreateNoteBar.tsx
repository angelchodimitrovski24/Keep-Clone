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
  Lock,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { NoteActions } from './NoteActions';
import { KeepFormattingBar } from './KeepFormattingBar';
import { KeepWysiwygEditor, KeepWysiwygEditorHandle } from './KeepWysiwygEditor';
import { NoteColor, NoteBackgroundTheme, TodoItem, NoteDrawing, Note } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { GoogleKeepFormatCommand } from '@/lib/formatUtils';
import { extractClipboardPayload, copyFilesToLocalFolder } from '@/lib/localPaste';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';
import { LinkNoteModal } from './LinkNoteModal';
import { EncryptNoteModal } from './EncryptNoteModal';
import { encryptNote } from '@/lib/crypto';
import { setUnlockedNote, setSessionPassword } from '@/lib/encryptionSession';
import { NoteThemeArtwork } from './NoteThemeArtwork';

interface CreateNoteBarProps {
  onOpenDrawingModal?: () => void;
}

export const CreateNoteBar: React.FC<CreateNoteBarProps> = ({ onOpenDrawingModal }) => {
  const { notes, addNote, selectedLabel, selectedCategory, categories, editingNote } = useKeep();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isList, setIsList] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoInput, setNewTodoInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [color, setColor] = useState<NoteColor>('default');
  const [theme, setTheme] = useState<NoteBackgroundTheme>('none');
  const [category, setCategory] = useState<string | null>(selectedCategory || null);
  const [labels, setLabels] = useState<string[]>([]);
  const [reminder, setReminder] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [drawings, setDrawings] = useState<NoteDrawing[]>([]);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [encryptionHint, setEncryptionHint] = useState('');
  const [showEncryptModal, setShowEncryptModal] = useState(false);

  // Sync category with active category filter when collapsed
  React.useEffect(() => {
    if (!isExpanded) {
      setCategory(selectedCategory || null);
    }
  }, [selectedCategory, isExpanded]);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<KeepWysiwygEditorHandle>(null);

  // If CreateNoteBar is collapsed and no modal is open, allow Ctrl+V anywhere on the page to start a note with the pasted image/file
  React.useEffect(() => {
    if (isExpanded || editingNote) return;

    const handleGlobalCollapsedPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const { files, imageUrls } = extractClipboardPayload(e.clipboardData);
      if (files.length === 0 && imageUrls.length === 0) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e as any).__keepPasteHandled = true;
      e.preventDefault();
      setIsExpanded(true);

      try {
        const saved = await copyFilesToLocalFolder(files, undefined, imageUrls);
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
        console.error('Collapsed paste failed:', err);
      }
    };

    window.addEventListener('paste', handleGlobalCollapsedPaste);
    return () => window.removeEventListener('paste', handleGlobalCollapsedPaste);
  }, [isExpanded, editingNote]);

  // Click outside to auto-save like Google Keep
  React.useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSaveAndClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, title, content, isList, todos, images, drawings, isPinned, color, theme, labels, reminder]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setIsList(false);
    setTodos([]);
    setNewTodoInput('');
    setIsPinned(false);
    setColor('default');
    setTheme('none');
    setCategory(selectedCategory || null);
    setLabels([]);
    setReminder(null);
    setImages([]);
    setDrawings([]);
    setLinkedNoteIds([]);
    setShowLinkModal(false);
    setIsFormattingOpen(false);
    setIsEncrypted(false);
    setEncryptionPassword('');
    setEncryptionHint('');
    setShowEncryptModal(false);
    setIsExpanded(false);
  };

  const handleSaveAndClose = async () => {
    const rawContent = editorRef.current?.getHTML() || content;
    const latestContent = renderMarkdownTablesInHtml(rawContent);
    const hasTodos = todos.some((t) => t.text.trim().length > 0);
    const hasText =
      title.trim().length > 0 ||
      (latestContent.trim().length > 0 && latestContent.trim() !== '<p></p>');
    const hasMedia = images.length > 0 || drawings.length > 0;

    if (hasText || hasTodos || hasMedia) {
      const finalTodos = newTodoInput.trim()
        ? [...todos, { id: 'todo-' + Date.now(), text: newTodoInput.trim(), completed: false }]
        : todos;

      const noteLabels = labels.length > 0 ? labels : selectedLabel ? [selectedLabel] : [];

      if (isEncrypted && encryptionPassword) {
        try {
          const bundle = await encryptNote(
            {
              title: title.trim(),
              content: latestContent.trim(),
              todos: finalTodos,
              images,
            },
            encryptionPassword,
            encryptionHint
          );

          const created = await addNote({
            title: title.trim() || 'Encrypted Note',
            content: '',
            isList,
            todos: [],
            color,
            theme,
            category: category || null,
            labels: noteLabels,
            isPinned,
            reminder,
            images: [],
            drawings,
            linkedNoteIds,
            isEncrypted: true,
            encryptedData: bundle,
          });

          // Cache in session so user sees their new note unlocked immediately
          setUnlockedNote(created.id, {
            title: title.trim(),
            content: latestContent.trim(),
            todos: finalTodos,
            images,
          });
          setSessionPassword(created.id, encryptionPassword);
        } catch (err) {
          console.error('Failed to encrypt note on create:', err);
        }
      } else {
        await addNote({
          title: title.trim(),
          content: latestContent.trim(),
          isList,
          todos: finalTodos,
          color,
          theme,
          category: category || null,
          labels: noteLabels,
          isPinned,
          reminder,
          images,
          drawings,
          linkedNoteIds,
        });
      }
    }
    resetForm();
  };

  // Copy selected files to local folder & insert markdown link + rendered preview
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
        className={`rounded-2xl shadow-xl border relative overflow-hidden transition-all ${colorClasses}`}
      >
        {/* Themed Background Illustration */}
        <NoteThemeArtwork theme={theme} />
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
            style={{ fontSize: 'calc(var(--note-font-size, 15px) * 1.15)' }}
            className="w-full bg-transparent font-semibold text-stone-900 dark:text-stone-100 placeholder:text-stone-500 outline-none"
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
                    style={{ fontSize: 'var(--note-font-size, 15px)' }}
                    className={`flex-1 bg-transparent outline-none ${
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
                  style={{ fontSize: 'var(--note-font-size, 15px)' }}
                  className="flex-1 bg-transparent outline-none placeholder:text-stone-400"
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
              autoFocus={true}
              listenWindowPaste={!editingNote}
            />
          )}

          {/* Category, Labels & Reminder chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {category && (() => {
              const catObj = categories.find((c) => c.name === category);
              return (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs"
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
                    className="hover:opacity-75"
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

            {reminder && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                <span>⏰ {new Date(reminder).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <button
                  type="button"
                  onClick={() => setReminder(null)}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {isEncrypted && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shadow-xs">
                <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>AES-256 Protected</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEncrypted(false);
                    setEncryptionPassword('');
                    setEncryptionHint('');
                  }}
                  className="hover:text-red-500"
                  title="Remove encryption"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
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
            note={{ color, theme, isList, labels, reminder, category, isEncrypted }}
            onColorChange={setColor}
            onThemeChange={setTheme}
            onSelectCategory={setCategory}
            onAddImage={handleAddImage}
            onToggleChecklist={() => setIsList(!isList)}
            onAddReminder={(r) => setReminder(r)}
            onToggleLabel={handleToggleLabel}
            onLinkNote={() => setShowLinkModal(true)}
            onEncrypt={() => setShowEncryptModal(true)}
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

      <LinkNoteModal
        currentNoteId=""
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

      {/* Encrypt Note Dialog for New Note */}
      <EncryptNoteModal
        note={
          {
            id: 'temp-create-note',
            title,
            content,
            isList,
            todos,
            images,
            drawings: [],
            isPinned: false,
            color: 'default',
            theme: 'none',
            order: 0,
            labels: [],
            isArchived: false,
            isTrash: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isEncrypted,
            encryptedData:
              isEncrypted && encryptionHint
                ? { ciphertext: '', iv: '', salt: '', hint: encryptionHint, timestamp: Date.now() }
                : null,
          } as Note
        }
        isOpen={showEncryptModal}
        onClose={() => setShowEncryptModal(false)}
        onEncrypted={async (updates, pass) => {
          setIsEncrypted(true);
          setEncryptionPassword(pass || '');
          setEncryptionHint(updates.encryptedData?.hint || '');
          setShowEncryptModal(false);
        }}
        onDecryptedPermanently={async () => {
          setIsEncrypted(false);
          setEncryptionPassword('');
          setEncryptionHint('');
          setShowEncryptModal(false);
        }}
      />
    </div>
  );
};
