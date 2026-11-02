import { saveMediaToDB } from '@/lib/db';
import { registerMediaBlobUrl, getSyncLocalMediaFolder } from '@/lib/localPaste';

export interface SupportbenchConfig {
  baseUrl: string; // e.g. "https://api.supportbench.net" or "https://mycompany.supportbench.com"
  apiToken: string; // Bearer token or API Key
}

export interface SupportbenchUser {
  displayName?: string;
  email?: string;
  id?: string;
}

export interface SupportbenchCaseSummary {
  id: string;
  caseNumber: string;
  subject: string;
  status: string;
  priority: string;
  assignee: string;
  contact: string;
  account: string;
  updated: string;
  attachmentCount: number;
  commentCount: number;
}

export interface SupportbenchNotePayload {
  caseId: string;
  caseNumber: string;
  title: string;
  markdown: string;
  labels: string[];
  images: string[];
  sourceUrl: string;
  status: string;
  priority: string;
  assignee: string;
  contact: string;
  account: string;
}

const SUPPORTBENCH_CONFIG_STORAGE_KEY = 'keep_supportbench_config';

/**
 * Reads saved Supportbench configuration from localStorage
 */
export function getSavedSupportbenchConfig(): SupportbenchConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SUPPORTBENCH_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves Supportbench configuration to localStorage
 */
export function saveSupportbenchConfig(config: SupportbenchConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUPPORTBENCH_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed saving Supportbench config:', err);
  }
}

/**
 * Clears saved Supportbench configuration
 */
export function clearSupportbenchConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SUPPORTBENCH_CONFIG_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed clearing Supportbench config:', err);
  }
}

/**
 * Tests connection to Supportbench with the given credentials
 */
export async function testSupportbenchConnection(
  config: SupportbenchConfig
): Promise<{ success: boolean; user?: SupportbenchUser; endpoint?: string; error?: string }> {
  try {
    const res = await fetch('/api/supportbench', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test-connection',
        baseUrl: config.baseUrl,
        apiToken: config.apiToken,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true, user: data.user, endpoint: data.endpoint };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Connection test failed' };
  }
}

/**
 * Fetches a single Supportbench case as a note payload
 */
export async function fetchSupportbenchCase(
  config: SupportbenchConfig,
  caseIdentifier: string,
  downloadAttachments: boolean = true
): Promise<SupportbenchNotePayload> {
  const syncFolder = getSyncLocalMediaFolder();

  const res = await fetch('/api/supportbench', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'fetch-case',
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      caseIdentifier,
      downloadAttachments,
      folderPath: syncFolder || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Failed fetching case ${caseIdentifier}`);
  }

  // Pre-sync images to IndexedDB
  if (Array.isArray(data.note?.images) && data.note.images.length > 0) {
    syncLocalFilesToClient(data.note.images).catch(() => {});
  }

  return data.note;
}

/**
 * Searches or lists cases from Supportbench
 */
export async function searchSupportbenchCases(
  config: SupportbenchConfig,
  query: string = '',
  limit: number = 20
): Promise<{ cases: SupportbenchCaseSummary[] }> {
  const res = await fetch('/api/supportbench', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'search-cases',
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      query,
      limit,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed searching Supportbench cases');
  }

  return {
    cases: data.cases || [],
  };
}

/**
 * Batch downloads multiple Supportbench cases
 */
export async function batchDownloadSupportbenchCases(
  config: SupportbenchConfig,
  caseIdentifiers: string[],
  downloadAttachments: boolean = true
): Promise<{ notes: SupportbenchNotePayload[]; errors: any[] }> {
  const syncFolder = getSyncLocalMediaFolder();

  const res = await fetch('/api/supportbench', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'batch-download',
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      caseIdentifiers,
      downloadAttachments,
      folderPath: syncFolder || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed batch downloading Supportbench cases');
  }

  // Pre-sync all images to IndexedDB
  if (Array.isArray(data.notes)) {
    for (const note of data.notes) {
      if (Array.isArray(note.images) && note.images.length > 0) {
        syncLocalFilesToClient(note.images).catch(() => {});
      }
    }
  }

  return {
    notes: data.notes || [],
    errors: data.errors || [],
  };
}

/**
 * Helper to cache locally saved files into IndexedDB & blob cache for immediate UI rendering
 */
async function syncLocalFilesToClient(filePaths: string[]): Promise<void> {
  for (const fPath of filePaths) {
    try {
      const fileName = fPath.split(/[/\\]/).pop() || '';
      const serveUrl = `/api/local-media?file=${encodeURIComponent(fileName)}`;
      const res = await fetch(serveUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        registerMediaBlobUrl(fileName, blobUrl);
        registerMediaBlobUrl(fPath, blobUrl);
        registerMediaBlobUrl(serveUrl, blobUrl);

        saveMediaToDB({
          id: fileName,
          fileName,
          blob,
          mimeType: blob.type || 'image/png',
          size: blob.size,
        }).catch(() => {});
      }
    } catch {
      // Non-fatal
    }
  }
}
