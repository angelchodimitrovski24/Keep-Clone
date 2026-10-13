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
} from './db';

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
 * Exports all Google Keep data as a complete ZIP archive.
 * Inside the ZIP:
 * - data.json: Complete structured metadata and note records
 * - media/images/: Extracted photo attachments as standalone image files
 * - media/drawings/: Extracted canvas drawings as standalone PNG files
 * - notes/: Human-readable Markdown (.md) exports of each note
 */
export async function exportBackupZip(): Promise<void> {
  const rawData = await exportAllData();
  const zip = new JSZip();

  let mediaCount = 0;
  const mediaFolder = zip.folder('media');
  const imagesFolder = mediaFolder?.folder('images');
  const drawingsFolder = mediaFolder?.folder('drawings');
  const notesFolder = zip.folder('notes');

  // Process and extract media from notes
  for (const note of rawData.notes) {
    const safeTitle = sanitizeFilename(note.title || `note_${note.id}`);

    // 1. Extract note images to media/images/
    if (note.images && Array.isArray(note.images)) {
      note.images.forEach((imgUrl, idx) => {
        const parsed = parseDataUrl(imgUrl);
        if (parsed) {
          const filename = `${safeTitle}_${note.id.slice(-6)}_img_${idx + 1}.${parsed.extension}`;
          imagesFolder?.file(filename, parsed.base64Data, { base64: true });
          mediaCount++;
        }
      });
    }

    // 2. Extract note canvas drawings to media/drawings/
    if (note.drawings && Array.isArray(note.drawings)) {
      note.drawings.forEach((drawing, idx) => {
        const parsed = parseDataUrl(drawing.dataUrl);
        if (parsed) {
          const filename = `${safeTitle}_${note.id.slice(-6)}_drawing_${idx + 1}.${parsed.extension}`;
          drawingsFolder?.file(filename, parsed.base64Data, { base64: true });
          mediaCount++;
        }
      });
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

  // Trigger browser download
  const dateStr = new Date().toISOString().slice(0, 10);
  const downloadUrl = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `google-keep-backup-${dateStr}.zip`;
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

      // Count media files in archive
      const mediaFiles = zip.file(/^media\//);
      mediaExtractedCount = mediaFiles.length;
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

  const summaryMessage = `Import completed: ${notesAdded} new notes added, ${notesUpdated} updated with newer changes, ${notesSkipped} unchanged. ${labelsAdded} labels, ${categoriesAdded} categories, and ${sessionsAdded} reading sessions merged.`;

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
