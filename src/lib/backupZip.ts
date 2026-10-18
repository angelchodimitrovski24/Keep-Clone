import JSZip from 'jszip';
import { Note, Label, Category, ReadingSession } from '@/types/note';
import {
  exportAllData,
  saveNoteToDB,
  saveLabelToDB,
  saveCategoryToDB,
  saveReadingSessionToDB,
  getAllNotesFromDB,
  getAllLabelsFromDB,
  getAllCategoriesFromDB,
  getAllReadingSessionsFromDB,
  saveMediaToDB,
  getMediaFromDB,
} from './db';
import { extractAllImagesFromNote } from './pdfExport';
import { resolveLocalMediaUrl } from './formatUtils';
import {
  registerMediaBlobUrl,
  getMediaBlobUrl,
  getSyncLocalMediaFolder,
} from './localPaste';

export interface ImportResult {
  success: boolean;
  notesAdded: number;
  notesUpdated: number;
  notesSkipped: number;
  labelsAdded: number;
  categoriesAdded: number;
  sessionsAdded: number;
  mediaExtracted: number;
  message: string;
}

export interface BackupMediaManifestItem {
  fileName: string;
  archivePath: string;
  originalSrc: string;
  noteId: string;
  type: 'image' | 'drawing';
}

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

function parseDataUrl(dataUrl: string): { mimeType: string; extension: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  let extension = 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
  else if (mimeType.includes('gif')) extension = 'gif';
  else if (mimeType.includes('webp')) extension = 'webp';
  else if (mimeType.includes('svg')) extension = 'svg';
  return { mimeType, extension, base64Data: match[2] };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF-]/g, '_').substring(0, 50) || 'untitled';
}

/**
 * Fetches or decodes binary data for an image source (from base64, IndexedDB, or server /api/local-media)
 */
async function fetchMediaBinary(rawSrc: string): Promise<{ data: ArrayBuffer; extension: string; mimeType: string } | null> {
  if (!rawSrc) return null;
  const trimmed = rawSrc.trim();

  // 1. Data URL
  if (trimmed.startsWith('data:')) {
    const parsed = parseDataUrl(trimmed);
    if (parsed) {
      try {
        const binaryString = atob(parsed.base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return { data: bytes.buffer, extension: parsed.extension, mimeType: parsed.mimeType };
      } catch {
        return null;
      }
    }
  }

  // 2. Extract clean file name
  const clean = trimmed.replace(/\\/g, '/');
  const withoutQuery = clean.split('?')[0];
  const fileName = withoutQuery.split('/').pop() || '';
  const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '.png';

  // 3. Check IndexedDB media store (instant local access)
  try {
    const record = await getMediaFromDB(fileName);
    if (record && record.blob) {
      const buffer = await record.blob.arrayBuffer();
      return {
        data: buffer,
        extension: ext.replace('.', '') || 'png',
        mimeType: record.mimeType || 'image/png',
      };
    }
  } catch {}

  // 4. Resolve media URL via resolveLocalMediaUrl or direct fetch
  const targetUrl = resolveLocalMediaUrl(trimmed);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const mime = res.headers.get('content-type') || 'image/png';
      let extension = ext.replace('.', '') || 'png';
      if (!extension || extension === 'local-media') {
        if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
        else if (mime.includes('gif')) extension = 'gif';
        else if (mime.includes('webp')) extension = 'webp';
        else extension = 'png';
      }
      return { data: buffer, extension, mimeType: mime };
    }
  } catch (err) {
    console.warn('Could not fetch media binary for export:', targetUrl, err);
  }

  return null;
}

/**
 * Generates the full Google Keep backup ZIP blob and metadata.
 * Can be downloaded locally or uploaded directly to Google Drive.
 */
export async function generateBackupZipBlob(): Promise<{
  blob: Blob;
  filename: string;
  notesCount: number;
  mediaCount: number;
}> {
  const rawData = await exportAllData();
  const zip = new JSZip();

  let mediaCount = 0;
  const mediaFolder = zip.folder('media');
  const imagesFolder = mediaFolder?.folder('images');
  const drawingsFolder = mediaFolder?.folder('drawings');
  const notesFolder = zip.folder('notes');

  const addedMediaFiles = new Set<string>();
  const mediaManifest: BackupMediaManifestItem[] = [];

  // Process and extract media from notes
  for (const note of rawData.notes) {
    const safeTitle = sanitizeFilename(note.title || `note_${note.id}`);

    // 1. Extract note canvas drawings to media/drawings/
    if (note.drawings && Array.isArray(note.drawings)) {
      note.drawings.forEach((drawing, idx) => {
        const parsed = parseDataUrl(drawing.dataUrl);
        if (parsed) {
          const filename = `${safeTitle}_${note.id.slice(-6)}_drawing_${idx + 1}.${parsed.extension}`;
          drawingsFolder?.file(filename, parsed.base64Data, { base64: true });
          mediaCount++;
          mediaManifest.push({
            fileName: filename,
            archivePath: `media/drawings/${filename}`,
            originalSrc: drawing.dataUrl,
            noteId: note.id,
            type: 'drawing',
          });
        }
      });
    }

    // 2. Extract ALL images from note (both attached note.images AND embedded in note.content)
    const allImages = extractAllImagesFromNote(note);
    for (let idx = 0; idx < allImages.length; idx++) {
      const imgUrl = allImages[idx];
      if (!imgUrl) continue;

      let filename = '';
      const clean = imgUrl.trim().replace(/\\/g, '/').split('?')[0];
      const baseName = clean.split('/').pop();
      if (baseName && /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(baseName)) {
        filename = sanitizeFilename(baseName);
        if (!filename.includes('.')) {
          const extMatch = baseName.match(/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i);
          filename += extMatch ? extMatch[0].toLowerCase() : '.png';
        }
      }

      if (!filename || filename === 'image.png' || filename === 'blob.png') {
        filename = `${safeTitle}_${note.id.slice(-6)}_img_${idx + 1}.png`;
      }

      if (addedMediaFiles.has(filename)) {
        continue;
      }

      const mediaBinary = await fetchMediaBinary(imgUrl);
      if (mediaBinary) {
        if (!filename.includes('.')) {
          filename += `.${mediaBinary.extension}`;
        }
        imagesFolder?.file(filename, mediaBinary.data);
        addedMediaFiles.add(filename);
        mediaCount++;
        mediaManifest.push({
          fileName: filename,
          archivePath: `media/images/${filename}`,
          originalSrc: imgUrl,
          noteId: note.id,
          type: 'image',
        });
      }
    }

    // 3. Create human-readable markdown file for each note
    if (notesFolder) {
      let mdContent = `# ${note.title || 'Untitled Note'}\n\n`;
      if (note.category) mdContent += `**Category:** ${note.category}\n`;
      if (note.labels && note.labels.length > 0) mdContent += `**Labels:** ${note.labels.join(', ')}\n`;
      if (note.createdAt) mdContent += `**Created:** ${new Date(note.createdAt).toLocaleString()}\n`;
      if (note.updatedAt) mdContent += `**Last Modified:** ${new Date(note.updatedAt).toLocaleString()}\n`;
      if (note.totalReadingTime && note.totalReadingTime > 0) {
        mdContent += `**Total Reading Time:** ${Math.floor(note.totalReadingTime / 60)}m ${note.totalReadingTime % 60}s\n`;
      }
      mdContent += `\n---\n\n`;

      if (note.isList && note.todos && note.todos.length > 0) {
        note.todos.forEach((t) => {
          mdContent += `- [${t.completed ? 'x' : ' '}] ${t.text}\n`;
        });
      } else if (note.content) {
        mdContent += `${note.content}\n`;
      }

      const noteFilename = `${safeTitle}_${note.id.slice(-5)}.md`;
      notesFolder.file(noteFilename, mdContent);
    }
  }

  // Include complete structured backup JSON
  const backupJson = {
    ...rawData,
    app: 'Google Keep Offline',
    version: '2.0.0',
    exportFormat: 'zip-bundle',
    totalMediaFiles: mediaCount,
    mediaManifest,
  };
  zip.file('data.json', JSON.stringify(backupJson, null, 2));

  // Add README.txt in root of ZIP
  const readme = `Google Keep Offline Backup
Exported on: ${new Date().toLocaleString()}
Total Notes: ${rawData.notes.length}
Total Categories: ${rawData.categories.length}
Total Labels: ${rawData.labels.length}
Total Reading Sessions: ${rawData.readingSessions?.length || 0}
Total Media Files: ${mediaCount}

Archive Structure:
- data.json: Primary application database used for intelligent restore
- media/images/: Image attachments extracted from your notes
- media/drawings/: Canvas drawings extracted as standalone PNG files
- notes/: Individual Markdown (.md) documents readable in any text or markdown editor
`;
  zip.file('README.txt', readme);

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `google-keep-backup-${dateStr}.zip`;

  return {
    blob: zipBlob,
    filename,
    notesCount: rawData.notes.length,
    mediaCount,
  };
}

/**
 * Exports all Google Keep data as a complete ZIP archive and initiates a local browser download.
 */
export async function exportBackupZip(): Promise<void> {
  const { blob, filename } = await generateBackupZipBlob();

  // Trigger browser download
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Intelligent Smart Import:
 * Accepts either a .zip backup archive OR a legacy .json backup file.
 * Intelligently reconciles data:
 * - Does NOT duplicate notes. Matches existing notes by ID (or title + createdAt).
 * - Only updates notes if imported version has newer updatedAt timestamp.
 * - Merges version histories and total reading time without overwriting newer local edits.
 * - Deduplicates labels, categories, and reading session records.
 */
export async function importBackupSmart(file: File): Promise<ImportResult> {
  let parsedData: {
    notes?: Note[];
    labels?: Label[];
    categories?: Category[];
    readingSessions?: ReadingSession[];
  } | null = null;

  let mediaExtractedCount = 0;

  // 1. Determine if ZIP or JSON
  const isZip = file.name.endsWith('.zip') || file.type.includes('zip') || file.type.includes('compressed');

  if (isZip) {
    try {
      const zip = await JSZip.loadAsync(file);
      const dataJsonFile = zip.file('data.json') || zip.file('backup.json');

      if (!dataJsonFile) {
        // Try looking for any .json file in root
        const jsonFiles = zip.file(/\.json$/i);
        if (jsonFiles.length === 0) {
          throw new Error('No data.json found inside the ZIP archive.');
        }
        const jsonContent = await jsonFiles[0].async('string');
        parsedData = JSON.parse(jsonContent);
      } else {
        const jsonContent = await dataJsonFile.async('string');
        parsedData = JSON.parse(jsonContent);
      }

      // Extract and restore all media files in archive
      const mediaFiles = zip.file(/^media\//);
      const filesToUpload: File[] = [];

      for (const mediaFile of mediaFiles) {
        if (mediaFile.dir) continue;
        const fileName = mediaFile.name.split('/').pop();
        if (!fileName) continue;

        try {
          const arrayBuffer = await mediaFile.async('arraybuffer');
          const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '.png';
          const mimeType = MIME_MAP[ext] || (mediaFile.name.includes('/images/') ? 'image/png' : 'application/octet-stream');
          const blob = new Blob([arrayBuffer], { type: mimeType });

          // 1. Save to IndexedDB media store (persists offline and across sessions)
          await saveMediaToDB({
            id: fileName,
            fileName,
            blob,
            mimeType,
            size: arrayBuffer.byteLength,
            updatedAt: Date.now(),
          });

          // 2. Register blob URL in memory cache for immediate instant rendering
          const blobUrl = URL.createObjectURL(blob);
          registerMediaBlobUrl(fileName, blobUrl);
          registerMediaBlobUrl(mediaFile.name, blobUrl);

          // 3. Prepare for physical filesystem save on server via /api/local-media
          const fileObj = new File([blob], fileName, { type: mimeType });
          filesToUpload.push(fileObj);

          mediaExtractedCount++;
        } catch (err) {
          console.warn('Failed extracting media file from archive:', mediaFile.name, err);
        }
      }

      // If running with server, upload all media files to /api/local-media with preserveName=true
      if (filesToUpload.length > 0 && typeof window !== 'undefined') {
        try {
          const formData = new FormData();
          formData.append('preserveName', 'true');
          const syncFolder = getSyncLocalMediaFolder();
          if (syncFolder) {
            formData.append('folderPath', syncFolder);
          }
          for (const f of filesToUpload) {
            formData.append('files', f, f.name);
          }

          fetch('/api/local-media', {
            method: 'POST',
            body: formData,
          }).catch((err) => {
            console.warn('Server filesystem media write skipped (IndexedDB active):', err);
          });
        } catch (err) {
          console.warn('Failed to upload extracted files to local-media server:', err);
        }
      }

      // Re-map original image sources from mediaManifest to newly extracted blob URLs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manifest = (parsedData as any)?.mediaManifest;
      if (Array.isArray(manifest)) {
        for (const item of manifest) {
          if (item && item.fileName && item.originalSrc) {
            const blobUrl = getMediaBlobUrl(item.fileName);
            if (blobUrl) {
              registerMediaBlobUrl(item.originalSrc, blobUrl);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error extracting ZIP archive:', err);
      return {
        success: false,
        notesAdded: 0,
        notesUpdated: 0,
        notesSkipped: 0,
        labelsAdded: 0,
        categoriesAdded: 0,
        sessionsAdded: 0,
        mediaExtracted: 0,
        message: 'Could not read ZIP archive. Please ensure it is a valid backup file.',
      };
    }
  } else {
    // Handle JSON file
    try {
      const text = await file.text();
      parsedData = JSON.parse(text);
    } catch (err) {
      console.error('Error parsing JSON backup:', err);
      return {
        success: false,
        notesAdded: 0,
        notesUpdated: 0,
        notesSkipped: 0,
        labelsAdded: 0,
        categoriesAdded: 0,
        sessionsAdded: 0,
        mediaExtracted: 0,
        message: 'Invalid JSON file. Please ensure it is a valid Google Keep backup.',
      };
    }
  }

  if (!parsedData || typeof parsedData !== 'object') {
    return {
      success: false,
      notesAdded: 0,
      notesUpdated: 0,
      notesSkipped: 0,
      labelsAdded: 0,
      categoriesAdded: 0,
      sessionsAdded: 0,
      mediaExtracted: 0,
      message: 'Invalid backup structure.',
    };
  }

  // 2. Fetch existing data from IndexedDB
  const [existingNotes, existingLabels, existingCategories, existingSessions] = await Promise.all([
    getAllNotesFromDB(),
    getAllLabelsFromDB(),
    getAllCategoriesFromDB(),
    getAllReadingSessionsFromDB(),
  ]);

  let notesAdded = 0;
  let notesUpdated = 0;
  let notesSkipped = 0;
  let labelsAdded = 0;
  let categoriesAdded = 0;
  let sessionsAdded = 0;

  // 3. Intelligent Reconciliation for Notes
  if (parsedData.notes && Array.isArray(parsedData.notes)) {
    for (const importedNote of parsedData.notes) {
      if (!importedNote || !importedNote.id) continue;

      // Find local note by ID, or fallback to matching title + createdAt
      const local = existingNotes.find(
        (n) => n.id === importedNote.id || (n.title === importedNote.title && n.createdAt === importedNote.createdAt)
      );

      if (!local) {
        // New note: Add
        await saveNoteToDB(importedNote);
        notesAdded++;
      } else {
        // Existing note found: Compare timestamps and content
        const isIdentical =
          local.title === importedNote.title &&
          local.content === importedNote.content &&
          local.isList === importedNote.isList &&
          JSON.stringify(local.todos || []) === JSON.stringify(importedNote.todos || []) &&
          local.color === importedNote.color &&
          local.theme === importedNote.theme &&
          local.category === importedNote.category &&
          local.isPinned === importedNote.isPinned &&
          local.isArchived === importedNote.isArchived &&
          local.isTrash === importedNote.isTrash &&
          JSON.stringify(local.images || []) === JSON.stringify(importedNote.images || []);

        if (isIdentical) {
          // Exactly the same: Skip without modifying
          notesSkipped++;
        } else if (importedNote.updatedAt > local.updatedAt) {
          // Imported note is NEWER: Update local note with imported data
          // Merge version histories so no revisions are lost
          const combinedVersions = [...(importedNote.versions || []), ...(local.versions || [])];
          const uniqueVersions = Array.from(new Map(combinedVersions.map((v) => [v.id, v])).values()).sort(
            (a, b) => b.timestamp - a.timestamp
          );

          const mergedNote: Note = {
            ...importedNote,
            versions: uniqueVersions,
            totalReadingTime: Math.max(local.totalReadingTime || 0, importedNote.totalReadingTime || 0),
          };

          await saveNoteToDB(mergedNote);
          notesUpdated++;
        } else {
          // Local note is NEWER or equal: Preserve local edits!
          // But merge any missing past version snapshots from imported
          const localVerIds = new Set((local.versions || []).map((v) => v.id));
          const missingImportedVersions = (importedNote.versions || []).filter((v) => !localVerIds.has(v.id));

          let needsUpdate = false;
          let mergedVersions = local.versions || [];

          if (missingImportedVersions.length > 0) {
            mergedVersions = [...missingImportedVersions, ...mergedVersions].sort((a, b) => b.timestamp - a.timestamp);
            needsUpdate = true;
          }

          const maxReadingTime = Math.max(local.totalReadingTime || 0, importedNote.totalReadingTime || 0);
          if (maxReadingTime !== (local.totalReadingTime || 0)) {
            needsUpdate = true;
          }

          if (needsUpdate) {
            await saveNoteToDB({
              ...local,
              versions: mergedVersions,
              totalReadingTime: maxReadingTime,
            });
            notesUpdated++;
          } else {
            notesSkipped++;
          }
        }
      }
    }
  }

  // 4. Intelligent Reconciliation for Labels
  if (parsedData.labels && Array.isArray(parsedData.labels)) {
    const existingLabelNames = new Set(existingLabels.map((l) => l.name.toLowerCase()));
    for (const label of parsedData.labels) {
      if (!label || !label.name) continue;
      if (!existingLabelNames.has(label.name.toLowerCase())) {
        await saveLabelToDB(label);
        existingLabelNames.add(label.name.toLowerCase());
        labelsAdded++;
      }
    }
  }

  // 5. Intelligent Reconciliation for Categories
  if (parsedData.categories && Array.isArray(parsedData.categories)) {
    const existingCategoryNames = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c]));
    for (const cat of parsedData.categories) {
      if (!cat || !cat.name) continue;
      const localCat = existingCategoryNames.get(cat.name.toLowerCase());
      if (!localCat) {
        await saveCategoryToDB(cat);
        existingCategoryNames.set(cat.name.toLowerCase(), cat);
        categoriesAdded++;
      } else {
        // If local is missing icon or color and imported has it, enrich
        if ((!localCat.icon && cat.icon) || (!localCat.color && cat.color)) {
          await saveCategoryToDB({
            ...localCat,
            icon: localCat.icon || cat.icon,
            color: localCat.color || cat.color,
          });
        }
      }
    }
  }

  // 6. Intelligent Reconciliation for Reading Sessions
  if (parsedData.readingSessions && Array.isArray(parsedData.readingSessions)) {
    const existingSessionIds = new Set(existingSessions.map((s) => s.id));
    for (const session of parsedData.readingSessions) {
      if (!session || !session.id) continue;
      if (!existingSessionIds.has(session.id)) {
        await saveReadingSessionToDB(session);
        existingSessionIds.add(session.id);
        sessionsAdded++;
      }
    }
  }

  const summaryMessage = `Import completed: ${notesAdded} new notes added, ${notesUpdated} updated with newer changes, ${notesSkipped} unchanged. ${labelsAdded} labels, ${categoriesAdded} categories, ${sessionsAdded} reading sessions merged, and ${mediaExtractedCount} media files restored.`;

  return {
    success: true,
    notesAdded,
    notesUpdated,
    notesSkipped,
    labelsAdded,
    categoriesAdded,
    sessionsAdded,
    mediaExtracted: mediaExtractedCount,
    message: summaryMessage,
  };
}
