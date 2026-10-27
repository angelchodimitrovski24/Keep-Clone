import { getSettingFromDB, saveSettingToDB, saveMediaToDB, getAllMediaFromDB } from './db';

export interface SavedLocalMediaFile {
  fileName: string;
  folderPath: string;
  savedPath: string;
  serveUrl: string;
  isImage: boolean;
  size: number;
  mimeType: string;
  markdownLink: string;
}

const LOCAL_FOLDER_STORAGE_KEY = 'keep_local_media_folder';

export function setSyncLocalMediaFolder(folder: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_FOLDER_STORAGE_KEY, folder);
  }
}

export function getSyncLocalMediaFolder(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(LOCAL_FOLDER_STORAGE_KEY) || '';
  }
  return '';
}

export interface ClipboardMediaPayload {
  files: File[];
  imageUrls: string[];
}

/**
 * Synchronously extracts all File objects AND any HTML <img> URLs from a ClipboardEvent / DragEvent
 */
export function extractClipboardPayload(clipboardData: DataTransfer | null): ClipboardMediaPayload {
  if (!clipboardData) return { files: [], imageUrls: [] };

  const files: File[] = [];
  const seen = new Set<string>();

  // 1. Check clipboardData.files
  if (clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      if (f && f.size > 0) {
        const key = `${f.name}-${f.size}-${f.type}-${i}`;
        seen.add(key);
        files.push(f);
      }
    }
  }

  // 2. Check clipboardData.items for any file/image items
  if (files.length === 0 && clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) {
          files.push(f);
        }
      }
    }
  }

  // 3. If no binary File objects, check text/html for standalone <img src="...">
  const imageUrls: string[] = [];
  if (files.length === 0 && typeof clipboardData.getData === 'function') {
    try {
      const html = clipboardData.getData('text/html');
      const plain = clipboardData.getData('text/plain')?.trim();
      // Only extract standalone images if there is NO substantial plain text,
      // or if the text is simply an image URL. If there is actual text, preserve it as text!
      if (html && /<img\s/i.test(html) && (!plain || plain.length === 0 || /^https?:\/\/\S+$/i.test(plain))) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const imgs = doc.querySelectorAll('img');
        imgs.forEach((img) => {
          const src = img.getAttribute('src');
          if (src && (src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://'))) {
            imageUrls.push(src);
          }
        });
      }
    } catch {
      // Ignore HTML parse errors
    }
  }

  return { files, imageUrls };
}

/**
 * Backwards-compatible helper returning File[]
 */
export function extractFilesFromClipboard(clipboardData: DataTransfer | null): File[] {
  return extractClipboardPayload(clipboardData).files;
}

/**
 * If the user also picked a Browser FileSystemDirectoryHandle, write the files there too
 */
async function writeToBrowserDirectoryHandleIfPresent(
  fileBuffers: { name: string; buffer: ArrayBuffer }[]
) {
  try {
    const dirHandle = await getSettingFromDB<FileSystemDirectoryHandle | null>(
      'browserDirectoryHandle',
      null
    );
    if (!dirHandle) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAny = dirHandle as any;
    if (typeof handleAny.queryPermission === 'function') {
      let perm = await handleAny.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && typeof handleAny.requestPermission === 'function') {
        perm = await handleAny.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return;
    }

    for (const item of fileBuffers) {
      const safeName =
        item.name && item.name !== 'image.png' ? item.name : `pasted-${Date.now()}.png`;
      const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(item.buffer);
      await writable.close();
    }
  } catch (err) {
    console.warn('Browser DirectoryHandle write skipped:', err);
  }
}

// In-memory cache mapping normalized paths and filenames to loadable URLs (blob: or serveUrl)
const mediaBlobUrlCache = new Map<string, string>();

export function registerMediaBlobUrl(pathOrName: string, url: string) {
  if (!pathOrName || !url) return;
  const key = pathOrName.trim().replace(/\\/g, '/').toLowerCase();
  mediaBlobUrlCache.set(key, url);
  const baseName = key.split('/').pop();
  if (baseName) {
    mediaBlobUrlCache.set(baseName, url);
  }
}

export function getMediaBlobUrl(pathOrName: string): string | undefined {
  if (!pathOrName) return undefined;
  const key = pathOrName.trim().replace(/\\/g, '/').toLowerCase();
  const direct = mediaBlobUrlCache.get(key);
  if (direct) return direct;
  const baseName = key.split('/').pop();
  if (baseName) return mediaBlobUrlCache.get(baseName);
  return undefined;
}

/**
 * Loads all locally cached media records from IndexedDB and registers blob URLs for instant offline/PWA rendering
 */
export async function initLocalMediaCache(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const records = await getAllMediaFromDB();
    for (const record of records) {
      if (record && record.blob) {
        const blobUrl = URL.createObjectURL(record.blob);
        registerMediaBlobUrl(record.id, blobUrl);
        registerMediaBlobUrl(record.fileName, blobUrl);
      }
    }
  } catch (err) {
    console.warn('Failed to load local media from IndexedDB:', err);
  }
}

export function makeTimestampName(ext: string): string {
  const now = new Date();
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    '-' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    '-' +
    String(now.getMilliseconds()).padStart(3, '0');
  return `pasted-${stamp}${ext || '.png'}`;
}

function convertFileToClientDataUrlMedia(file: File): Promise<SavedLocalMediaFile> {
  return new Promise((resolve) => {
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name);
    const ext = file.name && file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : (isImage ? '.png' : '');
    const safeName =
      file.name && file.name !== 'image.png' && file.name !== 'blob'
        ? file.name
        : makeTimestampName(ext || (isImage ? '.png' : ''));

    const syncFolder = getSyncLocalMediaFolder() || 'local-media';
    const normalizedFolder = syncFolder.replace(/\\/g, '/');
    const savedPath = `${normalizedFolder}/${safeName}`;

    // Create a local blob URL for immediate rendering
    let blobUrl = '';
    try {
      blobUrl = URL.createObjectURL(file);
    } catch {
      blobUrl = '';
    }

    if (blobUrl) {
      registerMediaBlobUrl(savedPath, blobUrl);
      registerMediaBlobUrl(safeName, blobUrl);
    }

    const serveUrl = `/api/local-media?folder=${encodeURIComponent(normalizedFolder)}&file=${encodeURIComponent(safeName)}`;
    const markdownLink = isImage ? `![${safeName}](${savedPath})` : `[${safeName}](${savedPath})`;

    resolve({
      fileName: safeName,
      folderPath: normalizedFolder,
      savedPath,
      serveUrl: blobUrl || serveUrl,
      isImage,
      size: file.size,
      mimeType: file.type || (isImage ? 'image/png' : 'application/octet-stream'),
      markdownLink,
    });
  });
}

function convertImageUrlToClientMedia(url: string): SavedLocalMediaFile {
  const isDataUrl = url.startsWith('data:image/');
  const fileName = makeTimestampName('.png');
  const syncFolder = getSyncLocalMediaFolder() || 'local-media';
  const normalizedFolder = syncFolder.replace(/\\/g, '/');
  const savedPath = `${normalizedFolder}/${fileName}`;

  registerMediaBlobUrl(savedPath, url);
  registerMediaBlobUrl(fileName, url);

  return {
    fileName,
    folderPath: normalizedFolder,
    savedPath,
    serveUrl: url,
    isImage: true,
    size: 0,
    mimeType: isDataUrl ? url.split(';')[0].replace('data:', '') : 'image/png',
    markdownLink: `![${fileName}](${savedPath})`,
  };
}

/**
 * Synchronously initiates the FormData upload during the paste/drop event tick
 * so clipboard File blobs are never invalidated by the browser before fetch() reads them!
 * Writes physically to local-media folder (server or Browser DirectoryHandle).
 */
export async function copyFilesToLocalFolder(
  files: File[],
  overrideFolderPath?: string,
  imageUrls: string[] = []
): Promise<SavedLocalMediaFile[]> {
  if ((!files || files.length === 0) && (!imageUrls || imageUrls.length === 0)) {
    return [];
  }

  // Read folder path synchronously so fetch() starts immediately in the same event tick!
  const syncFolder = overrideFolderPath ?? getSyncLocalMediaFolder();

  const formData = new FormData();
  if (syncFolder) {
    formData.append('folderPath', syncFolder);
  }
  for (const file of files) {
    formData.append('files', file, file.name || 'image.png');
  }
  if (imageUrls.length > 0) {
    formData.append('imageUrls', JSON.stringify(imageUrls));
  }

  // Start fetch synchronously before any await!
  const fetchPromise = fetch('/api/local-media', {
    method: 'POST',
    body: formData,
  }).catch((err) => {
    console.warn('Local media upload fetch error (falling back to client media):', err);
    return null;
  });

  // Also persist buffers to IndexedDB media store for offline/PWA access and snapshot to DirectoryHandle
  if (files.length > 0) {
    for (const f of files) {
      const isImg = f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name);
      const safeName = f.name && f.name !== 'image.png' && f.name !== 'blob' ? f.name : makeTimestampName(isImg ? '.png' : '');
      saveMediaToDB({
        id: safeName,
        fileName: safeName,
        blob: f,
        mimeType: f.type || (isImg ? 'image/png' : 'application/octet-stream'),
        size: f.size,
      }).catch(() => {});
    }

    Promise.all(
      files.map(async (f) => ({
        name: f.name,
        buffer: await f.arrayBuffer(),
      }))
    )
      .then((buffers) => writeToBrowserDirectoryHandleIfPresent(buffers))
      .catch(() => {});
  }

  try {
    const response = await fetchPromise;
    if (response && response.ok) {
      const data = await response.json();
      if (data.folderPath && !syncFolder) {
        setSyncLocalMediaFolder(data.folderPath);
        await saveSettingToDB('localMediaFolder', data.folderPath);
      }
      if (data.files && data.files.length > 0) {
        const savedList = data.files as SavedLocalMediaFile[];
        // Register urls into client cache
        for (const item of savedList) {
          registerMediaBlobUrl(item.savedPath, item.serveUrl);
          registerMediaBlobUrl(item.fileName, item.serveUrl);
        }
        return savedList;
      }
    }
  } catch (err) {
    console.warn('Local media processing error, falling back to client media:', err);
  }

  // Client fallback: generate proper local markdown links and register local blob URLs
  const clientFiles = await Promise.all(files.map(convertFileToClientDataUrlMedia));
  const clientUrls = imageUrls.map(convertImageUrlToClientMedia);
  return [...clientFiles, ...clientUrls];
}
