import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Note, Label, Category, ReadingSession, CalendarItem } from '@/types/note';

interface KeepDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: {
      'by-updated': number;
      'by-pinned': number;
      'by-archived': number;
      'by-trash': number;
    };
  };
  labels: {
    key: string;
    value: Label;
    indexes: {
      'by-name': string;
    };
  };
  categories: {
    key: string;
    value: Category;
    indexes: {
      'by-name': string;
    };
  };
  readingSessions: {
    key: string;
    value: ReadingSession;
    indexes: {
      'by-note': string;
      'by-date': string;
      'by-ended': number;
    };
  };
  calendarItems: {
    key: string;
    value: CalendarItem;
    indexes: {
      'by-type': string;
      'by-updated': number;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
  media: {
    key: string;
    value: KeepMediaRecord;
    indexes: {
      'by-filename': string;
    };
  };
}

export interface KeepMediaRecord {
  id: string;
  fileName: string;
  blob: Blob;
  mimeType: string;
  size: number;
  updatedAt: number;
}

const DB_NAME = 'google-keep-local-db';
const DB_VERSION = 5;

let dbPromise: Promise<IDBPDatabase<KeepDB>> | null = null;

export function getKeepDB() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<KeepDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Notes Store
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-updated', 'updatedAt');
          noteStore.createIndex('by-pinned', 'isPinned');
          noteStore.createIndex('by-archived', 'isArchived');
          noteStore.createIndex('by-trash', 'isTrash');
        }

        // Labels Store
        if (!db.objectStoreNames.contains('labels')) {
          const labelStore = db.createObjectStore('labels', { keyPath: 'id' });
          labelStore.createIndex('by-name', 'name');
        }

        // Categories Store
        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
          categoryStore.createIndex('by-name', 'name');
        }

        // Reading Sessions Store
        if (!db.objectStoreNames.contains('readingSessions')) {
          const sessionStore = db.createObjectStore('readingSessions', { keyPath: 'id' });
          sessionStore.createIndex('by-note', 'noteId');
          sessionStore.createIndex('by-date', 'dateStr');
          sessionStore.createIndex('by-ended', 'endedAt');
        }

        // Calendar Items Store (Events and Tasks)
        if (!db.objectStoreNames.contains('calendarItems')) {
          const calStore = db.createObjectStore('calendarItems', { keyPath: 'id' });
          calStore.createIndex('by-type', 'type');
          calStore.createIndex('by-updated', 'updatedAt');
        }

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        // Media Store (Offline / Mobile persistent images & attachments)
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('by-filename', 'fileName');
        }
      },
    });
  }
  return dbPromise;
}

// ----------------- NOTES REPOSITORY -----------------

export async function getAllNotesFromDB(): Promise<Note[]> {
  const db = await getKeepDB();
  if (!db) return [];
  const notes = await db.getAll('notes');
  // Sort by updated at descending (most recently updated first)
  return notes.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

export async function getNoteByIdFromDB(id: string): Promise<Note | undefined> {
  const db = await getKeepDB();
  if (!db) return undefined;
  return db.get('notes', id);
}

export async function saveNoteToDB(note: Note): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  await db.put('notes', note);
}

export async function saveMultipleNotesToDB(notes: Note[]): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction('notes', 'readwrite');
  await Promise.all(notes.map((n) => tx.store.put(n)));
  await tx.done;
}

export async function deleteNotePermanentlyFromDB(id: string): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  await db.delete('notes', id);
}

export async function clearTrashFromDB(): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction('notes', 'readwrite');
  const allNotes = await tx.store.getAll();
  for (const note of allNotes) {
    if (note.isTrash) {
      await tx.store.delete(note.id);
    }
  }
  await tx.done;
}

// ----------------- LABELS REPOSITORY -----------------

export async function getAllLabelsFromDB(): Promise<Label[]> {
  const db = await getKeepDB();
  if (!db) return [];
  const labels = await db.getAll('labels');
  return labels.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveLabelToDB(label: Label): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  await db.put('labels', label);
}

export async function deleteLabelFromDB(id: string, labelName: string): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction(['labels', 'notes'], 'readwrite');
  await tx.objectStore('labels').delete(id);

  // Also remove label name from any notes
  const notesStore = tx.objectStore('notes');
  const allNotes = await notesStore.getAll();
  for (const note of allNotes) {
    if (note.labels && note.labels.includes(labelName)) {
      note.labels = note.labels.filter((l) => l !== labelName);
      await notesStore.put(note);
    }
  }
  await tx.done;
}

export async function renameLabelInDB(id: string, oldName: string, newName: string): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction(['labels', 'notes'], 'readwrite');
  
  const label = await tx.objectStore('labels').get(id);
  if (label) {
    label.name = newName;
    await tx.objectStore('labels').put(label);
  }

  // Update note label references
  const notesStore = tx.objectStore('notes');
  const allNotes = await notesStore.getAll();
  for (const note of allNotes) {
    if (note.labels && note.labels.includes(oldName)) {
      note.labels = note.labels.map((l) => (l === oldName ? newName : l));
      await notesStore.put(note);
    }
  }
  await tx.done;
}

// ----------------- CATEGORIES REPOSITORY -----------------

export async function getAllCategoriesFromDB(): Promise<Category[]> {
  const db = await getKeepDB();
  if (!db) return [];
  const categories = await db.getAll('categories');
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCategoryToDB(category: Category): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  await db.put('categories', category);
}

export async function deleteCategoryFromDB(id: string, categoryName: string): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction(['categories', 'notes'], 'readwrite');
  await tx.objectStore('categories').delete(id);

  // Also remove category reference from any notes
  const notesStore = tx.objectStore('notes');
  const allNotes = await notesStore.getAll();
  for (const note of allNotes) {
    if (note.category === categoryName) {
      note.category = null;
      await notesStore.put(note);
    }
  }
  await tx.done;
}

export async function renameCategoryInDB(
  id: string,
  oldName: string,
  newName: string,
  newIcon?: string,
  newColor?: string
): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction(['categories', 'notes'], 'readwrite');

  const cat = await tx.objectStore('categories').get(id);
  if (cat) {
    cat.name = newName;
    if (newIcon !== undefined) cat.icon = newIcon;
    if (newColor !== undefined) cat.color = newColor;
    await tx.objectStore('categories').put(cat);
  }

  // Update note category references
  const notesStore = tx.objectStore('notes');
  const allNotes = await notesStore.getAll();
  for (const note of allNotes) {
    if (note.category === oldName) {
      note.category = newName;
      await notesStore.put(note);
    }
  }
  await tx.done;
}

// ----------------- READING SESSIONS REPOSITORY -----------------

export async function getAllReadingSessionsFromDB(): Promise<ReadingSession[]> {
  const db = await getKeepDB();
  if (!db) return [];
  if (!db.objectStoreNames.contains('readingSessions')) return [];
  const sessions = await db.getAll('readingSessions');
  return sessions.sort((a, b) => b.endedAt - a.endedAt);
}

export async function saveReadingSessionToDB(session: ReadingSession): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  if (!db.objectStoreNames.contains('readingSessions')) return;
  await db.put('readingSessions', session);
}

export async function deleteReadingSessionFromDB(id: string): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  if (!db.objectStoreNames.contains('readingSessions')) return;
  await db.delete('readingSessions', id);
}

export async function clearAllReadingSessionsFromDB(): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  if (!db.objectStoreNames.contains('readingSessions')) return;
  await db.clear('readingSessions');
}

// ----------------- SETTINGS / BACKUP REPOSITORY -----------------

export async function getSettingFromDB<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getKeepDB();
  if (!db) return defaultValue;
  const val = await db.get('settings', key);
  return (val as T) ?? defaultValue;
}

export async function saveSettingToDB(key: string, value: unknown): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  await db.put('settings', value, key);
}

export async function exportAllData(): Promise<{
  notes: Note[];
  labels: Label[];
  categories: Category[];
  readingSessions?: ReadingSession[];
  calendarItems?: CalendarItem[];
  settings?: Record<string, unknown>;
  exportDate: string;
}> {
  const db = await getKeepDB();
  if (!db) {
    return {
      notes: [],
      labels: [],
      categories: [],
      readingSessions: [],
      calendarItems: [],
      settings: {},
      exportDate: new Date().toISOString(),
    };
  }
  const rawNotes = await db.getAll('notes');
  const notes = rawNotes.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  const labels = await db.getAll('labels');
  const categories = await db.getAll('categories');
  let readingSessions: ReadingSession[] = [];
  if (db.objectStoreNames.contains('readingSessions')) {
    readingSessions = await db.getAll('readingSessions');
  }
  let calendarItems: CalendarItem[] = [];
  if (db.objectStoreNames.contains('calendarItems')) {
    calendarItems = await db.getAll('calendarItems');
  }

  const settings: Record<string, unknown> = {};
  if (db.objectStoreNames.contains('settings')) {
    const keys = await db.getAllKeys('settings');
    for (const key of keys) {
      settings[String(key)] = await db.get('settings', key);
    }
  }

  return {
    notes,
    labels,
    categories,
    readingSessions,
    calendarItems,
    settings,
    exportDate: new Date().toISOString(),
  };
}

export async function importAllData(data: {
  notes?: Note[];
  labels?: Label[];
  categories?: Category[];
  readingSessions?: ReadingSession[];
  calendarItems?: CalendarItem[];
  settings?: Record<string, unknown>;
}): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const storeNames: Array<'notes' | 'labels' | 'categories' | 'readingSessions' | 'calendarItems' | 'settings'> = ['notes', 'labels', 'categories'];
  if (db.objectStoreNames.contains('readingSessions')) {
    storeNames.push('readingSessions');
  }
  if (db.objectStoreNames.contains('calendarItems')) {
    storeNames.push('calendarItems');
  }
  if (data.settings && db.objectStoreNames.contains('settings')) {
    storeNames.push('settings');
  }
  const tx = db.transaction(storeNames, 'readwrite');
  
  if (data.notes && Array.isArray(data.notes)) {
    for (const note of data.notes) {
      await tx.objectStore('notes').put(note);
    }
  }
  if (data.labels && Array.isArray(data.labels)) {
    for (const label of data.labels) {
      await tx.objectStore('labels').put(label);
    }
  }
  if (data.categories && Array.isArray(data.categories)) {
    for (const category of data.categories) {
      await tx.objectStore('categories').put(category);
    }
  }
  if (data.readingSessions && Array.isArray(data.readingSessions) && db.objectStoreNames.contains('readingSessions')) {
    for (const session of data.readingSessions) {
      await tx.objectStore('readingSessions').put(session);
    }
  }
  if (data.calendarItems && Array.isArray(data.calendarItems) && db.objectStoreNames.contains('calendarItems')) {
    for (const item of data.calendarItems) {
      await tx.objectStore('calendarItems').put(item);
    }
  }
  if (data.settings && typeof data.settings === 'object' && db.objectStoreNames.contains('settings')) {
    for (const [key, val] of Object.entries(data.settings)) {
      if (val !== undefined && val !== null) {
        await tx.objectStore('settings').put(val, key);
      }
    }
  }
  await tx.done;
}

// ----------------- CALENDAR REPOSITORY (Events & Tasks) -----------------

export async function getAllCalendarItemsFromDB(): Promise<CalendarItem[]> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('calendarItems')) return [];
  const items = await db.getAll('calendarItems');
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCalendarItemToDB(item: CalendarItem): Promise<void> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('calendarItems')) return;
  await db.put('calendarItems', item);
}

export async function deleteCalendarItemFromDB(id: string): Promise<void> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('calendarItems')) return;
  await db.delete('calendarItems', id);
}

// ----------------- MEDIA REPOSITORY (Offline / Client Persistence) -----------------

export async function saveMediaToDB(media: {
  id: string;
  fileName: string;
  blob: Blob;
  mimeType: string;
  size: number;
  updatedAt?: number;
}): Promise<string> {
  const db = await getKeepDB();
  if (!db) return media.id;
  const record: KeepMediaRecord = {
    id: media.id,
    fileName: media.fileName,
    blob: media.blob,
    mimeType: media.mimeType,
    size: media.size,
    updatedAt: media.updatedAt || Date.now(),
  };
  await db.put('media', record);
  return record.id;
}

export async function getMediaFromDB(idOrFileName: string): Promise<KeepMediaRecord | undefined> {
  const db = await getKeepDB();
  if (!db) return undefined;
  const direct = await db.get('media', idOrFileName);
  if (direct) return direct;
  return await db.getFromIndex('media', 'by-filename', idOrFileName);
}

export async function getAllMediaFromDB(): Promise<KeepMediaRecord[]> {
  const db = await getKeepDB();
  if (!db) return [];
  return await db.getAll('media');
}

export async function deleteMediaFromDB(id: string): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  await db.delete('media', id);
}

