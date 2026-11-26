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
  CalendarRange,
  FileText,
  Sparkles,
  Globe,
  DownloadCloud,
  Folder,
  Tag,
  Home,
  MoreHorizontal,
} from 'lucide-react';
import {
  getClassicToolbarsServerSnapshot,
  getClassicToolbarsSnapshot,
  SlashAnchorRect,
  SlashNoteActionId,
  subscribeClassicToolbars,
  toggleClassicToolbarsPreference,
} from '@/lib/slashCommands';
import { useKeep } from '@/context/KeepContext';
import { NoteActions, NoteActionsHandle } from './NoteActions';
import { KeepFormattingBar } from './KeepFormattingBar';
import { KeepWysiwygEditor, KeepWysiwygEditorHandle } from './KeepWysiwygEditor';
import { NoteColor, NoteBackgroundTheme, TodoItem, NoteDrawing, Note, NoteConnection, NoteConnectionRole } from '@/types/note';
import { getNoteColorClasses } from '@/lib/constants';
import { GoogleKeepFormatCommand } from '@/lib/formatUtils';
import { ImageGalleryGrid } from './ImageGalleryGrid';
import { extractClipboardPayload, copyFilesToLocalFolder } from '@/lib/localPaste';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';
import { convertHtmlToMarkdown } from '@/lib/formatUtils';
import { LinkNoteModal } from './LinkNoteModal';
import { EncryptNoteModal } from './EncryptNoteModal';
import { encryptNote } from '@/lib/crypto';
import { setUnlockedNote, setSessionPassword } from '@/lib/encryptionSession';
import { NoteThemeArtwork } from './NoteThemeArtwork';
import { ChecklistItemInput } from './ChecklistItemInput';
import { printNote } from '@/lib/printNote';
import { importMhtmlIntoNote } from '@/lib/mhtmlParser';
import { NotionSubpagesSection } from './NotionSubpagesSection';
import { ExtractUrlModal } from './ExtractUrlModal';
import { ExtractUrlResult } from '@/lib/urlExtractor';
import { convertMarkdownToHtml } from '@/lib/formatUtils';

interface CreateNoteBarProps {
  onOpenDrawingModal?: () => void;
}

export const CreateNoteBar: React.FC<CreateNoteBarProps> = ({ onOpenDrawingModal }) => {
  const {
    notes,
    addNote,
    updateNote,
    resolveOrCreateLinkedNote,
    selectedLabel,
    selectedCategory,
    defaultCategory,
    categories,
    editingNote,
    setEditingNote,
    isDateCompileModalOpen,
    setIsDateCompileModalOpen,
    isNotionTemplateModalOpen,
    setIsNotionTemplateModalOpen,
    setIsJiraModalOpen,
    setIsSupportbenchModalOpen,
    setIsExtractUrlModalOpen,
    importDataSmart,
    connectNotes,
  } = useKeep();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isList, setIsList] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoInput, setNewTodoInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [color, setColor] = useState<NoteColor>('default');
  const [theme, setTheme] = useState<NoteBackgroundTheme>('none');
  const [category, setCategory] = useState<string | null>(selectedCategory || defaultCategory || null);
  const [labels, setLabels] = useState<string[]>([]);
  const [reminder, setReminder] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [drawings, setDrawings] = useState<NoteDrawing[]>([]);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [connections, setConnections] = useState<NoteConnection[]>([]);
  const [parentHubId, setParentHubId] = useState<string | null>(null);
  const [isHub, setIsHub] = useState(false);
  const [childNoteIds, setChildNoteIds] = useState<string[]>([]);
  const childNoteIdsRef = useRef<string[]>([]);
  React.useEffect(() => {
    childNoteIdsRef.current = childNoteIds;
  }, [childNoteIds]);
  const [isNotionMode, setIsNotionMode] = useState(false);
  const [tempNoteId, setTempNoteId] = useState<string>(() => 'note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalRole, setLinkModalRole] = useState<NoteConnectionRole>('related');
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [encryptionHint, setEncryptionHint] = useState('');
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [subpagesAddSignal, setSubpagesAddSignal] = useState(0);
  const showClassicToolbars = React.useSyncExternalStore(
    subscribeClassicToolbars,
    getClassicToolbarsSnapshot,
    getClassicToolbarsServerSnapshot
  );

  const handleToggleClassicToolbars = React.useCallback(() => {
    toggleClassicToolbarsPreference();
  }, []);

  // Sync category with active category filter or defaultCategory when collapsed
  React.useEffect(() => {
    if (!isExpanded) {
      setCategory(selectedCategory || defaultCategory || null);
    }
  }, [selectedCategory, defaultCategory, isExpanded]);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<KeepWysiwygEditorHandle>(null);
  const noteActionsRef = useRef<NoteActionsHandle>(null);

  // If CreateNoteBar is collapsed and no modal is open, allow Ctrl+V anywhere on the page to start a note with the pasted image/file
  React.useEffect(() => {
    if (isExpanded || editingNote) return;

    const handleGlobalCollapsedPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const { files, imageUrls } = extractClipboardPayload(e.clipboardData);
      const text = e.clipboardData?.getData('text/plain');
      if (files.length === 0 && imageUrls.length === 0 && !text?.trim()) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e as any).__keepPasteHandled = true;
      e.preventDefault();
      setIsExpanded(true);

      if (text?.trim()) {
        const containsHtml = /<(?:p|h[1-6]|ul|ol|li|table|div|blockquote|b|strong|i|em|a|code|pre|hr|span)[^>]*>/i.test(text);
        const processed = containsHtml ? convertHtmlToMarkdown(text) : text;
        setContent(processed);
      }

      if (files.length > 0 || imageUrls.length > 0) {
        try {
          const saved = await copyFilesToLocalFolder(files, undefined, imageUrls);
          if (saved.length > 0) {
            const blocks = saved.map((f) => f.markdownLink).join('\n\n');
            setContent((prev) => (prev ? `${prev}\n\n${blocks}` : blocks));
          }
        } catch (err) {
          console.error('Collapsed paste failed:', err);
        }
      }
    };

    window.addEventListener('paste', handleGlobalCollapsedPaste);
    return () => window.removeEventListener('paste', handleGlobalCollapsedPaste);
  }, [isExpanded, editingNote]);

  // Click outside to auto-save like Google Keep
  React.useEffect(() => {
    if (!isExpanded || isNotionTemplateModalOpen || isDateCompileModalOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Ignore clicks inside portaled mobile bottom sheet, modals, or dialogs
      if (
        !target.isConnected ||
        target.closest('.keep-backdrop-anim') ||
        target.closest('.keep-sheet-anim') ||
        target.closest('[role="dialog"]') ||
        target.closest('.keep-modal') ||
        target.closest('[data-portal="true"]') ||
        target.closest('[data-slash-menu="true"]') ||
        target.closest('[data-mention-menu="true"]') ||
        target.closest('[data-subpage-menu="true"]') ||
        target.closest('[data-keep-gallery-lightbox="true"]') ||
        target.closest('[data-keep-gallery-ui="true"]')
      ) {
        return;
      }

      if (containerRef.current && !containerRef.current.contains(target as Node)) {
        handleSaveAndClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isExpanded,
    isNotionTemplateModalOpen,
    isDateCompileModalOpen,
    title,
    content,
    isList,
    todos,
    newTodoInput,
    images,
    drawings,
    isPinned,
    color,
    theme,
    labels,
    reminder,
    category,
    linkedNoteIds,
    connections,
    isHub,
    parentHubId,
    childNoteIds,
    isNotionMode,
  ]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setIsList(false);
    setTodos([]);
    setNewTodoInput('');
    setIsPinned(false);
    setColor('default');
    setTheme('none');
    setCategory(selectedCategory || defaultCategory || null);
    setLabels([]);
    setReminder(null);
    setImages([]);
    setDrawings([]);
    setLinkedNoteIds([]);
    setConnections([]);
    setParentHubId(null);
    setIsHub(false);
    setChildNoteIds([]);
    setIsNotionMode(false);
    setTempNoteId('note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
    setShowLinkModal(false);
    setIsFormattingOpen(false);
    setIsEncrypted(false);
    setEncryptionPassword('');
    setEncryptionHint('');
    setShowEncryptModal(false);
    setIsExpanded(false);
  };

  // When a note is opened for editing, close and reset CreateNoteBar so it doesn't linger
  React.useEffect(() => {
    if (editingNote) {
      resetForm();
    }
  }, [editingNote]);

  const handleSaveAndClose = async () => {
    try {
      const rawContent = editorRef.current?.getHTML() || content;
      const latestContent = renderMarkdownTablesInHtml(rawContent);
      const hasTodos =
        todos.some((t) => t.text.trim().length > 0) || newTodoInput.trim().length > 0;
      const hasText =
        title.trim().length > 0 ||
        (latestContent.trim().length > 0 && latestContent.trim() !== '<p></p>');
      const hasMedia = images.length > 0 || drawings.length > 0;
      const latestChildIds = childNoteIdsRef.current;
      const hasSubnotes = latestChildIds.length > 0;

      if (hasText || hasTodos || hasMedia || hasSubnotes) {
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
              id: tempNoteId,
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
              connections,
              isHub,
              parentNoteId: parentHubId,
              childNoteIds: latestChildIds,
              noteType: isHub || isNotionMode || latestChildIds.length > 0 ? 'notion' : 'default',
              isEncrypted: true,
              encryptedData: bundle,
            });
            if (parentHubId && created) {
              await connectNotes(created.id, parentHubId, 'part_of');
            }

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
          const created = await addNote({
            id: tempNoteId,
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
            connections,
            isHub,
            parentNoteId: parentHubId,
            childNoteIds: latestChildIds,
            noteType: isHub || isNotionMode || latestChildIds.length > 0 ? 'notion' : 'default',
          });
          if (parentHubId && created) {
            await connectNotes(created.id, parentHubId, 'part_of');
          }
        }
      }
    } catch (err) {
      console.error('Failed saving note on close:', err);
    } finally {
      resetForm();
    }
  };

  // Copy selected files & images to note content
  const handleExtractedUrl = async (result: ExtractUrlResult) => {
    const htmlContent = convertMarkdownToHtml(result.markdown);
    const imagePaths = (result.images || []).map((img) => img.savedPath || img.serveUrl);
    const newLabels = Array.from(new Set([...labels, ...(result.labels || []), 'clipped']));

    if (isExpanded) {
      if (!title.trim() && result.title) {
        setTitle(result.title);
      }
      if (editorRef.current) {
        editorRef.current.insertContent(htmlContent);
      } else {
        setContent((prev) => (prev ? `${prev}\n\n${htmlContent}` : htmlContent));
      }
      setLabels(newLabels);
      if (imagePaths.length > 0) {
        // Web images are already embedded inline in editor content
      }
      return;
    }

    await addNote({
      id: `note-url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: result.title || 'Extracted Web Note',
      content: htmlContent,
      isList: false,
      todos: [],
      color: 'default',
      theme: 'none',
      category: category || (result.isJira ? 'Work' : null),
      labels: newLabels,
      isPinned: false,
      images: [],
      drawings: [],
      linkedNoteIds: [],
      childNoteIds: [],
      noteType: 'default',
      isArchived: false,
      isTrash: false,
    });
  };

  const handleInsertDataview = () => {
    setIsExpanded(true);
    if (editorRef.current) {
      editorRef.current.handleFormat('dataview');
    } else {
      const snippet = '\n\n```dataview\nNOTION\nWHERE !isArchived\nSORT updatedAt DESC\nLIMIT 10\n```\n\n';
      setContent((prev) => (prev ? `${prev}${snippet}` : snippet.trim()));
    }
  };

const handleImportMhtml = async (file: File) => {
    setIsExpanded(true);
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

    if (mhtmlFiles.length > 0) {
      for (const mf of mhtmlFiles) {
        await handleImportMhtml(mf);
      }
      return;
    }

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

  const availableCreateSlashActions = React.useMemo<SlashNoteActionId[]>(() => {
    const actions: SlashNoteActionId[] = [
      'wiki-link',
      'subpage',
      'toggle-subpages',
      'link-note',
      'file-hub',
      'next-note',
      'source-note',
      'toggle-hub',
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
      'encrypt',
      'pin',
      'print',
      'close',
    ];
    if (onOpenDrawingModal) {
      actions.push('drawing');
    }
    return actions;
  }, [onOpenDrawingModal]);

  const handleSlashNoteAction = async (actionId: SlashNoteActionId, anchorRect: SlashAnchorRect) => {
    switch (actionId) {
      case 'subpage':
        setIsNotionMode(true);
        setSubpagesAddSignal((n) => n + 1);
        break;
      case 'toggle-subpages':
        setIsNotionMode((v) => !v);
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
        const next = !isHub;
        setIsHub(next);
        if (next) setIsNotionMode(true);
        break;
      }
      case 'image':
        noteActionsRef.current?.triggerImageUpload();
        break;
      case 'drawing':
        onOpenDrawingModal?.();
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
        setIsList((v) => !v);
        break;
      case 'formatting-toolbar':
        setIsFormattingOpen((v) => !v);
        break;
      case 'encrypt':
        setShowEncryptModal(true);
        break;
      case 'pin':
        setIsPinned((v) => !v);
        break;
      case 'print':
        printNote(
          {
            id: 'draft',
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
          } as Note,
          categories
        );
        break;
      case 'close':
        await handleSaveAndClose();
        break;
    }
  };

  const colorClasses = getNoteColorClasses(color, theme);

  if (!isExpanded) {
    return (
      <div className="w-full max-w-2xl mx-auto mb-5 sm:mb-8 px-2.5 sm:px-4">
        <div
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-[#202124] rounded-xl sm:rounded-2xl keep-elevation-1 border border-black/[0.08] dark:border-white/[0.08] cursor-text hover:keep-elevation-2 transition-all text-stone-500 dark:text-stone-400"
        >
          <span className="font-normal text-sm">Take a note, or type / inside…</span>
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
                setIsNotionMode(true);
                setIsExpanded(true);
              }}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300"
              title="New Notion-style note with sub-pages"
            >
              <FileText className="w-5 h-5" />
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
            {/* Import from Webpage & Web Clipper (URL or HTML/MHTML File) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExtractUrlModalOpen(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
              title="Import from Webpage (URL Web Clipper or HTML/MHTML File)"
            >
              <Globe className="w-5 h-5" />
            </button>
            {/* Atlassian Jira Manager */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsJiraModalOpen(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
              title="Atlassian Jira Manager (Download tickets, API token & JQL search)"
            >
              <span className="w-5 h-5 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                J
              </span>
            </button>
            {/* Supportbench Manager */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsSupportbenchModalOpen(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer transition-colors"
              title="Supportbench Manager (Download cases, API token/key & multi-case scrape)"
            >
              <span className="w-5 h-5 rounded-md bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center font-black text-[10px] shadow-xs">
                SB
              </span>
            </button>
            <button type="button" onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDateCompileModalOpen(true);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
              title="Create note from date range (Today, 7d, 14d, 30d...)"
            >
              <CalendarRange className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsNotionTemplateModalOpen(true);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors"
              title="Notion Template Hub (Today's Notes, Days, Per Keyword)"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-5 sm:mb-8 px-2.5 sm:px-4" ref={containerRef}>
      <div
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
        className={`rounded-2xl keep-elevation-2 border relative transition-all ${colorClasses}`}
      >
        {/* Themed Background Illustration */}
        <NoteThemeArtwork theme={theme} />
        {/* Attached Images */}
        {images.length > 0 && (
          <div className="p-2 bg-black/[0.03] dark:bg-white/[0.03] rounded-t-2xl overflow-hidden border-b border-black/[0.05] dark:border-white/[0.06]">
            <ImageGalleryGrid
              images={images.map((img) => ({ src: img, alt: 'Attachment' }))}
              variant="editor"
              editable={true}
              interactive={true}
              onRemoveImage={(idx) => setImages((prev) => prev.filter((_, i) => i !== idx))}
            />
          </div>
        )}

        {/* Header & Pin */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isNotionMode && (
              <span className="text-2xl leading-none select-none shrink-0">
                {categories.find((c) => c.name === category)?.icon || '📚'}
              </span>
            )}
            <textarea
              placeholder={isNotionMode ? 'Untitled page' : 'Title'}
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
              style={!isNotionMode ? { fontSize: 'calc(var(--note-font-size, 15px) * 1.15)' } : undefined}
              className={`w-full bg-transparent text-stone-900 dark:text-stone-100 placeholder:text-stone-500 outline-none resize-none leading-snug overflow-hidden block ${
                isNotionMode ? 'font-bold text-2xl tracking-tight' : 'font-semibold'
              }`}
            />
          </div>
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

        {/* Content body: List, Notion Sub-pages, or Text - mixed together */}
        <div className="px-4 py-2 space-y-3">
          {/* 1. Notion subpages section (non-inline subpages or explicit section toggle) */}
          {(isNotionMode || childNoteIds.some((id) => !content.includes(`data-note-id="${id}"`))) && (
            <div className="mb-2">
              <NotionSubpagesSection
                parentNoteId={tempNoteId}
                childNoteIds={childNoteIds.filter((id) => !content.includes(`data-note-id="${id}"`))}
                excludeChildIds={childNoteIds.filter((id) => content.includes(`data-note-id="${id}"`))}
                onChangeChildIds={(newNonInlineIds) => {
                  const latestContent = editorRef.current?.getHTML() || content;
                  const inlineIds = childNoteIdsRef.current.filter((id) =>
                    latestContent.includes(`data-note-id="${id}"`)
                  );
                  const merged = Array.from(new Set([...inlineIds, ...newNonInlineIds]));
                  childNoteIdsRef.current = merged;
                  setChildNoteIds(merged);
                }}
                onOpenChildNote={async (child) => {
                  await handleSaveAndClose();
                  setEditingNote(child);
                }}
                category={category}
                autoOpenAddSignal={subpagesAddSignal}
              />
            </div>
          )}

          {/* 2. Interactive Checklist Items */}
          {isList && (
            <div className={`space-y-2 ${(isNotionMode || childNoteIds.length > 0) ? 'pt-3 border-t border-black/5 dark:border-white/5' : ''}`}>
              {todos.map((todo) => (
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
                    id={`create-todo-${todo.id}`}
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
                        const newId = 'todo-' + Date.now();
                        setTodos((prev) => {
                          const index = prev.findIndex((t) => t.id === todo.id);
                          const updated = [...prev];
                          updated.splice(index + 1, 0, { id: newId, text: '', completed: false });
                          return updated;
                        });
                        setTimeout(() => {
                          document.getElementById(`create-todo-${newId}`)?.focus();
                        }, 50);
                      }
                      if (e.key === 'Backspace' && todo.text === '') {
                        e.preventDefault();
                        const index = todos.findIndex((t) => t.id === todo.id);
                        const prevTodo = todos[index - 1];
                        handleRemoveTodo(todo.id);
                        if (prevTodo) {
                          setTimeout(() => {
                            const prevEl = document.getElementById(`create-todo-${prevTodo.id}`) as HTMLTextAreaElement | null;
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

              <div className="flex items-start gap-2.5 sm:gap-3 pt-2 border-t border-stone-200/50 dark:border-stone-700/50 min-w-0 w-full">
                <div className="keep-checklist-control">
                  <Plus className="w-[0.95em] h-[0.95em] min-w-4 min-h-4 text-stone-400" />
                </div>
                <ChecklistItemInput
                  id="create-todo-new"
                  placeholder="List item"
                  value={newTodoInput}
                  onChange={setNewTodoInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddTodoItem();
                      setTimeout(() => {
                        document.getElementById('create-todo-new')?.focus();
                      }, 50);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* 3. Written Note / Rich Text Editor / Markdown - always directly editable */}
          {(!isList || isNotionMode || content.trim() || childNoteIds.length > 0) && (
            <div className={isList ? 'pt-2 border-t border-black/5 dark:border-white/5' : ''}>
              <KeepWysiwygEditor
                ref={editorRef}
                content={content}
                onChange={setContent}
                placeholder="Press / to insert blocks"
                minHeightClass={(isNotionMode || childNoteIds.length > 0) ? 'min-h-[80px]' : 'min-h-[100px]'}
                autoFocus={!isNotionMode && !isList}
                listenWindowPaste={!editingNote}
                currentNoteId={tempNoteId}
                defaultCategoryForNewLink={category}
                availableSlashActions={availableCreateSlashActions}
                slashContextFlags={{
                  isList,
                  isFormattingOpen,
                  isHub,
                  isPinned,
                  isEncrypted,
                  showSubpages: isNotionMode,
                  category,
                  labelsCount: labels.length,
                }}
                onSlashNoteAction={handleSlashNoteAction}
                onCreateInlineSubpage={async ({ title: rawTitle, existingNote }) => {
                  if (existingNote) {
                    if (!existingNote.parentNoteId || existingNote.parentNoteId !== tempNoteId) {
                      await updateNote(existingNote.id, { parentNoteId: tempNoteId });
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
                    parentNoteId: tempNoteId,
                    noteType: 'notion',
                  });
                  if (!created) return null;
                  return {
                    id: created.id,
                    title: created.title || 'Untitled',
                    isList: created.isList,
                  };
                }}
                onAfterInsertInlineSubpage={(sub, updatedHtml) => {
                  const nextChildIds = Array.from(
                    new Set([...childNoteIdsRef.current, sub.id])
                  );
                  childNoteIdsRef.current = nextChildIds;
                  setChildNoteIds(nextChildIds);
                  setContent(updatedHtml);
                }}
                onOpenMentionedNote={async (titleOrId, fallbackTitle) => {
                  const res = await resolveOrCreateLinkedNote(titleOrId, {
                    fallbackTitle,
                    category: category || null,
                  });
                  if (!res) return;
                  editorRef.current?.bindNoteMentionId(fallbackTitle || titleOrId, res.note.id);
                  await handleSaveAndClose();
                  if (res.created) {
                    await connectNotes(tempNoteId, res.note.id, 'related');
                  }
                  setEditingNote(res.note);
                }}
                onNoteMentionSelected={(target, role) => {
                  if (role === 'part_of') {
                    setParentHubId(target.id);
                    return;
                  }
                  setLinkedNoteIds((prev) => Array.from(new Set([...prev, target.id])));
                  setConnections((prev) => {
                    const filtered = prev.filter(
                      (c) => !(c.targetId === target.id && c.role === role)
                    );
                    return [...filtered, { targetId: target.id, role, createdAt: Date.now() }];
                  });
                }}
              />
            </div>
          )}

          {/* Active Metadata Pills (Clean Notion style: only shown when set or classic toolbars active) */}
          {(showClassicToolbars || category || labels.length > 0 || isHub || reminder || isEncrypted) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-black/5 dark:border-white/5">
              {category ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-black/[0.04] dark:bg-white/[0.07] text-stone-700 dark:text-stone-200 group">
                  <button
                    type="button"
                    onClick={(e) => noteActionsRef.current?.openCategoryPicker(e.currentTarget)}
                    className="flex items-center gap-1 hover:opacity-80 cursor-pointer"
                    title="Change category"
                  >
                    <span>{categories.find((c) => c.name === category)?.icon || '📁'}</span>
                    <span>{category}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory(null)}
                    className="hover:opacity-75 ml-0.5 rounded-full p-0.5 cursor-pointer"
                    title="Remove category"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : showClassicToolbars ? (
                <button
                  type="button"
                  onClick={(e) => noteActionsRef.current?.openCategoryPicker(e.currentTarget)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
                >
                  <Folder className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                  <span>+ Category</span>
                </button>
              ) : null}

              {labels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-black/[0.04] dark:bg-white/[0.07] text-stone-700 dark:text-stone-200"
                >
                  <span className="text-stone-400">#</span>
                  <span>{lbl}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleLabel(lbl)}
                    className="hover:text-red-500 ml-0.5 cursor-pointer"
                    title="Remove label"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {showClassicToolbars && (
                <>
                  <button
                    type="button"
                    onClick={(e) => noteActionsRef.current?.openLabelPicker(e.currentTarget)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                    <span>+ Label</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !isHub;
                      setIsHub(next);
                      if (next) setIsNotionMode(true);
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
                </>
              )}

              {isHub && !showClassicToolbars && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/12 text-amber-700 dark:text-amber-300">
                  <span>🏠 Hub</span>
                  <button type="button" onClick={() => setIsHub(false)} className="hover:text-red-500 ml-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {reminder && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  <span>⏰ {new Date(reminder).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <button type="button" onClick={() => setReminder(null)} className="hover:text-red-500 ml-0.5 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {isEncrypted && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/12 text-amber-700 dark:text-amber-300">
                  <Lock className="w-3 h-3" />
                  <span>Encrypted</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEncrypted(false);
                      setEncryptionPassword('');
                      setEncryptionHint('');
                    }}
                    className="hover:text-red-500 ml-0.5 cursor-pointer"
                    title="Remove encryption"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Google Keep Authentic Formatting Bar (shown if toggled via /toolbar or •••) */}
        {!isList && isFormattingOpen && (
          <div className="px-2.5 sm:px-4 py-1.5 border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2">
            <KeepFormattingBar onFormat={handleFormatText} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-black/[0.05] dark:border-white/[0.06] gap-2 relative z-20">
          {showClassicToolbars ? (
            <NoteActions
              ref={noteActionsRef}
              note={{ title, content, todos, color, theme, isList, labels, reminder, category, isEncrypted }}
              hideInlineBar={false}
              showClassicToolbars={showClassicToolbars}
              onToggleClassicToolbars={handleToggleClassicToolbars}
              onStartDrawing={onOpenDrawingModal}
              onColorChange={setColor}
              onThemeChange={setTheme}
              onSelectCategory={setCategory}
              onAddImage={handleAddImage}
              onImportMhtml={handleImportMhtml}
              onInsertDataview={handleInsertDataview}
              onExtractUrl={() => setIsExtractUrlModalOpen(true)}
              onToggleChecklist={() => setIsList(!isList)}
              onToggleSubpages={() => setIsNotionMode(!isNotionMode)}
              hasSubpages={isNotionMode || childNoteIds.length > 0}
              onAddReminder={(r) => setReminder(r)}
              onToggleLabel={handleToggleLabel}
              onPrint={() => {
                printNote(
                  {
                    id: 'draft',
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
                  } as Note,
                  categories
                );
              }}
              onLinkNote={() => {
                setLinkModalRole('related');
                setShowLinkModal(true);
              }}
              onEncrypt={() => setShowEncryptModal(true)}
              showFormattingToggle={!isList}
              isFormattingOpen={isFormattingOpen}
              onToggleFormatting={() => setIsFormattingOpen(!isFormattingOpen)}
              menuPlacement="bottom"
              menuAlign="left"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <NoteActions
                ref={noteActionsRef}
                note={{ title, content, todos, color, theme, isList, labels, reminder, category, isEncrypted }}
                hideInlineBar={true}
                showClassicToolbars={showClassicToolbars}
                onToggleClassicToolbars={handleToggleClassicToolbars}
                onStartDrawing={onOpenDrawingModal}
                onColorChange={setColor}
                onThemeChange={setTheme}
                onSelectCategory={setCategory}
                onAddImage={handleAddImage}
                onImportMhtml={handleImportMhtml}
                onInsertDataview={handleInsertDataview}
                onExtractUrl={() => setIsExtractUrlModalOpen(true)}
                onToggleChecklist={() => setIsList(!isList)}
                onToggleSubpages={() => setIsNotionMode(!isNotionMode)}
                hasSubpages={isNotionMode || childNoteIds.length > 0}
                onAddReminder={(r) => setReminder(r)}
                onToggleLabel={handleToggleLabel}
                onPrint={() => {
                  printNote(
                    {
                      id: 'draft',
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
                    } as Note,
                    categories
                  );
                }}
                onLinkNote={() => {
                  setLinkModalRole('related');
                  setShowLinkModal(true);
                }}
                onEncrypt={() => setShowEncryptModal(true)}
                showFormattingToggle={!isList}
                isFormattingOpen={isFormattingOpen}
                onToggleFormatting={() => setIsFormattingOpen(!isFormattingOpen)}
                menuPlacement="bottom"
                menuAlign="right"
              />
              <span className="text-[11.5px] text-stone-400 dark:text-stone-500 hidden sm:inline">
                Type <code className="font-mono text-[11px]">/</code> for blocks &amp; menus
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {showClassicToolbars && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDateCompileModalOpen(true);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition-colors"
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
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-amber-600 dark:text-amber-400 transition-colors"
                  title="Notion Template Hub"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </>
            )}

            {!showClassicToolbars && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  noteActionsRef.current?.openMoreMenu(e.currentTarget);
                }}
                className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="More menus & options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-3.5 py-1 text-xs sm:text-sm font-medium rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <LinkNoteModal
        currentNoteId={tempNoteId}
        currentCategory={category}
        notes={notes}
        isOpen={showLinkModal}
        initialRole={linkModalRole}
        onClose={() => setShowLinkModal(false)}
        onSelectNote={(target, role: NoteConnectionRole) => {
          if (role === 'part_of') {
            setParentHubId(target.id);
            return;
          }
          const linkSyntax = `[[${target.id}|${target.title || 'Untitled Note'}]]`;
          if (!isList && editorRef.current) {
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
