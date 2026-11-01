import JSZip from 'jszip';
import { Note, Label, Category } from '@/types/note';
import {
  convertMarkdownToHtml,
  renderMarkdownImagesInString,
  resolveLocalMediaUrl,
} from './formatUtils';
import { renderMarkdownTablesInHtml } from './tableUtils';
import { formatWikiLinksInHtml } from './noteLinks';

export interface WebExportOptions {
  siteTitle?: string;
  notes: Note[];
  categories?: Category[];
  labels?: Label[];
  format?: 'single-html' | 'multi-page-zip';
  embedImages?: boolean;
  includeCategories?: boolean;
  includeLabels?: boolean;
  includeTimestamps?: boolean;
  defaultTheme?: 'light' | 'dark' | 'system';
  onProgress?: (progress: { current: number; total: number; stage: string }) => void;
}

/**
 * Converts image URL, blob, or local path to base64 data URL for 100% offline self-contained HTML
 */
async function imageSrcToBase64(rawSrc: string): Promise<string> {
  if (!rawSrc) return '';
  if (rawSrc.startsWith('data:image/')) return rawSrc;

  const resolved = resolveLocalMediaUrl(rawSrc);
  if (!resolved) return rawSrc;

  try {
    const res = await fetch(resolved);
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve((reader.result as string) || rawSrc);
      };
      reader.onerror = () => resolve(rawSrc);
      reader.readAsDataURL(blob);
    });
  } catch {
    return resolved;
  }
}

/**
 * Pre-processes a note's content:
 * converts Markdown to rich HTML, tables, images, checklists, and optionally embeds images as base64
 */
export async function prepareNoteHtmlContent(
  note: Note,
  embedImages = true
): Promise<string> {
  let content = note.content || '';

  // 1. Checklists: if note is a list, format todos
  if (note.isList && note.todos && note.todos.length > 0) {
    const todoHtml = note.todos
      .map(
        (t) =>
          `<li class="keep-export-task-item ${t.completed ? 'completed' : ''}">
            <input type="checkbox" ${t.completed ? 'checked' : ''} onclick="this.parentElement.classList.toggle('completed', this.checked)" />
            <span class="task-text">${escapeHtml(t.text)}</span>
          </li>`
      )
      .join('');
    content = `${content ? content + '\n\n' : ''}<ul class="keep-export-task-list">${todoHtml}</ul>`;
  }

  // 2. Convert markdown to HTML
  let html = convertMarkdownToHtml(content);
  html = renderMarkdownImagesInString(html);
  html = renderMarkdownTablesInHtml(html);
  html = formatWikiLinksInHtml(html);

  // 3. Drawings
  if (note.drawings && note.drawings.length > 0) {
    const drawingsHtml = note.drawings
      .map(
        (d) =>
          `<div class="keep-export-drawing"><img src="${d.dataUrl}" alt="Drawing attachment" /></div>`
      )
      .join('');
    html += `<div class="keep-export-drawings-grid">${drawingsHtml}</div>`;
  }

  // 4. Standalone Header Images (if any are not already in content)
  if (note.images && note.images.length > 0) {
    const standaloneImages = note.images.filter((img) => {
      const filename = img.split(/[/\\]/).pop() || img;
      return !content.includes(img) && !content.includes(filename);
    });

    if (standaloneImages.length > 0) {
      const imgTags: string[] = [];
      for (const img of standaloneImages) {
        const src = embedImages ? await imageSrcToBase64(img) : resolveLocalMediaUrl(img);
        imgTags.push(`<img src="${src}" alt="Attachment" class="keep-export-img" loading="lazy" />`);
      }
      html = `<div class="keep-export-images-banner">${imgTags.join('')}</div>` + html;
    }
  }

  // 5. Replace any remaining <img src="..."> with base64 if embedImages is true
  if (embedImages && typeof window !== 'undefined') {
    const imgMatches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi));
    for (const match of imgMatches) {
      const origSrc = match[1];
      if (origSrc && !origSrc.startsWith('data:image/')) {
        const b64 = await imageSrcToBase64(origSrc);
        if (b64 && b64 !== origSrc) {
          html = html.split(`src="${origSrc}"`).join(`src="${b64}"`);
        }
      }
    }
  }

  return html;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDateTime(timestamp?: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns complete CSS styling for the exported web page
 */
export function getWebExportStyles(): string {
  return `
    :root {
      --bg-body: #f8fafc;
      --bg-sidebar: #ffffff;
      --bg-card: #ffffff;
      --border-color: #e2e8f0;
      --border-subtle: #f1f5f9;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --text-subtle: #94a3b8;
      --accent: #f59e0b;
      --accent-hover: #d97706;
      --accent-subtle: rgba(245, 158, 11, 0.12);
      --accent-text: #b45309;
      --badge-bg: #f1f5f9;
      --badge-text: #475569;
      --code-bg: #f8fafc;
      --pre-bg: #0f172a;
      --pre-text: #f8fafc;
      --table-stripe: #f8fafc;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    [data-theme="dark"] {
      --bg-body: #090a0f;
      --bg-sidebar: #111318;
      --bg-card: #16181f;
      --border-color: #272a34;
      --border-subtle: #1c1e27;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-subtle: #64748b;
      --accent: #fbbf24;
      --accent-hover: #f59e0b;
      --accent-subtle: rgba(251, 191, 36, 0.15);
      --accent-text: #fde68a;
      --badge-bg: #1e222d;
      --badge-text: #cbd5e1;
      --code-bg: #1e222d;
      --pre-bg: #090a0f;
      --pre-text: #f8fafc;
      --table-stripe: #12141a;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.4);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      height: 100%;
      font-family: var(--font-sans);
      background-color: var(--bg-body);
      color: var(--text-main);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      transition: background-color 0.2s, color 0.2s;
    }

    /* Layout Structure */
    .app-container {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar / Table of Contents */
    .sidebar {
      width: 340px;
      min-width: 280px;
      max-width: 400px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      z-index: 20;
      transition: transform 0.25s ease;
    }

    .sidebar-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--text-main);
      text-decoration: none;
      user-select: none;
    }

    .sidebar-logo-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--accent);
      color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      font-weight: 900;
      box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
    }

    .theme-toggle-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      border-radius: 8px;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.15s;
    }

    .theme-toggle-btn:hover {
      background: var(--badge-bg);
      color: var(--text-main);
    }

    .search-box {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      position: relative;
    }

    .search-input {
      width: 100%;
      padding: 8px 12px 8px 34px;
      font-size: 0.85rem;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background-color: var(--bg-body);
      color: var(--text-main);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    .search-icon {
      position: absolute;
      left: 28px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-subtle);
      pointer-events: none;
      font-size: 0.9rem;
    }

    .filter-chips {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border-color);
      scrollbar-width: none;
    }

    .filter-chips::-webkit-scrollbar {
      display: none;
    }

    .chip-btn {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .chip-btn.active, .chip-btn:hover {
      background: var(--accent-subtle);
      border-color: var(--accent);
      color: var(--accent-text);
    }

    .toc-list-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .toc-item {
      display: block;
      padding: 12px 14px;
      margin-bottom: 4px;
      border-radius: 10px;
      text-decoration: none;
      color: var(--text-main);
      border: 1px solid transparent;
      transition: background-color 0.12s, border-color 0.12s;
      cursor: pointer;
    }

    .toc-item:hover {
      background-color: var(--badge-bg);
    }

    .toc-item.active {
      background-color: var(--accent-subtle);
      border-color: rgba(245, 158, 11, 0.3);
    }

    .toc-item.active .toc-item-title {
      color: var(--accent-text);
      font-weight: 700;
    }

    .toc-item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }

    .toc-item-title {
      font-size: 0.9rem;
      font-weight: 600;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .toc-item-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .toc-item-desc {
      font-size: 0.78rem;
      color: var(--text-muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-top: 4px;
    }

    .category-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 6px;
      background: var(--badge-bg);
      color: var(--badge-text);
    }

    .label-pill {
      display: inline-flex;
      align-items: center;
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--badge-bg);
      color: var(--text-muted);
    }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      font-size: 0.75rem;
      color: var(--text-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Main Viewport & Note Pages */
    .main-viewport {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow-y: auto;
      background-color: var(--bg-body);
      position: relative;
    }

    .top-nav-bar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      backdrop-filter: blur(8px);
    }

    .mobile-menu-btn {
      display: none;
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      align-items: center;
      gap: 6px;
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .breadcrumbs a {
      color: var(--text-muted);
      text-decoration: none;
    }

    .breadcrumbs a:hover {
      color: var(--accent-text);
    }

    .action-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 0.8rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .action-btn:hover {
      background: var(--badge-bg);
      color: var(--text-main);
    }

    /* Note Container (Individual Note Page) */
    .note-content-wrapper {
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
      padding: 36px 28px 80px 28px;
      flex: 1;
    }

    .note-page {
      display: none;
      animation: fadeIn 0.18s ease-in-out;
    }

    .note-page.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Note Header */
    .note-header {
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .note-title {
      font-size: 2.1rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.25;
      color: var(--text-main);
      margin-bottom: 14px;
      word-break: break-word;
    }

    .note-meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .meta-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* Rich Note Body Formatting */
    .note-body {
      font-size: 1.05rem;
      line-height: 1.75;
      color: var(--text-main);
      word-break: break-word;
    }

    .note-body p {
      margin-bottom: 1.1em;
    }

    .note-body h1, .note-body h2, .note-body h3, .note-body h4 {
      color: var(--text-main);
      font-weight: 700;
      line-height: 1.35;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
    }

    .note-body h1 { font-size: 1.65rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    .note-body h2 { font-size: 1.38rem; }
    .note-body h3 { font-size: 1.18rem; }
    .note-body h4 { font-size: 1.05rem; }

    .note-body blockquote {
      border-left: 4px solid var(--accent);
      padding: 8px 16px;
      margin: 1.2em 0;
      background: var(--badge-bg);
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: var(--text-muted);
    }

    .note-body ul, .note-body ol {
      margin-bottom: 1.1em;
      padding-left: 24px;
    }

    .note-body li {
      margin-bottom: 0.3em;
    }

    .note-body code {
      font-family: var(--font-mono);
      font-size: 0.88em;
      background-color: var(--code-bg);
      color: var(--accent-text);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .note-body pre {
      background-color: var(--pre-bg);
      color: var(--pre-text);
      padding: 16px;
      border-radius: 12px;
      overflow-x: auto;
      margin: 1.2em 0;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .note-body pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border: 0;
    }

    /* Tables */
    .note-body table, .note-body .keep-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.4em 0;
      font-size: 0.92rem;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border-color);
    }

    .note-body th {
      background-color: var(--badge-bg);
      font-weight: 700;
      text-align: left;
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      color: var(--text-main);
    }

    .note-body td {
      padding: 8px 14px;
      border: 1px solid var(--border-color);
    }

    .note-body tr:nth-child(even) td {
      background-color: var(--table-stripe);
    }

    /* Checklists */
    .keep-export-task-list {
      list-style: none !important;
      padding-left: 0 !important;
      margin: 1em 0;
    }

    .keep-export-task-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 1rem;
    }

    .keep-export-task-item input[type="checkbox"] {
      margin-top: 5px;
      cursor: pointer;
      accent-color: var(--accent);
      width: 17px;
      height: 17px;
    }

    .keep-export-task-item.completed .task-text {
      text-decoration: line-through;
      color: var(--text-subtle);
    }

    /* Images */
    .keep-export-images-banner {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 10px;
      margin-bottom: 24px;
    }

    .keep-export-img, .note-body img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      margin: 0.8em 0;
      display: block;
      box-shadow: var(--shadow-sm);
    }

    .keep-export-drawings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
      margin: 1.2em 0;
    }

    .keep-export-drawing img {
      width: 100%;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 10px;
    }

    /* Note Footer Navigation */
    .note-footer-nav {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .nav-page-btn {
      display: flex;
      flex-direction: column;
      padding: 12px 18px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      text-decoration: none;
      color: var(--text-main);
      max-width: 48%;
      transition: all 0.15s;
    }

    .nav-page-btn:hover {
      border-color: var(--accent);
      background: var(--accent-subtle);
    }

    .nav-page-btn .nav-direction {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 3px;
    }

    .nav-page-btn .nav-title {
      font-size: 0.9rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: var(--text-muted);
    }

    .empty-state-icon {
      font-size: 3.5rem;
      margin-bottom: 12px;
    }

    /* Print Styles */
    @media print {
      .sidebar, .top-nav-bar, .note-footer-nav, .action-buttons {
        display: none !important;
      }
      .app-container {
        display: block !important;
        height: auto !important;
      }
      .main-viewport {
        overflow: visible !important;
        height: auto !important;
      }
      .note-content-wrapper {
        padding: 0 !important;
        max-width: 100% !important;
      }
      .note-page {
        display: block !important;
        page-break-after: always;
      }
      body {
        background: #fff !important;
        color: #000 !important;
      }
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        transform: translateX(-100%);
        width: 85%;
        max-width: 320px;
        box-shadow: var(--shadow-lg);
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .mobile-menu-btn {
        display: inline-flex;
      }

      .note-content-wrapper {
        padding: 20px 16px 60px 16px;
      }

      .note-title {
        font-size: 1.6rem;
      }

      .sidebar-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        z-index: 15;
      }

      .sidebar-backdrop.open {
        display: block;
      }
    }
  `;
}

/**
 * Generates the complete, standalone offline Interactive HTML Single-File Web Export
 */
export async function generateSinglePageWebExport(
  options: WebExportOptions
): Promise<string> {
  const {
    siteTitle = 'Google Keep Notes Export',
    notes = [],
    categories = [],
    labels = [],
    embedImages = true,
    includeCategories = true,
    includeLabels = true,
    includeTimestamps = true,
    defaultTheme = 'system',
    onProgress,
  } = options;

  const total = notes.length;
  const processedNotes: Array<{
    id: string;
    title: string;
    html: string;
    category?: string | null;
    labels?: string[];
    createdAt?: number;
    updatedAt?: number;
    snippet: string;
    wordCount: number;
  }> = [];

  // Pre-process all notes
  for (let i = 0; i < total; i++) {
    const note = notes[i];
    onProgress?.({
      current: i + 1,
      total,
      stage: `Rendering note ${i + 1} of ${total}: ${note.title || 'Untitled'}`,
    });

    const html = await prepareNoteHtmlContent(note, embedImages);
    const plainText = (note.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const snippet = plainText.slice(0, 160) || (note.isList ? `${note.todos?.length || 0} checklist items` : '');

    processedNotes.push({
      id: note.id,
      title: note.title || 'Untitled Note',
      html,
      category: note.category,
      labels: note.labels,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      snippet,
      wordCount,
    });
  }

  // Extract unique categories & labels present in selected notes
  const usedCategories = Array.from(
    new Set(processedNotes.map((n) => n.category).filter(Boolean))
  ) as string[];
  const usedLabels = Array.from(
    new Set(processedNotes.flatMap((n) => n.labels || []).filter(Boolean))
  ) as string[];

  // Build Table of Contents list items HTML
  const tocItemsHtml = processedNotes
    .map((note, index) => {
      const catBadge =
        includeCategories && note.category
          ? `<span class="category-badge">📁 ${escapeHtml(note.category)}</span>`
          : '';
      const dateStr = includeTimestamps && note.updatedAt ? formatDate(note.updatedAt) : '';

      return `
        <a class="toc-item ${index === 0 ? 'active' : ''}" 
           data-note-id="${note.id}" 
           data-index="${index}"
           data-category="${escapeHtml(note.category || '')}"
           data-labels="${escapeHtml((note.labels || []).join(' '))}"
           href="#note-${note.id}"
           onclick="selectNotePage('${note.id}'); return false;">
          <div class="toc-item-header">
            <span class="toc-item-title">${escapeHtml(note.title)}</span>
            ${catBadge}
          </div>
          <div class="toc-item-meta">
            ${dateStr ? `<span>${dateStr}</span>` : ''}
            <span>• ${note.wordCount} words</span>
          </div>
          ${note.snippet ? `<div class="toc-item-desc">${escapeHtml(note.snippet)}</div>` : ''}
        </a>
      `;
    })
    .join('\n');

  // Build Note Pages HTML
  const notePagesHtml = processedNotes
    .map((note, index) => {
      const prevNote = index > 0 ? processedNotes[index - 1] : null;
      const nextNote = index < processedNotes.length - 1 ? processedNotes[index + 1] : null;

      const catBadge =
        includeCategories && note.category
          ? `<span class="category-badge">📁 ${escapeHtml(note.category)}</span>`
          : '';

      const labelsHtml =
        includeLabels && note.labels && note.labels.length > 0
          ? note.labels
              .map((l) => `<span class="label-pill">#${escapeHtml(l)}</span>`)
              .join(' ')
          : '';

      const createdDateStr = includeTimestamps && note.createdAt ? formatFullDateTime(note.createdAt) : '';
      const updatedDateStr = includeTimestamps && note.updatedAt ? formatFullDateTime(note.updatedAt) : '';

      const prevBtn = prevNote
        ? `
        <a class="nav-page-btn" href="#note-${prevNote.id}" onclick="selectNotePage('${prevNote.id}'); return false;">
          <span class="nav-direction">← Previous Note</span>
          <span class="nav-title">${escapeHtml(prevNote.title)}</span>
        </a>
      `
        : `<div></div>`;

      const nextBtn = nextNote
        ? `
        <a class="nav-page-btn" style="text-align: right;" href="#note-${nextNote.id}" onclick="selectNotePage('${nextNote.id}'); return false;">
          <span class="nav-direction">Next Note →</span>
          <span class="nav-title">${escapeHtml(nextNote.title)}</span>
        </a>
      `
        : `<div></div>`;

      return `
        <div id="note-${note.id}" class="note-page ${index === 0 ? 'active' : ''}" data-note-id="${note.id}">
          <div class="note-header">
            <h1 class="note-title">${escapeHtml(note.title)}</h1>
            <div class="note-meta-bar">
              ${catBadge}
              ${labelsHtml}
              ${createdDateStr ? `<span class="meta-group">📅 Created: ${createdDateStr}</span>` : ''}
              ${updatedDateStr ? `<span class="meta-group">• Edited: ${updatedDateStr}</span>` : ''}
              <span class="meta-group">• ${note.wordCount} words (~${Math.max(1, Math.ceil(note.wordCount / 200))} min read)</span>
            </div>
          </div>
          <div class="note-body">
            ${note.html || '<p><em>(Empty note)</em></p>'}
          </div>
          <div class="note-footer-nav">
            ${prevBtn}
            ${nextBtn}
          </div>
        </div>
      `;
    })
    .join('\n');

  // Category filter chips HTML
  const categoryChipsHtml = usedCategories.length > 0
    ? `<button class="chip-btn active" onclick="filterByCategory('all', this)">All</button>` +
      usedCategories
        .map((c) => `<button class="chip-btn" onclick="filterByCategory('${escapeHtml(c)}', this)">📁 ${escapeHtml(c)}</button>`)
        .join('')
    : '';

  // Embedded JavaScript for Navigation, Realtime Search, Theme Toggle, and Keyboard Shortcuts
  const clientScript = `
    let activeNoteId = '${processedNotes[0]?.id || ''}';
    let currentCategoryFilter = 'all';

    function initTheme() {
      const saved = localStorage.getItem('keep_export_theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = saved || ('${defaultTheme}' === 'dark' || ('${defaultTheme}' === 'system' && prefersDark) ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      updateThemeButtonIcon(theme);
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('keep_export_theme', next);
      updateThemeButtonIcon(next);
    }

    function updateThemeButtonIcon(theme) {
      const btn = document.getElementById('themeToggleBtn');
      if (btn) {
        btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode';
      }
    }

    function selectNotePage(noteId) {
      if (!noteId) return;
      activeNoteId = noteId;

      // Update pages
      document.querySelectorAll('.note-page').forEach(page => {
        page.classList.toggle('active', page.getAttribute('data-note-id') === noteId);
      });

      // Update TOC sidebar active state
      document.querySelectorAll('.toc-item').forEach(item => {
        const isTarget = item.getAttribute('data-note-id') === noteId;
        item.classList.toggle('active', isTarget);
        if (isTarget) {
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          const title = item.querySelector('.toc-item-title')?.textContent || 'Note';
          document.getElementById('breadcrumbTitle').textContent = title;
          document.title = title + ' - ' + '${escapeHtml(siteTitle)}';
        }
      });

      // Update URL hash
      if (window.location.hash !== '#note-' + noteId) {
        window.history.pushState(null, '', '#note-' + noteId);
      }

      // Scroll viewport to top
      const viewport = document.getElementById('mainViewport');
      if (viewport) viewport.scrollTop = 0;

      // Close mobile sidebar if open
      toggleMobileSidebar(false);
    }

    function filterNotes() {
      const query = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
      const items = document.querySelectorAll('.toc-item');
      let visibleCount = 0;

      items.forEach(item => {
        const title = (item.querySelector('.toc-item-title')?.textContent || '').toLowerCase();
        const desc = (item.querySelector('.toc-item-desc')?.textContent || '').toLowerCase();
        const category = (item.getAttribute('data-category') || '').toLowerCase();
        const labels = (item.getAttribute('data-labels') || '').toLowerCase();

        const matchesQuery = !query || title.includes(query) || desc.includes(query) || labels.includes(query) || category.includes(query);
        const matchesCategory = currentCategoryFilter === 'all' || category === currentCategoryFilter.toLowerCase();

        if (matchesQuery && matchesCategory) {
          item.style.display = 'block';
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
      });

      const countEl = document.getElementById('filteredCount');
      if (countEl) countEl.textContent = visibleCount + ' notes';
    }

    function filterByCategory(cat, btn) {
      currentCategoryFilter = cat;
      document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      filterNotes();
    }

    function toggleMobileSidebar(force) {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (!sidebar) return;
      const isOpen = force !== undefined ? force : !sidebar.classList.contains('open');
      sidebar.classList.toggle('open', isOpen);
      if (backdrop) backdrop.classList.toggle('open', isOpen);
    }

    function copyNoteContent() {
      const activePage = document.querySelector('.note-page.active');
      if (!activePage) return;
      const title = activePage.querySelector('.note-title')?.textContent || '';
      const body = activePage.querySelector('.note-body')?.innerText || '';
      const text = title + '\\n\\n' + body;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copyBtn');
        if (btn) {
          const original = btn.innerHTML;
          btn.innerHTML = '✓ Copied!';
          setTimeout(() => btn.innerHTML = original, 2000);
        }
      });
    }

    // Hash navigation listener
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#note-')) {
        const id = hash.replace('#note-', '');
        selectNotePage(id);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
      } else if (e.key === '[' || e.key === 'p') {
        const prev = document.querySelector('.note-page.active .nav-page-btn');
        if (prev && prev.getAttribute('href')) prev.click();
      } else if (e.key === ']' || e.key === 'n') {
        const next = document.querySelector('.note-page.active .note-footer-nav .nav-page-btn:last-child');
        if (next && next.getAttribute('href')) next.click();
      }
    });

    // On Load Initializer
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      const hash = window.location.hash;
      if (hash && hash.startsWith('#note-')) {
        const id = hash.replace('#note-', '');
        selectNotePage(id);
      } else if (activeNoteId) {
        selectNotePage(activeNoteId);
      }
    });
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(siteTitle)}</title>
  <style>
    ${getWebExportStyles()}
  </style>
</head>
<body>
  <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleMobileSidebar(false)"></div>
  
  <div class="app-container">
    <!-- Sidebar: Table of Contents -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <a href="#" class="sidebar-logo" onclick="window.scrollTo({top:0}); return false;">
          <div class="sidebar-logo-icon">💡</div>
          <span>${escapeHtml(siteTitle)}</span>
        </a>
        <button id="themeToggleBtn" class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">🌙</button>
      </div>

      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" class="search-input" placeholder="Search notes... (/ to focus)" oninput="filterNotes()" />
      </div>

      ${categoryChipsHtml ? `<div class="filter-chips">${categoryChipsHtml}</div>` : ''}

      <div class="toc-list-container">
        ${tocItemsHtml}
      </div>

      <div class="sidebar-footer">
        <span id="filteredCount">${total} notes</span>
        <span>Offline Web Export</span>
      </div>
    </aside>

    <!-- Main Viewport: Dedicated Note Pages -->
    <main class="main-viewport" id="mainViewport">
      <div class="top-nav-bar">
        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="mobile-menu-btn" onclick="toggleMobileSidebar(true)">
            <span>☰</span>
            <span>Contents</span>
          </button>
          <div class="breadcrumbs">
            <span>🏠 Notes</span>
            <span>/</span>
            <span id="breadcrumbTitle" style="font-weight: 600; color: var(--text-main);">${escapeHtml(processedNotes[0]?.title || 'Note')}</span>
          </div>
        </div>

        <div class="action-buttons">
          <button id="copyBtn" class="action-btn" onclick="copyNoteContent()" title="Copy note text">📋 Copy</button>
          <button class="action-btn" onclick="window.print()" title="Print current note">🖨️ Print</button>
        </div>
      </div>

      <div class="note-content-wrapper">
        ${notePagesHtml}
      </div>
    </main>
  </div>

  <script>
    ${clientScript}
  </script>
</body>
</html>`;
}

/**
 * Generates a Multi-Page Web Site packaged into a ZIP archive:
 * - index.html (Table of Contents index)
 * - notes/note-1.html, notes/note-2.html, ...
 * - assets/style.css
 */
export async function generateMultiPageWebExportZip(
  options: WebExportOptions
): Promise<Blob> {
  const {
    siteTitle = 'Google Keep Notes Export',
    notes = [],
    embedImages = true,
    includeCategories = true,
    includeLabels = true,
    includeTimestamps = true,
    onProgress,
  } = options;

  const zip = new JSZip();
  const total = notes.length;
  const processedNotes: Array<{
    id: string;
    filename: string;
    title: string;
    html: string;
    category?: string | null;
    labels?: string[];
    createdAt?: number;
    updatedAt?: number;
    snippet: string;
    wordCount: number;
  }> = [];

  // Add shared stylesheet
  zip.file('assets/style.css', getWebExportStyles());

  // Render all note pages
  for (let i = 0; i < total; i++) {
    const note = notes[i];
    onProgress?.({
      current: i + 1,
      total,
      stage: `Building page ${i + 1} of ${total}: ${note.title || 'Untitled'}`,
    });

    const html = await prepareNoteHtmlContent(note, embedImages);
    const plainText = (note.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const snippet = plainText.slice(0, 160) || '';
    const safeTitle = (note.title || `note-${i + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `note-${i + 1}`;
    const filename = `${i + 1}-${safeTitle}.html`;

    processedNotes.push({
      id: note.id,
      filename,
      title: note.title || 'Untitled Note',
      html,
      category: note.category,
      labels: note.labels,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      snippet,
      wordCount,
    });
  }

  // Generate each note's separate HTML file in notes/
  for (let i = 0; i < processedNotes.length; i++) {
    const note = processedNotes[i];
    const prev = i > 0 ? processedNotes[i - 1] : null;
    const next = i < processedNotes.length - 1 ? processedNotes[i + 1] : null;

    const catBadge =
      includeCategories && note.category
        ? `<span class="category-badge">📁 ${escapeHtml(note.category)}</span>`
        : '';
    const labelsHtml =
      includeLabels && note.labels && note.labels.length > 0
        ? note.labels.map((l) => `<span class="label-pill">#${escapeHtml(l)}</span>`).join(' ')
        : '';

    const createdDateStr = includeTimestamps && note.createdAt ? formatFullDateTime(note.createdAt) : '';
    const updatedDateStr = includeTimestamps && note.updatedAt ? formatFullDateTime(note.updatedAt) : '';

    const prevBtn = prev
      ? `<a class="nav-page-btn" href="${prev.filename}"><span class="nav-direction">← Previous</span><span class="nav-title">${escapeHtml(prev.title)}</span></a>`
      : '<div></div>';
    const nextBtn = next
      ? `<a class="nav-page-btn" style="text-align: right;" href="${next.filename}"><span class="nav-direction">Next →</span><span class="nav-title">${escapeHtml(next.title)}</span></a>`
      : '<div></div>';

    const notePageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(note.title)} - ${escapeHtml(siteTitle)}</title>
  <link rel="stylesheet" href="../assets/style.css">
</head>
<body>
  <div style="max-width: 860px; margin: 0 auto; padding: 24px 20px 80px 20px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
      <a href="../index.html" style="text-decoration: none; font-weight: 700; color: var(--accent-text); display: inline-flex; align-items: center; gap: 6px;">
        <span>← All Notes (Index)</span>
      </a>
      <button onclick="window.print()" class="action-btn" style="cursor: pointer;">🖨️ Print Note</button>
    </div>

    <div class="note-header">
      <h1 class="note-title">${escapeHtml(note.title)}</h1>
      <div class="note-meta-bar">
        ${catBadge}
        ${labelsHtml}
        ${createdDateStr ? `<span class="meta-group">📅 Created: ${createdDateStr}</span>` : ''}
        ${updatedDateStr ? `<span class="meta-group">• Edited: ${updatedDateStr}</span>` : ''}
        <span class="meta-group">• ${note.wordCount} words</span>
      </div>
    </div>

    <div class="note-body">
      ${note.html || '<p><em>(Empty note)</em></p>'}
    </div>

    <div class="note-footer-nav" style="margin-top: 48px;">
      ${prevBtn}
      ${nextBtn}
    </div>
  </div>
</body>
</html>`;

    zip.file(`notes/${note.filename}`, notePageHtml);
  }

  // Generate index.html (Table of Contents Home Page)
  const indexCardsHtml = processedNotes
    .map(
      (n) => `
      <a href="notes/${n.filename}" class="toc-item" style="border: 1px solid var(--border-color); margin-bottom: 10px; background: var(--bg-card);">
        <div class="toc-item-header">
          <span class="toc-item-title" style="font-size: 1.05rem;">${escapeHtml(n.title)}</span>
          ${n.category ? `<span class="category-badge">📁 ${escapeHtml(n.category)}</span>` : ''}
        </div>
        <div class="toc-item-meta" style="margin-bottom: 6px;">
          ${n.updatedAt ? `<span>${formatDate(n.updatedAt)}</span>` : ''}
          <span>• ${n.wordCount} words</span>
        </div>
        ${n.snippet ? `<div class="toc-item-desc">${escapeHtml(n.snippet)}</div>` : ''}
      </a>
    `
    )
    .join('\n');

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(siteTitle)} - Table of Contents</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <div style="max-width: 860px; margin: 0 auto; padding: 40px 20px 80px 20px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="sidebar-logo-icon">💡</div>
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 800;">${escapeHtml(siteTitle)}</h1>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${total} Notes Exported</p>
        </div>
      </div>
      <button onclick="window.print()" class="action-btn" style="cursor: pointer;">🖨️ Print Index</button>
    </div>

    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 12px;">Table of Contents</h2>
      <div style="display: flex; flex-direction: column;">
        ${indexCardsHtml}
      </div>
    </div>
  </div>
</body>
</html>`;

  zip.file('index.html', indexHtml);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Triggers a browser file download for a blob or text content
 */
export function triggerFileDownload(content: Blob | string, filename: string, mimeType = 'text/html') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
