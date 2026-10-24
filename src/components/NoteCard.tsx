'use client';

import React, { useState, useMemo } from 'react';
import {
  Pin,
  CheckCircle2,
  Circle,
  Bell,
  Trash2,
  CheckSquare,
  Lock,
  Link2,
  Timer,
  Paperclip,
  X,
} from 'lucide-react';
import { Note } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { NoteActions } from './NoteActions';
import { useKeep } from '@/context/KeepContext';
import { MarkdownRenderer } from './MarkdownRenderer';
import { toggleMarkdownCheckbox, resolveLocalMediaUrl } from '@/lib/formatUtils';
import { copyFilesToLocalFolder } from '@/lib/localPaste';
import { isNoteUnlockedInSession, getUnlockedNote, lockNoteInSession } from '@/lib/encryptionSession';
import { UnlockNoteModal } from './UnlockNoteModal';
import { EncryptNoteModal } from './EncryptNoteModal';
import { LinkNoteModal } from './LinkNoteModal';
import { getBidirectionalLinks } from '@/lib/noteLinks';
import { NoteThemeArtwork } from './NoteThemeArtwork';

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
    notes,
    categories,
    togglePinNote,
    toggleArchiveNote,
    trashNote,
    restoreNote,
    deleteNotePermanently,
    duplicateNote,
    updateNote,
    selectedNoteIds,
    toggleSelectNote,
    setEditingNote,
    unlockedCategoryNames,
    setUnlockCategoryModalTarget,
    setVersionHistoryNote,
    activeStopwatch,
    startReadingStopwatch,
    stopAndSaveReadingStopwatch,
    setSharingNote,
  } = useKeep();

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const categoryObj = useMemo(
    () => (note.category ? categories.find((c) => c.name === note.category) : null),
    [note.category, categories]
  );

  const isCategoryLocked = useMemo(() => {
    if (!categoryObj?.isLocked) return false;
    return !unlockedCategoryNames.includes(categoryObj.name.toLowerCase());
  }, [categoryObj, unlockedCategoryNames]);

  const isLocked = !isCategoryLocked && note.isEncrypted && !isNoteUnlockedInSession(note.id);
  const unlockedPayload = note.isEncrypted ? getUnlockedNote(note.id) : undefined;

  // Use decrypted payload if unlocked
  const activeNote = useMemo(() => {
    if (!note.isEncrypted || !unlockedPayload) return note;
    return {
      ...note,
      title: unlockedPayload.title || note.title,
      content: unlockedPayload.content || '',
      todos: unlockedPayload.todos || note.todos || [],
      images: unlockedPayload.images || note.images || [],
    };
  }, [note, unlockedPayload]);

  const { outgoing, backlinks } = useMemo(
    () => getBidirectionalLinks(activeNote, notes),
    [activeNote, notes]
  );

  const isSelected = selectedNoteIds.includes(note.id);
  const colorClasses = getNoteColorClasses(note.color, note.theme);

  const handleCardClick = () => {
    if (isCategoryLocked && categoryObj) {
      setUnlockCategoryModalTarget(categoryObj);
      return;
    }
    if (isLocked) {
      setShowUnlockModal(true);
      return;
    }
    onClick?.();
  };

  const handleOpenLinkedNote = (titleOrId: string) => {
    const q = titleOrId.toLowerCase().trim();
    const found = notes.find(
      (n) => n.id.toLowerCase() === q || (n.title && n.title.toLowerCase() === q)
    );
    if (found) {
      setEditingNote(found);
    }
  };

  const handleToggleTodo = (todoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = note.todos.map((t) =>
      t.id === todoId ? { ...t, completed: !t.completed } : t
    );
    updateNote(note.id, { todos: updated });
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    e.target.value = '';

    try {
      const saved = await copyFilesToLocalFolder(filesArray);
      if (saved.length > 0) {
        const blocks = saved.map((f) => f.markdownLink).join('\n\n');
        const newContent = activeNote.content
          ? `${activeNote.content}\n\n${blocks}`
          : blocks;
        updateNote(note.id, { content: newContent });
      }
    } catch (err) {
      console.error('Failed to attach files in NoteCard:', err);
    }
  };

  const attachedFileCount = useMemo(() => {
    if (!activeNote.content) return 0;
    const matches = activeNote.content.match(/data-keep-media="true"|keep-media-file-link|📎\s/g);
    return matches ? matches.length : 0;
  }, [activeNote.content]);

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
    <>
      <div
        onClick={handleCardClick}
        className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 cursor-default hover:keep-elevation-1 break-inside-avoid mb-4 ${colorClasses} ${
          isSelected
            ? 'ring-2 ring-stone-900 dark:ring-stone-100 keep-elevation-2'
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
          <div className={`absolute top-2 right-2 z-10 transition-opacity ${note.isPinned ? 'opacity-100' : 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100'}`}>
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

        {/* Category Locked Note Preview */}
        {isCategoryLocked ? (
          <div className="p-5 py-7 flex flex-col items-center justify-center text-center gap-2 cursor-pointer">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1 text-2xl shadow-2xs"
              style={{
                backgroundColor: categoryObj?.color ? `${categoryObj.color}25` : 'rgba(245, 158, 11, 0.15)',
                color: categoryObj?.color || '#f59e0b',
              }}
            >
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm flex items-center gap-1.5">
              <span>{categoryObj?.icon || '📁'}</span>
              <span>{categoryObj?.name || 'Category'} Note</span>
            </h4>
            <p className="text-xs text-stone-500 max-w-[200px]">
              Category is password protected. Click to unlock.
            </p>
            {categoryObj?.lockHint && (
              <span className="mt-1 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Hint: {categoryObj.lockHint}
              </span>
            )}
          </div>
        ) : isLocked ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowUnlockModal(true);
            }}
            className="p-5 py-7 flex flex-col items-center justify-center text-center gap-2 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1 shadow-xs ring-1 ring-amber-500/30">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
              {note.title || 'Encrypted Note'}
            </h4>
            <p className="text-xs text-stone-500 max-w-[200px]">
              Encrypted with AES-256-GCM. Click to unlock.
            </p>
            {note.encryptedData?.hint && (
              <span className="mt-1 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Hint: {note.encryptedData.hint}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowUnlockModal(true);
              }}
              className="mt-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs shadow-xs transition-colors"
            >
              Unlock Note
            </button>
          </div>
        ) : (
          <>
            {/* Render Images / Drawings */}
            {activeNote.images && activeNote.images.length > 0 && (
              <div
                className={`grid gap-0.5 bg-black/5 ${
                  activeNote.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {activeNote.images.slice(0, 4).map((img, idx) => (
                  <div key={idx} className="relative aspect-video max-h-48 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveLocalMediaUrl(img)}
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
              {/* AES Unlocked Badge */}
              {note.isEncrypted && (
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-black/5 dark:border-white/5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    <Lock className="w-3 h-3" /> Unlocked (AES-256)
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      lockNoteInSession(note.id);
                    }}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 transition-colors"
                    title="Lock note now (protect sensitive data)"
                  >
                    Lock Now
                  </button>
                </div>
              )}

              {activeNote.title && (
                <h3
                  className="font-semibold text-stone-900 dark:text-stone-100 mb-1.5 tracking-tight break-words whitespace-pre-wrap"
                  style={{ fontSize: 'calc(var(--note-font-size, 15px) * 1.15)' }}
                >
                  {activeNote.title}
                </h3>
              )}

              {/* Beautiful Category & Labels directly under the Title */}
              {((note.category) || (note.labels && note.labels.length > 0)) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5 mt-0.5">
                  {note.category && (
                    <span
                      className="group/cat inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs transition-all hover:opacity-90"
                      style={{
                        backgroundColor: categoryObj?.color ? `${categoryObj.color}20` : 'rgba(59, 130, 246, 0.15)',
                        color: categoryObj?.color || '#3b82f6',
                        border: `1px solid ${categoryObj?.color ? `${categoryObj.color}40` : 'rgba(59, 130, 246, 0.3)'}`,
                      }}
                    >
                      <span className="text-[12px]">{categoryObj?.icon || '📁'}</span>
                      <span>{note.category}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateNote(note.id, { category: null });
                        }}
                        className="hover:opacity-75 ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-70 sm:opacity-0 sm:group-hover/cat:opacity-100"
                        title="Remove category"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}

                  {note.labels?.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-black/5 dark:bg-white/10 text-stone-700 dark:text-stone-300 border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/15 transition-colors"
                    >
                      <span className="text-stone-400 dark:text-stone-500 font-semibold">#</span>
                      <span>{label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* List items view */}
              {activeNote.isList ? (
                <div className="space-y-1.5 my-1" style={{ fontSize: 'var(--note-font-size, 15px)' }}>
                  {activeTodos.slice(0, 8).map((todo) => (
                    <div
                      key={todo.id}
                      onClick={(e) => handleToggleTodo(todo.id, e)}
                      className="flex items-start gap-2.5 text-stone-800 dark:text-stone-200 cursor-pointer group/todo min-w-0"
                    >
                      <div className="w-4 h-4 mt-0.5 rounded border border-stone-400 dark:border-stone-500 flex items-center justify-center shrink-0 group-hover/todo:border-stone-600 dark:group-hover/todo:border-stone-300 transition-colors" />
                      <span className="flex-1 min-w-0 break-words whitespace-pre-wrap leading-snug">{todo.text}</span>
                    </div>
                  ))}

                  {completedTodos.length > 0 && (
                    <div className="pt-1 mt-1 border-t border-black/10 dark:border-white/10 text-xs text-stone-500">
                      <span>+{completedTodos.length} completed items</span>
                    </div>
                  )}
                </div>
              ) : (
                activeNote.content && (
                  <div className="max-h-72 overflow-hidden text-stone-700 dark:text-stone-300 leading-relaxed font-normal">
                    <MarkdownRenderer
                      content={activeNote.content}
                      onOpenLinkedNote={handleOpenLinkedNote}
                      onToggleCheckbox={(idx, checked) => {
                        const updated = toggleMarkdownCheckbox(activeNote.content, idx, checked);
                        updateNote(note.id, { content: updated });
                      }}
                      onToggleHtmlCheckbox={(updatedHtml) => {
                        updateNote(note.id, { content: updatedHtml });
                      }}
                    />
                  </div>
                )
              )}

              {/* Bi-directional connected notes badge */}
              {(outgoing.length > 0 || backlinks.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-black/5 dark:border-white/5">
                  {outgoing.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                      title={`Links to: ${outgoing.map((o) => o.title).join(', ')}`}
                    >
                      <span>↗</span> {outgoing.length} linked
                    </span>
                  )}
                  {backlinks.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20"
                      title={`Referenced in: ${backlinks.map((b) => b.title).join(', ')}`}
                    >
                      <span>↩</span> {backlinks.length} backlinks
                    </span>
                  )}
                </div>
              )}

              {/* Bottom Metadata Badges (Reminders, files, reading stopwatch) */}
              {(note.reminder || attachedFileCount > 0 || (note.totalReadingTime && note.totalReadingTime > 0) || activeStopwatch?.noteId === note.id) && (
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

                {attachedFileCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                    title={`${attachedFileCount} attached file${attachedFileCount === 1 ? '' : 's'}`}
                  >
                    <Paperclip className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>{attachedFileCount} {attachedFileCount === 1 ? 'file' : 'files'}</span>
                  </span>
                )}

                {((note.totalReadingTime && note.totalReadingTime > 0) || activeStopwatch?.noteId === note.id) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeStopwatch?.noteId === note.id) {
                        stopAndSaveReadingStopwatch();
                      } else {
                        startReadingStopwatch(note.id, activeNote.title, note.category);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                      activeStopwatch?.noteId === note.id
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25'
                    }`}
                    title={activeStopwatch?.noteId === note.id ? 'Stop reading and save time' : `Total reading time: ${Math.floor((note.totalReadingTime || 0) / 60)}m ${(note.totalReadingTime || 0) % 60}s. Click to start reading.`}
                  >
                    <Timer className={`w-3 h-3 ${activeStopwatch?.noteId === note.id ? 'animate-spin' : ''}`} />
                    {activeStopwatch?.noteId === note.id ? (
                      <span>Stop & Save</span>
                    ) : (
                      <span>{Math.floor((note.totalReadingTime || 0) / 60) > 0 ? `${Math.floor((note.totalReadingTime || 0) / 60)}m read` : `${note.totalReadingTime}s read`}</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
        )}

        {/* Themed Background Illustration */}
        <NoteThemeArtwork theme={activeNote.theme} />

        {/* Note Action Toolbar or Locked Category Notice */}
        {isCategoryLocked ? (
          <div className="px-3 py-2 flex items-center justify-between border-t border-black/5 dark:border-white/5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-amber-500" />
              <span>Category Locked</span>
            </span>
            <span className="text-stone-400 hover:text-amber-600 transition-colors">Click to unlock</span>
          </div>
        ) : (
          <div className="px-2 py-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-between border-t border-black/5 dark:border-white/5 sm:border-transparent">
            <NoteActions
              note={activeNote}
              isTrash={note.isTrash}
              onColorChange={(color) => updateNote(note.id, { color })}
              onThemeChange={(theme) => updateNote(note.id, { theme })}
              onArchiveToggle={() => toggleArchiveNote(note.id)}
              onDelete={() => trashNote(note.id)}
              onRestore={() => restoreNote(note.id)}
              onDeletePermanently={() => deleteNotePermanently(note.id)}
              onDuplicate={() => duplicateNote(note.id)}
              onShare={() => setSharingNote(activeNote)}
              onAddImage={handleAddImage}
              onEncrypt={() => setShowEncryptModal(true)}
              onLinkNote={() => setShowLinkModal(true)}
              onSelectCategory={(category) => updateNote(note.id, { category })}
              onToggleChecklist={() =>
                updateNote(note.id, {
                  isList: !note.isList,
                  todos: note.isList
                    ? []
                    : activeNote.content
                        .split('\n')
                        .filter((l) => l.trim())
                        .map((l, i) => ({ id: 'todo-' + i, text: l, completed: false })),
                })
              }
              onAddReminder={(reminder) => updateNote(note.id, { reminder })}
              onToggleLabel={handleToggleLabel}
              onOpenVersions={() => setVersionHistoryNote(note)}
              onStartReading={() => {
                setEditingNote(note);
                startReadingStopwatch(note.id, activeNote.title, note.category);
              }}
            />
          </div>
        )}
      </div>

      {/* Unlock Dialog for Encrypted Note */}
      <UnlockNoteModal
        note={note}
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        onUnlocked={(restored) => {
          setEditingNote(restored);
        }}
      />

      {/* Encrypt Settings Dialog */}
      <EncryptNoteModal
        note={activeNote}
        isOpen={showEncryptModal}
        onClose={() => setShowEncryptModal(false)}
        onEncrypted={async (updates) => {
          await updateNote(note.id, updates);
        }}
        onDecryptedPermanently={async () => {
          await updateNote(note.id, {
            isEncrypted: false,
            encryptedData: null,
            content: activeNote.content,
            todos: activeNote.todos,
            images: activeNote.images,
          });
        }}
      />

      {/* Link to another note Modal */}
      <LinkNoteModal
        currentNoteId={note.id}
        notes={notes}
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSelectNote={(target) => {
          const newContent = activeNote.content
            ? `${activeNote.content}\n\n[[${target.title || 'Untitled Note'}]]`
            : `[[${target.title || 'Untitled Note'}]]`;
          const currentLinks = activeNote.linkedNoteIds || [];
          const updatedLinks = Array.from(new Set([...currentLinks, target.id]));
          updateNote(note.id, { content: newContent, linkedNoteIds: updatedLinks });
        }}
      />
    </>
  );
};
