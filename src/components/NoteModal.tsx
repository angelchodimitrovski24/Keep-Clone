'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Timer,
  Play,
  Pause,
  Square,
  Share2,
  FilePlus,
  Sparkles,
  ArrowLeft,
  Edit2,
} from 'lucide-react';
import { Note, NoteColor, NoteBackgroundTheme, TodoItem, NoteDrawing, NoteVersion } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { NoteActions } from './NoteActions';
import { KeepFormattingBar } from './KeepFormattingBar';
import { KeepWysiwygEditor, KeepWysiwygEditorHandle } from './KeepWysiwygEditor';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useKeep } from '@/context/KeepContext';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';
import { GoogleKeepFormatCommand, resolveLocalMediaUrl } from '@/lib/formatUtils';
import { extractClipboardPayload, copyFilesToLocalFolder } from '@/lib/localPaste';
import { EncryptNoteModal } from './EncryptNoteModal';
import { LinkNoteModal } from './LinkNoteModal';
import { getBidirectionalLinks } from '@/lib/noteLinks';
import { encryptNote } from '@/lib/crypto';
import { getUnlockedNote, setUnlockedNote, getSessionPassword, lockNoteInSession } from '@/lib/encryptionSession';
import { NoteThemeArtwork } from './NoteThemeArtwork';
import { ChecklistItemInput } from './ChecklistItemInput';
import { EditReadingTimeModal } from './EditReadingTimeModal';

function formatStopwatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatReadingDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

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
    addNote,
    updateNote,
    toggleArchiveNote,
    trashNote,
    duplicateNote,
    setEditingNote,
    categories,
    unlockedCategoryNames,
    setUnlockCategoryModalTarget,
    setVersionHistoryNote,
    activeStopwatch,
    startReadingStopwatch,
    pauseReadingStopwatch,
    resumeReadingStopwatch,
    stopAndSaveReadingStopwatch,
    getNoteReadingStats,
    updateNoteReadingTime,
    deleteNoteReadingStats,
    setSharingNote,
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
  const [isEditingReadingTime, setIsEditingReadingTime] = useState(false);
  const [stopwatchToast, setStopwatchToast] = useState<string | null>(null);
  const [copiedUrlToast, setCopiedUrlToast] = useState(false);

  // Text selection and extract into new note
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [floatingBubblePos, setFloatingBubblePos] = useState<{ x: number; y: number } | null>(null);
  const [extractToast, setExtractToast] = useState<{ noteId: string; title: string } | null>(null);

  useEffect(() => {
    const handleSelection = () => {
      if (typeof window === 'undefined') return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectedText('');
        setFloatingBubblePos(null);
        return;
      }

      const text = sel.toString().trim();
      if (text.length >= 2 && modalContentRef.current) {
        try {
          const range = sel.getRangeAt(0);
          if (modalContentRef.current.contains(range.commonAncestorContainer)) {
            const rect = range.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
              setSelectedText(text);
              setFloatingBubblePos({
                x: Math.max(90, Math.min(window.innerWidth - 90, rect.left + rect.width / 2)),
                y: Math.max(20, rect.top - 46),
              });
              return;
            }
          }
        } catch {
          // ignore selection errors
        }
      }

      setSelectedText('');
      setFloatingBubblePos(null);
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  const handleExtractToNewNote = async (customText?: string) => {
    const raw = customText || selectedText || (typeof window !== 'undefined' ? window.getSelection()?.toString() : '') || '';
    const textToExtract = raw.trim();
    if (!textToExtract || !note) return;

    // Smart title extraction from first line
    const lines = textToExtract.split('\n').map((l) => l.trim()).filter(Boolean);
    const cleanFirstLine = lines[0] ? lines[0].replace(/<[^>]+>/g, '').replace(/^[#*\-•\d.]+\s*/, '') : 'Extracted Note';
    const newNoteTitle = cleanFirstLine.slice(0, 60) || 'Extracted Note';

    const created = await addNote({
      title: newNoteTitle,
      content: textToExtract,
      color: note.color,
      theme: note.theme,
      category: note.category,
      labels: note.labels,
      linkedNoteIds: [note.id],
    });

    if (created) {
      setLinkedNoteIds((prev) => Array.from(new Set([...prev, created.id])));
      setExtractToast({ noteId: created.id, title: newNoteTitle });
      setTimeout(() => setExtractToast(null), 6000);
    }

    setSelectedText('');
    setFloatingBubblePos(null);
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleCopyNoteUrl = () => {
    if (typeof window === 'undefined' || !note) return;
    const fullUrl = `${window.location.origin}/note/${encodeURIComponent(note.id)}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrlToast(true);
    setTimeout(() => setCopiedUrlToast(false), 2000);
  };

  const editorRef = useRef<KeepWysiwygEditorHandle | null>(null);

  const isThisNoteStopwatchActive = Boolean(note && activeStopwatch && activeStopwatch.noteId === note.id);
  const noteReadingStats = useMemo(
    () => (note ? getNoteReadingStats(note.id) : { totalSeconds: 0, sessionCount: 0 }),
    [note, getNoteReadingStats, isThisNoteStopwatchActive]
  );

  const handleStopStopwatch = async () => {
    const session = await stopAndSaveReadingStopwatch();
    if (session) {
      setStopwatchToast(`Saved ${formatReadingDuration(session.durationSeconds)} reading session!`);
      setTimeout(() => setStopwatchToast(null), 3500);
    }
  };

  const [autoSnapshotStatus, setAutoSnapshotStatus] = useState<'idle' | 'editing' | 'saved'>('idle');
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number | null>(null);

  const lastSnapshottedRef = useRef<{
    title: string;
    content: string;
    todos: TodoItem[];
    isList: boolean;
    color: NoteColor;
    theme: NoteBackgroundTheme;
    category?: string | null;
    labels?: string[];
    reminder?: string | null;
    isPinned?: boolean;
    timestamp: number;
  } | null>(null);

  const activeNoteIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRestoredVerIdRef = useRef<string | null>(null);

  const categoryObj = useMemo(
    () => (note?.category ? categories.find((c) => c.name === note.category) : null),
    [note?.category, categories]
  );

  const isCategoryLocked = useMemo(() => {
    if (!categoryObj?.isLocked) return false;
    return !unlockedCategoryNames.includes(categoryObj.name.toLowerCase());
  }, [categoryObj, unlockedCategoryNames]);

  // Sync state when note opens or note changes
  useEffect(() => {
    if (note) {
      const isDifferentNote = activeNoteIdRef.current !== note.id;

      if (isDifferentNote) {
        const unlocked = note.isEncrypted ? getUnlockedNote(note.id) : undefined;
        const initTitle = unlocked?.title || note.title || '';
        const initContent = unlocked?.content || note.content || '';
        const initTodos = unlocked?.todos || note.todos || [];

        setTitle(initTitle);
        setContent(initContent);
        setIsList(note.isList || false);
        setTodos(initTodos);
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
        setAutoSnapshotStatus('idle');

        activeNoteIdRef.current = note.id;
        lastSnapshottedRef.current = {
          title: initTitle.trim(),
          content: initContent.trim(),
          todos: JSON.parse(JSON.stringify(initTodos)),
          isList: note.isList || false,
          color: note.color || 'default',
          theme: note.theme || 'none',
          category: note.category || null,
          labels: [...(note.labels || [])],
          reminder: note.reminder || null,
          isPinned: note.isPinned || false,
          timestamp: note.updatedAt || Date.now(),
        };
      } else {
        // Same note: check if a historical version was just restored
        const latestVer = note.versions?.[0];
        if (
          latestVer &&
          latestVer.id !== lastRestoredVerIdRef.current &&
          latestVer.changeSummary?.startsWith('Restored version')
        ) {
          lastRestoredVerIdRef.current = latestVer.id;
          setTitle(latestVer.title || '');
          setContent(latestVer.content || '');
          setTodos(latestVer.todos ? JSON.parse(JSON.stringify(latestVer.todos)) : []);
          setIsList(latestVer.isList || false);
          setColor(latestVer.color || 'default');
          setTheme(latestVer.theme || 'none');
          lastSnapshottedRef.current = {
            title: (latestVer.title || '').trim(),
            content: (latestVer.content || '').trim(),
            todos: latestVer.todos ? JSON.parse(JSON.stringify(latestVer.todos)) : [],
            isList: latestVer.isList || false,
            color: latestVer.color || 'default',
            theme: latestVer.theme || 'none',
            timestamp: Date.now(),
          };
          setAutoSnapshotStatus('saved');
        }
      }
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

  const performAutoSnapshot = useCallback(
    async (reason?: string) => {
      if (!note) return;

      const rawContent = editorRef.current?.getHTML() || content;
      const latestContent = renderMarkdownTablesInHtml(rawContent);
      const trimmedTitle = title.trim();
      const trimmedContent = latestContent.trim();
      const finalTodos = newTodoInput.trim()
        ? [...todos, { id: 'todo-' + Date.now(), text: newTodoInput.trim(), completed: false }]
        : todos;

      const lastSnap = lastSnapshottedRef.current;
      const hasChanged =
        !lastSnap ||
        lastSnap.title !== trimmedTitle ||
        lastSnap.content !== trimmedContent ||
        JSON.stringify(lastSnap.todos) !== JSON.stringify(finalTodos) ||
        lastSnap.isList !== isList ||
        lastSnap.color !== color ||
        lastSnap.theme !== theme ||
        lastSnap.category !== (category || null) ||
        JSON.stringify(lastSnap.labels || []) !== JSON.stringify(labels || []) ||
        lastSnap.reminder !== reminder ||
        lastSnap.isPinned !== isPinned;

      if (!hasChanged) return;

      // Avoid creating empty snapshots on completely empty note
      if (!trimmedTitle && !trimmedContent && finalTodos.length === 0 && images.length === 0 && drawings.length === 0) {
        return;
      }

      const now = Date.now();
      const timeFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const changeSummary = reason || `Auto snapshot at ${timeFormatted}`;

      const newSnapshot: NoteVersion = {
        id: 'ver-' + now + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: now,
        title: trimmedTitle,
        content: trimmedContent,
        isList,
        todos: finalTodos ? JSON.parse(JSON.stringify(finalTodos)) : [],
        color,
        theme,
        changeSummary,
        wordCount: trimmedContent ? trimmedContent.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length : 0,
      };

      const existingVersions = note.versions || [];
      const prevVer = existingVersions[0];
      const isRecentAuto =
        prevVer &&
        now - prevVer.timestamp < 30000 &&
        (prevVer.changeSummary?.startsWith('Auto snapshot') || prevVer.changeSummary?.startsWith('Auto checkpoint'));

      let updatedVersions: NoteVersion[];
      if (isRecentAuto) {
        // Consolidate recent auto-snapshot
        updatedVersions = [{ ...newSnapshot, id: prevVer.id }, ...existingVersions.slice(1)];
      } else {
        // New version checkpoint
        updatedVersions = [newSnapshot, ...existingVersions];
      }

      lastSnapshottedRef.current = {
        title: trimmedTitle,
        content: trimmedContent,
        todos: finalTodos ? JSON.parse(JSON.stringify(finalTodos)) : [],
        isList,
        color,
        theme,
        category: category || null,
        labels: [...(labels || [])],
        reminder: reminder || null,
        isPinned: isPinned || false,
        timestamp: now,
      };

      if (note.isEncrypted) {
        const sessionPassword = getSessionPassword(note.id);
        if (sessionPassword) {
          try {
            const bundle = await encryptNote(
              {
                title: trimmedTitle,
                content: trimmedContent,
                todos: finalTodos,
                images,
              },
              sessionPassword,
              note.encryptedData?.hint
            );

            setUnlockedNote(note.id, {
              title: trimmedTitle,
              content: trimmedContent,
              todos: finalTodos,
              images,
            });

            await updateNote(note.id, {
              isEncrypted: true,
              encryptedData: bundle,
              title: note.title,
              content: '',
              todos: [],
              images: [],
              drawings,
              color,
              theme,
              category: category || null,
              labels,
              isPinned,
              reminder,
              linkedNoteIds,
              versions: updatedVersions,
            });
          } catch (err) {
            console.error('Failed to auto-snapshot encrypted note:', err);
          }
        }
      } else {
        await updateNote(note.id, {
          title: trimmedTitle,
          content: trimmedContent,
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
          versions: updatedVersions,
        });
      }

      setAutoSnapshotStatus('saved');
      setLastSnapshotTime(now);

      setTimeout(() => {
        setAutoSnapshotStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2500);
    },
    [
      note,
      title,
      content,
      newTodoInput,
      todos,
      isList,
      color,
      theme,
      category,
      labels,
      isPinned,
      reminder,
      images,
      drawings,
      linkedNoteIds,
      updateNote,
    ]
  );

  // Automatically trigger snapshots while editing note
  // Track editing state while actively working on note
  useEffect(() => {
    if (!isOpen || !note || activeNoteIdRef.current !== note.id) return;

    const rawContent = editorRef.current?.getHTML() || content;
    const latestContent = renderMarkdownTablesInHtml(rawContent);
    const trimmedTitle = title.trim();
    const trimmedContent = latestContent.trim();
    const lastSnap = lastSnapshottedRef.current;

    const hasChanged =
      !lastSnap ||
      lastSnap.title !== trimmedTitle ||
      lastSnap.content !== trimmedContent ||
      JSON.stringify(lastSnap.todos) !== JSON.stringify(todos) ||
      lastSnap.isList !== isList ||
      lastSnap.color !== color ||
      lastSnap.theme !== theme ||
      lastSnap.category !== (category || null) ||
      JSON.stringify(lastSnap.labels || []) !== JSON.stringify(labels || []) ||
      lastSnap.reminder !== reminder ||
      lastSnap.isPinned !== isPinned;

    if (hasChanged) {
      setAutoSnapshotStatus('editing');
    }
  }, [title, content, todos, isList, color, theme, category, labels, reminder, isPinned, isOpen, note?.id]);

  // Save snapshot and reading stopwatch when closing app, switching tabs, or backgrounding window
  useEffect(() => {
    if (!isOpen || !note) return;

    const handleAppClosing = () => {
      // 1. If reading stopwatch is active on this note, stop and save it
      if (activeStopwatch && activeStopwatch.noteId === note.id && activeStopwatch.elapsedSeconds > 0) {
        stopAndSaveReadingStopwatch();
      }
      // 2. Perform snapshot on close
      performAutoSnapshot('Snapshot on app close');
    };

    window.addEventListener('beforeunload', handleAppClosing);
    window.addEventListener('pagehide', handleAppClosing);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAppClosing();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleAppClosing);
      window.removeEventListener('pagehide', handleAppClosing);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, note, activeStopwatch, performAutoSnapshot, stopAndSaveReadingStopwatch]);

  const handleCategoryChange = useCallback(
    async (newCat: string | null) => {
      const val = newCat || null;
      setCategory(val);
      if (note) {
        await updateNote(note.id, { category: val });
        if (lastSnapshottedRef.current) {
          lastSnapshottedRef.current.category = val;
        }
      }
    },
    [note, updateNote]
  );

  const handleToggleLabel = useCallback(
    async (labelName: string) => {
      setLabels((prev) => {
        const next = prev.includes(labelName)
          ? prev.filter((l) => l !== labelName)
          : [...prev, labelName];
        if (note) {
          updateNote(note.id, { labels: next });
        }
        return next;
      });
    },
    [note, updateNote]
  );

  if (!isOpen || !note) return null;

  const handleSaveAndClose = async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);

    if (activeStopwatch && activeStopwatch.noteId === note.id && activeStopwatch.elapsedSeconds > 0) {
      await stopAndSaveReadingStopwatch();
    }

    const rawContent = editorRef.current?.getHTML() || content;
    const latestContent = renderMarkdownTablesInHtml(rawContent);
    const trimmedTitle = title.trim();
    const trimmedContent = latestContent.trim();
    const finalTodos = newTodoInput.trim()
      ? [...todos, { id: 'todo-' + Date.now(), text: newTodoInput.trim(), completed: false }]
      : todos;

    // Definitively save all current note changes to the database
    if (note.isEncrypted) {
      const sessionPassword = getSessionPassword(note.id);
      if (sessionPassword) {
        try {
          const bundle = await encryptNote(
            {
              title: trimmedTitle,
              content: trimmedContent,
              todos: finalTodos,
              images,
            },
            sessionPassword,
            note.encryptedData?.hint
          );
          setUnlockedNote(note.id, {
            title: trimmedTitle,
            content: trimmedContent,
            todos: finalTodos,
            images,
          });
          await updateNote(note.id, {
            isEncrypted: true,
            encryptedData: bundle,
            color,
            theme,
            category: category || null,
            labels,
            isPinned,
            reminder,
            drawings,
            linkedNoteIds,
          });
        } catch (err) {
          console.error('Failed saving encrypted note on close:', err);
        }
      }
    } else {
      await updateNote(note.id, {
        title: trimmedTitle,
        content: trimmedContent,
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
    }

    await performAutoSnapshot('Auto snapshot on close');
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

    // Insert into WYSIWYG editor or append markdown links to note content
    if (editorRef.current) {
      await editorRef.current.insertLocalFiles(filesArray);
    } else {
      try {
        const saved = await copyFilesToLocalFolder(filesArray);
        if (saved.length > 0) {
          const blocks = saved.map((f) => f.markdownLink).join('\n\n');
          setContent((prev) => (prev ? `${prev}\n\n${blocks}` : blocks));
        }
      } catch (err) {
        console.error('Failed to add media to note content:', err);
      }
    }
  };

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const colorClasses = getNoteColorClasses(color, theme);

  return (
    <div
      onClick={handleSaveAndClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-xs p-0 sm:p-4 md:p-8 sm:items-center sm:justify-center overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
        onPaste={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (e.defaultPrevented || (e.nativeEvent as any)?.__keepPasteHandled) return;
          const { files, imageUrls } = extractClipboardPayload(e.clipboardData);
          if (files.length > 0 || imageUrls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e.nativeEvent as any).__keepPasteHandled = true;
            e.preventDefault();

            if (editorRef.current) {
              editorRef.current.insertLocalFiles(files, imageUrls);
            } else {
              copyFilesToLocalFolder(files, undefined, imageUrls).then((saved) => {
                if (saved.length > 0) {
                  const blocks = saved.map((f) => f.markdownLink).join('\n\n');
                  setContent((prev) => (prev ? `${prev}\n\n${blocks}` : blocks));
                }
              });
            }
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (e.defaultPrevented || (e.nativeEvent as any)?.__keepPasteHandled) return;
          const { files, imageUrls } = extractClipboardPayload(e.dataTransfer);
          if (files.length > 0 || imageUrls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e.nativeEvent as any).__keepPasteHandled = true;
            e.preventDefault();

            if (editorRef.current) {
              editorRef.current.insertLocalFiles(files, imageUrls);
            } else {
              copyFilesToLocalFolder(files, undefined, imageUrls).then((saved) => {
                if (saved.length > 0) {
                  const blocks = saved.map((f) => f.markdownLink).join('\n\n');
                  setContent((prev) => (prev ? `${prev}\n\n${blocks}` : blocks));
                }
              });
            }
          }
        }}
        className={`w-full h-full sm:h-auto sm:max-w-3xl sm:min-h-[460px] sm:max-h-[92vh] rounded-none sm:rounded-2xl border-0 sm:border sm:border-stone-200/80 dark:sm:border-stone-700/80 shadow-none sm:keep-elevation-2 flex flex-col transition-all duration-150 relative overflow-hidden ${colorClasses}`}
      >
        {/* Themed Background Illustration */}
        <NoteThemeArtwork theme={theme} isModal={true} />
        {/* Images Gallery */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-1 p-2 bg-black/5 max-h-60 overflow-y-auto shrink-0">
            {images.map((img, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden max-h-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveLocalMediaUrl(img)} alt="Attachment" className="w-full h-full object-cover" />
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

        {/* Floating Bubble: Extract Selected Text into New Note */}
        {floatingBubblePos && selectedText && (
          <div
            style={{
              position: 'fixed',
              left: `${floatingBubblePos.x}px`,
              top: `${floatingBubblePos.y}px`,
              transform: 'translateX(-50%)',
              zIndex: 100,
            }}
            className="animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => handleExtractToNewNote()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xl border border-white/20 dark:border-black/20 text-xs font-semibold hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              title="Extract highlighted text into a brand new note"
            >
              <FilePlus className="w-3.5 h-3.5 text-amber-500" />
              <span>Extract to new note</span>
            </button>
          </div>
        )}

        {/* Success Toast after extracting note */}
        {extractToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xl border border-black/10 dark:border-white/10 animate-in fade-in slide-in-from-top-4 duration-200">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-medium">
              Extracted into note: <strong className="font-semibold">&quot;{extractToast.title}&quot;</strong>
            </span>
            <button
              type="button"
              onClick={async () => {
                await handleSaveAndClose();
                const targetNote = notes.find((n) => n.id === extractToast.noteId);
                if (targetNote) {
                  setEditingNote(targetNote);
                }
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            >
              Open Note
            </button>
            <button
              type="button"
              onClick={() => setExtractToast(null)}
              className="p-1 text-stone-400 hover:text-white dark:hover:text-stone-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header: Note Title (Shows FIRST, Full width, Word-wrapped, with Mobile Back & Done controls) */}
        <div className="px-3.5 sm:px-6 pt-3 sm:pt-5 pb-1.5 shrink-0">
          <div className="flex items-center gap-1 sm:gap-0">
            {/* Native Mobile App Back Arrow (←) */}
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="sm:hidden p-2 -ml-1.5 rounded-full text-stone-600 dark:text-stone-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
              title="Save and back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <textarea
              placeholder="Title"
              value={title}
              rows={1}
              onChange={(e) => {
                setTitle(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              className="w-full bg-transparent font-semibold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-none resize-none leading-snug overflow-hidden block"
              style={{ fontSize: 'calc(var(--note-font-size, 15px) * 1.25)' }}
            />

            {/* Mobile Done checkmark button */}
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="sm:hidden p-2 -mr-1.5 rounded-full text-stone-600 dark:text-stone-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
              title="Save and done"
            >
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </button>
          </div>

          {/* Beautiful Category & Labels directly under the Title */}
          {((category) || (labels && labels.length > 0)) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-1">
              {category && (() => {
                const catObj = categories.find((c) => c.name === category);
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold shadow-2xs group transition-all"
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
                      onClick={() => handleCategoryChange(null)}
                      className="hover:opacity-75 ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 text-stone-800 dark:text-stone-200 border border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15 transition-colors"
                >
                  <span className="text-stone-400 dark:text-stone-500 font-semibold">#</span>
                  <span>{lbl}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleLabel(lbl)}
                    className="hover:text-red-500 ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    title="Remove label"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Menus Toolbar (Positioned neatly BELOW the title, horizontally scrollable on mobile) */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 pb-2 pt-0.5 shrink-0 gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar border-b border-black/5 dark:border-white/5">
          {/* Left: AES Encryption status / Lock button */}
          <div className="flex items-center gap-2">
            {note.isEncrypted && (
              <div className="shrink-0 flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs"
                  title="Protected with AES-256-GCM zero-knowledge encryption"
                >
                  <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" /> AES-256 Protected
                </span>
                <button
                  type="button"
                  onClick={() => {
                    lockNoteInSession(note.id);
                    onClose();
                  }}
                  className="px-2 py-0.5 rounded-full bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-[11px] font-medium text-stone-700 dark:text-stone-300 transition-colors"
                  title="Lock note immediately (clears decrypted cache from session)"
                >
                  Lock Now
                </button>
              </div>
            )}
          </div>

          {/* Right: Menus & Action Buttons (Stopwatch, Auto-snapshot status, Extract, History, Preview, URL, Share, Pin) */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end ml-auto">
            {/* Reading Stopwatch Controls */}
            {isThisNoteStopwatchActive ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                <span className="relative flex h-2 w-2">
                  {activeStopwatch?.isRunning && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${activeStopwatch?.isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="font-mono font-semibold text-xs min-w-[36px] tracking-tight">
                  {formatStopwatchTime(activeStopwatch?.elapsedSeconds || 0)}
                </span>
                {activeStopwatch?.isRunning ? (
                  <button
                    type="button"
                    onClick={pauseReadingStopwatch}
                    className="p-1 hover:bg-emerald-500/20 rounded-full transition-colors text-emerald-700 dark:text-emerald-300"
                    title="Pause stopwatch"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeReadingStopwatch}
                    className="p-1 hover:bg-emerald-500/20 rounded-full transition-colors text-emerald-700 dark:text-emerald-300"
                    title="Resume stopwatch"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStopStopwatch}
                  className="px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs"
                  title="Stop reading and save time"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop & Save</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startReadingStopwatch(note.id, title, category)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/25 shadow-2xs"
                  title={`Start reading stopwatch. Total recorded: ${formatReadingDuration(noteReadingStats.totalSeconds)} (${noteReadingStats.sessionCount} sessions)`}
                >
                  <Timer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Start Reading</span>
                  {noteReadingStats.totalSeconds > 0 && (
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                      {formatReadingDuration(noteReadingStats.totalSeconds)}
                    </span>
                  )}
                </button>
                {noteReadingStats.totalSeconds > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsEditingReadingTime(true)}
                    className="p-1 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
                    title="Edit or reset reading time stats for this note"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {stopwatchToast && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full animate-in fade-in">
                ✓ {stopwatchToast}
              </span>
            )}

            {/* Live Auto-Snapshot Status Indicator */}
            {autoSnapshotStatus === 'editing' && (
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-in fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="hidden sm:inline">Auto-snapshotting…</span>
                <span className="sm:hidden">Saving…</span>
              </span>
            )}
            {autoSnapshotStatus === 'saved' && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Snapshot saved</span>
                <span className="sm:hidden">Saved</span>
              </span>
            )}

            {/* Extract Selected Text to New Note Button */}
            <button
              type="button"
              onClick={() => handleExtractToNewNote()}
              disabled={!selectedText}
              className={`p-2 rounded-full transition-colors relative ${
                selectedText
                  ? 'text-amber-600 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400 shadow-xs ring-1 ring-amber-500/50'
                  : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-black/10'
              }`}
              title={
                selectedText
                  ? `Extract selected text ("${selectedText.slice(0, 25)}...") into new note`
                  : 'Extract selected text into new note (highlight text in note to activate)'
              }
            >
              <FilePlus className="w-5 h-5" />
              {selectedText && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>

            {/* Version History Button */}
            <button
              type="button"
              onClick={async () => {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
                await performAutoSnapshot('Snapshot before viewing history');
                const latestNote = notes.find((n) => n.id === note.id) || note;
                setVersionHistoryNote(latestNote);
              }}
              className="p-2 rounded-full transition-colors text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/10 relative"
              title={`Version history (${note.versions?.length || 1} versions)`}
            >
              <History className="w-5 h-5" />
              {note.versions && note.versions.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 px-1 bg-amber-500 text-white text-[9px] font-bold rounded-full min-w-3.5 text-center leading-tight">
                  {note.versions.length}
                </span>
              )}
            </button>

            {/* Markdown Preview Button */}
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

            {/* Copy Note URL Button */}
            <button
              type="button"
              onClick={handleCopyNoteUrl}
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/10 transition-colors"
              title={`Copy note full URL (${typeof window !== 'undefined' ? window.location.origin : ''}/note/${note.id})`}
            >
              {copiedUrlToast ? <Check className="w-5 h-5 text-emerald-500" /> : <Link2 className="w-5 h-5" />}
            </button>

            {/* Share Note Button */}
            <button
              type="button"
              onClick={() => {
                setSharingNote({
                  ...note,
                  title,
                  content,
                  isList,
                  todos,
                  color,
                  theme,
                  labels,
                  category,
                  images,
                  drawings,
                });
              }}
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/10 transition-colors"
              title="Share note (Short link & images)"
            >
              <Share2 className="w-5 h-5" />
            </button>

            {/* Pin Note Button */}
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
            <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 overflow-y-auto flex-1 flex flex-col justify-between space-y-4">
          <div>
            {isList ? (
              <div className="space-y-2">
                {/* Active Interactive Checkboxes */}
                {activeTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-start gap-2.5 sm:gap-3 group py-1 min-w-0 w-full rounded-lg transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo.id)}
                      className="w-4 h-4 mt-1 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600 shrink-0"
                    />
                    <ChecklistItemInput
                      id={`modal-todo-${todo.id}`}
                      value={todo.text}
                      completed={todo.completed}
                      onChange={(val) => {
                        setTodos((prev) =>
                          prev.map((t) => (t.id === todo.id ? { ...t, text: val } : t))
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          // Add new empty todo item right below
                          const newId = 'todo-' + Date.now();
                          setTodos((prev) => {
                            const index = prev.findIndex((t) => t.id === todo.id);
                            const updated = [...prev];
                            updated.splice(index + 1, 0, { id: newId, text: '', completed: false });
                            return updated;
                          });
                          setTimeout(() => {
                            document.getElementById(`modal-todo-${newId}`)?.focus();
                          }, 50);
                        }
                        if (e.key === 'Backspace' && todo.text === '') {
                          e.preventDefault();
                          const index = todos.findIndex((t) => t.id === todo.id);
                          const prevTodo = todos[index - 1];
                          handleRemoveTodo(todo.id);
                          if (prevTodo) {
                            setTimeout(() => {
                              const prevEl = document.getElementById(`modal-todo-${prevTodo.id}`) as HTMLTextAreaElement | null;
                              if (prevEl) {
                                prevEl.focus();
                                prevEl.selectionStart = prevEl.value.length;
                                prevEl.selectionEnd = prevEl.value.length;
                              }
                            }, 50);
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTodo(todo.id)}
                      className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 hover:opacity-100 text-stone-400 hover:text-red-500 dark:hover:text-red-400 p-1 sm:p-1.5 transition-all shrink-0 mt-0.5"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add item row */}
                <div className="flex items-start gap-2.5 sm:gap-3 pt-2 border-t border-black/5 dark:border-white/5 min-w-0 w-full">
                  <Plus className="w-4 h-4 mt-1 text-stone-400 shrink-0" />
                  <ChecklistItemInput
                    id="modal-todo-new"
                    placeholder="List item"
                    value={newTodoInput}
                    onChange={setNewTodoInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddTodo();
                        setTimeout(() => {
                          document.getElementById('modal-todo-new')?.focus();
                        }, 50);
                      }
                    }}
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
                      <div className="space-y-2 pl-1 sm:pl-2">
                        {completedTodos.map((todo) => (
                          <div
                            key={todo.id}
                            className="flex items-start gap-2.5 sm:gap-3 group py-1 min-w-0 w-full rounded-lg transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                          >
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => handleToggleTodo(todo.id)}
                              className="w-4 h-4 mt-1 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600 shrink-0"
                            />
                            <ChecklistItemInput
                              id={`modal-todo-${todo.id}`}
                              value={todo.text}
                              completed={true}
                              onChange={(val) => {
                                setTodos((prev) =>
                                  prev.map((t) => (t.id === todo.id ? { ...t, text: val } : t))
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && todo.text === '') {
                                  e.preventDefault();
                                  handleRemoveTodo(todo.id);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveTodo(todo.id)}
                              className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 hover:opacity-100 text-stone-400 hover:text-red-500 dark:hover:text-red-400 p-1 sm:p-1.5 transition-all shrink-0 mt-0.5"
                              title="Delete item"
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
            </div>

            <div className="text-[11px] text-stone-400 dark:text-stone-500 flex items-center justify-between gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-1.5 font-mono text-[11px] bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md border border-black/5 dark:border-white/5">
                <Link2 className="w-3 h-3 text-stone-400 shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-[340px] text-stone-600 dark:text-stone-400 select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/note/${note.id}` : `/note/${note.id}`}
                </span>
                <button
                  type="button"
                  onClick={handleCopyNoteUrl}
                  className="hover:text-stone-700 dark:hover:text-stone-200 ml-1 font-sans text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline shrink-0"
                >
                  {copiedUrlToast ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Edited {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* Google Keep Authentic Formatting Bar (H1, H2, Aa, B, I, U, Lists, Clear) */}
        {!isList && isFormattingOpen && (
          <div className="px-3 sm:px-6 py-1.5 sm:py-2 border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2">
            <KeepFormattingBar
              onFormat={handleFormatText}
              onExtractSelection={() => handleExtractToNewNote()}
            />
          </div>
        )}

        {/* Footer toolbar */}
        <div className="flex items-center justify-between px-2.5 sm:px-5 py-2 sm:py-3.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 shrink-0 gap-2 relative">
          <div className="flex-1 min-w-0">
            <NoteActions
              note={{ color, theme, isList, labels, reminder, category }}
              onColorChange={setColor}
              onThemeChange={setTheme}
              onSelectCategory={handleCategoryChange}
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
              onShare={() => {
                setSharingNote({
                  ...note,
                  title,
                  content,
                  isList,
                  todos,
                  color,
                  theme,
                  labels,
                  category,
                  images,
                  drawings,
                });
              }}
              onToggleChecklist={handleToggleChecklist}
              onAddReminder={setReminder}
              onToggleLabel={handleToggleLabel}
              onEncrypt={() => setShowEncryptModal(true)}
              onLinkNote={() => setShowLinkModal(true)}
              onOpenVersions={() => setVersionHistoryNote(note)}
              onStartReading={() => startReadingStopwatch(note.id, title, category)}
              showFormattingToggle={!isList}
              isFormattingOpen={isFormattingOpen}
              onToggleFormatting={() => setIsFormattingOpen(!isFormattingOpen)}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-1.5 text-sm font-medium rounded-lg text-stone-800 dark:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 transition-colors shrink-0"
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

      {/* Edit Reading Time Modal */}
      {isEditingReadingTime && (
        <EditReadingTimeModal
          isOpen={true}
          onClose={() => setIsEditingReadingTime(false)}
          title={title || note.title || 'Untitled Note'}
          initialSeconds={noteReadingStats.totalSeconds}
          isSession={false}
          onSave={async (newSeconds) => {
            await updateNoteReadingTime(note.id, newSeconds);
          }}
          onDeleteStats={async () => {
            await deleteNoteReadingStats(note.id);
          }}
        />
      )}
    </div>
  );
};
