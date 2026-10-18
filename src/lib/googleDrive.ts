/**
 * Google Drive API Service for Google Keep Clone.
 * Handles OAuth 2.0 authorization via Google Identity Services (GIS),
 * uploading backup ZIP archives to a dedicated "Google Keep Backups" folder,
 * listing existing backups, downloading backups for smart import, and file deletion.
 */

export interface GoogleDriveUser {
  email?: string;
  name?: string;
  picture?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
}

export interface GoogleDriveAuthState {
  isConnected: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  user: GoogleDriveUser | null;
  clientId: string;
}

export interface StoredDriveFolder {
  id: string;
  name: string;
}

export const STORAGE_KEY_AUTH = 'keep_gdrive_auth';
export const STORAGE_KEY_CLIENT_ID = 'keep_gdrive_client_id';
export const STORAGE_KEY_EXPORT_FOLDER = 'keep_gdrive_export_folder';
export const STORAGE_KEY_IMPORT_FOLDER = 'keep_gdrive_import_folder';

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

/**
 * Loads the Google Identity Services (GIS) client library if not already loaded.
 */
export function initGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }

    const existingScript = document.getElementById('google-gis-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services: ' + err));
    document.head.appendChild(script);
  });
}

/**
 * Retrieves the stored Google Client ID (from localStorage or NEXT_PUBLIC env variable).
 */
export function getStoredClientId(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
  if (stored && stored.trim()) return stored.trim();
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
}

/**
 * Saves a custom Google Client ID.
 */
export function saveStoredClientId(clientId: string): void {
  if (typeof window === 'undefined') return;
  if (!clientId || !clientId.trim()) {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  } else {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
  }
}

/**
 * Retrieves the current authentication state from localStorage.
 */
export function getStoredDriveAuth(): GoogleDriveAuthState {
  const defaultState: GoogleDriveAuthState = {
    isConnected: false,
    accessToken: null,
    expiresAt: null,
    user: null,
    clientId: getStoredClientId(),
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) return defaultState;

    const data = JSON.parse(raw);
    const now = Date.now();

    // Check if token has expired (with 30s buffer)
    if (!data.accessToken || (data.expiresAt && data.expiresAt <= now + 30000)) {
      return {
        ...defaultState,
        clientId: getStoredClientId(),
      };
    }

    return {
      isConnected: true,
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
      user: data.user || null,
      clientId: getStoredClientId(),
    };
  } catch {
    return defaultState;
  }
}

/**
 * Saves the authentication state into localStorage.
 */
export function saveDriveAuth(auth: Partial<GoogleDriveAuthState>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredDriveAuth();
    const updated = { ...current, ...auth };
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save Drive auth to localStorage:', e);
  }
}

/**
 * Clears Google Drive authentication.
 */
export function disconnectGoogleDrive(): void {
  if (typeof window === 'undefined') return;
  const auth = getStoredDriveAuth();
  if (auth.accessToken) {
    // Revoke token if GIS oauth2 is available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (google?.accounts?.oauth2?.revoke) {
      try {
        google.accounts.oauth2.revoke(auth.accessToken, () => {});
      } catch {}
    }
  }
  localStorage.removeItem(STORAGE_KEY_AUTH);
}

/**
 * Retrieves the stored destination export folder from localStorage.
 */
export function getStoredExportFolder(): StoredDriveFolder | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXPORT_FOLDER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
        return parsed;
      }
    }
  } catch {}
  return null;
}

/**
 * Saves the chosen export folder in localStorage.
 */
export function saveStoredExportFolder(folder: StoredDriveFolder): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_EXPORT_FOLDER, JSON.stringify(folder));
  } catch (e) {
    console.error('Failed to save export folder:', e);
  }
}

/**
 * Retrieves the stored import folder from localStorage.
 */
export function getStoredImportFolder(): StoredDriveFolder | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IMPORT_FOLDER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
        return parsed;
      }
    }
  } catch {}
  return null;
}

/**
 * Saves the chosen import folder in localStorage.
 */
export function saveStoredImportFolder(folder: StoredDriveFolder): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_IMPORT_FOLDER, JSON.stringify(folder));
  } catch (e) {
    console.error('Failed to save import folder:', e);
  }
}

/**
 * Requests an OAuth 2.0 access token via Google Identity Services popup.
 */
export async function requestDriveAccessToken(clientId: string): Promise<{ accessToken: string; expiresAt: number; user: GoogleDriveUser | null }> {
  await initGisScript();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services client library is not available.');
  }

  return new Promise((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }

          const accessToken = response.access_token;
          const expiresInSeconds = parseInt(response.expires_in, 10) || 3600;
          const expiresAt = Date.now() + expiresInSeconds * 1000;

          // Fetch user info
          let user: GoogleDriveUser | null = null;
          try {
            user = await getDriveUserInfo(accessToken);
          } catch {
            // Non-fatal if userinfo fails
          }

          saveDriveAuth({
            isConnected: true,
            accessToken,
            expiresAt,
            user,
            clientId,
          });

          resolve({ accessToken, expiresAt, user });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google OAuth authentication failed.'));
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetches basic user profile from Google OAuth userinfo.
 */
export async function getDriveUserInfo(accessToken: string): Promise<GoogleDriveUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch user profile from Google.');
  }

  const data = await res.json();
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  parents?: string[];
  modifiedTime?: string;
}

/**
 * Ensures a dedicated "Google Keep Backups" folder exists on the user's Drive.
 * Returns the folder ID (or 'root' on fallback).
 */
export async function ensureKeepBackupsFolder(accessToken: string): Promise<string> {
  try {
    const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and name = 'Google Keep Backups' and trashed = false");
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (listRes.ok) {
      const listData = await listRes.json();
      if (listData.files && listData.files.length > 0) {
        return listData.files[0].id;
      }
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Google Keep Backups',
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Backups created by Google Keep Offline clone',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
  } catch (err) {
    console.warn('Could not auto-create or find Google Keep Backups folder:', err);
  }

  return 'root';
}

/**
 * Lists subfolders inside a specific parent folder in Google Drive.
 * parentId = 'root' for top-level My Drive.
 */
export async function listGoogleDriveFolders(
  accessToken: string,
  parentId = 'root'
): Promise<GoogleDriveFolder[]> {
  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime)');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name%20asc&pageSize=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list folders: ${errText || res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Creates a new folder inside a specific parent folder in Google Drive.
 */
export async function createGoogleDriveFolder(
  accessToken: string,
  folderName: string,
  parentId = 'root'
): Promise<GoogleDriveFolder> {
  const parents = parentId && parentId !== 'root' ? [parentId] : [];
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName.trim(),
      mimeType: 'application/vnd.google-apps.folder',
      ...(parents.length > 0 ? { parents } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create folder: ${errText || res.statusText}`);
  }

  return await res.json();
}

/**
 * Retrieves all folders across the user's Google Drive for quick picker selection.
 */
export async function getAllGoogleDriveFolders(
  accessToken: string
): Promise<GoogleDriveFolder[]> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const fields = encodeURIComponent('files(id,name,parents,modifiedTime)');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name%20asc&pageSize=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to retrieve folders: ${errText || res.statusText}`);
  }

  const data = await res.json();
  const list: GoogleDriveFolder[] = (data.files || []).map((f: { id: string; name: string; parents?: string[]; modifiedTime?: string }) => ({
    id: f.id,
    name: f.name,
    parents: f.parents,
    modifiedTime: f.modifiedTime,
  }));

  // Always include My Drive (Root)
  return [
    { id: 'root', name: 'My Drive (Root)' },
    ...list,
  ];
}

/**
 * Uploads a backup Blob to Google Drive inside the chosen folder.
 * Uses Google Drive Resumable Upload to eliminate CORS preflight multipart issues
 * and support large ZIP bundles reliably.
 */
export async function uploadBackupToGoogleDrive(
  accessToken: string,
  blob: Blob,
  filename: string,
  folderId?: string
): Promise<GoogleDriveFile> {
  const targetFolderId = folderId || (await ensureKeepBackupsFolder(accessToken));
  const parents = targetFolderId && targetFolderId !== 'root' ? [targetFolderId] : [];

  const metadata = {
    name: filename,
    mimeType: blob.type || 'application/zip',
    ...(parents.length > 0 ? { parents } : {}),
    description: 'Google Keep Offline Backup ZIP bundle with notes, images, and drawings',
  };

  // Step 1: Initiate resumable upload session
  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': blob.type || 'application/zip',
        'X-Upload-Content-Length': blob.size.toString(),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Failed to start Google Drive upload session: ${errText || initRes.statusText}`);
  }

  const uploadLocation = initRes.headers.get('Location');
  if (!uploadLocation) {
    throw new Error('Google Drive did not provide an upload session location.');
  }

  // Step 2: Upload binary data directly to the resumable session URL
  const uploadRes = await fetch(uploadLocation, {
    method: 'PUT',
    headers: {
      'Content-Type': blob.type || 'application/zip',
    },
    body: blob,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed: ${errText || uploadRes.statusText}`);
  }

  const uploadedFile: GoogleDriveFile = await uploadRes.json();
  return uploadedFile;
}

/**
 * Lists backup files in the user's Google Drive.
 * Can filter by specific folder or search backups across Drive.
 */
export async function listGoogleDriveBackups(
  accessToken: string,
  folderId?: string
): Promise<GoogleDriveFile[]> {
  let queryStr = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";

  if (folderId && folderId !== 'all') {
    queryStr += ` and '${folderId}' in parents`;
  } else {
    // Across all drive: match zip backups or keep backup files
    queryStr += " and (name contains 'google-keep-backup' or name contains 'keep-backup' or mimeType = 'application/zip' or name contains '.zip')";
  }

  const query = encodeURIComponent(queryStr);
  const fields = encodeURIComponent('files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,parents)');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list backups from Google Drive: ${errText || res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Downloads a backup file from Google Drive and returns it as a File instance ready for smart import.
 */
export async function downloadGoogleDriveBackup(
  accessToken: string,
  fileId: string,
  fileName: string
): Promise<File> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to download backup from Google Drive: ${errText}`);
  }

  const blob = await res.blob();
  const mimeType = fileName.endsWith('.zip') ? 'application/zip' : 'application/json';
  return new File([blob], fileName, { type: mimeType });
}

/**
 * Deletes a backup file from Google Drive.
 */
export async function deleteGoogleDriveBackup(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Failed to delete backup from Google Drive: ${errText}`);
  }
}

/**
 * Utility to format file bytes to human readable string (KB / MB).
 */
export function formatBytes(bytes?: string | number): string {
  if (!bytes) return 'Unknown size';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num <= 0) return '0 B';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}
