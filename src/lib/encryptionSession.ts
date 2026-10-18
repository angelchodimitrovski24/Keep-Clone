import { DecryptedNotePayload } from './crypto';

// In-memory decrypted note cache for the current session
const unlockedCache = new Map<string, DecryptedNotePayload>();
const passwordCache = new Map<string, string>();

export function getUnlockedNote(noteId: string): DecryptedNotePayload | undefined {
  return unlockedCache.get(noteId);
}

export function setUnlockedNote(noteId: string, payload: DecryptedNotePayload): void {
  unlockedCache.set(noteId, payload);
}

export function getSessionPassword(noteId: string): string | undefined {
  return passwordCache.get(noteId);
}

export function setSessionPassword(noteId: string, password: string): void {
  passwordCache.set(noteId, password);
}

export function lockNoteInSession(noteId: string): void {
  unlockedCache.delete(noteId);
  passwordCache.delete(noteId);
}

export function isNoteUnlockedInSession(noteId: string): boolean {
  return unlockedCache.has(noteId);
}

// In-memory unlocked category set for the current session
const unlockedCategories = new Set<string>();

export function isCategoryUnlockedInSession(categoryNameOrId: string): boolean {
  return unlockedCategories.has(categoryNameOrId.toLowerCase());
}

export function unlockCategoryInSession(categoryNameOrId: string): void {
  unlockedCategories.add(categoryNameOrId.toLowerCase());
}

export function lockCategoryInSession(categoryNameOrId: string): void {
  unlockedCategories.delete(categoryNameOrId.toLowerCase());
}
