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

/**
 * Extracts all File objects (images or files) from a ClipboardEvent
 */
export function extractFilesFromClipboard(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];

  const files: File[] = [];
  const seen = new Set<string>();

  // 1. Check clipboardData.files
  if (clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      const key = `${f.name}-${f.size}-${f.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        files.push(f);
      }
    }
  }

  // 2. Check clipboardData.items for any file items not already captured
  if (clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) {
          const key = `${f.name}-${f.size}-${f.type}`;
          if (!seen.has(key)) {
            seen.add(key);
            files.push(f);
          }
        }
      }
    }
  }

  return files;
}

/**
 * If the user also picked a Browser FileSystemDirectoryHandle, write the files there too
 */
async function writeToBrowserDirectoryHandleIfPresent(files: File[]) {
  try {
    const dirHandle = await getSettingFromDB<FileSystemDirectoryHandle | null>(
      'browserDirectoryHandle',
      null
    );
    if (!dirHandle) return;

    // Request/verify readwrite permission if supported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAny = dirHandle as any;
    if (typeof handleAny.queryPermission === 'function') {
      let perm = await handleAny.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && typeof handleAny.requestPermission === 'function') {
        perm = await handleAny.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return;
    }

    for (const file of files) {
      const safeName = file.name && file.name !== 'image.png'
        ? file.name
        : `pasted-${Date.now()}.png`;
      const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();
    }
  } catch (err) {
    // Ignore browser handle errors as server-side copy handles disk persistence
    console.warn('Browser DirectoryHandle write skipped:', err);
  }
}

/**
 * Copies pasted or dropped files to the configured local folder and returns metadata + markdown links
 */
export async function copyFilesToLocalFolder(
  files: File[],
  overrideFolderPath?: string
): Promise<SavedLocalMediaFile[]> {
  if (!files || files.length === 0) return [];

  const storedFolder =
    overrideFolderPath ?? (await getSettingFromDB<string>('localMediaFolder', ''));

  // Also write to browser FileSystemDirectoryHandle if user selected one
  writeToBrowserDirectoryHandleIfPresent(files);

  const formData = new FormData();
  if (storedFolder) {
    formData.append('folderPath', storedFolder);
  }
  for (const file of files) {
    formData.append('files', file);
  }

  const response = await fetch('/api/local-media', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to copy files to local folder');
  }

  const data = await response.json();
  if (data.folderPath && !storedFolder) {
    await saveSettingToDB('localMediaFolder', data.folderPath);
  }

  return (data.files || []) as SavedLocalMediaFile[];
}
