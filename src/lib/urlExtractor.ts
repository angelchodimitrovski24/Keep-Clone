import { saveMediaToDB } from '@/lib/db';
import { registerMediaBlobUrl, getSyncLocalMediaFolder } from '@/lib/localPaste';

export type UrlAuthType = 'none' | 'jira' | 'bearer' | 'basic' | 'cookie' | 'custom';

export interface DomainAuthConfig {
  domain: string;
  authType: UrlAuthType;
  username?: string; // or email
  password?: string; // or API token
  token?: string; // Bearer token
  cookie?: string; // Session cookie string
  customHeaders?: Record<string, string>;
  updatedAt: number;
}

export interface ExtractUrlOptions {
  url: string;
  authType?: UrlAuthType;
  username?: string;
  password?: string;
  token?: string;
  cookie?: string;
  customHeaders?: Record<string, string>;
  downloadImages?: boolean;
  imagePathStyle?: 'relative' | 'api' | 'filename';
  folderPath?: string;
}

export interface ExtractedImageResult {
  originalUrl: string;
  fileName: string;
  savedPath: string;
  serveUrl: string;
  relativeMarkdownPath: string;
  size: number;
  mimeType: string;
}

export interface ExtractUrlResult {
  success: boolean;
  isJira?: boolean;
  title: string;
  markdown: string;
  sourceUrl: string;
  siteName?: string;
  author?: string;
  labels?: string[];
  images: ExtractedImageResult[];
  error?: string;
}

const STORAGE_KEY = 'keep_saved_domain_auths';

/**
 * Saves or updates authentication credentials for a domain.
 */
export function saveDomainAuth(config: Omit<DomainAuthConfig, 'updatedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map: Record<string, DomainAuthConfig> = raw ? JSON.parse(raw) : {};
    const domainKey = config.domain.toLowerCase().trim();
    map[domainKey] = {
      ...config,
      domain: domainKey,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed saving domain auth:', err);
  }
}

/**
 * Retrieves saved credentials for a specific domain.
 */
export function getDomainAuth(domain: string): DomainAuthConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, DomainAuthConfig> = JSON.parse(raw);
    const domainKey = domain.toLowerCase().trim();

    // Exact match
    if (map[domainKey]) return map[domainKey];

    // Wildcard or parent domain match e.g. company.atlassian.net -> atlassian.net
    for (const [key, val] of Object.entries(map)) {
      if (domainKey.endsWith(`.${key}`) || domainKey === key) {
        return val;
      }
    }
  } catch (err) {
    console.warn('Failed reading domain auth:', err);
  }
  return null;
}

/**
 * Lists all saved domain credentials (without exposing full passwords).
 */
export function listSavedDomainAuths(): Array<{ domain: string; authType: UrlAuthType; username?: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const map: Record<string, DomainAuthConfig> = JSON.parse(raw);
    return Object.values(map).map((v) => ({
      domain: v.domain,
      authType: v.authType,
      username: v.username,
    }));
  } catch {
    return [];
  }
}

/**
 * Deletes saved credentials for a domain.
 */
export function deleteDomainAuth(domain: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const map: Record<string, DomainAuthConfig> = JSON.parse(raw);
    delete map[domain.toLowerCase().trim()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed deleting domain auth:', err);
  }
}

/**
 * Calls backend API to extract webpage / Jira ticket content into Markdown
 * and download images locally.
 */
export async function extractFromUrl(options: ExtractUrlOptions): Promise<ExtractUrlResult> {
  const syncFolder = options.folderPath || getSyncLocalMediaFolder();

  const response = await fetch('/api/extract-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...options,
      folderPath: syncFolder || undefined,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Extraction failed with HTTP ${response.status}`);
  }

  // Pre-load and cache downloaded images into IndexedDB & memory blob cache
  if (Array.isArray(data.images) && data.images.length > 0) {
    syncDownloadedImagesToClient(data.images).catch((err) => {
      console.warn('Failed client sync for downloaded images:', err);
    });
  }

  return data;
}

/**
 * Downloads image buffers from serveUrl in background tick to populate client
 * IndexedDB and in-memory blob cache for instant rendering in editor and note cards.
 */
async function syncDownloadedImagesToClient(images: ExtractedImageResult[]): Promise<void> {
  for (const img of images) {
    try {
      const res = await fetch(img.serveUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Register blob URLs across all reference styles
        registerMediaBlobUrl(img.fileName, blobUrl);
        registerMediaBlobUrl(img.savedPath, blobUrl);
        registerMediaBlobUrl(img.serveUrl, blobUrl);
        registerMediaBlobUrl(img.relativeMarkdownPath, blobUrl);
        if (img.originalUrl) {
          registerMediaBlobUrl(img.originalUrl, blobUrl);
        }

        // Save to IndexedDB
        saveMediaToDB({
          id: img.fileName,
          fileName: img.fileName,
          blob,
          mimeType: img.mimeType || blob.type || 'image/png',
          size: blob.size,
        }).catch(() => {});
      }
    } catch {
      // Non-fatal if client cache fails; server already stored file on disk
    }
  }
}
