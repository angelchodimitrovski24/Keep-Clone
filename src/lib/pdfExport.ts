import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { Note, Label, Category } from '@/types/note';
import { getUnlockedNote } from './encryptionSession';

export interface PdfExportProgress {
  currentNote: number;
  totalNotes: number;
  status: string;
  stage: 'preparing' | 'rendering' | 'splitting' | 'zipping' | 'completed' | 'error';
}

export interface PdfPart {
  filename: string;
  blob: Blob;
  pageCount: number;
  partNumber: number;
  totalParts: number;
  pageRangeStr: string;
}

export interface PdfExportResult {
  totalNotes: number;
  totalPages: number;
  isSplit: boolean;
  parts: PdfPart[];
  zipBlob?: Blob;
  zipFilename?: string;
}

/**
 * Converts image URL or base64 into a clean base64 data URL and retrieves dimensions
 */
async function resolveImageDimensions(
  src: string
): Promise<{ dataUrl: string; width: number; height: number; format: 'JPEG' | 'PNG' } | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const naturalWidth = img.naturalWidth || img.width || 400;
        const naturalHeight = img.naturalHeight || img.height || 300;

        // If it's already a clean data URL
        if (src.startsWith('data:image/')) {
          const isPng = src.startsWith('data:image/png');
          resolve({
            dataUrl: src,
            width: naturalWidth,
            height: naturalHeight,
            format: isPng ? 'PNG' : 'JPEG',
          });
          return;
        }

        // Otherwise convert URL to canvas data URL
        const canvas = document.createElement('canvas');
        canvas.width = naturalWidth;
        canvas.height = naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve({
            dataUrl,
            width: naturalWidth,
            height: naturalHeight,
            format: 'JPEG',
          });
          return;
        }
      } catch (err) {
        console.warn('Failed to resolve image on canvas:', err);
      }
      resolve(null);
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Strips HTML tags and converts common structures to clean text suitable for NotebookLM
 */
function cleanHtmlContentForPdf(html: string): string {
  if (!html) return '';

  return html
    // Handle headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    // Handle list items
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    // Handle line breaks and paragraphs
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    // Handle table cells
    .replace(/<th[^>]*>(.*?)<\/th>/gi, ' | $1')
    .replace(/<td[^>]*>(.*?)<\/td>/gi, ' | $1')
    .replace(/<\/tr>/gi, ' |\n')
    .replace(/<tr[^>]*>/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Consolidate multiple empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Exports all given notes to one or more PDFs split every 200 pages.
 */
export async function exportNotesToPdf(
  notes: Note[],
  labelsOrOptions?:
    | Label[]
    | {
        categories?: Category[];
        labels?: Label[];
        onProgress?: (progress: PdfExportProgress) => void;
      },
  categories?: Category[],
  onProgressArg?: (progress: PdfExportProgress) => void
): Promise<PdfExportResult> {
  let labelsList: Label[] = [];
  let categoriesList: Category[] = [];
  let onProgress: (progress: PdfExportProgress) => void = () => {};

  if (Array.isArray(labelsOrOptions)) {
    labelsList = labelsOrOptions;
    categoriesList = categories || [];
    onProgress = onProgressArg || (() => {});
  } else if (labelsOrOptions) {
    labelsList = labelsOrOptions.labels || [];
    categoriesList = labelsOrOptions.categories || [];
    onProgress = labelsOrOptions.onProgress || (() => {});
  }

  const categoriesMap = new Map(categoriesList.map((c) => [c.name, c]));

  onProgress({
    currentNote: 0,
    totalNotes: notes.length,
    status: 'Initializing PDF document…',
    stage: 'preparing',
  });

  // A4 Dimensions in millimeters
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 16;
  const marginRight = 16;
  const marginTop = 18;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginLeft - marginRight; // 178mm
  const maxY = pageHeight - marginBottom;

  let currentY = marginTop;

  const addNewPage = () => {
    doc.addPage('a4', 'portrait');
    currentY = marginTop;
  };

  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > maxY) {
      addNewPage();
    }
  };

  // Title Cover Header on First Page
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text('Google Keep Notes', marginLeft, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  const exportDate = new Date().toLocaleDateString(undefined, {
    dateStyle: 'full',
  });
  doc.text(
    `Exported ${notes.length} notes on ${exportDate} • Formatted for NotebookLM`,
    marginLeft,
    currentY
  );
  currentY += 6;

  // Divider line
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.5);
  doc.line(marginLeft, currentY, marginLeft + contentWidth, currentY);
  currentY += 10;

  // Process Each Note Sequentially
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    onProgress({
      currentNote: i + 1,
      totalNotes: notes.length,
      status: `Rendering note ${i + 1} of ${notes.length}: "${(note.title || 'Untitled').slice(0, 30)}"`,
      stage: 'rendering',
    });

    // Check if unlocked encrypted note
    const unlocked = note.isEncrypted ? getUnlockedNote(note.id) : null;
    const noteTitle = (unlocked?.title || note.title || 'Untitled Note').trim();
    const rawContent = unlocked?.content || note.content || '';
    const noteContent = cleanHtmlContentForPdf(rawContent);
    const noteTodos = unlocked?.todos || note.todos || [];
    const noteImages = unlocked?.images || note.images || [];
    const noteDrawings = note.drawings || [];

    // Note Section Header: Title
    ensureSpace(24);

    // Note Card Background Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // Slate-900

    const titleLines = doc.splitTextToSize(noteTitle, contentWidth);
    ensureSpace(titleLines.length * 6 + 12);

    // Number indicator + Title
    doc.text(titleLines, marginLeft, currentY);
    currentY += titleLines.length * 6 + 2;

    // Metadata Bar: Category, Labels, Dates
    const metaParts: string[] = [];
    if (note.category) {
      const catObj = categoriesMap.get(note.category);
      metaParts.push(`Category: ${catObj?.icon || '📁'} ${note.category}`);
    }
    if (note.labels && note.labels.length > 0) {
      metaParts.push(`Tags: ${note.labels.map((l) => `#${l}`).join(' ')}`);
    }
    if (note.updatedAt) {
      metaParts.push(`Updated: ${new Date(note.updatedAt).toLocaleDateString()}`);
    }
    if (note.isEncrypted && !unlocked) {
      metaParts.push(`[AES-256 Encrypted (Locked)]`);
    }

    if (metaParts.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // Slate-500
      const metaText = metaParts.join('  •  ');
      const metaLines = doc.splitTextToSize(metaText, contentWidth);
      doc.text(metaLines, marginLeft, currentY);
      currentY += metaLines.length * 4.5 + 4;
    }

    // Render Text Content
    if (noteContent) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate-700

      const contentLines = doc.splitTextToSize(noteContent, contentWidth);
      for (const line of contentLines) {
        ensureSpace(5.5);
        doc.text(line, marginLeft, currentY);
        currentY += 5;
      }
      currentY += 2;
    }

    // Render Checklist (Todos)
    if (note.isList && noteTodos.length > 0) {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Checklist:', marginLeft, currentY);
      currentY += 5;

      for (const todo of noteTodos) {
        ensureSpace(5.5);
        const checkMark = todo.completed ? '[✓]' : '[  ]';
        doc.setFont('helvetica', todo.completed ? 'normal' : 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(todo.completed ? 148 : 51, todo.completed ? 163 : 65, todo.completed ? 184 : 85);

        const todoText = `${checkMark}  ${todo.text}`;
        const todoLines = doc.splitTextToSize(todoText, contentWidth - 4);
        doc.text(todoLines, marginLeft + 2, currentY);
        currentY += todoLines.length * 5;
      }
      currentY += 2;
    }

    // Render Note Images
    if (noteImages.length > 0) {
      for (let imgIdx = 0; imgIdx < noteImages.length; imgIdx++) {
        const imgSrc = noteImages[imgIdx];
        try {
          const resolved = await resolveImageDimensions(imgSrc);
          if (resolved) {
            // Scale proportionally to max width 160mm, max height 100mm
            const maxW = Math.min(contentWidth, 160);
            const maxH = 100;
            let displayW = maxW;
            let displayH = (resolved.height / resolved.width) * maxW;

            if (displayH > maxH) {
              displayH = maxH;
              displayW = (resolved.width / resolved.height) * maxH;
            }

            ensureSpace(displayH + 8);
            doc.addImage(
              resolved.dataUrl,
              resolved.format,
              marginLeft,
              currentY,
              displayW,
              displayH
            );
            currentY += displayH + 6;
          }
        } catch (err) {
          console.warn(`Failed to embed image ${imgIdx + 1} in PDF:`, err);
        }
      }
    }

    // Render Canvas Drawings
    if (noteDrawings.length > 0) {
      for (let dIdx = 0; dIdx < noteDrawings.length; dIdx++) {
        const drawing = noteDrawings[dIdx];
        if (drawing?.dataUrl) {
          try {
            const resolved = await resolveImageDimensions(drawing.dataUrl);
            if (resolved) {
              const maxW = Math.min(contentWidth, 150);
              const maxH = 80;
              let displayW = maxW;
              let displayH = (resolved.height / resolved.width) * maxW;

              if (displayH > maxH) {
                displayH = maxH;
                displayW = (resolved.width / resolved.height) * maxH;
              }

              ensureSpace(displayH + 8);
              doc.addImage(
                resolved.dataUrl,
                resolved.format,
                marginLeft,
                currentY,
                displayW,
                displayH
              );
              currentY += displayH + 6;
            }
          } catch (err) {
            console.warn(`Failed to embed drawing ${dIdx + 1} in PDF:`, err);
          }
        }
      }
    }

    // Divider between notes
    ensureSpace(12);
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.3);
    doc.line(marginLeft, currentY, marginLeft + contentWidth, currentY);
    currentY += 8;
  }

  // Add Page Numbers in Footer for All Pages
  const totalRawPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalRawPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400

    // Footer: Page X of Y
    const footerText = `Page ${p} of ${totalRawPages} • Keep Notes Export for NotebookLM`;
    doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  const CHUNK_SIZE = 200; // NotebookLM strict maximum page limit

  // If total pages <= 200, return single PDF directly
  if (totalRawPages <= CHUNK_SIZE) {
    onProgress({
      currentNote: notes.length,
      totalNotes: notes.length,
      status: `Finalizing single PDF document (${totalRawPages} pages)…`,
      stage: 'completed',
    });

    const fullBlob = doc.output('blob');
    const filename = `keep_notes_export_${notes.length}_notes_${totalRawPages}pages.pdf`;

    return {
      totalNotes: notes.length,
      totalPages: totalRawPages,
      isSplit: false,
      parts: [
        {
          filename,
          blob: fullBlob,
          pageCount: totalRawPages,
          partNumber: 1,
          totalParts: 1,
          pageRangeStr: `Pages 1–${totalRawPages}`,
        },
      ],
    };
  }

  // If total pages > 200, SPLIT INTO 200-PAGE CHUNKS using pdf-lib!
  onProgress({
    currentNote: notes.length,
    totalNotes: notes.length,
    status: `Document is ${totalRawPages} pages (>200). Splitting into 200-page NotebookLM parts…`,
    stage: 'splitting',
  });

  const fullPdfArrayBuffer = doc.output('arraybuffer');
  const fullPdfDoc = await PDFDocument.load(fullPdfArrayBuffer);
  const totalParts = Math.ceil(totalRawPages / CHUNK_SIZE);
  const parts: PdfPart[] = [];

  for (let i = 0; i < totalRawPages; i += CHUNK_SIZE) {
    const partNumber = Math.floor(i / CHUNK_SIZE) + 1;
    const pageCountInPart = Math.min(CHUNK_SIZE, totalRawPages - i);
    const startPage = i + 1;
    const endPage = i + pageCountInPart;

    onProgress({
      currentNote: notes.length,
      totalNotes: notes.length,
      status: `Generating Part ${partNumber} of ${totalParts} (pages ${startPage}–${endPage})…`,
      stage: 'splitting',
    });

    const subDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: pageCountInPart }, (_, idx) => i + idx);
    const copiedPages = await subDoc.copyPages(fullPdfDoc, pageIndices);
    copiedPages.forEach((p) => subDoc.addPage(p));

    const subBytes = await subDoc.save();
    const filename = `keep_notes_part_${partNumber}_of_${totalParts}_pages_${startPage}-${endPage}.pdf`;
    const blob = new Blob([subBytes as unknown as BlobPart], { type: 'application/pdf' });

    parts.push({
      filename,
      blob,
      pageCount: pageCountInPart,
      partNumber,
      totalParts,
      pageRangeStr: `Pages ${startPage}–${endPage}`,
    });
  }

  // Create a ZIP bundle containing all parts
  onProgress({
    currentNote: notes.length,
    totalNotes: notes.length,
    status: `Bundling all ${totalParts} PDF parts into a ZIP file…`,
    stage: 'zipping',
  });

  const zip = new JSZip();
  parts.forEach((part) => {
    zip.file(part.filename, part.blob);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `keep_notes_pdf_export_${totalRawPages}pages_split_${totalParts}_parts.zip`;

  onProgress({
    currentNote: notes.length,
    totalNotes: notes.length,
    status: `Ready! ${totalRawPages} pages split into ${totalParts} NotebookLM-ready parts.`,
    stage: 'completed',
  });

  return {
    totalNotes: notes.length,
    totalPages: totalRawPages,
    isSplit: true,
    parts,
    zipBlob,
    zipFilename,
  };
}

/**
 * Triggers a browser file download for a blob
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
