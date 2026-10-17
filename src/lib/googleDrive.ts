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

const STORAGE_KEY_AUTH = 'keep_gdrive_auth';
const STORAGE_KEY_CLIENT_ID = 'keep_gdrive_client_id';

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

/**
 * Ensures a dedicated "Google Keep Backups" folder exists on the user's Drive.
 * Returns the folder ID.
 */
export async function ensureKeepBackupsFolder(accessToken: string): Promise<string> {
  // Check if folder already exists
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

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Keep Backups folder: ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Uploads a backup Blob to Google Drive inside the "Google Keep Backups" folder.
 */
export async function uploadBackupToGoogleDrive(
  accessToken: string,
  blob: Blob,
  filename: string
): Promise<GoogleDriveFile> {
  const folderId = await ensureKeepBackupsFolder(accessToken);

  const boundary = '-------KeepBackupBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    mimeType: blob.type || 'application/zip',
    parents: [folderId],
    description: 'Google Keep Offline Backup ZIP bundle with notes, images, and drawings',
  };

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${blob.type || 'application/zip'}\r\n\r\n`;

  const preBlob = new Blob([metadataPart], { type: 'text/plain' });
  const postBlob = new Blob([closeDelimiter], { type: 'text/plain' });
  const multipartBlob = new Blob([preBlob, blob, postBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,createdTime,modifiedTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: multipartBlob,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed: ${errText}`);
  }

  const uploadedFile: GoogleDriveFile = await uploadRes.json();
  return uploadedFile;
}

/**
 * Lists all backup files in the user's Google Drive.
 */
export async function listGoogleDriveBackups(accessToken: string): Promise<GoogleDriveFile[]> {
  const query = encodeURIComponent("trashed = false and (name contains 'google-keep-backup' or mimeType = 'application/zip' or mimeType = 'application/json')");
  const fields = encodeURIComponent('files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink)');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=40`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list backups from Google Drive: ${errText}`);
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
