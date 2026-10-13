'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Note, Label, ViewFilter, LayoutViewMode } from '@/types/note';
import {
  getAllNotesFromDB,
  getAllLabelsFromDB,
  saveNoteToDB,
  saveMultipleNotesToDB,
  deleteNotePermanentlyFromDB,
  clearTrashFromDB,
  saveLabelToDB,
  deleteLabelFromDB,
  renameLabelInDB,
  getSettingFromDB,
  saveSettingToDB,
  exportAllData,
  importAllData,
} from '@/lib/db';
import { setSyncLocalMediaFolder } from '@/lib/localPaste';

interface KeepContextType {
  notes: Note[];
  labels: Label[];
  isLoading: boolean;
  currentFilter: ViewFilter;
  selectedLabel: string | null;
  searchQuery: string;
  layoutMode: LayoutViewMode;
  darkMode: boolean;
  selectedNoteIds: string[];
  editingNote: Note | null;
  isDrawingModalOpen: boolean;
  drawingNoteId: string | null;
  isLabelModalOpen: boolean;
  localMediaFolder: string;
  isLocalFolderModalOpen: boolean;

  // Setters
  setCurrentFilter: (filter: ViewFilter, labelName?: string) => void;
  setSearchQuery: (query: string) => void;
  setLayoutMode: (mode: LayoutViewMode) => void;
  setDarkMode: (dark: boolean) => void;
  setEditingNote: (note: Note | null) => void;
  setIsDrawingModalOpen: (open: boolean, noteId?: string | null) => void;
  setIsLabelModalOpen: (open: boolean) => void;
  setLocalMediaFolder: (folder: string) => void;
  setIsLocalFolderModalOpen: (open: boolean) => void;

  // Selection
  toggleSelectNote: (id: string) => void;
  clearSelection: () => void;
  selectAllNotes: () => void;

  // Note CRUD
  addNote: (note: Partial<Note>) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  togglePinNote: (id: string) => Promise<void>;
  toggleArchiveNote: (id: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  duplicateNote: (id: string) => Promise<void>;
  reorderNotes: (notes: Note[]) => Promise<void>;

  // Batch actions
  batchColor: (color: Note['color']) => Promise<void>;
  batchArchive: () => Promise<void>;
  batchTrash: () => Promise<void>;
  batchDeletePermanently: () => Promise<void>;
  batchAddLabel: (labelName: string) => Promise<void>;

  // Label CRUD
  createLabel: (name: string) => Promise<Label | null>;
  deleteLabel: (id: string, name: string) => Promise<void>;
  renameLabel: (id: string, oldName: string, newName: string) => Promise<void>;

  // Backup / Data
  exportDataJSON: () => Promise<void>;
  importDataJSON: (jsonString: string) => Promise<boolean>;
}

const KeepContext = createContext<KeepContextType | null>(null);

export function KeepProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentFilter, setCurrentFilterState] = useState<ViewFilter>('notes');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutModeState] = useState<LayoutViewMode>('grid');
  const [darkMode, setDarkModeState] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isDrawingModalOpen, setIsDrawingModalOpenState] = useState(false);
  const [drawingNoteId, setDrawingNoteId] = useState<string | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [localMediaFolder, setLocalMediaFolderState] = useState('');
  const [isLocalFolderModalOpen, setIsLocalFolderModalOpen] = useState(false);

  // Initialize data from IndexedDB
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [storedNotes, storedLabels, storedLayout, storedDark, storedFolder] = await Promise.all([
        getAllNotesFromDB(),
        getAllLabelsFromDB(),
        getSettingFromDB<LayoutViewMode>('layoutMode', 'grid'),
        getSettingFromDB<boolean>('darkMode', false),
        getSettingFromDB<string>('localMediaFolder', ''),
      ]);

      if (storedFolder) {
        setLocalMediaFolderState(storedFolder);
        setSyncLocalMediaFolder(storedFolder);
      } else {
        // Initialize with default server local-media path
        fetch('/api/local-media?action=default')
          .then((r) => r.json())
          .then((d) => {
            if (d?.defaultFolder) {
              setLocalMediaFolderState(d.defaultFolder);
              setSyncLocalMediaFolder(d.defaultFolder);
              saveSettingToDB('localMediaFolder', d.defaultFolder);
            }
          })
          .catch(() => {});
      }

      // Seed with sample welcome notes if empty
      if (storedNotes.length === 0 && storedLabels.length === 0) {
        const welcomeLabel: Label = {
          id: 'label-' + Date.now(),
          name: 'Welcome',
          createdAt: Date.now(),
        };
        await saveLabelToDB(welcomeLabel);

        const now = Date.now();
        const initialNotes: Note[] = [
          {
            id: 'note-welcome-1',
            title: '✨ Welcome to Google Keep Offline!',
            content:
              'This is a complete, offline-first Google Keep clone running entirely locally inside your browser with IndexedDB.\n\nEverything you do is stored safe and persistent without any external server!\n\nTry features:\n- 📌 Pin & unpin notes\n- 🎨 Colors & background themes\n- 🏷️ Labels & Tagging\n- ☑️ Interactive checklists with completion progress\n- ⏰ Reminder notifications\n- 🖼️ Image attachments & drawing canvas\n- 📥 JSON export & import backup\n- 🔍 Instant fuzzy search and keyboard shortcuts!',
            isList: false,
            todos: [],
            color: 'sand',
            theme: 'notes',
            labels: ['Welcome'],
            isPinned: true,
            isArchived: false,
            isTrash: false,
            images: [],
            createdAt: now - 3600000,
            updatedAt: now - 3600000,
            order: 1,
          },
          {
            id: 'note-welcome-2',
            title: 'Weekly Groceries 🛒',
            content: '',
            isList: true,
            todos: [
              { id: '1', text: 'Organic oat milk', completed: true },
              { id: '2', text: 'Fresh avocados & limes', completed: true },
              { id: '3', text: 'Sourdough bread', completed: false },
              { id: '4', text: 'Ground coffee beans', completed: false },
              { id: '5', text: 'Dark chocolate (85%)', completed: false },
            ],
            color: 'mint',
            theme: 'groceries',
            labels: ['Welcome'],
            isPinned: false,
            isArchived: false,
            isTrash: false,
            images: [],
            createdAt: now - 1800000,
            updatedAt: now - 1800000,
            order: 2,
          },
          {
            id: 'note-welcome-3',
            title: 'Project Ideas 💡',
            content:
              'Ideas to build:\n- Personal knowledge management graph\n- Voice memo transcribers\n- Markdown blog generator\n- Interactive canvas whiteboard',
            isList: false,
            todos: [],
            color: 'blossom',
            theme: 'celebration',
            labels: [],
            isPinned: false,
            isArchived: false,
            isTrash: false,
            images: [],
            createdAt: now - 900000,
            updatedAt: now - 900000,
            order: 3,
          },
        ];

        await saveMultipleNotesToDB(initialNotes);
        setNotes(initialNotes);
        setLabels([welcomeLabel]);
      } else {
        setNotes(storedNotes);
        setLabels(storedLabels);
      }

      setLayoutModeState(storedLayout);
      setDarkModeState(storedDark);
      if (storedDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (err) {
      console.error('Failed to load DB initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // View Filter setter
  const setCurrentFilter = useCallback((filter: ViewFilter, labelName?: string) => {
    setCurrentFilterState(filter);
    if (filter === 'label') {
      setSelectedLabel(labelName || null);
    } else {
      setSelectedLabel(null);
    }
    setSelectedNoteIds([]);
  }, []);

  // Theme Mode setter
  const setDarkMode = useCallback((dark: boolean) => {
    setDarkModeState(dark);
    saveSettingToDB('darkMode', dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Layout mode setter
  const setLayoutMode = useCallback((mode: LayoutViewMode) => {
    setLayoutModeState(mode);
    saveSettingToDB('layoutMode', mode);
  }, []);

  // Drawing modal setter
  const setIsDrawingModalOpen = useCallback((open: boolean, noteId?: string | null) => {
    setIsDrawingModalOpenState(open);
    setDrawingNoteId(noteId || null);
  }, []);

  // Local media folder setter
  const setLocalMediaFolder = useCallback((folder: string) => {
    setLocalMediaFolderState(folder);
    setSyncLocalMediaFolder(folder);
    saveSettingToDB('localMediaFolder', folder);
  }, []);

  // Selection handlers
  const toggleSelectNote = useCallback((id: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNoteIds([]);
  }, []);

  const selectAllNotes = useCallback(() => {
    // Select all visible notes in current view
    setSelectedNoteIds(notes.map((n) => n.id));
  }, [notes]);

  // Note actions
  const addNote = useCallback(
    async (noteData: Partial<Note>): Promise<Note> => {
      const now = Date.now();
      const newNote: Note = {
        id: 'note-' + now + '-' + Math.random().toString(36).substring(2, 7),
        title: noteData.title || '',
        content: noteData.content || '',
        isList: noteData.isList || false,
        todos: noteData.todos || [],
        color: noteData.color || 'default',
        theme: noteData.theme || 'none',
        labels: noteData.labels || (selectedLabel ? [selectedLabel] : []),
        isPinned: noteData.isPinned || false,
        isArchived: noteData.isArchived || false,
        isTrash: false,
        reminder: noteData.reminder || null,
        images: noteData.images || [],
        drawings: noteData.drawings || [],
        linkedNoteIds: noteData.linkedNoteIds || [],
        isEncrypted: noteData.isEncrypted || false,
        encryptedData: noteData.encryptedData || null,
        createdAt: now,
        updatedAt: now,
        order: now,
      };

      await saveNoteToDB(newNote);
      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    [selectedLabel]
  );

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    setNotes((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target) return prev;
      const updated: Note = {
        ...target,
        ...updates,
        updatedAt: Date.now(),
      };
      saveNoteToDB(updated);
      return prev.map((n) => (n.id === id ? updated : n));
    });

    setEditingNote((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, ...updates, updatedAt: Date.now() };
      }
      return prev;
    });
  }, []);

  const togglePinNote = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      await updateNote(id, { isPinned: !note.isPinned, isArchived: false });
    },
    [notes, updateNote]
  );

  const toggleArchiveNote = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      await updateNote(id, { isArchived: !note.isArchived, isPinned: false });
    },
    [notes, updateNote]
  );

  const trashNote = useCallback(
    async (id: string) => {
      await updateNote(id, { isTrash: true, isPinned: false, trashedAt: Date.now() });
      setSelectedNoteIds((prev) => prev.filter((i) => i !== id));
    },
    [updateNote]
  );

  const restoreNote = useCallback(
    async (id: string) => {
      await updateNote(id, { isTrash: false, trashedAt: null });
    },
    [updateNote]
  );

  const deleteNotePermanently = useCallback(async (id: string) => {
    await deleteNotePermanentlyFromDB(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setSelectedNoteIds((prev) => prev.filter((i) => i !== id));
  }, []);

  const emptyTrash = useCallback(async () => {
    await clearTrashFromDB();
    setNotes((prev) => prev.filter((n) => !n.isTrash));
    setSelectedNoteIds([]);
  }, []);

  const duplicateNote = useCallback(
    async (id: string) => {
      const original = notes.find((n) => n.id === id);
      if (!original) return;
      const now = Date.now();
      const copy: Note = {
        ...original,
        id: 'note-' + now + '-' + Math.random().toString(36).substring(2, 7),
        title: original.title ? `${original.title} (Copy)` : '',
        createdAt: now,
        updatedAt: now,
        order: now,
      };
      await saveNoteToDB(copy);
      setNotes((prev) => [copy, ...prev]);
    },
    [notes]
  );

  const reorderNotes = useCallback(async (reordered: Note[]) => {
    setNotes(reordered);
    const updatedWithOrder = reordered.map((note, index) => ({
      ...note,
      order: reordered.length - index,
    }));
    await saveMultipleNotesToDB(updatedWithOrder);
  }, []);

  // Batch actions
  const batchColor = useCallback(
    async (color: Note['color']) => {
      for (const id of selectedNoteIds) {
        await updateNote(id, { color });
      }
      clearSelection();
    },
    [selectedNoteIds, updateNote, clearSelection]
  );

  const batchArchive = useCallback(async () => {
    for (const id of selectedNoteIds) {
      await updateNote(id, { isArchived: true, isPinned: false });
    }
    clearSelection();
  }, [selectedNoteIds, updateNote, clearSelection]);

  const batchTrash = useCallback(async () => {
    for (const id of selectedNoteIds) {
      await updateNote(id, { isTrash: true, isPinned: false, trashedAt: Date.now() });
    }
    clearSelection();
  }, [selectedNoteIds, updateNote, clearSelection]);

  const batchDeletePermanently = useCallback(async () => {
    for (const id of selectedNoteIds) {
      await deleteNotePermanentlyFromDB(id);
    }
    setNotes((prev) => prev.filter((n) => !selectedNoteIds.includes(n.id)));
    clearSelection();
  }, [selectedNoteIds, clearSelection]);

  const batchAddLabel = useCallback(
    async (labelName: string) => {
      for (const id of selectedNoteIds) {
        const note = notes.find((n) => n.id === id);
        if (note && !note.labels.includes(labelName)) {
          await updateNote(id, { labels: [...note.labels, labelName] });
        }
      }
      clearSelection();
    },
    [selectedNoteIds, notes, updateNote, clearSelection]
  );

  // Labels
  const createLabel = useCallback(async (name: string): Promise<Label | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;

    const newLabel: Label = {
      id: 'label-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      name: trimmed,
      createdAt: Date.now(),
    };
    await saveLabelToDB(newLabel);
    setLabels((prev) => [...prev, newLabel].sort((a, b) => a.name.localeCompare(b.name)));
    return newLabel;
  }, [labels]);

  const deleteLabel = useCallback(
    async (id: string, name: string) => {
      await deleteLabelFromDB(id, name);
      setLabels((prev) => prev.filter((l) => l.id !== id));
      setNotes((prev) =>
        prev.map((n) => ({
          ...n,
          labels: n.labels.filter((l) => l !== name),
        }))
      );
      if (selectedLabel === name) {
        setCurrentFilter('notes');
      }
    },
    [selectedLabel, setCurrentFilter]
  );

  const renameLabel = useCallback(
    async (id: string, oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return;
      await renameLabelInDB(id, oldName, trimmed);
      setLabels((prev) =>
        prev.map((l) => (l.id === id ? { ...l, name: trimmed } : l))
      );
      setNotes((prev) =>
        prev.map((n) => ({
          ...n,
          labels: n.labels.map((l) => (l === oldName ? trimmed : l)),
        }))
      );
      if (selectedLabel === oldName) {
        setSelectedLabel(trimmed);
      }
    },
    [selectedLabel]
  );

  // Backup & Import
  const exportDataJSON = useCallback(async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `google-keep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const importDataJSON = useCallback(async (jsonString: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonString);
      await importAllData(parsed);
      await loadInitialData();
      return true;
    } catch (e) {
      console.error('Invalid JSON import:', e);
      return false;
    }
  }, [loadInitialData]);

  const value = useMemo(
    () => ({
      notes,
      labels,
      isLoading,
      currentFilter,
      selectedLabel,
      searchQuery,
      layoutMode,
      darkMode,
      selectedNoteIds,
      editingNote,
      isDrawingModalOpen,
      drawingNoteId,
      isLabelModalOpen,
      localMediaFolder,
      isLocalFolderModalOpen,
      setCurrentFilter,
      setSearchQuery,
      setLayoutMode,
      setDarkMode,
      setEditingNote,
      setIsDrawingModalOpen,
      setIsLabelModalOpen,
      setLocalMediaFolder,
      setIsLocalFolderModalOpen,
      toggleSelectNote,
      clearSelection,
      selectAllNotes,
      addNote,
      updateNote,
      togglePinNote,
      toggleArchiveNote,
      trashNote,
      restoreNote,
      deleteNotePermanently,
      emptyTrash,
      duplicateNote,
      reorderNotes,
      batchColor,
      batchArchive,
      batchTrash,
      batchDeletePermanently,
      batchAddLabel,
      createLabel,
      deleteLabel,
      renameLabel,
      exportDataJSON,
      importDataJSON,
    }),
    [
      notes,
      labels,
      isLoading,
      currentFilter,
      selectedLabel,
      searchQuery,
      layoutMode,
      darkMode,
      selectedNoteIds,
      editingNote,
      isDrawingModalOpen,
      drawingNoteId,
      isLabelModalOpen,
      localMediaFolder,
      isLocalFolderModalOpen,
      setCurrentFilter,
      setSearchQuery,
      setLayoutMode,
      setDarkMode,
      setEditingNote,
      setIsDrawingModalOpen,
      setLocalMediaFolder,
      toggleSelectNote,
      clearSelection,
      selectAllNotes,
      addNote,
      updateNote,
      togglePinNote,
      toggleArchiveNote,
      trashNote,
      restoreNote,
      deleteNotePermanently,
      emptyTrash,
      duplicateNote,
      reorderNotes,
      batchColor,
      batchArchive,
      batchTrash,
      batchDeletePermanently,
      batchAddLabel,
      createLabel,
      deleteLabel,
      renameLabel,
      exportDataJSON,
      importDataJSON,
    ]
  );

  return <KeepContext.Provider value={value}>{children}</KeepContext.Provider>;
}

export function useKeep() {
  const context = useContext(KeepContext);
  if (!context) {
    throw new Error('useKeep must be used within a KeepProvider');
  }
  return context;
}
