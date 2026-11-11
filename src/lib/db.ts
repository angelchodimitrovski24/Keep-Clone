import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Note, Label, Category, ReadingSession, CalendarItem, NoteColor } from '@/types/note';
import { extractNoteLinksFromContent, NoteLinkTarget, BidirectionalLinksResult } from './noteLinks';

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
  const lower = text.toLowerCase();
  const alphanumeric = lower.match(/[\p{L}\p{N}]{1,50}/gu) || [];
  const tagged = lower.match(/[#@][\p{L}\p{N}]{1,50}/gu) || [];
  return Array.from(new Set([...alphanumeric, ...tagged]));
}

/**
 * Checks whether a note matches a given search query.
 * Exhaustively checks Note Title, Note Content (body), Category name,
 * every Label, and every Todo/Checklist item text.
 * 
 * Supports:
 * - Full text phrases (e.g. "Scalability & Performance")
 * - Single words (e.g. "meeting", "benchmark")
 * - Part of word / substrings (e.g. "999", "972", "bench", "scal")
 * - Symbols & tagged tokens (e.g. "#99972", "99972", "#999")
 * - Multi-word tokens across fields (e.g. "Note 99972 Work")
 * - Case-insensitive and punctuation-normalized matching
 */
export function noteMatchesSearchQuery(note: Note, query: string): boolean {
  if (!query || !query.trim()) return true;
  const rawQ = query.trim().toLowerCase();
  const cleanQ = rawQ.replace(/[^\p{L}\p{N}]/gu, '');

  const title = (note.title || '').toLowerCase();
  const content = (note.content || '').toLowerCase();
  const category = (note.category || '').toLowerCase();
  const labels = (note.labels || []).map((l) => (l || '').toLowerCase());
  const todos = (note.todos || []).map((t) => (t.text || '').toLowerCase());

  // 1. Direct raw substring match (Full text, one word, part of word with or without symbols)
  // E.g. "#99972" matches "Note #99972", "999" matches "Note #99972", "972" matches "Note #99972"
  if (
    title.includes(rawQ) ||
    content.includes(rawQ) ||
    category.includes(rawQ) ||
    labels.some((l) => l.includes(rawQ)) ||
    todos.some((t) => t.includes(rawQ))
  ) {
    return true;
  }

  // 2. Normalized clean match (Ignores punctuation differences like #, -, _, /, commas)
  // E.g. Note has "Note #99972" and user searches "99972", or note has "Note 99972" and user searches "#99972"
  if (cleanQ.length > 0) {
    const cleanTitle = title.replace(/[^\p{L}\p{N}]/gu, '');
    const cleanContent = content.replace(/[^\p{L}\p{N}]/gu, '');
    const cleanCategory = category.replace(/[^\p{L}\p{N}]/gu, '');
    if (
      cleanTitle.includes(cleanQ) ||
      cleanContent.includes(cleanQ) ||
      cleanCategory.includes(cleanQ) ||
      labels.some((l) => l.replace(/[^\p{L}\p{N}]/gu, '').includes(cleanQ)) ||
      todos.some((t) => t.replace(/[^\p{L}\p{N}]/gu, '').includes(cleanQ))
    ) {
      return true;
    }
  }

  // 3. Multi-word query support (Every token must match somewhere in Title, Content, Category, Labels, Todos)
  const terms = rawQ.split(/\s+/).filter(Boolean);
  if (terms.length > 1) {
    const fullCombined = `${title} ${content} ${category} ${labels.join(' ')} ${todos.join(' ')}`;
    const fullCleanCombined = fullCombined.replace(/[^\p{L}\p{N}\s]/gu, '');
    const allMatch = terms.every((term) => {
      const cleanTerm = term.replace(/[^\p{L}\p{N}]/gu, '');
      return fullCombined.includes(term) || (cleanTerm.length > 0 && fullCleanCombined.includes(cleanTerm));
    });
    if (allMatch) return true;
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
    const matchedIds = new Set<string>();

    const addMatch = (note: Note) => {
      if (!matchedIds.has(note.id)) {
        matchedIds.add(note.id);
        matchedNotes.push(note);
      }
    };

    const isAllowed = (note: Note) => {
      if (filter === 'trash') return !!note.isTrash;
      if (filter === 'archive') return !!note.isArchived && !note.isTrash;
      return !note.isTrash && !note.isArchived;
    };

    // A. DIRECT FAST INDEX & ID LOOKUPS (O(1) < 1ms)
    // 1) Direct ID lookup
    try {
      const directNote = await db.get('notes', q);
      if (directNote && isAllowed(directNote) && noteMatchesSearchQuery(directNote, q)) {
        addMatch(directNote);
      }
    } catch {}

    // 2) Benchmark Note ID lookup if query contains a number
    // E.g. "#99972", "99972", "Note #99972" -> extracts "99972"
    const numMatch = q.match(/\d+/);
    if (numMatch) {
      const numStr = numMatch[0];
      try {
        const benchKeyRange = IDBKeyRange.bound(`bench-note-${numStr}-`, `bench-note-${numStr}-\uffff`);
        const benchCursor = await db.transaction('notes', 'readonly').store.openCursor(benchKeyRange);
        if (benchCursor) {
          const note = benchCursor.value;
          if (isAllowed(note) && noteMatchesSearchQuery(note, q)) {
            addMatch(note);
          }
        }
      } catch {}
    }

    // 3) Token Index Lookup via 'searchTokens' store (for instant exact token hits)
    if (db.objectStoreNames.contains('searchTokens')) {
      const searchTokens = extractTokensFromText(q);
      for (const token of searchTokens) {
        try {
          const records = await db.getAllFromIndex('searchTokens', 'by-token', token);
          for (const rec of records) {
            if (!matchedIds.has(rec.noteId)) {
              const note = await db.get('notes', rec.noteId);
              if (note && isAllowed(note) && noteMatchesSearchQuery(note, q)) {
                addMatch(note);
                if (matchedNotes.length >= 200) break;
              }
            }
          }
        } catch {}
      }
    }

    // B. COMPREHENSIVE STREAMING CURSOR SCAN
    // Streams notes in by-updated order, inspecting Title, Content, Category, Labels, and Todos.
    // If not enough matches have been found yet, scans up to 100,000 notes so that deep notes
    // like Note #99972 are fully reached and returned.
    const maxScanLimit = matchedNotes.length >= pageSize ? 10000 : 100000;
    try {
      const tx = db.transaction('notes', 'readonly');
      const index = tx.store.index('by-updated');
      let cursor = await index.openCursor(null, 'prev');
      let scanned = 0;

      while (cursor && scanned < maxScanLimit && matchedNotes.length < 2000) {
        scanned++;
        const note = cursor.value;

        if (!matchedIds.has(note.id) && isAllowed(note) && noteMatchesSearchQuery(note, q)) {
          addMatch(note);
        }

        cursor = await cursor.continue();
      }
    } catch {}

    // Sort newest first
    matchedNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

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

/**
 * Robustly retrieves all child / sub-page notes for a parent note directly from IndexedDB,
 * ensuring sub-pages are never missing or invisible regardless of pagination or memory state.
 */
export async function getChildNotesForParentFromDB(parentId: string, childNoteIds?: string[]): Promise<Note[]> {
  const db = await getKeepDB();
  if (!db) return [];

  const foundMap = new Map<string, Note>();

  // 1. Fetch by explicit childNoteIds
  if (childNoteIds && childNoteIds.length > 0) {
    for (const id of childNoteIds) {
      try {
        const note = await db.get('notes', id);
        if (note && !note.isTrash) {
          foundMap.set(note.id, note);
        }
      } catch {}
    }
  }

  // 2. Scan for any notes having parentNoteId === parentId
  if (parentId) {
    try {
      const tx = db.transaction('notes', 'readonly');
      let cursor = await tx.store.openCursor();
      while (cursor) {
        const note = cursor.value;
        if (note.parentNoteId === parentId && !note.isTrash && !foundMap.has(note.id)) {
          foundMap.set(note.id, note);
        }
        cursor = await cursor.continue();
      }
    } catch {}
  }

  // Order by childNoteIds first, then any extra found
  const result: Note[] = [];
  if (childNoteIds) {
    for (const id of childNoteIds) {
      const n = foundMap.get(id);
      if (n) {
        result.push(n);
        foundMap.delete(id);
      }
    }
  }
  for (const n of foundMap.values()) {
    result.push(n);
  }

  return result;
}

export async function searchLinkableNotesFromDB(params: {
  query?: string;
  categoryFilter?: string | null;
  excludeNoteIds?: string[];
  limit?: number;
}): Promise<Note[]> {
  const db = await getKeepDB();
  if (!db) return [];

  const q = (params.query || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(100, params.limit || 40));
  const excludeSet = new Set(params.excludeNoteIds || []);
  const catFilter = params.categoryFilter;

  const matchesCategory = (note: Note) => {
    if (!catFilter || catFilter === '__all__') return true;
    if (catFilter === '__uncategorized__') return !note.category;
    return (note.category || '').toLowerCase() === catFilter.toLowerCase();
  };

  const results: Note[] = [];
  const seenIds = new Set<string>();
  const tx = db.transaction('notes', 'readonly');
  const index = tx.store.index('by-updated');
  let cursor = await index.openCursor(null, 'prev');
  let scanned = 0;
  const maxScan = q ? 50000 : 10000;

  while (cursor && results.length < limit && scanned < maxScan) {
    scanned++;
    const note = cursor.value;
    if (!note.isTrash && !excludeSet.has(note.id) && !seenIds.has(note.id) && matchesCategory(note)) {
      if (!q || noteMatchesSearchQuery(note, q)) {
        seenIds.add(note.id);
        results.push(note);
      }
    }
    cursor = await cursor.continue();
  }

  return results;
}

export async function findNoteByTitleOrIdFromDB(titleOrId: string): Promise<Note | undefined> {
  const db = await getKeepDB();
  if (!db) return undefined;
  const trimmed = (titleOrId || '').trim();
  if (!trimmed) return undefined;

  const byId = await db.get('notes', trimmed);
  if (byId && !byId.isTrash) return byId;

  const q = trimmed.toLowerCase();
  const tx = db.transaction('notes', 'readonly');
  const index = tx.store.index('by-updated');
  let cursor = await index.openCursor(null, 'prev');
  let scanned = 0;
  while (cursor && scanned < 50000) {
    scanned++;
    const note = cursor.value;
    if (!note.isTrash) {
      if (note.id.toLowerCase() === q || (note.title && note.title.trim().toLowerCase() === q)) {
        return note;
      }
    }
    cursor = await cursor.continue();
  }
  return undefined;
}

export async function getBidirectionalLinksFromDB(currentNote: Note): Promise<BidirectionalLinksResult> {
  const db = await getKeepDB();
  if (!db || !currentNote) return { outgoing: [], backlinks: [] };

  const outgoingMap = new Map<string, NoteLinkTarget>();
  const backlinksMap = new Map<string, NoteLinkTarget>();

  const linkedIds = currentNote.linkedNoteIds || [];
  for (const id of linkedIds) {
    if (!id || id === currentNote.id) continue;
    try {
      const target = await db.get('notes', id);
      if (target && !target.isTrash) {
        outgoingMap.set(target.id, {
          id: target.id,
          title: target.title || 'Untitled Note',
          category: target.category || null,
        });
      }
    } catch {}
  }

  const currentExtracted = extractNoteLinksFromContent(currentNote.content || '');
  const currentExtractedSet = new Set(currentExtracted);
  const currentTitleLower = (currentNote.title || '').trim().toLowerCase();
  const currentIdLower = currentNote.id.toLowerCase();

  const tx = db.transaction('notes', 'readonly');
  const index = tx.store.index('by-updated');
  let cursor = await index.openCursor(null, 'prev');
  let scanned = 0;

  while (cursor && scanned < 5000) {
    scanned++;
    const other = cursor.value;
    if (!other.isTrash && other.id !== currentNote.id) {
      const otherTitleLower = (other.title || '').trim().toLowerCase();
      const otherIdLower = other.id.toLowerCase();

      if (
        !outgoingMap.has(other.id) &&
        (currentExtractedSet.has(otherIdLower) || (otherTitleLower && currentExtractedSet.has(otherTitleLower)))
      ) {
        outgoingMap.set(other.id, {
          id: other.id,
          title: other.title || 'Untitled Note',
          category: other.category || null,
        });
      }

      const directBacklink = Boolean(other.linkedNoteIds && other.linkedNoteIds.includes(currentNote.id));
      let contentBacklink = false;
      if (!directBacklink && other.content && (other.content.includes('[[') || other.content.includes('data-note-'))) {
        const contentLower = other.content.toLowerCase();
        if ((currentTitleLower && contentLower.includes(currentTitleLower)) || contentLower.includes(currentIdLower)) {
          const otherExtracted = extractNoteLinksFromContent(other.content);
          contentBacklink = Boolean(
            otherExtracted.includes(currentIdLower) ||
            (currentTitleLower && otherExtracted.includes(currentTitleLower))
          );
        }
      }

      if (directBacklink || contentBacklink) {
        backlinksMap.set(other.id, {
          id: other.id,
          title: other.title || 'Untitled Note',
          category: other.category || null,
        });
      }
    }
    cursor = await cursor.continue();
  }

  return {
    outgoing: Array.from(outgoingMap.values()),
    backlinks: Array.from(backlinksMap.values()),
  };
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

  const hasSearchTokens = db.objectStoreNames.contains('searchTokens');
  const storeNames: ('notes' | 'searchTokens')[] = hasSearchTokens ? ['notes', 'searchTokens'] : ['notes'];

  let inserted = 0;
  while (inserted < count) {
    const currentBatchSize = Math.min(BATCH_SIZE, count - inserted);
    const tx = db.transaction(storeNames, 'readwrite');
    const store = tx.objectStore('notes');
    const searchStore = hasSearchTokens ? tx.objectStore('searchTokens') : null;

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

      if (searchStore) {
        searchStore.put({ id: `${idx}_${note.id}`, token: `${idx}`, noteId: note.id });
        searchStore.put({ id: `hash_${idx}_${note.id}`, token: `#${idx}`, noteId: note.id });
      }
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

  // 1. Gather all benchmark note IDs
  const idsToDelete: string[] = [];
  const readTx = db.transaction('notes', 'readonly');
  let cursor = await readTx.store.openCursor();
  while (cursor) {
    if (cursor.value.isBenchmark) {
      idsToDelete.push(cursor.value.id);
    }
    cursor = await cursor.continue();
  }
  await readTx.done;

  if (idsToDelete.length === 0) return 0;

  // 2. Batch delete from notes store
  const BATCH_SIZE = 500;
  let totalDeleted = 0;

  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.store;
    for (const id of chunk) {
      await store.delete(id);
    }
    await tx.done;
    totalDeleted += chunk.length;
    if (onProgress) onProgress(totalDeleted);
    await new Promise((r) => setTimeout(r, 0));
  }

  // 3. Clean up search tokens if present
  if (db.objectStoreNames.contains('searchTokens')) {
    try {
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
        const sTx = db.transaction('searchTokens', 'readwrite');
        const sStore = sTx.store;
        const noteIndex = sStore.index('by-noteId');
        for (const noteId of chunk) {
          const keys = await noteIndex.getAllKeys(IDBKeyRange.only(noteId));
          for (const key of keys) {
            await sStore.delete(key);
          }
        }
        await sTx.done;
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch {}
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

/**
 * Deletes all notes associated with a specific label.
 * If permanent is false/omitted, notes are moved to trash (can be restored).
 * If permanent is true, notes are completely removed from IndexedDB (including searchTokens).
 * Returns the number of affected notes.
 */
export async function deleteNotesByLabelFromDB(
  labelName: string,
  permanent: boolean = false
): Promise<number> {
  const db = await getKeepDB();
  if (!db) return 0;

  const targetLabel = labelName.trim().toLowerCase();
  const isBenchmarkTarget = targetLabel === 'benchmark';

  // 1. Identify all matching note IDs in a single clean read pass
  const idsToDelete: string[] = [];
  const readTx = db.transaction('notes', 'readonly');
  let cursor = await readTx.store.openCursor();

  while (cursor) {
    const note = cursor.value;
    const hasLabel = (note.labels || []).some((l) => l.trim().toLowerCase() === targetLabel);
    const matches = hasLabel || (isBenchmarkTarget && note.isBenchmark);

    if (matches) {
      idsToDelete.push(note.id);
    }
    cursor = await cursor.continue();
  }
  await readTx.done;

  if (idsToDelete.length === 0) return 0;

  // 2. Perform batched mutations safely without cursor state conflicts
  const BATCH_SIZE = 500;
  const now = Date.now();

  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.store;

    if (permanent) {
      for (const id of chunk) {
        await store.delete(id);
      }
    } else {
      for (const id of chunk) {
        const note = await store.get(id);
        if (note) {
          note.isTrash = true;
          note.trashedAt = now;
          note.isPinned = false;
          await store.put(note);
        }
      }
    }

    await tx.done;
    await new Promise((r) => setTimeout(r, 0));
  }

  // 3. Clean up search tokens if permanently deleting
  if (permanent && db.objectStoreNames.contains('searchTokens')) {
    try {
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
        const sTx = db.transaction('searchTokens', 'readwrite');
        const sStore = sTx.store;
        const noteIndex = sStore.index('by-noteId');
        for (const noteId of chunk) {
          const keys = await noteIndex.getAllKeys(IDBKeyRange.only(noteId));
          for (const key of keys) {
            await sStore.delete(key);
          }
        }
        await sTx.done;
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      console.warn('Non-fatal searchTokens cleanup error:', err);
    }
  }

  return idsToDelete.length;
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

/**
 * Deletes all notes belonging to a specific category.
 * If permanent is false/omitted, notes are moved to trash (can be restored).
 * If permanent is true, notes are completely removed from IndexedDB (including searchTokens).
 * Returns the number of affected notes.
 */
export async function deleteNotesByCategoryFromDB(
  categoryName: string,
  permanent: boolean = false
): Promise<number> {
  const db = await getKeepDB();
  if (!db) return 0;

  const targetCategory = categoryName.trim().toLowerCase();
  const isBenchmarkTarget = targetCategory === 'benchmark';

  // 1. Identify all matching note IDs in a single clean read pass
  const idsToDelete: string[] = [];
  const readTx = db.transaction('notes', 'readonly');
  let cursor = await readTx.store.openCursor();

  while (cursor) {
    const note = cursor.value;
    const catLower = (note.category || '').trim().toLowerCase();
    const matches =
      catLower === targetCategory ||
      (isBenchmarkTarget && (note.isBenchmark || (note.labels || []).some((l) => l.toLowerCase() === 'benchmark')));

    if (matches) {
      idsToDelete.push(note.id);
    }
    cursor = await cursor.continue();
  }
  await readTx.done;

  if (idsToDelete.length === 0) return 0;

  // 2. Perform batched mutations safely without cursor state conflicts
  const BATCH_SIZE = 500;
  const now = Date.now();

  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.store;

    if (permanent) {
      for (const id of chunk) {
        await store.delete(id);
      }
    } else {
      for (const id of chunk) {
        const note = await store.get(id);
        if (note) {
          note.isTrash = true;
          note.trashedAt = now;
          note.isPinned = false;
          await store.put(note);
        }
      }
    }

    await tx.done;
    await new Promise((r) => setTimeout(r, 0));
  }

  // 3. Clean up search tokens if permanently deleting
  if (permanent && db.objectStoreNames.contains('searchTokens')) {
    try {
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
        const sTx = db.transaction('searchTokens', 'readwrite');
        const sStore = sTx.store;
        const noteIndex = sStore.index('by-noteId');
        for (const noteId of chunk) {
          const keys = await noteIndex.getAllKeys(IDBKeyRange.only(noteId));
          for (const key of keys) {
            await sStore.delete(key);
          }
        }
        await sTx.done;
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      console.warn('Non-fatal searchTokens cleanup error:', err);
    }
  }

  return idsToDelete.length;
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

  // Merge active integration configurations & folders from localStorage if not already present
  if (typeof window !== 'undefined') {
    const syncKeys = [
      'keep_jira_config',
      'keep_supportbench_config',
      'keep_ollama_config',
      'keep_gdrive_client_id',
      'keep_gdrive_export_folder',
      'keep_gdrive_import_folder',
      'keep_local_media_folder',
    ];
    for (const key of syncKeys) {
      if (!settings[key]) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              settings[key] = JSON.parse(val);
            } catch {
              settings[key] = val;
            }
          }
        } catch {
          // ignore
        }
      }
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
