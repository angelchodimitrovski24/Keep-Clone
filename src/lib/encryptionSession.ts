import { DecryptedNotePayload } from './crypto';

// In-memory decrypted note cache for the current session
const unlockedCache = new Map<string, DecryptedNotePayload>();

export function getUnlockedNote(noteId: string): DecryptedNotePayload | undefined {
  return unlockedCache.get(noteId);
}

export function setUnlockedNote(noteId: string, payload: DecryptedNotePayload): void {
  unlockedCache.set(noteId, payload);
}

export function lockNoteInSession(noteId: string): void {
  unlockedCache.delete(noteId);
}

export function isNoteUnlockedInSession(noteId: string): boolean {
  return unlockedCache.has(noteId);
}
