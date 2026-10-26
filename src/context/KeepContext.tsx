'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Note, NoteVersion, Label, Category, ViewFilter, LayoutViewMode, FontSizeOption, AppThemeMode, ReadingSession, ActiveStopwatch, CalendarItem, CalendarEvent, CalendarTask, CalendarReminderNotice } from '@/types/note';
import {
  getAllNotesFromDB,
  getAllLabelsFromDB,
  getAllCategoriesFromDB,
  saveCategoryToDB,
  deleteCategoryFromDB,
  renameCategoryInDB,
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
  getAllReadingSessionsFromDB,
  saveReadingSessionToDB,
  deleteReadingSessionFromDB,
  clearAllReadingSessionsFromDB,
  getAllCalendarItemsFromDB,
  saveCalendarItemToDB,
  deleteCalendarItemFromDB,
} from '@/lib/db';
import { setSyncLocalMediaFolder, initLocalMediaCache } from '@/lib/localPaste';
import { hashCategoryPassword, verifyCategoryPassword } from '@/lib/crypto';
import {
  isCategoryUnlockedInSession,
  unlockCategoryInSession,
  lockCategoryInSession as lockCategoryInSessionStore,
} from '@/lib/encryptionSession';
import { exportBackupZip, importBackupSmart, ImportResult } from '@/lib/backupZip';

export function getFontSizeInPx(size: FontSizeOption | string): string {
  switch (size) {
    case 'small': return '13.5px';
    case 'medium': return '15px';
    case 'large': return '17px';
    case 'xlarge': return '20px';
    case 'huge': return '24px';
    case 'max': return '28px';
    default:
      if (/^\d+(\.\d+)?(px)?$/.test(size)) {
        return size.endsWith('px') ? size : `${size}px`;
      }
      return '15px';
  }
}

interface KeepContextType {
  notes: Note[];
  labels: Label[];
  categories: Category[];
  isLoading: boolean;
  currentFilter: ViewFilter;
  selectedLabel: string | null;
  selectedCategory: string | null;
  searchQuery: string;
  layoutMode: LayoutViewMode;
  darkMode: boolean;
  themeMode: AppThemeMode;
  fontSize: FontSizeOption;
  selectedNoteIds: string[];
  editingNote: Note | null;
  versionHistoryNote: Note | null;
  isDrawingModalOpen: boolean;
  drawingNoteId: string | null;
  isLabelModalOpen: boolean;
  isCategoryModalOpen: boolean;
  localMediaFolder: string;
  isLocalFolderModalOpen: boolean;
  isSettingsOpen: boolean;
  isGoogleDriveModalOpen: boolean;
  isPdfExportModalOpen: boolean;
  sharingNote: Note | null;

  // Setters
  setCurrentFilter: (filter: ViewFilter, paramName?: string) => void;
  setSearchQuery: (query: string) => void;
  setLayoutMode: (mode: LayoutViewMode) => void;
  setDarkMode: (dark: boolean) => void;
  setThemeMode: (mode: AppThemeMode) => void;
  setFontSize: (size: FontSizeOption) => void;
  setEditingNote: (note: Note | null) => void;
  setVersionHistoryNote: (note: Note | null) => void;
  setSharingNote: (note: Note | null) => void;
  restoreNoteVersion: (noteId: string, versionId: string) => Promise<void>;
  createNoteSnapshot: (noteId: string, summary?: string) => Promise<void>;
  deleteNoteVersion: (noteId: string, versionId: string) => Promise<void>;
  setIsDrawingModalOpen: (open: boolean, noteId?: string | null) => void;
  setIsLabelModalOpen: (open: boolean) => void;
  setIsCategoryModalOpen: (open: boolean) => void;
  setLocalMediaFolder: (folder: string) => void;
  setIsLocalFolderModalOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsGoogleDriveModalOpen: (open: boolean) => void;
  setIsPdfExportModalOpen: (open: boolean) => void;
  isDateCompileModalOpen: boolean;
  setIsDateCompileModalOpen: (open: boolean) => void;

  // Android & Mobile PWA Installation
  isInstallModalOpen: boolean;
  setIsInstallModalOpen: (open: boolean) => void;
  canInstallPwa: boolean;
  isPwaInstalled: boolean;
  promptInstallPwa: () => Promise<boolean>;

  // Selection
  toggleSelectNote: (id: string) => void;
  clearSelection: () => void;
  selectAllNotes: () => void;

  // Note CRUD
  addNote: (note: Partial<Note>) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>, changeSummary?: string) => Promise<void>;
  togglePinNote: (id: string) => Promise<void>;
  toggleArchiveNote: (id: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  duplicateNote: (id: string) => Promise<Note | null>;
  reorderNotes: (notes: Note[]) => Promise<void>;

  // Batch actions
  batchDuplicate: () => Promise<void>;
  batchColor: (color: Note['color']) => Promise<void>;
  batchArchive: () => Promise<void>;
  batchTrash: () => Promise<void>;
  batchDeletePermanently: () => Promise<void>;
  batchAddLabel: (labelName: string) => Promise<void>;
  batchSetCategory: (categoryName: string | null) => Promise<void>;

  // Label CRUD
  createLabel: (name: string) => Promise<Label | null>;
  deleteLabel: (id: string, name: string) => Promise<void>;
  renameLabel: (id: string, oldName: string, newName: string) => Promise<void>;

  // Category CRUD & Locking
  createCategory: (name: string, color?: string, icon?: string) => Promise<Category | null>;
  updateCategory: (id: string, updates: { name: string; color?: string; icon?: string }) => Promise<void>;
  deleteCategory: (id: string, name: string) => Promise<void>;
  lockCategory: (categoryId: string, password: string, hint?: string) => Promise<void>;
  removeCategoryLock: (categoryId: string, password: string) => Promise<boolean>;
  unlockCategoryForSession: (categoryNameOrId: string, password: string) => Promise<boolean>;
  relockCategoryInSession: (categoryNameOrId: string) => void;
  isCategoryLocked: (categoryNameOrId: string) => boolean;
  unlockedCategoryNames: string[];
  unlockCategoryModalTarget: Category | null;
  setUnlockCategoryModalTarget: (category: Category | null) => void;

  // Reading Stopwatch & Stats
  readingSessions: ReadingSession[];
  activeStopwatch: ActiveStopwatch | null;
  startReadingStopwatch: (noteId: string, noteTitle?: string, category?: string | null) => void;
  pauseReadingStopwatch: () => void;
  resumeReadingStopwatch: () => void;
  stopAndSaveReadingStopwatch: () => Promise<ReadingSession | null>;
  discardReadingStopwatch: () => void;
  deleteReadingSession: (sessionId: string) => Promise<void>;
  updateReadingSession: (sessionId: string, newDurationSeconds: number) => Promise<void>;
  updateNoteReadingTime: (noteId: string, newTotalSeconds: number) => Promise<void>;
  deleteNoteReadingStats: (noteId: string) => Promise<void>;
  clearAllReadingStats: () => Promise<void>;
  getNoteReadingStats: (noteId: string) => { totalSeconds: number; sessionCount: number; lastReadAt?: number };

  // Google Calendar (Events, Tasks, Reminders)
  calendarItems: CalendarItem[];
  addCalendarItem: (item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CalendarItem>;
  updateCalendarItem: (id: string, updates: Partial<CalendarItem>) => Promise<void>;
  deleteCalendarItem: (id: string) => Promise<void>;
  toggleTaskComplete: (id: string) => Promise<void>;
  activeReminderNotices: CalendarReminderNotice[];
  dismissReminderNotice: (id: string) => void;

  // Backup / Data (ZIP & Intelligent Reconciliation)
  exportDataZip: () => Promise<void>;
  exportDataJSON: () => Promise<void>;
  importDataSmart: (file: File) => Promise<ImportResult>;
  importDataJSON: (jsonString: string) => Promise<boolean>;
  importSummary: ImportResult | null;
  setImportSummary: (result: ImportResult | null) => void;
}

const KeepContext = createContext<KeepContextType | null>(null);

export function KeepProvider({
  children,
  initialFilter = 'notes',
}: {
  children: React.ReactNode;
  initialFilter?: ViewFilter;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [activeReminderNotices, setActiveReminderNotices] = useState<CalendarReminderNotice[]>([]);
  const [activeStopwatch, setActiveStopwatch] = useState<ActiveStopwatch | null>(null);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [currentFilter, setCurrentFilterState] = useState<ViewFilter>(initialFilter);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutModeState] = useState<LayoutViewMode>('grid');
  const [darkMode, setDarkModeState] = useState(false);
  const [themeMode, setThemeModeState] = useState<AppThemeMode>('system');
  const [fontSize, setFontSizeState] = useState<FontSizeOption>('medium');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [versionHistoryNote, setVersionHistoryNote] = useState<Note | null>(null);
  const [isDrawingModalOpen, setIsDrawingModalOpenState] = useState(false);
  const [drawingNoteId, setDrawingNoteId] = useState<string | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [unlockedCategoryNames, setUnlockedCategoryNames] = useState<string[]>([]);
  const [unlockCategoryModalTarget, setUnlockCategoryModalTarget] = useState<Category | null>(null);
  const [localMediaFolder, setLocalMediaFolderState] = useState('');
  const [isLocalFolderModalOpen, setIsLocalFolderModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState(false);
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = useState(false);
  const [isDateCompileModalOpen, setIsDateCompileModalOpen] = useState(false);
  const [sharingNote, setSharingNote] = useState<Note | null>(null);

  // Android & Mobile PWA Installation states
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const deferredPromptRef = useRef<any>(null);

  // Register service worker and handle Android PWA beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already installed (standalone mode or web-app)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsPwaInstalled(true);
    }

    // Register service worker for offline support and Android installability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => {
          console.warn('Service Worker registration note:', err);
        });
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstallPwa(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstallPwa(false);
      setIsPwaInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstallPwa = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPromptRef.current;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          setIsPwaInstalled(true);
          setCanInstallPwa(false);
          deferredPromptRef.current = null;
          return true;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    // If native prompt is not available or was dismissed, open the visual Android install guide modal
    setIsInstallModalOpen(true);
    return false;
  }, []);

  // Initialize data from IndexedDB
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [
        storedNotes,
        storedLabels,
        storedCategories,
        storedLayout,
        storedDark,
        storedFolder,
        storedThemeMode,
        storedFontSize,
        storedReadingSessions,
        storedCalendarItems,
      ] = await Promise.all([
        getAllNotesFromDB(),
        getAllLabelsFromDB(),
        getAllCategoriesFromDB(),
        getSettingFromDB<LayoutViewMode>('layoutMode', 'grid'),
        getSettingFromDB<boolean>('darkMode', false),
        getSettingFromDB<string>('localMediaFolder', ''),
        getSettingFromDB<AppThemeMode>('themeMode', 'system'),
        getSettingFromDB<FontSizeOption>('fontSize', 'medium'),
        getAllReadingSessionsFromDB(),
        getAllCalendarItemsFromDB(),
      ]);

      // Initialize in-memory blob URLs from offline IndexedDB media store
      await initLocalMediaCache().catch(() => {});

      setReadingSessions(storedReadingSessions);

      // Seed initial calendar items if empty
      if (storedCalendarItems.length === 0 && storedNotes.length === 0) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const defaultItems: CalendarItem[] = [
          {
            id: 'cal-sample-1',
            type: 'event',
            title: '📅 Google Calendar inside Keep!',
            description: 'Create and organize your Events and Tasks with reminders right here.',
            startDate: todayStr,
            startTime: '10:00',
            endDate: todayStr,
            endTime: '11:00',
            isAllDay: false,
            color: '#039be5',
            location: 'Keep App',
            reminderMinutes: 15,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: 'cal-sample-2',
            type: 'task',
            title: 'Plan upcoming tasks & review notes',
            description: 'Mark tasks completed directly on the calendar or reschedule them.',
            dueDate: todayStr,
            dueTime: '15:00',
            isCompleted: false,
            color: '#0b8043',
            reminderMinutes: 10,
            createdAt: Date.now() + 1,
            updatedAt: Date.now() + 1,
          },
        ];
        for (const item of defaultItems) {
          await saveCalendarItemToDB(item);
        }
        setCalendarItems(defaultItems);
      } else {
        setCalendarItems(storedCalendarItems);
      }

      const initialThemeMode = storedThemeMode || 'system';
      const initialFontSize = storedFontSize || 'medium';

      setThemeModeState(initialThemeMode);
      setFontSizeState(initialFontSize);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-font-size', initialFontSize);
        document.documentElement.style.setProperty('--note-font-size', getFontSizeInPx(initialFontSize));
      }

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
            createdAt: now,
            updatedAt: now,
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
            createdAt: now - 60000,
            updatedAt: now - 60000,
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
            createdAt: now - 120000,
            updatedAt: now - 120000,
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

      // Initialize default categories if none exist
      if (storedCategories.length === 0) {
        const defaultCategories: Category[] = [
          { id: 'cat-personal', name: 'Personal', color: '#3b82f6', icon: '👤', createdAt: Date.now() },
          { id: 'cat-work', name: 'Work', color: '#10b981', icon: '💼', createdAt: Date.now() + 1 },
          { id: 'cat-ideas', name: 'Ideas', color: '#f59e0b', icon: '💡', createdAt: Date.now() + 2 },
          { id: 'cat-finance', name: 'Finance', color: '#8b5cf6', icon: '💰', createdAt: Date.now() + 3 },
        ];
        for (const cat of defaultCategories) {
          await saveCategoryToDB(cat);
        }
        setCategories(defaultCategories);
      } else {
        setCategories(storedCategories);
      }

      setLayoutModeState(storedLayout);

      let isDark = storedDark;
      if (initialThemeMode === 'system') {
        isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        isDark = initialThemeMode === 'dark';
      }

      setDarkModeState(isDark);
      if (typeof document !== 'undefined') {
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
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

  // Listen to OS theme changes when themeMode is 'system'
  useEffect(() => {
    if (themeMode !== 'system' || typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      setDarkModeState(e.matches);
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [themeMode]);

  // View Filter setter
  const setCurrentFilter = useCallback(
    (filter: ViewFilter, paramName?: string) => {
      setCurrentFilterState(filter);
      if (filter === 'label') {
        setSelectedLabel(paramName || null);
        setSelectedCategory(null);
      } else if (filter === 'category') {
        setSelectedCategory(paramName || null);
        setSelectedLabel(null);
        if (paramName) {
          const cat = categories.find((c) => c.name.toLowerCase() === paramName.toLowerCase());
          if (cat?.isLocked && !isCategoryUnlockedInSession(cat.name)) {
            setUnlockCategoryModalTarget(cat);
          }
        }
      } else {
        setSelectedLabel(null);
        setSelectedCategory(null);
      }
      setSelectedNoteIds([]);
    },
    [categories]
  );

  // Font Size setter
  const setFontSize = useCallback((size: FontSizeOption) => {
    setFontSizeState(size);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-font-size', size);
      document.documentElement.style.setProperty('--note-font-size', getFontSizeInPx(size));
    }
    saveSettingToDB('fontSize', size);
  }, []);

  // Theme Mode setter (system | light | dark)
  const setThemeMode = useCallback((mode: AppThemeMode) => {
    setThemeModeState(mode);
    saveSettingToDB('themeMode', mode);
    let isDark = false;
    if (mode === 'system') {
      isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = mode === 'dark';
    }
    setDarkModeState(isDark);
    saveSettingToDB('darkMode', isDark);
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  // Quick Dark Mode toggle (light <-> dark)
  const setDarkMode = useCallback((dark: boolean) => {
    setDarkModeState(dark);
    const newMode: AppThemeMode = dark ? 'dark' : 'light';
    setThemeModeState(newMode);
    saveSettingToDB('darkMode', dark);
    saveSettingToDB('themeMode', newMode);
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
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
      const initialVersion: NoteVersion = {
        id: 'ver-' + now,
        timestamp: now,
        title: noteData.title || '',
        content: noteData.content || '',
        isList: noteData.isList || false,
        todos: noteData.todos ? JSON.parse(JSON.stringify(noteData.todos)) : [],
        color: noteData.color || 'default',
        theme: noteData.theme || 'none',
        changeSummary: 'Created note',
      };

      const newNote: Note = {
        id: 'note-' + now + '-' + Math.random().toString(36).substring(2, 7),
        title: noteData.title || '',
        content: noteData.content || '',
        isList: noteData.isList || false,
        todos: noteData.todos || [],
        color: noteData.color || 'default',
        theme: noteData.theme || 'none',
        labels: noteData.labels || (selectedLabel ? [selectedLabel] : []),
        category: noteData.category !== undefined ? noteData.category : (selectedCategory || null),
        isPinned: noteData.isPinned || false,
        isArchived: noteData.isArchived || false,
        isTrash: false,
        reminder: noteData.reminder || null,
        images: noteData.images || [],
        drawings: noteData.drawings || [],
        linkedNoteIds: noteData.linkedNoteIds || [],
        isEncrypted: noteData.isEncrypted || false,
        encryptedData: noteData.encryptedData || null,
        versions: [initialVersion],
        createdAt: now,
        updatedAt: now,
        order: now,
      };

      await saveNoteToDB(newNote);
      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    [selectedLabel, selectedCategory]
  );

  const updateNote = useCallback(async (id: string, updates: Partial<Note>, changeSummary?: string) => {
    setNotes((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target) return prev;

      const hasContentChange =
        (updates.title !== undefined && updates.title !== target.title) ||
        (updates.content !== undefined && updates.content !== target.content) ||
        (updates.isList !== undefined && updates.isList !== target.isList) ||
        (updates.todos !== undefined && JSON.stringify(updates.todos) !== JSON.stringify(target.todos)) ||
        (updates.color !== undefined && updates.color !== target.color) ||
        (updates.theme !== undefined && updates.theme !== target.theme);

      let newVersions = updates.versions !== undefined ? updates.versions : [...(target.versions || [])];

      if (hasContentChange && updates.versions === undefined) {
        const snapshot: NoteVersion = {
          id: 'ver-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: target.updatedAt || target.createdAt || Date.now(),
          title: target.title,
          content: target.content,
          isList: target.isList,
          todos: target.todos ? JSON.parse(JSON.stringify(target.todos)) : [],
          color: target.color,
          theme: target.theme,
          changeSummary: changeSummary || 'Edited note',
        };

        const lastVer = newVersions[0];
        const isDuplicate =
          lastVer &&
          lastVer.title === snapshot.title &&
          lastVer.content === snapshot.content &&
          JSON.stringify(lastVer.todos) === JSON.stringify(snapshot.todos) &&
          lastVer.color === snapshot.color &&
          lastVer.theme === snapshot.theme;

        if (!isDuplicate) {
          newVersions = [snapshot, ...newVersions];
        }
      }

      const updated: Note = {
        ...target,
        ...updates,
        versions: newVersions,
        updatedAt: Date.now(),
      };
      saveNoteToDB(updated);
      const remaining = prev.filter((n) => n.id !== id);
      return [updated, ...remaining];
    });

    setEditingNote((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, ...updates, updatedAt: Date.now() };
      }
      return prev;
    });

    setVersionHistoryNote((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, ...updates, updatedAt: Date.now() };
      }
      return prev;
    });
  }, []);

  const restoreNoteVersion = useCallback(
    async (noteId: string, versionId: string) => {
      const target = notes.find((n) => n.id === noteId);
      if (!target || !target.versions) return;
      const ver = target.versions.find((v) => v.id === versionId);
      if (!ver) return;

      const preRestoreSnapshot: NoteVersion = {
        id: 'ver-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
        title: target.title,
        content: target.content,
        isList: target.isList,
        todos: target.todos ? JSON.parse(JSON.stringify(target.todos)) : [],
        color: target.color,
        theme: target.theme,
        changeSummary: `Before restoring version from ${new Date(ver.timestamp).toLocaleTimeString()}`,
      };

      const updatedVersions = [preRestoreSnapshot, ...target.versions];

      await updateNote(
        noteId,
        {
          title: ver.title,
          content: ver.content,
          isList: ver.isList,
          todos: ver.todos ? JSON.parse(JSON.stringify(ver.todos)) : [],
          color: ver.color,
          theme: ver.theme,
          versions: updatedVersions,
        },
        `Restored version from ${new Date(ver.timestamp).toLocaleTimeString()}`
      );
    },
    [notes, updateNote]
  );

  const createNoteSnapshot = useCallback(
    async (noteId: string, summary?: string) => {
      const target = notes.find((n) => n.id === noteId);
      if (!target) return;

      const snapshot: NoteVersion = {
        id: 'ver-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
        title: target.title,
        content: target.content,
        isList: target.isList,
        todos: target.todos ? JSON.parse(JSON.stringify(target.todos)) : [],
        color: target.color,
        theme: target.theme,
        changeSummary: summary || 'Manual snapshot checkpoint',
      };

      const updatedVersions = [snapshot, ...(target.versions || [])];
      await updateNote(noteId, { versions: updatedVersions });
    },
    [notes, updateNote]
  );

  const deleteNoteVersion = useCallback(
    async (noteId: string, versionId: string) => {
      const target = notes.find((n) => n.id === noteId);
      if (!target || !target.versions) return;
      const updatedVersions = target.versions.filter((v) => v.id !== versionId);
      await updateNote(noteId, { versions: updatedVersions });
    },
    [notes, updateNote]
  );

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
    async (id: string): Promise<Note | null> => {
      const original = notes.find((n) => n.id === id);
      if (!original) return null;
      const now = Date.now();
      const copy: Note = {
        ...original,
        id: 'note-' + now + '-' + Math.random().toString(36).substring(2, 7),
        title: original.title ? `${original.title} (Copy)` : 'Copy of note',
        todos: (original.todos || []).map((t, idx) => ({ ...t, id: 'todo-' + now + '-' + idx })),
        images: [...(original.images || [])],
        drawings: [...(original.drawings || [])],
        labels: [...(original.labels || [])],
        category: original.category || null,
        linkedNoteIds: [...(original.linkedNoteIds || [])],
        isEncrypted: original.isEncrypted || false,
        encryptedData: original.encryptedData ? { ...original.encryptedData } : null,
        createdAt: now,
        updatedAt: now,
        order: now,
      };
      await saveNoteToDB(copy);
      setNotes((prev) => [copy, ...prev]);
      return copy;
    },
    [notes]
  );

  const batchDuplicate = useCallback(async () => {
    const clones: Note[] = [];
    const now = Date.now();
    for (let i = 0; i < selectedNoteIds.length; i++) {
      const id = selectedNoteIds[i];
      const original = notes.find((n) => n.id === id);
      if (!original) continue;
      const cloneTime = now + i;
      const copy: Note = {
        ...original,
        id: 'note-' + cloneTime + '-' + Math.random().toString(36).substring(2, 7),
        title: original.title ? `${original.title} (Copy)` : 'Copy of note',
        todos: (original.todos || []).map((t, idx) => ({ ...t, id: 'todo-' + cloneTime + '-' + idx })),
        images: [...(original.images || [])],
        drawings: [...(original.drawings || [])],
        labels: [...(original.labels || [])],
        category: original.category || null,
        linkedNoteIds: [...(original.linkedNoteIds || [])],
        isEncrypted: original.isEncrypted || false,
        encryptedData: original.encryptedData ? { ...original.encryptedData } : null,
        createdAt: cloneTime,
        updatedAt: cloneTime,
        order: cloneTime,
      };
      await saveNoteToDB(copy);
      clones.push(copy);
    }
    if (clones.length > 0) {
      setNotes((prev) => [...clones, ...prev]);
    }
    clearSelection();
  }, [selectedNoteIds, notes, clearSelection]);

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

  const batchSetCategory = useCallback(
    async (categoryName: string | null) => {
      for (const id of selectedNoteIds) {
        await updateNote(id, { category: categoryName });
      }
      clearSelection();
    },
    [selectedNoteIds, updateNote, clearSelection]
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

  // Categories CRUD
  const createCategory = useCallback(
    async (name: string, color?: string, icon?: string): Promise<Category | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;

      const newCategory: Category = {
        id: 'cat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: trimmed,
        color: color || '#3b82f6',
        icon: icon || '📁',
        createdAt: Date.now(),
      };
      await saveCategoryToDB(newCategory);
      setCategories((prev) => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
      return newCategory;
    },
    [categories]
  );

  const updateCategory = useCallback(
    async (id: string, updates: { name: string; color?: string; icon?: string }) => {
      const trimmed = updates.name.trim();
      if (!trimmed) return;
      const current = categories.find((c) => c.id === id);
      if (!current) return;

      const updated: Category = {
        ...current,
        name: trimmed,
        color: updates.color || current.color,
        icon: updates.icon || current.icon,
      };
      await saveCategoryToDB(updated);
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));

      if (current.name !== trimmed) {
        // Cascade rename to notes
        setNotes((prev) =>
          prev.map((n) => (n.category === current.name ? { ...n, category: trimmed } : n))
        );
        if (selectedCategory === current.name) {
          setSelectedCategory(trimmed);
        }
      }
    },
    [categories, selectedCategory]
  );

  const deleteCategory = useCallback(
    async (id: string, name: string) => {
      await deleteCategoryFromDB(id, name);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setNotes((prev) =>
        prev.map((n) => (n.category === name ? { ...n, category: null } : n))
      );
      if (selectedCategory === name) {
        setCurrentFilter('notes');
      }
    },
    [selectedCategory, setCurrentFilter]
  );

  const isCategoryLocked = useCallback(
    (categoryNameOrId: string): boolean => {
      const q = categoryNameOrId.toLowerCase().trim();
      const cat = categories.find((c) => c.name.toLowerCase() === q || c.id === q);
      if (!cat || !cat.isLocked) return false;
      return (
        !isCategoryUnlockedInSession(cat.name) &&
        !unlockedCategoryNames.includes(cat.name.toLowerCase())
      );
    },
    [categories, unlockedCategoryNames]
  );

  const lockCategory = useCallback(
    async (categoryId: string, password: string, hint?: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const { hash, salt } = await hashCategoryPassword(password);
      const updated: Category = {
        ...cat,
        isLocked: true,
        lockPasswordHash: hash,
        lockSalt: salt,
        lockHint: hint?.trim() || undefined,
      };
      await saveCategoryToDB(updated);
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
      lockCategoryInSessionStore(cat.name);
      setUnlockedCategoryNames((prev) => prev.filter((n) => n !== cat.name.toLowerCase()));
    },
    [categories]
  );

  const removeCategoryLock = useCallback(
    async (categoryId: string, password: string): Promise<boolean> => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat || !cat.isLocked || !cat.lockPasswordHash || !cat.lockSalt) return false;
      const isValid = await verifyCategoryPassword(password, cat.lockPasswordHash, cat.lockSalt);
      if (!isValid) return false;

      const updated: Category = {
        ...cat,
        isLocked: false,
        lockPasswordHash: undefined,
        lockSalt: undefined,
        lockHint: undefined,
      };
      await saveCategoryToDB(updated);
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
      lockCategoryInSessionStore(cat.name);
      setUnlockedCategoryNames((prev) => prev.filter((n) => n !== cat.name.toLowerCase()));
      return true;
    },
    [categories]
  );

  const unlockCategoryForSession = useCallback(
    async (categoryNameOrId: string, password: string): Promise<boolean> => {
      const q = categoryNameOrId.toLowerCase().trim();
      const cat = categories.find((c) => c.name.toLowerCase() === q || c.id === q);
      if (!cat || !cat.isLocked || !cat.lockPasswordHash || !cat.lockSalt) return false;
      const isValid = await verifyCategoryPassword(password, cat.lockPasswordHash, cat.lockSalt);
      if (!isValid) return false;

      unlockCategoryInSession(cat.name);
      setUnlockedCategoryNames((prev) =>
        Array.from(new Set([...prev, cat.name.toLowerCase()]))
      );
      return true;
    },
    [categories]
  );

  const relockCategoryInSession = useCallback(
    (categoryNameOrId: string) => {
      const q = categoryNameOrId.toLowerCase().trim();
      const cat = categories.find((c) => c.name.toLowerCase() === q || c.id === q);
      if (!cat) return;
      lockCategoryInSessionStore(cat.name);
      setUnlockedCategoryNames((prev) => prev.filter((n) => n !== cat.name.toLowerCase()));
    },
    [categories]
  );

  // Active Stopwatch tick interval (tracks real timestamps for 100% accuracy in background tabs/screens)
  useEffect(() => {
    if (!activeStopwatch || !activeStopwatch.isRunning) return;
    let lastTick = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.max(1, Math.round((now - lastTick) / 1000));
      lastTick = now;

      setActiveStopwatch((prev) => {
        if (!prev || !prev.isRunning) return prev;
        return {
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + deltaSeconds,
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeStopwatch?.isRunning]);

  const startReadingStopwatch = useCallback(
    (noteId: string, noteTitle?: string, category?: string | null) => {
      const note = notes.find((n) => n.id === noteId);
      const title = noteTitle || note?.title || 'Untitled Note';
      const cat = category !== undefined ? category : (note?.category || null);
      setActiveStopwatch({
        noteId,
        noteTitle: title,
        category: cat,
        elapsedSeconds: 0,
        isRunning: true,
        startedAt: Date.now(),
      });
    },
    [notes]
  );

  const pauseReadingStopwatch = useCallback(() => {
    setActiveStopwatch((prev) => (prev ? { ...prev, isRunning: false } : null));
  }, []);

  const resumeReadingStopwatch = useCallback(() => {
    setActiveStopwatch((prev) => (prev ? { ...prev, isRunning: true } : null));
  }, []);

  const stopAndSaveReadingStopwatch = useCallback(async (): Promise<ReadingSession | null> => {
    if (!activeStopwatch) return null;
    const current = activeStopwatch;
    const now = Date.now();
    const duration = current.elapsedSeconds;

    if (duration < 1) {
      setActiveStopwatch(null);
      return null;
    }

    const todayDateStr = new Date(now).toISOString().split('T')[0];
    const session: ReadingSession = {
      id: 'session-' + now + '-' + Math.random().toString(36).substring(2, 6),
      noteId: current.noteId,
      noteTitle: current.noteTitle,
      category: current.category || null,
      durationSeconds: duration,
      startedAt: current.startedAt,
      endedAt: now,
      dateStr: todayDateStr,
    };

    await saveReadingSessionToDB(session);
    setReadingSessions((prev) => [session, ...prev]);
    setActiveStopwatch(null);

    // Update note total reading time
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === current.noteId) {
          const updated = {
            ...n,
            totalReadingTime: (n.totalReadingTime || 0) + duration,
          };
          saveNoteToDB(updated);
          return updated;
        }
        return n;
      })
    );

    return session;
  }, [activeStopwatch]);

  const discardReadingStopwatch = useCallback(() => {
    setActiveStopwatch(null);
  }, []);

  const deleteReadingSession = useCallback(
    async (sessionId: string) => {
      const session = readingSessions.find((s) => s.id === sessionId);
      if (!session) return;
      await deleteReadingSessionFromDB(sessionId);
      setReadingSessions((prev) => prev.filter((s) => s.id !== sessionId));

      setNotes((prev) =>
        prev.map((n) => {
          if (n.id === session.noteId && n.totalReadingTime) {
            const newTotal = Math.max(0, n.totalReadingTime - session.durationSeconds);
            const updated = { ...n, totalReadingTime: newTotal };
            saveNoteToDB(updated);
            return updated;
          }
          return n;
        })
      );
    },
    [readingSessions]
  );

  const updateReadingSession = useCallback(
    async (sessionId: string, newDurationSeconds: number) => {
      const session = readingSessions.find((s) => s.id === sessionId);
      if (!session) return;
      const sanitized = Math.max(0, Math.round(newDurationSeconds));
      const diff = sanitized - session.durationSeconds;
      const updatedSession: ReadingSession = {
        ...session,
        durationSeconds: sanitized,
      };

      await saveReadingSessionToDB(updatedSession);
      setReadingSessions((prev) => prev.map((s) => (s.id === sessionId ? updatedSession : s)));

      if (diff !== 0) {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.id === session.noteId) {
              const newTotal = Math.max(0, (n.totalReadingTime || 0) + diff);
              const updated = { ...n, totalReadingTime: newTotal };
              saveNoteToDB(updated);
              return updated;
            }
            return n;
          })
        );
      }
    },
    [readingSessions]
  );

  const updateNoteReadingTime = useCallback(
    async (noteId: string, newTotalSeconds: number) => {
      const sanitizedSeconds = Math.max(0, Math.round(newTotalSeconds));

      // 1. Update Note's totalReadingTime
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id === noteId) {
            const updated = { ...n, totalReadingTime: sanitizedSeconds };
            saveNoteToDB(updated);
            return updated;
          }
          return n;
        })
      );

      // 2. Synchronize reading sessions to match the new duration
      const noteSessions = readingSessions.filter((s) => s.noteId === noteId);
      if (sanitizedSeconds === 0) {
        for (const s of noteSessions) {
          await deleteReadingSessionFromDB(s.id);
        }
        setReadingSessions((prev) => prev.filter((s) => s.noteId !== noteId));
      } else if (noteSessions.length === 0) {
        // Create an initial session representing this reading time
        const targetNote = notes.find((n) => n.id === noteId);
        const nowTime = Date.now();
        const newSession: ReadingSession = {
          id: `session_manual_${nowTime}_${Math.random().toString(36).slice(2, 7)}`,
          noteId,
          noteTitle: targetNote?.title || 'Untitled Note',
          category: targetNote?.category || null,
          durationSeconds: sanitizedSeconds,
          startedAt: nowTime - sanitizedSeconds * 1000,
          endedAt: nowTime,
          dateStr: new Date(nowTime).toISOString().split('T')[0],
        };
        await saveReadingSessionToDB(newSession);
        setReadingSessions((prev) => [newSession, ...prev]);
      } else {
        const currentSum = noteSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
        const diff = sanitizedSeconds - currentSum;
        if (diff !== 0) {
          // Adjust the latest session
          const sorted = [...noteSessions].sort((a, b) => b.endedAt - a.endedAt);
          const mostRecent = sorted[0];
          const newDuration = Math.max(1, mostRecent.durationSeconds + diff);
          const updatedSession: ReadingSession = {
            ...mostRecent,
            durationSeconds: newDuration,
          };
          await saveReadingSessionToDB(updatedSession);
          setReadingSessions((prev) =>
            prev.map((s) => (s.id === mostRecent.id ? updatedSession : s))
          );
        }
      }
    },
    [readingSessions, notes]
  );

  const deleteNoteReadingStats = useCallback(
    async (noteId: string) => {
      // 1. Delete all reading sessions belonging to this note
      const sessionsToDelete = readingSessions.filter((s) => s.noteId === noteId);
      for (const s of sessionsToDelete) {
        await deleteReadingSessionFromDB(s.id);
      }
      setReadingSessions((prev) => prev.filter((s) => s.noteId !== noteId));

      // 2. Clear active stopwatch if running on this note
      setActiveStopwatch((prev) => (prev && prev.noteId === noteId ? null : prev));

      // 3. Reset note totalReadingTime to 0
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id === noteId) {
            const updated = { ...n, totalReadingTime: 0 };
            saveNoteToDB(updated);
            return updated;
          }
          return n;
        })
      );
    },
    [readingSessions]
  );

  const clearAllReadingStats = useCallback(async () => {
    await clearAllReadingSessionsFromDB();
    setReadingSessions([]);
    setActiveStopwatch(null);
    setNotes((prev) =>
      prev.map((n) => {
        if (n.totalReadingTime) {
          const updated = { ...n, totalReadingTime: 0 };
          saveNoteToDB(updated);
          return updated;
        }
        return n;
      })
    );
  }, []);

  const getNoteReadingStats = useCallback(
    (noteId: string) => {
      const noteSessions = readingSessions.filter((s) => s.noteId === noteId);
      const sessionSeconds = noteSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
      const targetNote = notes.find((n) => n.id === noteId);
      const totalSeconds =
        targetNote?.totalReadingTime !== undefined ? targetNote.totalReadingTime : sessionSeconds;
      const sessionCount = noteSessions.length;
      const lastReadAt = noteSessions.length > 0 ? noteSessions[0].endedAt : undefined;
      return { totalSeconds, sessionCount, lastReadAt };
    },
    [readingSessions, notes]
  );

  // Calendar (Google Calendar style Events & Tasks)
  const addCalendarItem = useCallback(
    async (itemData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarItem> => {
      const now = Date.now();
      const id = (itemData.type === 'event' ? 'event-' : 'task-') + now + '-' + Math.random().toString(36).substring(2, 7);
      const newItem: CalendarItem = {
        ...itemData,
        id,
        createdAt: now,
        updatedAt: now,
      } as CalendarItem;

      await saveCalendarItemToDB(newItem);
      setCalendarItems((prev) => [newItem, ...prev]);
      return newItem;
    },
    []
  );

  const updateCalendarItem = useCallback(
    async (id: string, updates: Partial<CalendarItem>) => {
      setCalendarItems((prev) => {
        const target = prev.find((i) => i.id === id);
        if (!target) return prev;
        const updated = {
          ...target,
          ...updates,
          updatedAt: Date.now(),
        } as CalendarItem;
        saveCalendarItemToDB(updated);
        return prev.map((i) => (i.id === id ? updated : i));
      });
    },
    []
  );

  const deleteCalendarItem = useCallback(async (id: string) => {
    await deleteCalendarItemFromDB(id);
    setCalendarItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toggleTaskComplete = useCallback(async (id: string) => {
    setCalendarItems((prev) => {
      const target = prev.find((i) => i.id === id && i.type === 'task') as CalendarTask | undefined;
      if (!target) return prev;
      const nextCompleted = !target.isCompleted;
      const updated: CalendarTask = {
        ...target,
        isCompleted: nextCompleted,
        completedAt: nextCompleted ? Date.now() : undefined,
        updatedAt: Date.now(),
      };
      saveCalendarItemToDB(updated);
      return prev.map((i) => (i.id === id ? updated : i));
    });
  }, []);

  const dismissReminderNotice = useCallback((id: string) => {
    setActiveReminderNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Reminder Notification Monitoring
  const notifiedRemindersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkReminders = () => {
      const now = Date.now();
      const newNotices: CalendarReminderNotice[] = [];

      // 1. Check Calendar Items (Events & Tasks)
      for (const item of calendarItems) {
        if (item.reminderMinutes === undefined || item.reminderMinutes < 0) continue;
        if (item.type === 'task' && item.isCompleted) continue;

        let targetTimeMs: number | null = null;
        if (item.type === 'event') {
          const timePart = item.startTime || (item.isAllDay ? '09:00' : '00:00');
          const [hours, minutes] = timePart.split(':').map(Number);
          const [y, m, d] = item.startDate.split('-').map(Number);
          const eventDate = new Date(y, m - 1, d, hours || 0, minutes || 0, 0);
          targetTimeMs = eventDate.getTime() - item.reminderMinutes * 60 * 1000;
        } else {
          const timePart = item.dueTime || '09:00';
          const [hours, minutes] = timePart.split(':').map(Number);
          const [y, m, d] = item.dueDate.split('-').map(Number);
          const taskDate = new Date(y, m - 1, d, hours || 0, minutes || 0, 0);
          targetTimeMs = taskDate.getTime() - item.reminderMinutes * 60 * 1000;
        }

        if (targetTimeMs) {
          const diffMs = now - targetTimeMs;
          if (diffMs >= 0 && diffMs <= 180000) {
            const noticeKey = `${item.id}-${targetTimeMs}`;
            if (!notifiedRemindersRef.current.has(noticeKey)) {
              notifiedRemindersRef.current.add(noticeKey);
              newNotices.push({
                id: noticeKey,
                title: item.title,
                timeStr: new Date(targetTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                itemType: item.type,
                color: item.color,
                itemId: item.id,
              });

              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(`⏰ Calendar Reminder: ${item.title}`, {
                    body: item.description || `${item.type === 'event' ? 'Event' : 'Task'} scheduled now`,
                    icon: '/favicon.ico',
                  });
                } catch {
                  // ignore
                }
              }
            }
          }
        }
      }

      // 2. Check Note reminders
      for (const note of notes) {
        if (!note.reminder || note.isTrash || note.isArchived) continue;
        const reminderTime = new Date(note.reminder).getTime();
        const diffMs = now - reminderTime;
        if (diffMs >= 0 && diffMs <= 180000) {
          const noticeKey = `note-${note.id}-${reminderTime}`;
          if (!notifiedRemindersRef.current.has(noticeKey)) {
            notifiedRemindersRef.current.add(noticeKey);
            newNotices.push({
              id: noticeKey,
              title: note.title || 'Untitled Note',
              timeStr: new Date(reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              itemType: 'note',
              color: '#f59e0b',
              itemId: note.id,
            });

            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`🔔 Note Reminder: ${note.title || 'Untitled Note'}`, {
                  body: note.content ? note.content.slice(0, 100) : 'Reminder set for this note',
                  icon: '/favicon.ico',
                });
              } catch {
                // ignore
              }
            }
          }
        }
      }

      if (newNotices.length > 0) {
        setActiveReminderNotices((prev) => [...newNotices, ...prev]);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 25000);
    return () => clearInterval(interval);
  }, [calendarItems, notes]);

  // Backup & Import (ZIP and Intelligent Reconciliation)
  const exportDataZip = useCallback(async () => {
    await exportBackupZip();
  }, []);

  const exportDataJSON = exportDataZip; // Default export to ZIP with images and files bundled!

  const importDataSmart = useCallback(
    async (file: File): Promise<ImportResult> => {
      const result = await importBackupSmart(file);
      if (result.success) {
        await initLocalMediaCache().catch(() => {});
        await loadInitialData();
      }
      setImportSummary(result);
      return result;
    },
    [loadInitialData]
  );

  const importDataJSON = useCallback(
    async (jsonString: string): Promise<boolean> => {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'backup.json', { type: 'application/json' });
      const res = await importDataSmart(file);
      return res.success;
    },
    [importDataSmart]
  );

  const value = useMemo(
    () => ({
      notes,
      labels,
      categories,
      readingSessions,
      calendarItems,
      activeReminderNotices,
      activeStopwatch,
      isLoading,
      currentFilter,
      selectedLabel,
      selectedCategory,
      searchQuery,
      layoutMode,
      darkMode,
      themeMode,
      fontSize,
      selectedNoteIds,
      editingNote,
      versionHistoryNote,
      isDrawingModalOpen,
      drawingNoteId,
      isLabelModalOpen,
      isCategoryModalOpen,
      localMediaFolder,
      isLocalFolderModalOpen,
      isSettingsOpen,
      setIsSettingsOpen,
      isGoogleDriveModalOpen,
      setIsGoogleDriveModalOpen,
      isPdfExportModalOpen,
      setIsPdfExportModalOpen,
      isDateCompileModalOpen,
      setIsDateCompileModalOpen,
      isInstallModalOpen,
      setIsInstallModalOpen,
      canInstallPwa,
      isPwaInstalled,
      promptInstallPwa,
      sharingNote,
      setSharingNote,
      setCurrentFilter,
      setSearchQuery,
      setLayoutMode,
      setDarkMode,
      setThemeMode,
      setFontSize,
      setEditingNote,
      setVersionHistoryNote,
      restoreNoteVersion,
      createNoteSnapshot,
      deleteNoteVersion,
      startReadingStopwatch,
      pauseReadingStopwatch,
      resumeReadingStopwatch,
      stopAndSaveReadingStopwatch,
      discardReadingStopwatch,
      deleteReadingSession,
      updateReadingSession,
      updateNoteReadingTime,
      deleteNoteReadingStats,
      clearAllReadingStats,
      getNoteReadingStats,
      setIsDrawingModalOpen,
      setIsLabelModalOpen,
      setIsCategoryModalOpen,
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
      batchDuplicate,
      batchColor,
      batchArchive,
      batchTrash,
      batchDeletePermanently,
      batchAddLabel,
      batchSetCategory,
      createLabel,
      deleteLabel,
      renameLabel,
      createCategory,
      updateCategory,
      deleteCategory,
      lockCategory,
      removeCategoryLock,
      unlockCategoryForSession,
      relockCategoryInSession,
      isCategoryLocked,
      unlockedCategoryNames,
      unlockCategoryModalTarget,
      setUnlockCategoryModalTarget,
      exportDataZip,
      exportDataJSON,
      importDataSmart,
      importDataJSON,
      importSummary,
      setImportSummary,
      addCalendarItem,
      updateCalendarItem,
      deleteCalendarItem,
      toggleTaskComplete,
      dismissReminderNotice,
    }),
    [
      notes,
      labels,
      categories,
      readingSessions,
      calendarItems,
      activeReminderNotices,
      activeStopwatch,
      isLoading,
      currentFilter,
      selectedLabel,
      selectedCategory,
      searchQuery,
      layoutMode,
      darkMode,
      themeMode,
      fontSize,
      selectedNoteIds,
      editingNote,
      versionHistoryNote,
      isDrawingModalOpen,
      drawingNoteId,
      isLabelModalOpen,
      isCategoryModalOpen,
      localMediaFolder,
      isLocalFolderModalOpen,
      isSettingsOpen,
      isGoogleDriveModalOpen,
      isPdfExportModalOpen,
      isInstallModalOpen,
      canInstallPwa,
      isPwaInstalled,
      promptInstallPwa,
      sharingNote,
      setSharingNote,
      setCurrentFilter,
      setSearchQuery,
      setLayoutMode,
      setDarkMode,
      setThemeMode,
      setFontSize,
      setEditingNote,
      setVersionHistoryNote,
      restoreNoteVersion,
      createNoteSnapshot,
      deleteNoteVersion,
      startReadingStopwatch,
      pauseReadingStopwatch,
      resumeReadingStopwatch,
      stopAndSaveReadingStopwatch,
      discardReadingStopwatch,
      deleteReadingSession,
      updateReadingSession,
      updateNoteReadingTime,
      deleteNoteReadingStats,
      clearAllReadingStats,
      getNoteReadingStats,
      setIsDrawingModalOpen,
      setIsLabelModalOpen,
      setIsCategoryModalOpen,
      setLocalMediaFolder,
      setIsLocalFolderModalOpen,
      setIsSettingsOpen,
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
      batchDuplicate,
      batchColor,
      batchArchive,
      batchTrash,
      batchDeletePermanently,
      batchAddLabel,
      batchSetCategory,
      createLabel,
      deleteLabel,
      renameLabel,
      createCategory,
      updateCategory,
      deleteCategory,
      lockCategory,
      removeCategoryLock,
      unlockCategoryForSession,
      relockCategoryInSession,
      isCategoryLocked,
      unlockedCategoryNames,
      unlockCategoryModalTarget,
      exportDataZip,
      exportDataJSON,
      importDataSmart,
      importDataJSON,
      importSummary,
      addCalendarItem,
      updateCalendarItem,
      deleteCalendarItem,
      toggleTaskComplete,
      dismissReminderNotice,
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
