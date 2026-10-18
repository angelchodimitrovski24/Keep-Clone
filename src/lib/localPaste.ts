import { getSettingFromDB, saveSettingToDB } from './db';

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

  // 3. If no binary File objects, check text/html for <img src="...">
  const imageUrls: string[] = [];
  if (files.length === 0 && typeof clipboardData.getData === 'function') {
    try {
      const html = clipboardData.getData('text/html');
      if (html && /<img\s/i.test(html)) {
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

function convertFileToClientDataUrlMedia(file: File): Promise<SavedLocalMediaFile> {
  return new Promise((resolve) => {
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const safeName = file.name || (isImage ? `image-${Date.now()}.png` : `file-${Date.now()}`);
      resolve({
        fileName: safeName,
        folderPath: 'local-browser',
        savedPath: safeName,
        serveUrl: dataUrl,
        isImage,
        size: file.size,
        mimeType: file.type || (isImage ? 'image/png' : 'application/octet-stream'),
        markdownLink: isImage ? `![${safeName}](${dataUrl})` : `[${safeName}](${dataUrl})`,
      });
    };
    reader.onerror = () => {
      const safeName = file.name || 'file';
      resolve({
        fileName: safeName,
        folderPath: 'local-browser',
        savedPath: safeName,
        serveUrl: '',
        isImage,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        markdownLink: `[${safeName}](#)`,
      });
    };
    reader.readAsDataURL(file);
  });
}

function convertImageUrlToClientMedia(url: string): SavedLocalMediaFile {
  const isDataUrl = url.startsWith('data:image/');
  const fileName = `image-${Date.now()}.png`;
  return {
    fileName,
    folderPath: 'local-browser',
    savedPath: url,
    serveUrl: url,
    isImage: true,
    size: 0,
    mimeType: isDataUrl ? url.split(';')[0].replace('data:', '') : 'image/png',
    markdownLink: `![${fileName}](${url})`,
  };
}

/**
 * Synchronously initiates the FormData upload during the paste/drop event tick
 * so clipboard File blobs are never invalidated by the browser before fetch() reads them!
 * Falls back seamlessly to client-side Data URLs if running on Vercel or when local-media server is unavailable.
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
    console.warn('Local media upload fetch error (falling back to Data URLs):', err);
    return null;
  });

  // Also snapshot buffers for optional Browser DirectoryHandle mirror
  if (files.length > 0) {
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
        return data.files as SavedLocalMediaFile[];
      }
    }
  } catch (err) {
    console.warn('Local media processing error, falling back to Data URLs:', err);
  }

  // Guaranteed fallback: convert files & imageUrls to Data URLs client-side
  const clientFiles = await Promise.all(files.map(convertFileToClientDataUrlMedia));
  const clientUrls = imageUrls.map(convertImageUrlToClientMedia);
  return [...clientFiles, ...clientUrls];
}
