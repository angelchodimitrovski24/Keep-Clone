import { saveMediaToDB } from '@/lib/db';
import { registerMediaBlobUrl, getSyncLocalMediaFolder } from '@/lib/localPaste';

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraUser {
  displayName: string;
  emailAddress: string;
  accountId?: string;
  avatarUrl?: string;
  timeZone?: string;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  assignee: string;
  updated: string;
  issueType: string;
  attachmentCount: number;
}

export interface JiraNotePayload {
  key: string;
  title: string;
  markdown: string;
  labels: string[];
  images: string[];
  sourceUrl: string;
  status: string;
  priority: string;
  assignee: string;
  issueType: string;
}

const JIRA_CONFIG_STORAGE_KEY = 'keep_jira_config';

/**
 * Reads saved Jira configuration from localStorage
 */
export function getSavedJiraConfig(): JiraConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(JIRA_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves Jira configuration to localStorage
 */
export function saveJiraConfig(config: JiraConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(JIRA_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed saving Jira config:', err);
  }
}

/**
 * Clears saved Jira configuration
 */
export function clearJiraConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(JIRA_CONFIG_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed clearing Jira config:', err);
  }
}

/**
 * Tests connection to Jira with the given credentials
 */
export async function testJiraConnection(config: JiraConfig): Promise<{ success: boolean; user?: JiraUser; error?: string }> {
  try {
    const res = await fetch('/api/jira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test-connection',
        baseUrl: config.baseUrl,
        email: config.email,
        apiToken: config.apiToken,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Connection test failed' };
  }
}

/**
 * Fetches a single Jira issue as a note payload
 */
export async function fetchJiraIssue(
  config: JiraConfig,
  issueKey: string,
  downloadAttachments: boolean = true,
  includeComments: boolean = true
): Promise<JiraNotePayload> {
  const syncFolder = getSyncLocalMediaFolder();

  const res = await fetch('/api/jira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'fetch-issue',
      baseUrl: config.baseUrl,
      email: config.email,
      apiToken: config.apiToken,
      issueKey,
      downloadAttachments,
      includeComments,
      folderPath: syncFolder || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Failed fetching issue ${issueKey}`);
  }

  // Pre-sync images to IndexedDB
  if (Array.isArray(data.note?.images) && data.note.images.length > 0) {
    syncLocalFilesToClient(data.note.images).catch(() => {});
  }

  return data.note;
}

/**
 * Searches Jira using JQL query
 */
export async function searchJiraJql(
  config: JiraConfig,
  jql: string,
  maxResults: number = 30
): Promise<{ issues: JiraIssueSummary[]; total: number }> {
  const res = await fetch('/api/jira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'search-jql',
      baseUrl: config.baseUrl,
      email: config.email,
      apiToken: config.apiToken,
      jql,
      maxResults,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed searching Jira issues');
  }

  return {
    issues: data.issues || [],
    total: data.total || 0,
  };
}

/**
 * Batch downloads multiple Jira issues
 */
export async function batchDownloadJiraIssues(
  config: JiraConfig,
  issueKeys: string[],
  downloadAttachments: boolean = true,
  includeComments: boolean = true
): Promise<{ notes: JiraNotePayload[]; errors: any[] }> {
  const syncFolder = getSyncLocalMediaFolder();

  const res = await fetch('/api/jira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'batch-download',
      baseUrl: config.baseUrl,
      email: config.email,
      apiToken: config.apiToken,
      issueKeys,
      downloadAttachments,
      includeComments,
      folderPath: syncFolder || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed batch downloading Jira issues');
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
