import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Note, Label, Category } from '@/types/note';

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
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'google-keep-local-db';
const DB_VERSION = 2;

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

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
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
  // Sort primarily by pinned status then updated/order
  return notes.sort((a, b) => (b.order ?? b.updatedAt) - (a.order ?? a.updatedAt));
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
  exportDate: string;
}> {
  const db = await getKeepDB();
  if (!db) return { notes: [], labels: [], categories: [], exportDate: new Date().toISOString() };
  const notes = await db.getAll('notes');
  const labels = await db.getAll('labels');
  const categories = await db.getAll('categories');
  return {
    notes,
    labels,
    categories,
    exportDate: new Date().toISOString(),
  };
}

export async function importAllData(data: {
  notes?: Note[];
  labels?: Label[];
  categories?: Category[];
}): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction(['notes', 'labels', 'categories'], 'readwrite');
  
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
  await tx.done;
}
