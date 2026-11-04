import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Note, Label, Category, ReadingSession, CalendarItem, NoteColor } from '@/types/note';

export interface SearchTokenRecord {
  id: string; // `${token}_${noteId}`
  token: string;
  noteId: string;
}

interface KeepDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: {
      'by-updated': number;
      'by-pinned': number;
      'by-archived': number;
      'by-trash': number;
      'by-category': string;
      'by-isBenchmark': number;
    };
  };
  searchTokens: {
    key: string;
    value: SearchTokenRecord;
    indexes: {
      'by-token': string;
      'by-noteId': string;
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
const DB_VERSION = 6;

let dbPromise: Promise<IDBPDatabase<KeepDB>> | null = null;

export function getKeepDB() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<KeepDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Notes Store
        let noteStore: any;
        if (!db.objectStoreNames.contains('notes')) {
          noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-updated', 'updatedAt');
          noteStore.createIndex('by-pinned', 'isPinned');
          noteStore.createIndex('by-archived', 'isArchived');
          noteStore.createIndex('by-trash', 'isTrash');
          noteStore.createIndex('by-category', 'category');
          noteStore.createIndex('by-isBenchmark', 'isBenchmark');
        } else {
          noteStore = transaction.objectStore('notes');
          if (!noteStore.indexNames.contains('by-updated')) {
            noteStore.createIndex('by-updated', 'updatedAt');
          }
          if (!noteStore.indexNames.contains('by-pinned')) {
            noteStore.createIndex('by-pinned', 'isPinned');
          }
          if (!noteStore.indexNames.contains('by-archived')) {
            noteStore.createIndex('by-archived', 'isArchived');
          }
          if (!noteStore.indexNames.contains('by-trash')) {
            noteStore.createIndex('by-trash', 'isTrash');
          }
          if (!noteStore.indexNames.contains('by-category')) {
            noteStore.createIndex('by-category', 'category');
          }
          if (!noteStore.indexNames.contains('by-isBenchmark')) {
            noteStore.createIndex('by-isBenchmark', 'isBenchmark');
          }
        }

        // Search Tokens Store (for high-speed inverted full-text search)
        if (!db.objectStoreNames.contains('searchTokens')) {
          const searchStore = db.createObjectStore('searchTokens', { keyPath: 'id' });
          searchStore.createIndex('by-token', 'token');
          searchStore.createIndex('by-noteId', 'noteId');
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

// ----------------- TOKEN SEARCH INDEX HELPER -----------------

export function extractTokensFromText(text: string): string[] {
  if (!text) return [];
  const words = text.toLowerCase().match(/[\p{L}\p{N}]{1,50}/gu) || [];
  return Array.from(new Set(words));
}

/**
 * Checks whether a note matches a given search query.
 * Exhaustively checks Note Title, Note Content (body), Category name,
 * every Label, and every Todo/Checklist item text.
 * Also supports multi-word queries.
 */
export function noteMatchesSearchQuery(note: Note, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  // 1. Title match
  if (note.title && note.title.toLowerCase().includes(q)) {
    return true;
  }

  // 2. Note content / body match
  if (note.content && note.content.toLowerCase().includes(q)) {
    return true;
  }

  // 3. Category match
  if (note.category && note.category.toLowerCase().includes(q)) {
    return true;
  }

  // 4. Labels match
  if (note.labels && note.labels.some((l) => l.toLowerCase().includes(q))) {
    return true;
  }

  // 5. Todos / Checklist items match
  if (note.todos && note.todos.some((t) => t.text && t.text.toLowerCase().includes(q))) {
    return true;
  }

  // 6. Multi-word query support (e.g. "meeting work" or "finance budget")
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length > 1) {
    const fullText = `${note.title || ''} ${note.content || ''} ${note.category || ''} ${(note.labels || []).join(' ')} ${(note.todos || []).map((t) => t.text).join(' ')}`.toLowerCase();
    return terms.every((term) => fullText.includes(term));
  }

  return false;
}

export async function indexNoteSearchTokens(note: Note): Promise<void> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('searchTokens')) return;

  try {
    const tx = db.transaction('searchTokens', 'readwrite');
    const store = tx.store;
    const noteIndex = store.index('by-noteId');

    let cursor = await noteIndex.openKeyCursor(IDBKeyRange.only(note.id));
    while (cursor) {
      await store.delete(cursor.primaryKey);
      cursor = await cursor.continue();
    }

    const fullText = `${note.title || ''} ${note.content || ''} ${note.category || ''} ${(note.labels || []).join(' ')} ${(note.todos || []).map((t) => t.text).join(' ')}`;
    const tokens = extractTokensFromText(fullText).slice(0, 100);
    for (const token of tokens) {
      await store.put({
        id: `${token}_${note.id}`,
        token,
        noteId: note.id,
      });
    }
    await tx.done;
  } catch (err) {
    console.warn('Token indexing non-fatal error:', err);
  }
}

// ----------------- NOTES REPOSITORY (1-MILLION SCALE) -----------------

export interface PagedNotesResult {
  notes: Note[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function matchesFilterConditions(
  note: Note,
  filter: string,
  category?: string | null,
  label?: string | null
): boolean {
  if (filter === 'trash') {
    return !!note.isTrash;
  }
  if (note.isTrash) {
    return false;
  }

  if (filter === 'archive') {
    return !!note.isArchived;
  }
  if (note.isArchived) {
    return false;
  }

  if (filter === 'reminders') {
    if (!note.reminder) return false;
  } else if (filter === 'label') {
    if (!label || !note.labels?.includes(label)) return false;
  } else if (filter === 'category') {
    if (!category || (note.category || '').toLowerCase() !== category.toLowerCase()) return false;
  } else if (filter === 'favorites') {
    if (!note.isPinned) return false;
  }

  if (category && (note.category || '').toLowerCase() !== category.toLowerCase()) {
    return false;
  }

  return true;
}

export async function getNotesPagedFromDB(params: {
  filter?: string;
  category?: string | null;
  label?: string | null;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedNotesResult> {
  const db = await getKeepDB();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 30));

  if (!db) {
    return { notes: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
  }

  const { filter = 'notes', category, label, searchQuery } = params;
  const q = (searchQuery || '').trim().toLowerCase();

  // 1. FAST & COMPREHENSIVE SEARCH PATH (Title, Content, Category, Labels, Todos)
  if (q.length > 0) {
    const matchedNotes: Note[] = [];
    const tx = db.transaction('notes', 'readonly');
    const index = tx.store.index('by-updated');
    let cursor = await index.openCursor(null, 'prev');
    let scanned = 0;

    // Stream notes in by-updated order, scanning up to 10,000 notes or 1,000 matches
    while (cursor && scanned < 10000 && matchedNotes.length < 1000) {
      scanned++;
      const note = cursor.value;

      // Filter check based on current view:
      // If user is currently in Trash, search Trash.
      // If user is currently in Archive, search Archive.
      // Otherwise, search across all active notes (across all categories, labels, etc.)
      let isAllowed = false;
      if (filter === 'trash') {
        isAllowed = !!note.isTrash;
      } else if (filter === 'archive') {
        isAllowed = !!note.isArchived && !note.isTrash;
      } else {
        isAllowed = !note.isTrash && !note.isArchived;
      }

      if (isAllowed && noteMatchesSearchQuery(note, q)) {
        matchedNotes.push(note);
      }

      cursor = await cursor.continue();
    }

    // Secondary fallback for massive 100k+ benchmark datasets if scan limit was reached
    if (matchedNotes.length < pageSize && scanned >= 10000 && db.objectStoreNames.contains('searchTokens')) {
      const searchTokens = extractTokensFromText(q);
      const existingIds = new Set(matchedNotes.map((n) => n.id));
      for (const token of searchTokens) {
        try {
          const records = await db.getAllFromIndex('searchTokens', 'by-token', token);
          for (const rec of records) {
            if (!existingIds.has(rec.noteId)) {
              existingIds.add(rec.noteId);
              const note = await db.get('notes', rec.noteId);
              if (note) {
                let isAllowed = false;
                if (filter === 'trash') {
                  isAllowed = !!note.isTrash;
                } else if (filter === 'archive') {
                  isAllowed = !!note.isArchived && !note.isTrash;
                } else {
                  isAllowed = !note.isTrash && !note.isArchived;
                }
                if (isAllowed && noteMatchesSearchQuery(note, q)) {
                  matchedNotes.push(note);
                }
              }
            }
          }
        } catch {}
      }
      matchedNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    const totalCount = matchedNotes.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const effectivePage = Math.min(page, totalPages);
    const startIndex = (effectivePage - 1) * pageSize;
    const notes = matchedNotes.slice(startIndex, startIndex + pageSize);
    return { notes, totalCount, page: effectivePage, pageSize, totalPages };
  }

  // 2. CURSOR PAGINATION FOR GENERAL BROWSING
  const tx = db.transaction('notes', 'readonly');
  const store = tx.store;
  const index = store.index('by-updated');

  let totalCount = 0;
  try {
    if (filter === 'trash') {
      totalCount = await store.index('by-trash').count(IDBKeyRange.only(true as any)).catch(async () => {
        return (await store.index('by-trash').count(IDBKeyRange.only(1 as any))) || 0;
      });
    } else if (filter === 'archive') {
      totalCount = await store.index('by-archived').count(IDBKeyRange.only(true as any)).catch(async () => {
        return (await store.index('by-archived').count(IDBKeyRange.only(1 as any))) || 0;
      });
    } else if (filter === 'category' && category && store.indexNames.contains('by-category')) {
      totalCount = await store.index('by-category').count(IDBKeyRange.only(category));
    } else {
      const totalAll = await store.count();
      let trashCount = 0;
      let archiveCount = 0;
      try {
        trashCount = await store.index('by-trash').count(IDBKeyRange.only(true as any));
      } catch {
        try {
          trashCount = await store.index('by-trash').count(IDBKeyRange.only(1 as any));
        } catch {
          trashCount = 0;
        }
      }
      try {
        archiveCount = await store.index('by-archived').count(IDBKeyRange.only(true as any));
      } catch {
        try {
          archiveCount = await store.index('by-archived').count(IDBKeyRange.only(1 as any));
        } catch {
          archiveCount = 0;
        }
      }
      totalCount = Math.max(0, totalAll - trashCount - archiveCount);
    }
  } catch {
    totalCount = await store.count();
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const effectivePage = Math.min(page, totalPages);
  const targetSkip = (effectivePage - 1) * pageSize;

  const notes: Note[] = [];
  let skipped = 0;
  let cursor = await index.openCursor(null, 'prev');

  while (cursor) {
    const note = cursor.value;
    if (matchesFilterConditions(note, filter, category, label)) {
      if (skipped < targetSkip) {
        skipped++;
      } else {
        notes.push(note);
        if (notes.length >= pageSize) {
          break;
        }
      }
    }
    cursor = await cursor.continue();
  }

  return {
    notes,
    totalCount,
    page: effectivePage,
    pageSize,
    totalPages,
  };
}

export interface NotesCountsSummary {
  totalActive: number;
  trash: number;
  archived: number;
  reminders: number;
  byCategory: Record<string, number>;
}

export async function getNotesCountsSummaryFromDB(
  categoryNames: string[] = []
): Promise<NotesCountsSummary> {
  const db = await getKeepDB();
  if (!db) {
    return { totalActive: 0, trash: 0, archived: 0, reminders: 0, byCategory: {} };
  }

  try {
    const tx = db.transaction('notes', 'readonly');
    const store = tx.store;

    const totalAll = await store.count();
    let trash = 0;
    let archived = 0;

    try {
      trash = await store.index('by-trash').count(IDBKeyRange.only(true as any));
    } catch {
      try {
        trash = await store.index('by-trash').count(IDBKeyRange.only(1 as any));
      } catch {
        trash = 0;
      }
    }

    try {
      archived = await store.index('by-archived').count(IDBKeyRange.only(true as any));
    } catch {
      try {
        archived = await store.index('by-archived').count(IDBKeyRange.only(1 as any));
      } catch {
        archived = 0;
      }
    }

    const totalActive = Math.max(0, totalAll - trash - archived);

    const byCategory: Record<string, number> = {};
    if (store.indexNames.contains('by-category')) {
      for (const catName of categoryNames) {
        try {
          byCategory[catName] = await store.index('by-category').count(IDBKeyRange.only(catName));
        } catch {
          byCategory[catName] = 0;
        }
      }
    }

    return {
      totalActive,
      trash,
      archived,
      reminders: 0,
      byCategory,
    };
  } catch (err) {
    console.warn('Count summary error:', err);
    return { totalActive: 0, trash: 0, archived: 0, reminders: 0, byCategory: {} };
  }
}

export async function getAllNotesFromDB(limit = 1000): Promise<Note[]> {
  const db = await getKeepDB();
  if (!db) return [];
  if (limit > 0) {
    const notes: Note[] = [];
    const tx = db.transaction('notes', 'readonly');
    const index = tx.store.index('by-updated');
    let cursor = await index.openCursor(null, 'prev');
    while (cursor && notes.length < limit) {
      notes.push(cursor.value);
      cursor = await cursor.continue();
    }
    return notes;
  }
  const notes = await db.getAll('notes');
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
  indexNoteSearchTokens(note).catch(() => {});
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

  if (db.objectStoreNames.contains('searchTokens')) {
    try {
      const tx = db.transaction('searchTokens', 'readwrite');
      const noteIndex = tx.store.index('by-noteId');
      let cursor = await noteIndex.openKeyCursor(IDBKeyRange.only(id));
      while (cursor) {
        await tx.store.delete(cursor.primaryKey);
        cursor = await cursor.continue();
      }
      await tx.done;
    } catch {}
  }
}

export async function clearTrashFromDB(): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  const tx = db.transaction('notes', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.isTrash) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ----------------- BENCHMARK & 1M STRESS TEST UTILITY -----------------

export async function getBenchmarkNotesCountFromDB(): Promise<number> {
  const db = await getKeepDB();
  if (!db) return 0;
  try {
    const tx = db.transaction('notes', 'readonly');
    if (tx.store.indexNames.contains('by-isBenchmark')) {
      const count = await tx.store.index('by-isBenchmark').count(IDBKeyRange.only(true as any));
      return count;
    }
  } catch {}
  return 0;
}

export async function getDatabaseStatsFromDB(): Promise<{
  totalNotes: number;
  benchmarkNotes: number;
  activeNotes: number;
  labelsCount: number;
  categoriesCount: number;
}> {
  const db = await getKeepDB();
  if (!db) {
    return { totalNotes: 0, benchmarkNotes: 0, activeNotes: 0, labelsCount: 0, categoriesCount: 0 };
  }

  const tx = db.transaction(['notes', 'labels', 'categories'], 'readonly');
  const totalNotes = await tx.objectStore('notes').count();
  const labelsCount = await tx.objectStore('labels').count();
  const categoriesCount = await tx.objectStore('categories').count();

  let benchmarkNotes = 0;
  if (tx.objectStore('notes').indexNames.contains('by-isBenchmark')) {
    try {
      benchmarkNotes = await tx.objectStore('notes').index('by-isBenchmark').count(IDBKeyRange.only(true as any));
    } catch {
      try {
        benchmarkNotes = await tx.objectStore('notes').index('by-isBenchmark').count(IDBKeyRange.only(1 as any));
      } catch {
        benchmarkNotes = 0;
      }
    }
  }

  let trash = 0;
  let archived = 0;
  try {
    trash = await tx.objectStore('notes').index('by-trash').count(IDBKeyRange.only(true as any));
  } catch {}
  try {
    archived = await tx.objectStore('notes').index('by-archived').count(IDBKeyRange.only(true as any));
  } catch {}

  const activeNotes = Math.max(0, totalNotes - trash - archived);

  return {
    totalNotes,
    benchmarkNotes,
    activeNotes,
    labelsCount,
    categoriesCount,
  };
}

export async function bulkInsertBenchmarkNotes(
  count: number,
  onProgress?: (inserted: number, total: number) => void
): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;

  const BATCH_SIZE = 2500;
  const categories = ['Work', 'Personal', 'Ideas', 'Finance', 'Travel'];
  const colors: NoteColor[] = ['default', 'coral', 'peach', 'sand', 'mint', 'sage', 'fog'];
  const now = Date.now();

  let inserted = 0;
  while (inserted < count) {
    const currentBatchSize = Math.min(BATCH_SIZE, count - inserted);
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.store;

    for (let i = 0; i < currentBatchSize; i++) {
      const idx = inserted + i + 1;
      const cat = categories[idx % categories.length];
      const color = colors[idx % colors.length];
      const note: Note = {
        id: `bench-note-${idx}-${now}`,
        title: `Note #${idx}: Scalability & Performance Benchmark for ${cat}`,
        content: `This is benchmark test note #${idx}. Demonstrating instant sub-50ms IndexedDB loading with 1,000,000 items. Color: ${color}, Category: ${cat}.`,
        isList: idx % 10 === 0,
        todos:
          idx % 10 === 0
            ? [
                { id: '1', text: 'Verify instant cursor pagination', completed: true },
                { id: '2', text: 'Ensure heap memory stays under 50MB', completed: true },
                { id: '3', text: 'Sub-20ms page flip', completed: false },
              ]
            : [],
        color,
        theme: 'none',
        labels: idx % 3 === 0 ? ['Important', 'Benchmark'] : ['Benchmark'],
        isPinned: idx % 50 === 0,
        isArchived: false,
        isTrash: false,
        category: cat,
        images: [],
        createdAt: now - idx * 1000,
        updatedAt: now - idx * 1000,
        order: idx,
        isBenchmark: true,
      };
      store.put(note);
    }

    await tx.done;
    inserted += currentBatchSize;
    if (onProgress) {
      onProgress(inserted, count);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export async function clearBenchmarkNotesFromDB(
  onProgress?: (deleted: number) => void
): Promise<number> {
  const db = await getKeepDB();
  if (!db) return 0;

  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.store;
    let countInBatch = 0;
    let cursor = await store.openCursor();
    while (cursor && countInBatch < 3000) {
      if (cursor.value.isBenchmark) {
        await cursor.delete();
        countInBatch++;
        totalDeleted++;
      }
      cursor = await cursor.continue();
    }
    await tx.done;

    if (countInBatch === 0) {
      hasMore = false;
    } else {
      if (onProgress) onProgress(totalDeleted);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return totalDeleted;
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

  const notesStore = tx.objectStore('notes');
  let cursor = await notesStore.openCursor();
  while (cursor) {
    const note = cursor.value;
    if (note.labels && note.labels.includes(labelName)) {
      note.labels = note.labels.filter((l) => l !== labelName);
      await cursor.update(note);
    }
    cursor = await cursor.continue();
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

  const notesStore = tx.objectStore('notes');
  let cursor = await notesStore.openCursor();
  while (cursor) {
    const note = cursor.value;
    if (note.labels && note.labels.includes(oldName)) {
      note.labels = note.labels.map((l) => (l === oldName ? newName : l));
      await cursor.update(note);
    }
    cursor = await cursor.continue();
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

  const notesStore = tx.objectStore('notes');
  let cursor = await notesStore.openCursor();
  while (cursor) {
    const note = cursor.value;
    if (note.category === categoryName) {
      note.category = null;
      await cursor.update(note);
    }
    cursor = await cursor.continue();
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

  const notesStore = tx.objectStore('notes');
  let cursor = await notesStore.openCursor();
  while (cursor) {
    const note = cursor.value;
    if (note.category === oldName) {
      note.category = newName;
      await cursor.update(note);
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ----------------- READING SESSIONS REPOSITORY (Stopwatch Stats) -----------------

export async function getAllReadingSessionsFromDB(): Promise<ReadingSession[]> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('readingSessions')) return [];
  const sessions = await db.getAll('readingSessions');
  return sessions.sort((a, b) => b.endedAt - a.endedAt);
}

export async function saveReadingSessionToDB(session: ReadingSession): Promise<void> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('readingSessions')) return;
  await db.put('readingSessions', session);
}

export async function deleteReadingSessionFromDB(id: string): Promise<void> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('readingSessions')) return;
  await db.delete('readingSessions', id);
}

export async function clearAllReadingSessionsFromDB(): Promise<void> {
  const db = await getKeepDB();
  if (!db || !db.objectStoreNames.contains('readingSessions')) return;
  await db.clear('readingSessions');
}

// ----------------- SETTINGS REPOSITORY -----------------

export async function getSettingFromDB<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getKeepDB();
  if (!db) return defaultValue;
  const val = await db.get('settings', key);
  return val !== undefined ? (val as T) : defaultValue;
}

export async function saveSettingToDB(key: string, value: unknown): Promise<void> {
  const db = await getKeepDB();
  if (!db) return;
  await db.put('settings', value, key);
}

// ----------------- EXPORT & IMPORT -----------------

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
    return { notes: [], labels: [], categories: [], exportDate: new Date().toISOString() };
  }

  const notes: Note[] = [];
  const tx = db.transaction('notes', 'readonly');
  let cursor = await tx.store.openCursor();
  while (cursor && notes.length < 100000) {
    notes.push(cursor.value);
    cursor = await cursor.continue();
  }

  const [labels, categories] = await Promise.all([
    db.getAll('labels'),
    db.getAll('categories'),
  ]);

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
    for (const k of keys) {
      settings[k] = await db.get('settings', k);
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
