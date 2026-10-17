import fs from 'fs';
import path from 'path';
import { SharedNoteData } from '@/types/note';

const SHARES_DIR = path.join(process.cwd(), 'shared-notes');

// Base 58 / readable characters (no ambiguous 0, O, I, l, 1)
const SHORT_ALPHABET = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

function ensureSharesDir() {
  if (!fs.existsSync(SHARES_DIR)) {
    fs.mkdirSync(SHARES_DIR, { recursive: true });
  }
}

/**
 * Generate a clean, 6-character short ID (approx. 38 billion combinations).
 */
export function generateShortId(length = 6): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * SHORT_ALPHABET.length);
    id += SHORT_ALPHABET[randomIndex];
  }
  return id;
}

/**
 * Sanitize a short ID to prevent path traversal
 */
export function sanitizeShortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

/**
 * Save a shared note to the filesystem
 */
export async function saveSharedNote(data: Omit<SharedNoteData, 'id' | 'sharedAt'> & { id?: string }): Promise<SharedNoteData> {
  ensureSharesDir();

  let shortId = data.id ? sanitizeShortId(data.id) : '';
  if (!shortId) {
    // Generate unique short ID
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = generateShortId(6);
      const filePath = path.join(SHARES_DIR, `${candidate}.json`);
      if (!fs.existsSync(filePath)) {
        shortId = candidate;
        break;
      }
    }
    if (!shortId) {
      shortId = generateShortId(8);
    }
  }

  const sharedNote: SharedNoteData = {
    ...data,
    id: shortId,
    sharedAt: Date.now(),
    views: data.views ?? 0,
  };

  const filePath = path.join(SHARES_DIR, `${shortId}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(sharedNote, null, 2), 'utf-8');

  return sharedNote;
}

/**
 * Retrieve a shared note by its short ID
 */
export async function getSharedNote(id: string, incrementView = false): Promise<SharedNoteData | null> {
  ensureSharesDir();
  const safeId = sanitizeShortId(id);
  if (!safeId) return null;

  const filePath = path.join(SHARES_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const note = JSON.parse(raw) as SharedNoteData;

    if (incrementView) {
      note.views = (note.views || 0) + 1;
      // non-blocking view counter update
      fs.promises.writeFile(filePath, JSON.stringify(note, null, 2), 'utf-8').catch((err) => {
        console.error('Failed to increment view counter:', err);
      });
    }

    return note;
  } catch (err) {
    console.error(`Error reading shared note [${safeId}]:`, err);
    return null;
  }
}

/**
 * Delete / revoke a shared note
 */
export async function deleteSharedNote(id: string): Promise<boolean> {
  ensureSharesDir();
  const safeId = sanitizeShortId(id);
  if (!safeId) return false;

  const filePath = path.join(SHARES_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    console.error(`Error deleting shared note [${safeId}]:`, err);
    return false;
  }
}
