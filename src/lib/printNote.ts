import { Note, Category } from '@/types/note';
import { resolveLocalMediaUrl, renderMarkdownImagesInString } from './formatUtils';
import { renderMarkdownTablesInHtml } from './tableUtils';

/**
 * Generates clean, printer-friendly HTML and opens the browser print dialog
 * in a dedicated hidden iframe so that only the note is printed.
 */
export function printNote(note: Partial<Note>, categories: Category[] = []): void {
  if (typeof window === 'undefined') return;

  const categoryObj = categories.find((c) => c.name === note.category);
  const formattedDate = note.updatedAt
    ? new Date(note.updatedAt).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // Process HTML/Markdown content
  let bodyHtml = '';
  if (note.isList && note.todos && note.todos.length > 0) {
    const listItems = note.todos
      .map(
        (t) => `
        <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; list-style: none;">
          <input type="checkbox" ${t.completed ? 'checked' : ''} disabled style="margin-top: 3px;" />
          <span style="${t.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHtml(t.text)}</span>
        </li>
      `
      )
      .join('');
    bodyHtml = `<ul style="padding-left: 0; margin: 12px 0;">${listItems}</ul>`;
  } else if (note.content) {
    let content = note.content;
    content = renderMarkdownImagesInString(content);
    content = renderMarkdownTablesInHtml(content);
    bodyHtml = `<div class="note-body-content">${content}</div>`;
  }

  // Attached images
  let imagesHtml = '';
  if (note.images && note.images.length > 0) {
    const imgTags = note.images
      .map(
        (img) => `
        <div style="page-break-inside: avoid; margin-bottom: 12px;">
          <img src="${resolveLocalMediaUrl(img)}" alt="Attachment" style="max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 6px; border: 1px solid #e5e7eb;" />
        </div>
      `
      )
      .join('');
    imagesHtml = `<div style="margin: 16px 0;">${imgTags}</div>`;
  }

  // Drawings
  let drawingsHtml = '';
  if (note.drawings && note.drawings.length > 0) {
    const drawTags = note.drawings
      .map(
        (d) => `
        <div style="page-break-inside: avoid; margin-bottom: 12px;">
          <img src="${d.dataUrl}" alt="Drawing" style="max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 6px; border: 1px solid #e5e7eb;" />
        </div>
      `
      )
      .join('');
    drawingsHtml = `<div style="margin: 16px 0;">${drawTags}</div>`;
  }

  const printDocumentHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(note.title || 'Note')}</title>
      <style>
        @page {
          size: auto;
          margin: 1.5cm;
        }
        *, *::before, *::after {
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111827;
          background: #ffffff;
          line-height: 1.6;
          font-size: 14px;
          margin: 0;
          padding: 0;
        }
        h1.note-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #111827;
          line-height: 1.3;
        }
        .note-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 18px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          background-color: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }
        .note-body-content p {
          margin: 0 0 10px 0;
        }
        pre, code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        code {
          background-color: #f3f4f6;
          color: #be123c;
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 0.9em;
        }
        pre {
          background: #f8fafc;
          color: #0f172a;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          overflow-x: auto;
          line-height: 1.5;
          margin: 12px 0;
          page-break-inside: avoid;
          white-space: pre-wrap;
          word-break: break-word;
        }
        pre code {
          background: transparent !important;
          color: inherit !important;
          padding: 0 !important;
          border: none !important;
        }
        blockquote {
          border-left: 3px solid #f59e0b;
          margin: 12px 0;
          padding-left: 12px;
          color: #4b5563;
          font-style: italic;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 14px 0;
          font-size: 13px;
          page-break-inside: avoid;
        }
        table th, table td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          text-align: left;
        }
        table th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        .footer-brand {
          margin-top: 32px;
          padding-top: 12px;
          border-top: 1px dashed #e5e7eb;
          font-size: 11px;
          color: #9ca3af;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
      </style>
    </head>
    <body>
      <article>
        ${note.title ? `<h1 class="note-title">${escapeHtml(note.title)}</h1>` : ''}
        <div class="note-meta">
          ${formattedDate ? `<span>Last edited: ${formattedDate}</span>` : ''}
          ${
            note.category
              ? `<span class="badge" style="background-color: ${categoryObj?.color ? `${categoryObj.color}15` : '#eff6ff'}; color: ${categoryObj?.color || '#2563eb'}; border-color: ${categoryObj?.color ? `${categoryObj.color}40` : '#bfdbfe'};">
                  <span>${categoryObj?.icon || '📁'}</span>
                  <span>${escapeHtml(note.category)}</span>
                </span>`
              : ''
          }
          ${
            note.labels && note.labels.length > 0
              ? note.labels
                  .map((lbl) => `<span class="badge">#${escapeHtml(lbl)}</span>`)
                  .join(' ')
              : ''
          }
          ${
            note.reminder
              ? `<span class="badge" style="color: #b45309; background-color: #fef3c7; border-color: #fde68a;">⏰ ${new Date(note.reminder).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`
              : ''
          }
        </div>
        ${imagesHtml}
        ${drawingsHtml}
        ${bodyHtml}
        <div class="footer-brand">
          <span>Printed from Google Keep Clone</span>
          <span>${new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        </div>
      </article>
    </body>
    </html>
  `;

  // Create temporary iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(printDocumentHtml);
  doc.close();

  // Wait for images in iframe to load, then trigger print
  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 1000);
    }
  };

  // Check if document or images need loading
  const images = doc.images;
  if (images.length === 0) {
    setTimeout(triggerPrint, 150);
  } else {
    let loadedCount = 0;
    const totalImages = images.length;
    const onImgDone = () => {
      loadedCount++;
      if (loadedCount >= totalImages) {
        triggerPrint();
      }
    };
    for (let i = 0; i < totalImages; i++) {
      const img = images[i];
      if (img.complete) {
        onImgDone();
      } else {
        img.onload = onImgDone;
        img.onerror = onImgDone;
      }
    }
    // Fallback timer if an image hangs
    setTimeout(triggerPrint, 1200);
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
