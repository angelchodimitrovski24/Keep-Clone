'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
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
  CalendarRange,
  ArrowLeft,
  Edit2,
  Printer,
  FileText,
  ClipboardCopy,
  Tag,
  Folder,
  Home,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react';
import {
  getClassicToolbarsServerSnapshot,
  getClassicToolbarsSnapshot,
  SlashAnchorRect,
  SlashNoteActionId,
  subscribeClassicToolbars,
  toggleClassicToolbarsPreference,
} from '@/lib/slashCommands';
import { Note, NoteColor, NoteBackgroundTheme, TodoItem, NoteDrawing, NoteVersion, NoteConnection, NoteConnectionRole } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { NoteActions, NoteActionsHandle } from './NoteActions';
import { KeepFormattingBar } from './KeepFormattingBar';
import { KeepWysiwygEditor, KeepWysiwygEditorHandle } from './KeepWysiwygEditor';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useKeep } from '@/context/KeepContext';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';
import { GoogleKeepFormatCommand, resolveLocalMediaUrl, copyNoteToClipboard } from '@/lib/formatUtils';
import { extractClipboardPayload, copyFilesToLocalFolder } from '@/lib/localPaste';
import { EncryptNoteModal } from './EncryptNoteModal';
import { LinkNoteModal } from './LinkNoteModal';
import { NoteConnectionsPanel } from './NoteConnectionsPanel';
import { getBidirectionalLinks, NoteLinkTarget } from '@/lib/noteLinks';
import { getBidirectionalLinksFromDB } from '@/lib/db';
import { encryptNote } from '@/lib/crypto';
import { getUnlockedNote, setUnlockedNote, getSessionPassword, lockNoteInSession } from '@/lib/encryptionSession';
import { NoteThemeArtwork } from './NoteThemeArtwork';
import { ChecklistItemInput } from './ChecklistItemInput';
import { EditReadingTimeModal } from './EditReadingTimeModal';
import { printNote } from '@/lib/printNote';
import { importMhtmlIntoNote } from '@/lib/mhtmlParser';
import { NotionSubpagesSection } from './NotionSubpagesSection';
import { ExtractUrlModal } from './ExtractUrlModal';
import { ExtractUrlResult } from '@/lib/urlExtractor';
import { convertMarkdownToHtml } from '@/lib/formatUtils';

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
  fullPage?: boolean;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  note,
  isOpen,
  onClose,
  onOpenDrawingModal,
  fullPage = false,
}) => {
  const {
    notes,
    addNote,
    updateNote,
    toggleArchiveNote,
    trashNote,
    restoreNote,
    deleteNotePermanently,
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
    setIsNotionTemplateModalOpen,
    setIsDateCompileModalOpen,
    openAiChatForNote,
    getNoteById,
    resolveNoteByTitleOrId,
    connectNotes,
    disconnectNotes,
    openInKnowledgeMap,
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
  const [connections, setConnections] = useState<NoteConnection[]>([]);
  const [isHub, setIsHub] = useState(false);
  const [childNoteIds, setChildNoteIds] = useState<string[]>([]);
  const childNoteIdsRef = useRef<string[]>([]);
  useEffect(() => {
    childNoteIdsRef.current = childNoteIds;
  }, [childNoteIds]);
  const [showSubpages, setShowSubpages] = useState(false);
  const [showCompletedTodos, setShowCompletedTodos] = useState(true);
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const [isExtractUrlModalOpen, setIsExtractUrlModalOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalRole, setLinkModalRole] = useState<NoteConnectionRole>('related');
  const [isEditingReadingTime, setIsEditingReadingTime] = useState(false);
  const [stopwatchToast, setStopwatchToast] = useState<string | null>(null);
  const [copiedUrlToast, setCopiedUrlToast] = useState(false);
  const [copiedContentToast, setCopiedContentToast] = useState(false);
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(false);
  const [subpagesAddSignal, setSubpagesAddSignal] = useState(0);
  const [slashNotice, setSlashNotice] = useState<string | null>(null);

  const showClassicToolbars = useSyncExternalStore(
    subscribeClassicToolbars,
    getClassicToolbarsSnapshot,
    getClassicToolbarsServerSnapshot
  );

  const handleToggleClassicToolbars = useCallback(() => {
    toggleClassicToolbarsPreference();
  }, []);

  // Text selection and extract into new note
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const noteActionsRef = useRef<NoteActionsHandle>(null);
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

  const handleCopyTitleAndContent = async () => {
    const rawContent = editorRef.current?.getHTML() || content;
    const noteData = {
      title,
      content: rawContent,
      isList,
      todos,
    };
    const success = await copyNoteToClipboard(noteData);
    if (success) {
      setCopiedContentToast(true);
      setTimeout(() => setCopiedContentToast(false), 2000);
    }
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

  const ancestorsKey = note?.parentNoteId ? `${note.id}:${note.parentNoteId}` : '';
  const [ancestorsState, setAncestorsState] = useState<{ noteKey: string; items: Note[] }>({
    noteKey: '',
    items: [],
  });

  useEffect(() => {
    if (!ancestorsKey || !note?.parentNoteId) return;
    let cancelled = false;

    const resolveChain = async () => {
      const chain: Note[] = [];
      const visited = new Set<string>([note.id]);
      let currParentId: string | null | undefined = note.parentNoteId;
      let depth = 0;

      while (currParentId && !visited.has(currParentId) && depth < 8) {
        visited.add(currParentId);
        const found =
          notes.find((n) => n.id === currParentId && !n.isTrash) ||
          (await getNoteById(currParentId));
        if (!found || found.isTrash) break;
        chain.unshift(found);
        currParentId = found.parentNoteId;
        depth++;
      }

      if (!cancelled) {
        setAncestorsState({ noteKey: ancestorsKey, items: chain });
      }
    };

    resolveChain().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ancestorsKey, note?.id, note?.parentNoteId, notes, getNoteById]);

  const ancestors = useMemo(
    () => (ancestorsKey && ancestorsState.noteKey === ancestorsKey ? ancestorsState.items : []),
    [ancestorsKey, ancestorsState]
  );

  // Only display images in the header gallery if they are NOT already embedded in the note's content
  const headerImages = useMemo(() => {
    if (!images || images.length === 0) return [];
    if (!content) return images;
    if (content.includes('<img ') || content.includes('data-keep-media') || /!\[[^\]]*\]\([^)]+\)/.test(content)) return [];
    return images.filter((img) => {
      const filename = img.split(/[/\\]/).pop() || img;
      return !content.includes(img) && !content.includes(filename) && !content.includes(encodeURIComponent(filename));
    });
  }, [images, content]);

  const nonInlineChildIds = useMemo(
    () => childNoteIds.filter((id) => !content.includes(`data-note-id="${id}"`)),
    [childNoteIds, content]
  );

  const isNotionPage = Boolean(
    (note && note.noteType === 'notion') ||
    showSubpages ||
    (childNoteIds && childNoteIds.length > 0)
  );

  const noteTextStats = useMemo(() => {
    const titleText = (title || '').trim();

    let bodyText = '';
    if (isList) {
      bodyText = (todos || [])
        .map((t) => t.text || '')
        .filter(Boolean)
        .join('\n');
    } else {
      const raw = editorRef.current?.getHTML() || content || '';
      bodyText = raw
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/p>|<\/div>|<br\s*\/?>|<\/li>|<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    }

    const combinedText = [titleText, bodyText].filter(Boolean).join('\n');
    const words = combinedText.trim()
      ? combinedText.trim().split(/\s+/).filter(Boolean).length
      : 0;
    const characters = combinedText.length;

    return { words, characters };
  }, [title, content, isList, todos]);

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
        setConnections(note.connections || []);
        setIsHub(Boolean(note.isHub));
        const nextChildIds = note.childNoteIds || [];
        setChildNoteIds(nextChildIds);
        childNoteIdsRef.current = nextChildIds;
        const hasNonInlineSubpages = nextChildIds.some(
          (id) => !initContent.includes(`data-note-id="${id}"`)
        );
        setShowSubpages(hasNonInlineSubpages);
        setShowConnectionsPanel(false);
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
        setLinkedNoteIds(note.linkedNoteIds || []);
        setConnections(note.connections || []);
        setIsHub(Boolean(note.isHub));
        setChildNoteIds(note.childNoteIds || []);
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
      connections,
      isHub,
    }),
    [note, title, content, linkedNoteIds, connections, isHub]
  );

  const currentNoteForConnections = useMemo(
    () => ({
      ...currentNoteForLinks,
      category,
      labels,
      childNoteIds,
    }),
    [currentNoteForLinks, category, labels, childNoteIds]
  );

  const memLinks = useMemo(
    () =>
      note
        ? getBidirectionalLinks(currentNoteForLinks, notes)
        : { outgoing: [], backlinks: [], prevNotes: [], nextNotes: [], sources: [] },
    [currentNoteForLinks, notes, note]
  );

  const [dbLinksState, setDbLinksState] = useState<{
    noteId: string;
    data: {
      outgoing: NoteLinkTarget[];
      backlinks: NoteLinkTarget[];
      prevNotes: NoteLinkTarget[];
      nextNotes: NoteLinkTarget[];
      sources: NoteLinkTarget[];
    };
  } | null>(null);

  const currentNoteLinksRef = useRef(currentNoteForLinks);
  useEffect(() => {
    currentNoteLinksRef.current = currentNoteForLinks;
  }, [currentNoteForLinks]);

  const linksSignature = useMemo(() => {
    if (!note?.id) return '';
    const inlineTokens: string[] = [];
    const wikiRe = /\[\[([^\]\n]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = wikiRe.exec(content)) !== null) {
      inlineTokens.push(m[1].trim().toLowerCase());
    }
    const attrRe = /data-note-(?:id|title)=["']([^"']+)["']/gi;
    while ((m = attrRe.exec(content)) !== null) {
      inlineTokens.push(m[1].trim().toLowerCase());
    }
    return `${note.id}|${(linkedNoteIds || []).join(',')}|${(connections || [])
      .map((c) => `${c.targetId}:${c.role}`)
      .join(',')}|${inlineTokens.join(',')}`;
  }, [note?.id, linkedNoteIds, connections, content]);

  useEffect(() => {
    if (!isOpen || !linksSignature) return;
    let cancelled = false;
    const snapshotNote = currentNoteLinksRef.current;
    const targetId = snapshotNote.id;
    const timer = setTimeout(() => {
      getBidirectionalLinksFromDB(snapshotNote)
        .then((res) => {
          if (!cancelled) setDbLinksState({ noteId: targetId, data: res });
        })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, linksSignature]);

  const dbLinks = isOpen && note && dbLinksState?.noteId === note.id ? dbLinksState.data : null;

  const { outgoing, backlinks, prevNotes, nextNotes, sources } = useMemo(() => {
    if (!dbLinks) return memLinks;

    const mergeList = (dbList: NoteLinkTarget[], memList: NoteLinkTarget[]) => {
      const map = new Map<string, NoteLinkTarget>();
      for (const item of dbList) map.set(item.id, item);
      for (const item of memList) {
        if (!map.has(item.id) && item.title !== 'Linked Note') {
          map.set(item.id, item);
        }
      }
      return Array.from(map.values());
    };

    return {
      outgoing: mergeList(dbLinks.outgoing, memLinks.outgoing),
      backlinks: mergeList(dbLinks.backlinks, memLinks.backlinks),
      prevNotes: mergeList(dbLinks.prevNotes, memLinks.prevNotes),
      nextNotes: mergeList(dbLinks.nextNotes, memLinks.nextNotes),
      sources: mergeList(dbLinks.sources, memLinks.sources),
    };
  }, [dbLinks, memLinks]);

  const performAutoSnapshot = useCallback(
    async (reason?: string) => {
      if (!note || activeNoteIdRef.current !== note.id) return;

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
              connections,
              isHub,
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
          connections,
          isHub,
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
      connections,
      isHub,
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
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        performAutoSnapshot('Auto checkpoint while editing').catch(() => {});
      }, 1500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [title, content, todos, isList, color, theme, category, labels, reminder, isPinned, isOpen, note?.id, performAutoSnapshot]);

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

  const saveCurrentNote = useCallback(async (snapshotReason?: string) => {
    if (!note || activeNoteIdRef.current !== note.id) return;
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
            connections,
            isHub,
            childNoteIds: childNoteIdsRef.current,
            noteType: isHub || showSubpages || childNoteIdsRef.current.length > 0 ? 'notion' : (note.noteType || 'default'),
          });
        } catch (err) {
          console.error('Failed saving encrypted note:', err);
        }
      }
    } else {
      await updateNote(
        note.id,
        {
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
          connections,
          isHub,
          childNoteIds: childNoteIdsRef.current,
          noteType: isHub || showSubpages || childNoteIdsRef.current.length > 0 ? 'notion' : (note.noteType || 'default'),
        },
        snapshotReason || 'Auto snapshot on save'
      );
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
      timestamp: Date.now(),
    };
    setAutoSnapshotStatus('saved');
  }, [
    note,
    activeStopwatch,
    stopAndSaveReadingStopwatch,
    content,
    title,
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
    connections,
    isHub,
    showSubpages,
    updateNote,
  ]);

  const isClosingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
    }
  }, [isOpen, note?.id]);

  const handleSaveAndClose = useCallback(async () => {
    if (isClosingRef.current) {
      onClose();
      return;
    }
    isClosingRef.current = true;
    try {
      if (note) {
        await Promise.race([
          saveCurrentNote('Auto snapshot on close'),
          new Promise<void>((resolve) => setTimeout(resolve, 250)),
        ]);
      }
    } catch (err) {
      console.error('Failed saving note on close:', err);
    } finally {
      onClose();
    }
  }, [note, onClose, saveCurrentNote]);

  useEffect(() => {
    if (!isOpen || !note) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const hasOpenFloatingMenu = Boolean(
          document.querySelector('[data-slash-menu="true"]') ||
          document.querySelector('[data-mention-menu="true"]') ||
          document.querySelector('[data-subpage-menu="true"]') ||
          document.querySelector('[data-portal="true"]')
        );
        const hasOpenSubModal =
          showEncryptModal ||
          showLinkModal ||
          isEditingReadingTime ||
          isExtractUrlModalOpen;
        if (!hasOpenSubModal && !hasOpenFloatingMenu) {
          handleSaveAndClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showEncryptModal, showLinkModal, isEditingReadingTime, isExtractUrlModalOpen, handleSaveAndClose]);

  const handlePrint = () => {
    if (!note) return;
    const rawContent = editorRef.current?.getHTML() || content;
    printNote(
      {
        ...note,
        title,
        content: rawContent,
        isList,
        todos,
        color,
        theme,
        labels,
        category,
        images,
        drawings,
      },
      categories
    );
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

  const todoListRef = useRef<HTMLDivElement>(null);
  const todoRowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [todoDragState, setTodoDragState] = useState<{
    sourceIndex: number;
    dropBoundaryIndex: number;
    indicatorTop: number;
  } | null>(null);

  const startTodoDrag = (sourceIndex: number, e: React.PointerEvent<HTMLButtonElement>) => {
    const containerEl = todoListRef.current;
    if (!containerEl) return;

    e.preventDefault();
    e.stopPropagation();

    const activeCount = activeTodos.length;
    const computeDrop = (clientY: number) => {
      const containerRect = containerEl.getBoundingClientRect();
      const els = todoRowRefs.current.slice(0, activeCount);
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) {
          return { boundary: i, indicatorTop: r.top - containerRect.top };
        }
      }
      const lastEl = els[els.length - 1];
      return {
        boundary: els.length,
        indicatorTop: (lastEl ? lastEl.getBoundingClientRect().bottom : containerRect.bottom) - containerRect.top,
      };
    };

    let latestDrop = computeDrop(e.clientY);
    setTodoDragState({
      sourceIndex,
      dropBoundaryIndex: latestDrop.boundary,
      indicatorTop: latestDrop.indicatorTop,
    });

    const onMove = (moveEvent: PointerEvent) => {
      latestDrop = computeDrop(moveEvent.clientY);
      setTodoDragState({
        sourceIndex,
        dropBoundaryIndex: latestDrop.boundary,
        indicatorTop: latestDrop.indicatorTop,
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setTodoDragState(null);

      if (
        latestDrop.boundary !== sourceIndex &&
        latestDrop.boundary !== sourceIndex + 1
      ) {
        setTodos((prev) => {
          const active = prev.filter((t) => !t.completed);
          const completed = prev.filter((t) => t.completed);
          if (sourceIndex < 0 || sourceIndex >= active.length) return prev;
          const [moved] = active.splice(sourceIndex, 1);
          const insertAt =
            latestDrop.boundary > sourceIndex ? latestDrop.boundary - 1 : latestDrop.boundary;
          active.splice(insertAt, 0, moved);
          return [...active, ...completed];
        });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleToggleChecklist = () => {
    if (isList) {
      // Convert list items to a single clean task list HTML block
      const htmlFromTodos = todos.length > 0
        ? `<ul data-type="taskList">${todos
            .map(
              (t) =>
                `<li data-type="taskItem" data-checked="${Boolean(t.completed)}"><label><input type="checkbox"${
                  t.completed ? ' checked="checked"' : ''
                }><span></span></label><div><p>${t.text}</p></div></li>`
            )
            .join('')}</ul>`
        : '';
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
            .replace(/^\d+\.\s+/, '')
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

  const handleExtractedUrlInModal = (result: ExtractUrlResult) => {
    if (!title.trim() && result.title) {
      setTitle(result.title);
    }
    const htmlContent = convertMarkdownToHtml(result.markdown);
    if (editorRef.current) {
      editorRef.current.insertContent(htmlContent);
    } else {
      setContent((prev) => (prev ? `${prev}\n\n${htmlContent}` : htmlContent));
    }
    if (result.labels && result.labels.length > 0) {
      setLabels((prev) => Array.from(new Set([...prev, ...result.labels!])));
    }
    if (result.images && result.images.length > 0) {
      const newImagePaths = result.images.map((img) => img.savedPath || img.serveUrl);
      // Images are already embedded inline in editorContent, do not add to header gallery
    }
  };

  const handleInsertDataview = () => {
    if (editorRef.current) {
      editorRef.current.handleFormat('dataview');
    } else {
      const snippet = '\n\n```dataview\nNOTION\nWHERE !isArchived\nSORT updatedAt DESC\nLIMIT 10\n```\n\n';
      setContent((prev) => (prev ? `${prev}${snippet}` : snippet.trim()));
    }
  };

const handleImportMhtml = async (file: File) => {
    await importMhtmlIntoNote({
      file,
      currentTitle: title,
      onUpdateTitle: (newTitle) => setTitle(newTitle),
      onInsertEditorContent: (html) => editorRef.current?.insertContent(html),
      onAppendContent: (md) => setContent((prev) => (prev ? `${prev}\n\n${md}` : md)),
    });
  };

const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    e.target.value = '';

    const mhtmlFiles = filesArray.filter((f) =>
      f.name.toLowerCase().endsWith('.mhtml') ||
      f.name.toLowerCase().endsWith('.mht') ||
      f.name.toLowerCase().endsWith('.html') ||
      f.name.toLowerCase().endsWith('.htm') ||
      f.type.includes('message/rfc822') ||
      f.type.includes('multipart/related') ||
      f.type.includes('text/html')
    );
    const otherFiles = filesArray.filter((f) => !mhtmlFiles.includes(f));

    for (const mf of mhtmlFiles) {
      await handleImportMhtml(mf);
    }

    if (otherFiles.length === 0) return;

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
  const totalConnectionsCount =
    ancestors.length + outgoing.length + backlinks.length + prevNotes.length + nextNotes.length + sources.length;

  const availableNoteSlashActions = useMemo<SlashNoteActionId[]>(() => {
    const actions: SlashNoteActionId[] = [
      'wiki-link',
      'subpage',
      'toggle-subpages',
      'link-note',
      'file-hub',
      'next-note',
      'source-note',
      'toggle-hub',
      'connections',
      'knowledge-map',
      'image',
      'extract-url',
      'import-mhtml',
      'notion-template',
      'date-digest',
      'category',
      'label',
      'color',
      'reminder',
      'checklist-mode',
      'formatting-toolbar',
      'stopwatch',
      'edit-reading-time',
      'ai-chat',
      'ai-suggest',
      'extract-selection',
      'encrypt',
      'history',
      'preview',
      'pin',
      'copy-url',
      'copy-content',
      'share',
      'duplicate',
      'print',
      'archive',
      'trash',
      'close',
    ];
    if (onOpenDrawingModal) {
      actions.push('drawing');
    }
    return actions;
  }, [onOpenDrawingModal]);

  const showSlashNotice = (msg: string) => {
    setSlashNotice(msg);
    setTimeout(() => setSlashNotice(null), 2600);
  };

  const handleSlashNoteAction = async (actionId: SlashNoteActionId, anchorRect: SlashAnchorRect) => {
    if (!note) return;
    switch (actionId) {
      case 'subpage':
        setShowSubpages(true);
        setSubpagesAddSignal((n) => n + 1);
        break;
      case 'toggle-subpages':
        setShowSubpages((prev) => !prev);
        break;
      case 'link-note':
        setLinkModalRole('related');
        setShowLinkModal(true);
        break;
      case 'file-hub':
        setLinkModalRole('part_of');
        setShowLinkModal(true);
        break;
      case 'next-note':
        setLinkModalRole('next');
        setShowLinkModal(true);
        break;
      case 'source-note':
        setLinkModalRole('source');
        setShowLinkModal(true);
        break;
      case 'toggle-hub': {
        const nextHub = !isHub;
        setIsHub(nextHub);
        if (nextHub) setShowSubpages(true);
        await updateNote(note.id, {
          isHub: nextHub,
          noteType: nextHub ? 'notion' : (note.noteType || 'default'),
        });
        break;
      }
      case 'connections':
        setShowConnectionsPanel((prev) => !prev);
        break;
      case 'knowledge-map':
        await saveCurrentNote('Auto snapshot before opening Knowledge Map');
        onClose();
        openInKnowledgeMap(note.id);
        break;
      case 'image':
        noteActionsRef.current?.triggerImageUpload();
        break;
      case 'drawing':
        onOpenDrawingModal?.(note.id);
        break;
      case 'extract-url':
        setIsExtractUrlModalOpen(true);
        break;
      case 'import-mhtml':
        noteActionsRef.current?.triggerMhtmlUpload();
        break;
      case 'notion-template':
        setIsNotionTemplateModalOpen(true);
        break;
      case 'date-digest':
        setIsDateCompileModalOpen(true);
        break;
      case 'category':
        noteActionsRef.current?.openCategoryPicker(anchorRect);
        break;
      case 'label':
        noteActionsRef.current?.openLabelPicker(anchorRect);
        break;
      case 'color':
        noteActionsRef.current?.openColorPicker(anchorRect);
        break;
      case 'reminder':
        noteActionsRef.current?.openReminderPicker(anchorRect);
        break;
      case 'checklist-mode':
        handleToggleChecklist();
        break;
      case 'formatting-toolbar':
        setIsFormattingOpen((prev) => !prev);
        break;
      case 'stopwatch':
        if (isThisNoteStopwatchActive) {
          await handleStopStopwatch();
        } else {
          startReadingStopwatch(note.id, title, category);
        }
        break;
      case 'edit-reading-time':
        setIsEditingReadingTime(true);
        break;
      case 'ai-chat':
        openAiChatForNote({
          ...note,
          title,
          content: editorRef.current?.getHTML() || content,
          isList,
          todos,
          color,
          theme,
          labels,
          reminder,
          category,
        });
        break;
      case 'ai-suggest':
        setShowConnectionsPanel(true);
        break;
      case 'extract-selection':
        if (selectedText) {
          await handleExtractToNewNote();
        } else {
          showSlashNotice('Highlight some text first to extract it into a new note');
        }
        break;
      case 'encrypt':
        setShowEncryptModal(true);
        break;
      case 'history': {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
        await performAutoSnapshot('Snapshot before viewing history');
        const latestNote = notes.find((n) => n.id === note.id) || note;
        setVersionHistoryNote(latestNote);
        break;
      }
      case 'preview':
        setIsPreviewMode((prev) => !prev);
        break;
      case 'pin':
        setIsPinned((prev) => !prev);
        break;
      case 'copy-url':
        handleCopyNoteUrl();
        break;
      case 'copy-content':
        await handleCopyTitleAndContent();
        break;
      case 'share':
        setSharingNote({
          ...note,
          title,
          content: editorRef.current?.getHTML() || content,
          isList,
          todos,
          color,
          theme,
          labels,
          category,
          images,
          drawings,
        });
        break;
      case 'duplicate':
        await handleSaveAndClose();
        await duplicateNote(note.id);
        break;
      case 'print':
        handlePrint();
        break;
      case 'archive':
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
        await saveCurrentNote('Auto snapshot before archive toggle');
        await toggleArchiveNote(note.id);
        onClose();
        break;
      case 'trash':
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
        activeNoteIdRef.current = null;
        await trashNote(note.id);
        onClose();
        break;
      case 'close':
        await handleSaveAndClose();
        break;
    }
  };

  if (!isOpen || !note) return null;

  return (
    <div
      onClick={!fullPage ? (e) => {
        if (e.target === e.currentTarget) {
          handleSaveAndClose();
        }
      } : undefined}
      className={
        fullPage
          ? "w-full max-w-5xl mx-auto flex flex-col pb-8 animate-in fade-in duration-150"
          : "fixed inset-0 z-50 flex flex-col bg-black/55 backdrop-blur-xs p-0 sm:p-4 md:p-8 sm:items-center sm:justify-center overflow-y-auto animate-in fade-in duration-150"
      }
    >
      <div
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
        onPaste={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (e.defaultPrevented || (e.nativeEvent as any)?.__keepPasteHandled) return;
          const target = e.target as HTMLElement | null;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
          }
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
        className={
          fullPage
            ? `w-full min-h-[calc(100vh-160px)] rounded-2xl border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex flex-col transition-all duration-150 relative overflow-hidden ${colorClasses}`
            : `w-full h-full sm:h-auto sm:max-w-3xl sm:min-h-[460px] sm:max-h-[92vh] rounded-none sm:rounded-2xl border-0 sm:border sm:border-stone-200/80 dark:sm:border-stone-700/80 shadow-none sm:keep-elevation-2 flex flex-col transition-all duration-150 relative overflow-hidden ${colorClasses}`
        }
      >
        {/* Themed Background Illustration */}
        <NoteThemeArtwork theme={theme} isModal={true} />
        {/* Images Gallery */}
        {headerImages.length > 0 && (
          <div className="grid grid-cols-2 gap-1 p-2 bg-black/5 max-h-36 sm:max-h-60 overflow-y-auto shrink-0">
            {headerImages.map((img, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden max-h-32 sm:max-h-48">
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
                await saveCurrentNote('Auto snapshot before opening extracted note');
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

        {slashNotice && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xl text-xs font-medium animate-in fade-in duration-150">
            <span>{slashNotice}</span>
          </div>
        )}

        {/* Unified Notion Clean Top Header Bar */}
        <div className="px-3 sm:px-5 h-11 flex items-center justify-between gap-2 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0 select-none">
          {/* Left: Back arrow + Clean Breadcrumb + Only Active Metadata Badges */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              onClick={handleSaveAndClose}
              className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors shrink-0 cursor-pointer ${
                fullPage ? '' : 'sm:hidden'
              }`}
              title={fullPage ? 'Back to notes' : 'Save and close'}
            >
              <ArrowLeft className="w-4 h-4" />
              {fullPage && <span className="hidden sm:inline font-medium">Notes</span>}
            </button>

            {fullPage && (
              <span className="hidden sm:inline text-stone-300 dark:text-stone-600 shrink-0">/</span>
            )}

            {ancestors.map((anc) => (
              <React.Fragment key={anc.id}>
                <button
                  type="button"
                  onClick={async () => {
                    await saveCurrentNote('Auto snapshot before returning to parent');
                    setEditingNote(anc);
                  }}
                  className="hover:underline inline-flex items-center gap-1 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 cursor-pointer shrink-0 max-w-[140px]"
                >
                  {anc.isHub && <span className="text-[11px]">🏠</span>}
                  <span className="truncate">{anc.title || 'Untitled'}</span>
                </button>
                <span className="text-stone-300 dark:text-stone-600 shrink-0">/</span>
              </React.Fragment>
            ))}

            <span className="text-stone-800 dark:text-stone-200 font-medium truncate max-w-[190px]">
              {title || 'Untitled'}
            </span>

            {/* Quiet Active Category Pill (clickable to change or remove) */}
            {category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-black/[0.04] dark:bg-white/[0.07] text-stone-600 dark:text-stone-300 shrink-0">
                <button
                  type="button"
                  onClick={(e) => noteActionsRef.current?.openCategoryPicker(e.currentTarget)}
                  className="inline-flex items-center gap-1 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                  title="Change category"
                >
                  <span>{categoryObj?.icon || '📁'}</span>
                  <span className="truncate max-w-[100px]">{category}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange(null)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                  title="Remove category"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}

            {/* Quiet Active Labels (only when assigned) */}
            {labels.map((lbl) => (
              <span
                key={lbl}
                className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-stone-500 dark:text-stone-400 bg-black/[0.03] dark:bg-white/[0.05] shrink-0"
              >
                <span>#{lbl}</span>
                <button
                  type="button"
                  onClick={() => handleToggleLabel(lbl)}
                  className="hover:text-red-500 cursor-pointer"
                  title="Remove label"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}

            {/* Quiet Active Hub badge (only when Hub) */}
            {isHub && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/12 text-amber-700 dark:text-amber-300 shrink-0">
                <span>🏠</span>
                <span className="hidden sm:inline">Hub</span>
              </span>
            )}

            {/* Encryption Protected badge (only when encrypted) */}
            {note.isEncrypted && (
              <div className="shrink-0 flex items-center gap-1">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/12 text-amber-700 dark:text-amber-300"
                  title="Protected with AES-256-GCM encryption"
                >
                  <Lock className="w-3 h-3" />
                  <span className="hidden sm:inline">Encrypted</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    lockNoteInSession(note.id);
                    onClose();
                  }}
                  className="px-1.5 py-0.5 rounded text-[11px] text-stone-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
                  title="Lock note now"
                >
                  Lock
                </button>
              </div>
            )}

            {/* Running Stopwatch Pill (only when active) */}
            {isThisNoteStopwatchActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] shrink-0">
                <span className="font-mono font-semibold">
                  {formatStopwatchTime(activeStopwatch?.elapsedSeconds || 0)}
                </span>
                {activeStopwatch?.isRunning ? (
                  <button
                    type="button"
                    onClick={pauseReadingStopwatch}
                    className="p-0.5 hover:bg-emerald-500/20 rounded"
                    title="Pause stopwatch"
                  >
                    <Pause className="w-3 h-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeReadingStopwatch}
                    className="p-0.5 hover:bg-emerald-500/20 rounded"
                    title="Resume stopwatch"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStopStopwatch}
                  className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold"
                  title="Stop & Save reading time"
                >
                  Stop
                </button>
              </div>
            )}
          </div>

          {/* Right: Quiet Edit Status + Share + Pin + ••• Menu + Close & Save */}
          <div className="flex items-center gap-1 shrink-0">
            {stopwatchToast && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 px-1.5 hidden sm:inline">
                ✓ {stopwatchToast}
              </span>
            )}

            <span className="hidden md:inline text-[11.5px] text-stone-400 dark:text-stone-500 mr-1.5 whitespace-nowrap">
              {autoSnapshotStatus === 'editing'
                ? 'Saving…'
                : autoSnapshotStatus === 'saved'
                ? 'Saved'
                : note.updatedAt
                ? `Edited ${new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Edited just now'}
            </span>

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
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12.5px] font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
              title="Share note"
            >
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                isPinned
                  ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/15'
                  : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
              }`}
              title={isPinned ? 'Unpin note' : 'Pin note'}
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                noteActionsRef.current?.openMoreMenu(e.currentTarget);
              }}
              className="p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
              title="Page options, menus & toolbars"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSaveAndClose}
              className="ml-0.5 px-2.5 py-1 text-xs font-medium rounded-md text-stone-700 dark:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer whitespace-nowrap"
              title={fullPage ? 'Close & Save' : 'Done'}
            >
              {fullPage ? 'Close & Save' : 'Done'}
            </button>
          </div>
        </div>

        {/* Classic Toolbars (Hidden by default in clean Notion mode; toggle via /toolbar or ••• menu) */}
        {showClassicToolbars && (
          <div className="px-3.5 sm:px-6 py-2 border-b border-black/[0.06] dark:border-white/[0.07] space-y-2 bg-black/[0.015] dark:bg-white/[0.015] shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {category ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
                  <button
                    type="button"
                    onClick={(e) => noteActionsRef.current?.openCategoryPicker(e.currentTarget)}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{categoryObj?.icon || '📁'}</span>
                    <span>{category}</span>
                  </button>
                  <button type="button" onClick={() => handleCategoryChange(null)} title="Remove category">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => noteActionsRef.current?.openCategoryPicker(e.currentTarget)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>+ Category</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => noteActionsRef.current?.openLabelPicker(e.currentTarget)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>+ Label</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const nextHub = !isHub;
                  setIsHub(nextHub);
                  if (nextHub) setShowSubpages(true);
                  await updateNote(note.id, {
                    isHub: nextHub,
                    noteType: nextHub ? 'notion' : (note.noteType || 'default'),
                  });
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  isHub
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                }`}
              >
                <Home className={`w-3.5 h-3.5 ${isHub ? 'text-amber-500' : 'text-stone-400'}`} />
                <span>{isHub ? 'Hub ✓' : 'Make Hub'}</span>
              </button>

              {!isThisNoteStopwatchActive && (
                <button
                  type="button"
                  onClick={() => startReadingStopwatch(note.id, title, category)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 cursor-pointer"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>Start Reading</span>
                  {noteReadingStats.totalSeconds > 0 && (
                    <span className="text-[10px] font-mono">{formatReadingDuration(noteReadingStats.totalSeconds)}</span>
                  )}
                </button>
              )}

              {noteReadingStats.totalSeconds > 0 && (
                <button
                  type="button"
                  onClick={() => setIsEditingReadingTime(true)}
                  className="p-1 text-stone-400 hover:text-emerald-600 rounded-full"
                  title="Edit reading time stats"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => handleExtractToNewNote()}
                  disabled={!selectedText}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-40"
                  title="Extract highlighted text to new note"
                >
                  <FilePlus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                    if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
                    await performAutoSnapshot('Snapshot before viewing history');
                    const latestNote = notes.find((n) => n.id === note.id) || note;
                    setVersionHistoryNote(latestNote);
                  }}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  title="Version history"
                >
                  <History className="w-4 h-4" />
                </button>
                {!isList && (
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                    title="Toggle markdown preview"
                  >
                    {isPreviewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyNoteUrl}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  title="Copy note URL"
                >
                  {copiedUrlToast ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyTitleAndContent}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  title="Copy title & content"
                >
                  {copiedContentToast ? <Check className="w-4 h-4 text-emerald-500" /> : <ClipboardCopy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  title="Print note"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

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
            <div className="overflow-y-auto flex-1 flex flex-col">
              <div
                className={`w-full flex-1 flex flex-col justify-between space-y-5 ${
                  fullPage
                    ? 'max-w-[760px] mx-auto px-5 sm:px-10 py-6 sm:py-10'
                    : 'px-4 sm:px-7 py-5 sm:py-6'
                }`}
              >
            <div className="space-y-3">
              {/* Clean Notion Page Title */}
              <div className="flex items-start gap-2.5">
                {(isHub || categoryObj?.icon) && (
                  <span className="text-2xl sm:text-3xl leading-none select-none shrink-0 mt-1">
                    {isHub ? '🏠' : categoryObj?.icon}
                  </span>
                )}
                <textarea
                  placeholder="Untitled"
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
                  className="w-full bg-transparent text-stone-900 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600 outline-none resize-none leading-tight overflow-hidden block font-bold text-2xl sm:text-[34px] tracking-[-0.025em]"
                />
              </div>

              {/* 1. Notion-style Sub-pages list (Only for non-inline sub-pages or when manually toggled) */}
              {(nonInlineChildIds.length > 0 || showSubpages) && (
                <div className="pt-0.5 pb-1">
                  <NotionSubpagesSection
                    parentNoteId={note.id}
                    childNoteIds={nonInlineChildIds}
                    excludeChildIds={childNoteIds.filter((id) => content.includes(`data-note-id="${id}"`))}
                    onChangeChildIds={async (newNonInlineIds) => {
                      const latestContent = editorRef.current?.getHTML() || content;
                      const inlineIds = childNoteIdsRef.current.filter((id) =>
                        latestContent.includes(`data-note-id="${id}"`)
                      );
                      const merged = Array.from(new Set([...inlineIds, ...newNonInlineIds]));
                      childNoteIdsRef.current = merged;
                      setChildNoteIds(merged);
                      await updateNote(note.id, { childNoteIds: merged });
                    }}
                    onOpenChildNote={async (childNote) => {
                      await Promise.race([
                        saveCurrentNote('Auto snapshot before opening sub-page'),
                        new Promise<void>((r) => setTimeout(r, 250)),
                      ]);
                      setEditingNote(childNote);
                    }}
                    category={category}
                    autoOpenAddSignal={subpagesAddSignal}
                  />
                </div>
              )}

              {/* 2. Interactive Checklist Items (if checkboxes are enabled) */}
              {isList && (
                <div className={`space-y-2 ${isNotionPage ? 'pt-3 border-t border-black/5 dark:border-white/5' : ''}`}>
                  {/* Active Interactive Checkboxes */}
                  <div ref={todoListRef} className="space-y-2 relative">
                    {todoDragState && (
                      <div
                        data-todo-drop-indicator="true"
                        style={{ top: `${todoDragState.indicatorTop}px` }}
                        className="pointer-events-none absolute left-0 right-0 z-30 flex items-center"
                      >
                        <div className="w-2 h-2 -ml-1 rounded-full bg-blue-500 shadow-xs" />
                        <div className="flex-1 h-[2px] bg-blue-500 shadow-xs" />
                      </div>
                    )}
                  {activeTodos.map((todo, todoIdx) => (
                    <div
                      key={todo.id}
                      ref={(el) => {
                        todoRowRefs.current[todoIdx] = el;
                      }}
                      className={`relative flex items-start gap-2.5 sm:gap-3 group py-1 min-w-0 w-full rounded-lg transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${
                        todoDragState?.sourceIndex === todoIdx ? 'opacity-50' : ''
                      }`}
                    >
                      <button
                        type="button"
                        data-todo-drag-handle="true"
                        onPointerDown={(e) => startTodoDrag(todoIdx, e)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="hidden sm:flex items-center justify-center sm:absolute sm:-left-6 sm:top-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-grab active:cursor-grabbing transition-opacity touch-none"
                        title="Drag item up or down"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </button>
                      <div className="keep-checklist-control">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={() => handleToggleTodo(todo.id)}
                          className="keep-checklist-checkbox rounded text-blue-600 focus:ring-0"
                        />
                      </div>
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
                      <div className="keep-checklist-control">
                        <button
                          type="button"
                          onClick={() => handleRemoveTodo(todo.id)}
                          className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 hover:opacity-100 text-stone-400 hover:text-red-500 dark:hover:text-red-400 p-1 sm:p-1.5 transition-all"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>

                  {/* Add item row */}
                  <div className="flex items-start gap-2.5 sm:gap-3 pt-2 border-t border-black/5 dark:border-white/5 min-w-0 w-full">
                    <div className="keep-checklist-control">
                      <Plus className="w-[0.95em] h-[0.95em] min-w-4 min-h-4 text-stone-400" />
                    </div>
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
                              <div className="keep-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={todo.completed}
                                  onChange={() => handleToggleTodo(todo.id)}
                                  className="keep-checklist-checkbox rounded text-blue-600 focus:ring-0"
                                />
                              </div>
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
                              <div className="keep-checklist-control">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTodo(todo.id)}
                                  className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 hover:opacity-100 text-stone-400 hover:text-red-500 dark:hover:text-red-400 p-1 sm:p-1.5 transition-all"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Written Note / Rich Text Editor / Markdown */}
              {(!isList || showSubpages || childNoteIds.length > 0 || content.trim()) && (
                <div className={isList ? 'pt-2 border-t border-black/5 dark:border-white/5' : ''}>
                  {isPreviewMode ? (
                    <div className="min-h-[140px] py-1 text-stone-800 dark:text-stone-200 leading-relaxed overflow-x-auto space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 pb-1 border-b border-black/[0.05] dark:border-white/[0.06]">
                        <span>Markdown Preview</span>
                        <button
                          type="button"
                          onClick={() => setIsPreviewMode(false)}
                          className="font-medium text-stone-600 dark:text-stone-300 hover:underline cursor-pointer"
                        >
                          Back to editor
                        </button>
                      </div>
                      <MarkdownRenderer
                        content={content}
                        onOpenLinkedNote={async (titleOrId) => {
                          const found = await resolveNoteByTitleOrId(titleOrId);
                          if (found) {
                            await saveCurrentNote('Auto snapshot before following link');
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
                      placeholder="Press / to insert blocks"
                      minHeightClass={fullPage ? 'min-h-[380px]' : 'min-h-[240px]'}
                      autoFocus={!isList && !showSubpages && childNoteIds.length === 0}
                      listenWindowPaste={true}
                      currentNoteId={note.id}
                      defaultCategoryForNewLink={category}
                      availableSlashActions={availableNoteSlashActions}
                      slashContextFlags={{
                        isList,
                        isFormattingOpen,
                        isHub,
                        isPreviewMode,
                        isPinned,
                        isArchived: note.isArchived,
                        isEncrypted: note.isEncrypted,
                        showSubpages,
                        showConnections: showConnectionsPanel,
                        category,
                        labelsCount: labels.length,
                      }}
                      onSlashNoteAction={handleSlashNoteAction}
                      onCreateInlineSubpage={async ({ title: rawTitle, existingNote }) => {
                        if (existingNote) {
                          if (!existingNote.parentNoteId || existingNote.parentNoteId !== note.id) {
                            await updateNote(existingNote.id, { parentNoteId: note.id });
                          }
                          return {
                            id: existingNote.id,
                            title: existingNote.title || 'Untitled',
                            isList: existingNote.isList,
                          };
                        }
                        const created = await addNote({
                          title: (rawTitle || '').trim() || 'Untitled',
                          content: '',
                          isList: false,
                          todos: [],
                          color: 'default',
                          theme: 'none',
                          category: category || null,
                          labels: [],
                          isPinned: false,
                          isArchived: false,
                          isTrash: false,
                          images: [],
                          parentNoteId: note.id,
                          noteType: 'notion',
                        });
                        if (!created) return null;
                        return {
                          id: created.id,
                          title: created.title || 'Untitled',
                          isList: created.isList,
                        };
                      }}
                      onAfterInsertInlineSubpage={async (sub, updatedHtml) => {
                        const nextChildIds = Array.from(
                          new Set([...childNoteIdsRef.current, sub.id])
                        );
                        childNoteIdsRef.current = nextChildIds;
                        setChildNoteIds(nextChildIds);
                        setContent(updatedHtml);
                        if (debounceTimerRef.current) {
                          clearTimeout(debounceTimerRef.current);
                          debounceTimerRef.current = null;
                        }
                        if (lastSnapshottedRef.current) {
                          lastSnapshottedRef.current.content = updatedHtml.trim();
                          lastSnapshottedRef.current.timestamp = Date.now();
                        }
                        setAutoSnapshotStatus('saved');
                        await updateNote(note.id, {
                          content: updatedHtml,
                          childNoteIds: nextChildIds,
                          noteType: 'notion',
                        });
                      }}
                      onOpenMentionedNote={async (titleOrId) => {
                        const found = await resolveNoteByTitleOrId(titleOrId);
                        if (found) {
                          await Promise.race([
                            saveCurrentNote('Auto snapshot before following link'),
                            new Promise<void>((r) => setTimeout(r, 250)),
                          ]);
                          setEditingNote(found);
                        }
                      }}
                      onNoteMentionSelected={async (target, role) => {
                        if (role === 'part_of') {
                          await connectNotes(note.id, target.id, 'part_of');
                          return;
                        }
                        setLinkedNoteIds((prev) => Array.from(new Set([...prev, target.id])));
                        setConnections((prev) => {
                          const filtered = prev.filter(
                            (c) => !(c.targetId === target.id && c.role === role)
                          );
                          return [...filtered, { targetId: target.id, role, createdAt: Date.now() }];
                        });
                        await connectNotes(note.id, target.id, role);
                      }}
                    />
                  )}
                </div>
              )}
            </div>

          {/* Structured Connections Neighborhood (Expanded in classic mode or when toggled via /connections; quiet summary strip when clean) */}
          {(showClassicToolbars || showConnectionsPanel) ? (
            <NoteConnectionsPanel
              note={currentNoteForConnections}
              ancestors={ancestors}
              outgoing={outgoing}
              backlinks={backlinks}
              prevNotes={prevNotes}
              nextNotes={nextNotes}
              sources={sources}
              onNavigateToNote={async (targetId) => {
                await saveCurrentNote('Auto snapshot before following link');
                const targetNote = await getNoteById(targetId);
                if (targetNote) setEditingNote(targetNote);
              }}
              onOpenLinkModal={(defaultRole) => {
                setLinkModalRole(defaultRole);
                setShowLinkModal(true);
              }}
              onDisconnect={async (targetId, role) => {
                await saveCurrentNote('Auto snapshot before unlinking');
                await disconnectNotes(note.id, targetId, role || 'all');
                const fresh = await getNoteById(note.id);
                if (fresh) {
                  setContent(fresh.content || '');
                  setLinkedNoteIds(fresh.linkedNoteIds || []);
                  setConnections(fresh.connections || []);
                  setChildNoteIds(fresh.childNoteIds || []);
                  if (lastSnapshottedRef.current) {
                    lastSnapshottedRef.current.content = (fresh.content || '').trim();
                  }
                }
              }}
              onConnectSuggested={async (targetNote, role) => {
                await saveCurrentNote('Auto snapshot before connecting note');
                await connectNotes(note.id, targetNote.id, role);
                if (role !== 'part_of') {
                  setLinkedNoteIds((prev) => Array.from(new Set([...prev, targetNote.id])));
                  setConnections((prev) => {
                    const filtered = prev.filter(
                      (c) => !(c.targetId === targetNote.id && c.role === role)
                    );
                    return [...filtered, { targetId: targetNote.id, role, createdAt: Date.now() }];
                  });
                }
              }}
              onOpenInMap={async () => {
                await saveCurrentNote('Auto snapshot before opening map');
                openInKnowledgeMap(note.id);
              }}
            />
          ) : totalConnectionsCount > 0 ? (
            <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center flex-wrap gap-1.5 text-xs text-stone-400 dark:text-stone-500">
              {[...outgoing, ...backlinks, ...nextNotes, ...sources]
                .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)
                .slice(0, 6)
                .map((linked) => (
                  <button
                    key={linked.id}
                    type="button"
                    onClick={async () => {
                      await saveCurrentNote('Auto snapshot before following link');
                      const targetNote = await getNoteById(linked.id);
                      if (targetNote) setEditingNote(targetNote);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.09] text-stone-600 dark:text-stone-300 transition-colors cursor-pointer max-w-[180px]"
                  >
                    <Link2 className="w-3 h-3 text-stone-400 shrink-0" />
                    <span className="truncate">{linked.title || 'Untitled'}</span>
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setShowConnectionsPanel(true)}
                className="ml-auto text-[11px] text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                {totalConnectionsCount} {totalConnectionsCount === 1 ? 'connection' : 'connections'} · Details
              </button>
            </div>
          ) : null}

          {/* Active Reminder & Classic Metadata Footer */}
          {(reminder || showClassicToolbars) && (
            <div className="pt-2">
              {reminder && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300">
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
                </div>
              )}

              {showClassicToolbars && (
                <div className="text-[11px] text-stone-400 dark:text-stone-500 flex items-center justify-between gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md border border-black/5 dark:border-white/5 max-w-full min-w-0">
                    <Link2 className="w-3 h-3 text-stone-400 shrink-0" />
                    <span className="truncate min-w-0 flex-1 sm:flex-initial sm:max-w-[340px] text-stone-600 dark:text-stone-400 select-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/note/${note.id}` : `/note/${note.id}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyNoteUrl}
                      className="hover:text-stone-900 dark:hover:text-stone-100 ml-1 font-sans text-[10px] font-semibold text-stone-600 dark:text-stone-300 hover:underline shrink-0"
                    >
                      {copiedUrlToast ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                    <div
                      className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 select-none"
                      title={`${noteTextStats.words.toLocaleString()} words, ${noteTextStats.characters.toLocaleString()} characters`}
                    >
                      <span>{noteTextStats.words.toLocaleString()} {noteTextStats.words === 1 ? 'word' : 'words'}</span>
                      <span className="opacity-40">•</span>
                      <span>{noteTextStats.characters.toLocaleString()} {noteTextStats.characters === 1 ? 'character' : 'characters'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Edited {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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

        {/* Footer toolbar (hidden in clean Notion mode unless trashed or classic toolbars toggled on; portals remain mounted cleanly) */}
        <div
          className={
            showClassicToolbars || note.isTrash
              ? 'flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 shrink-0 relative'
              : 'contents'
          }
        >
          <div className={showClassicToolbars || note.isTrash ? 'w-full sm:w-auto sm:flex-1 min-w-0' : 'contents'}>
            <NoteActions
              ref={noteActionsRef}
              note={{
                ...note,
                title,
                content: editorRef.current?.getHTML() || content,
                isList,
                todos,
                color,
                theme,
                labels,
                reminder,
                category,
              }}
              isTrash={note.isTrash}
              hideInlineBar={!showClassicToolbars && !note.isTrash}
              showClassicToolbars={showClassicToolbars}
              onToggleClassicToolbars={handleToggleClassicToolbars}
              onStartDrawing={onOpenDrawingModal ? () => onOpenDrawingModal(note.id) : undefined}
              hideInlinePrint={true}
              onColorChange={setColor}
              onThemeChange={setTheme}
              onSelectCategory={handleCategoryChange}
              onAddImage={handleAddImage}
              onImportMhtml={handleImportMhtml}
              onInsertDataview={handleInsertDataview}
              onExtractUrl={() => setIsExtractUrlModalOpen(true)}
              onSummarizeWithAi={() => {
                openAiChatForNote({
                  ...note,
                  title,
                  content: editorRef.current?.getHTML() || content,
                  isList,
                  todos,
                  color,
                  theme,
                  labels,
                  reminder,
                  category,
                });
              }}
              onCopyContent={handleCopyTitleAndContent}
              onArchiveToggle={async () => {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
                await saveCurrentNote('Auto snapshot before archive toggle');
                await toggleArchiveNote(note.id);
                onClose();
              }}
              onDelete={async () => {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
                activeNoteIdRef.current = null;
                await trashNote(note.id);
                onClose();
              }}
              onRestore={async () => {
                await restoreNote(note.id);
                onClose();
              }}
              onDeletePermanently={async () => {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
                activeNoteIdRef.current = null;
                await deleteNotePermanently(note.id);
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
              onPrint={handlePrint}
              onToggleChecklist={handleToggleChecklist}
              onToggleSubpages={() => setShowSubpages(!showSubpages)}
              hasSubpages={showSubpages || (childNoteIds && childNoteIds.length > 0)}
              onAddReminder={setReminder}
              onToggleLabel={handleToggleLabel}
              onEncrypt={() => setShowEncryptModal(true)}
              onLinkNote={() => {
                setLinkModalRole('related');
                setShowLinkModal(true);
              }}
              onOpenVersions={() => setVersionHistoryNote(note)}
              onStartReading={() => startReadingStopwatch(note.id, title, category)}
              showFormattingToggle={!isList}
              isFormattingOpen={isFormattingOpen}
              onToggleFormatting={() => setIsFormattingOpen(!isFormattingOpen)}
              menuPlacement="top"
              menuAlign="right"
            />
          </div>

          {(showClassicToolbars || note.isTrash) && (
            <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto shrink-0 ml-auto pt-1.5 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/5">
              {showClassicToolbars && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDateCompileModalOpen(true);
                    }}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition-colors shrink-0"
                    title="Create note from date range (Today, 7d, 14d, 30d...)"
                  >
                    <CalendarRange className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsNotionTemplateModalOpen(true);
                    }}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors shrink-0"
                    title="Notion Template Hub (Today's Notes, Days, Per Keyword)"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 flex items-center gap-1.5 transition-colors shrink-0"
                    title="Print note"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleSaveAndClose}
                className="px-3.5 sm:px-5 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-stone-800 dark:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
              >
                {fullPage ? 'Close & Save' : 'Close'}
              </button>
            </div>
          )}
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
        currentCategory={category}
        notes={notes}
        isOpen={showLinkModal}
        initialRole={linkModalRole}
        onClose={() => setShowLinkModal(false)}
        onSelectNote={async (target, role) => {
          if (role === 'part_of') {
            await saveCurrentNote('Auto snapshot before moving into Hub');
            await connectNotes(note.id, target.id, 'part_of');
            return;
          }
          const linkSyntax = `[[${target.id}|${target.title || 'Untitled Note'}]]`;
          if (!isList && !isPreviewMode && editorRef.current) {
            editorRef.current.insertNoteMention({
              id: target.id,
              title: target.title || 'Untitled Note',
              role,
            });
          } else {
            setContent((prev) => `${prev}\n${linkSyntax}`);
          }
          setLinkedNoteIds((prev) => Array.from(new Set([...prev, target.id])));
          setConnections((prev) => {
            const filtered = prev.filter(
              (c) => !(c.targetId === target.id && c.role === role)
            );
            return [...filtered, { targetId: target.id, role, createdAt: Date.now() }];
          });
          await connectNotes(note.id, target.id, role);
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
      <ExtractUrlModal
        isOpen={isExtractUrlModalOpen}
        onClose={() => setIsExtractUrlModalOpen(false)}
        onExtracted={handleExtractedUrlInModal}
        isInsertMode={true}
      />
    </div>
  );
};
