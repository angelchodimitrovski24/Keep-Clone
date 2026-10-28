/**
 * MHTML (MIME HTML / Webpage Single File) Parser
 * Extracts HTML content, quoted-printable text, and embedded base64 images
 * into clean Markdown and rich Note assets for Google Keep Clone.
 */

import { convertHtmlToMarkdown, convertMarkdownToHtml } from './formatUtils';
import { saveMediaToDB } from './db';
import { registerMediaBlobUrl } from './localPaste';

export interface MhtmlImage {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  blob: Blob;
  size: number;
  contentLocation?: string;
  contentId?: string;
}

export interface MhtmlParsedResult {
  title: string;
  markdownContent: string;
  htmlContent: string;
  sourceUrl?: string;
  date?: string;
  images: MhtmlImage[];
}

/**
 * Robust Quoted-Printable decoder that handles multi-byte UTF-8, Windows-1252, and ISO-8859-1
 */
export function decodeQuotedPrintable(input: string, charset = 'utf-8'): string {
  if (!input) return '';

  // 1. Remove soft line breaks (= immediately followed by CRLF or LF)
  const noSoftBreaks = input.replace(/=\r?\n/g, '');

  // 2. Collect raw byte values
  const bytes: number[] = [];
  for (let i = 0; i < noSoftBreaks.length; i++) {
    const char = noSoftBreaks[i];
    if (
      char === '=' &&
      i + 2 < noSoftBreaks.length &&
      /[0-9A-Fa-f]{2}/.test(noSoftBreaks.substring(i + 1, i + 3))
    ) {
      bytes.push(parseInt(noSoftBreaks.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(char.charCodeAt(0) & 0xff);
    }
  }

  // 3. Decode bytes using TextDecoder
  try {
    const cleanCharset = (charset || 'utf-8').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'utf-8';
    const decoder = new TextDecoder(cleanCharset);
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
}

/**
 * Decodes base64 text into a string with charset decoding
 */
export function decodeBase64Text(base64: string, charset = 'utf-8'): string {
  if (!base64) return '';
  const cleanB64 = base64.replace(/[\r\n\s]+/g, '');
  try {
    const binaryStr = atob(cleanB64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const cleanCharset = (charset || 'utf-8').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'utf-8';
    return new TextDecoder(cleanCharset).decode(bytes);
  } catch (err) {
    console.warn('Failed decoding base64 text:', err);
    return '';
  }
}

/**
 * Converts a base64 string to a Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const cleanB64 = base64.replace(/[\r\n\s]+/g, '');
  try {
    const binaryStr = atob(cleanB64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return new Blob([], { type: mimeType });
  }
}

/**
 * Extracts header parameter by name (e.g. charset="utf-8" or boundary="---")
 */
function getHeaderParam(headerVal: string, paramName: string): string | undefined {
  if (!headerVal) return undefined;
  const regex = new RegExp(`${paramName}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^;\\s\\r\\n]+))`, 'i');
  const match = headerVal.match(regex);
  return match ? (match[1] || match[2] || match[3]) : undefined;
}

/**
 * Unfolds multi-line MIME headers
 */
function unfoldHeaders(headersStr: string): string {
  return headersStr.replace(/\r?\n[ \t]+/g, ' ');
}

/**
 * Parses MIME headers block into a lowercase Map
 */
function parseHeaders(headersStr: string): Map<string, string> {
  const headers = new Map<string, string>();
  const unfolded = unfoldHeaders(headersStr);
  const lines = unfolded.split(/\r?\n/);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const val = line.slice(colonIndex + 1).trim();
      headers.set(key, val);
    }
  }

  return headers;
}

/**
 * Parses an MHTML file or string and extracts markdown content, title, and images.
 */
export async function parseMhtmlFile(
  fileOrText: File | string,
  fallbackTitle?: string
): Promise<MhtmlParsedResult> {
  let content = '';
  let defaultTitle = fallbackTitle || 'Imported Webpage';

  if (typeof fileOrText === 'string') {
    content = fileOrText;
  } else {
    defaultTitle = fileOrText.name.replace(/\.(mhtml|mht)$/i, '') || defaultTitle;
    content = await fileOrText.text();
  }

  // 1. Detect Snapshot-Content-Location or Subject from preamble headers
  let sourceUrl: string | undefined;
  let snapshotDate: string | undefined;

  const snapshotLocationMatch = content.match(/Snapshot-Content-Location:\s*([^\r\n]+)/i);
  if (snapshotLocationMatch && snapshotLocationMatch[1]) {
    sourceUrl = snapshotLocationMatch[1].trim();
  }

  const dateMatch = content.match(/^Date:\s*([^\r\n]+)/im);
  if (dateMatch && dateMatch[1]) {
    snapshotDate = dateMatch[1].trim();
  }

  // 2. Find Multipart Boundary
  let boundary: string | undefined;
  const boundaryMatch = content.match(/boundary\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s\r\n]+))/i);
  if (boundaryMatch) {
    boundary = boundaryMatch[1] || boundaryMatch[2] || boundaryMatch[3];
  }

  if (!boundary) {
    // Fallback: look for boundary-like lines starting with --
    const firstLines = content.slice(0, 4000).split(/\r?\n/);
    for (const line of firstLines) {
      if (line.startsWith('--') && line.length > 8 && !line.endsWith('--')) {
        boundary = line.substring(2).trim();
        break;
      }
    }
  }

  if (!boundary) {
    throw new Error('Invalid MHTML file: Multipart boundary delimiter not found.');
  }

  // 3. Split into parts by boundary delimiter
  const boundaryDelimiter = '--' + boundary;
  const rawParts = content.split(boundaryDelimiter);

  interface RawPart {
    headers: Map<string, string>;
    body: string;
  }

  const parsedParts: RawPart[] = [];

  for (let i = 1; i < rawParts.length; i++) {
    const rawPart = rawParts[i];
    // Check if end boundary (--boundary--)
    if (rawPart.trim().startsWith('--') || rawPart.trim() === '--') {
      continue;
    }

    // Split headers and body at first blank line
    const headerEndIndex = rawPart.search(/\r?\n\r?\n/);
    if (headerEndIndex === -1) continue;

    const headersStr = rawPart.substring(0, headerEndIndex);
    const bodyStr = rawPart.substring(headerEndIndex).replace(/^[\r\n]+/, '');

    const headers = parseHeaders(headersStr);
    parsedParts.push({ headers, body: bodyStr });
  }

  // 4. Locate Primary HTML Part and Image Assets
  let htmlPart: RawPart | null = null;
  const imageParts: {
    raw: RawPart;
    mimeType: string;
    charset?: string;
    encoding: string;
    location?: string;
    contentId?: string;
    fileName: string;
  }[] = [];

  for (const part of parsedParts) {
    const contentType = part.headers.get('content-type') || '';
    const encoding = (part.headers.get('content-transfer-encoding') || '7bit').toLowerCase().trim();
    const location = part.headers.get('content-location');
    const contentId = (part.headers.get('content-id') || '').replace(/^<|>$/g, '').trim();
    const disposition = part.headers.get('content-disposition') || '';

    // File name determination
    let fileName =
      getHeaderParam(disposition, 'filename') ||
      getHeaderParam(contentType, 'name') ||
      '';

    if (!fileName && location) {
      try {
        const urlObj = new URL(location, 'http://localhost');
        const lastSeg = urlObj.pathname.split('/').filter(Boolean).pop();
        if (lastSeg && lastSeg.includes('.')) {
          fileName = decodeURIComponent(lastSeg);
        }
      } catch {
        const lastSeg = location.split('/').filter(Boolean).pop();
        if (lastSeg && lastSeg.includes('.')) {
          fileName = lastSeg.split('?')[0];
        }
      }
    }

    if (contentType.toLowerCase().includes('text/html') && !htmlPart) {
      htmlPart = part;
    } else if (contentType.toLowerCase().startsWith('image/')) {
      const mimeType = contentType.split(';')[0].trim().toLowerCase();
      const ext = mimeType.replace('image/', '').replace('+xml', '');
      if (!fileName) {
        fileName = `mhtml-img-${imageParts.length + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
      }
      imageParts.push({
        raw: part,
        mimeType,
        encoding,
        location,
        contentId: contentId || undefined,
        fileName,
      });
    }
  }

  // Fallback: if no text/html explicitly labeled, pick the largest text part
  if (!htmlPart && parsedParts.length > 0) {
    htmlPart = parsedParts[0];
  }

  if (!htmlPart) {
    throw new Error('No readable HTML document found inside MHTML archive.');
  }

  // 5. Decode Primary HTML Part
  const htmlContentType = htmlPart.headers.get('content-type') || 'text/html; charset=utf-8';
  const htmlCharset = getHeaderParam(htmlContentType, 'charset') || 'utf-8';
  const htmlEncoding = (htmlPart.headers.get('content-transfer-encoding') || '7bit').toLowerCase().trim();

  let decodedHtml = '';
  if (htmlEncoding === 'quoted-printable') {
    decodedHtml = decodeQuotedPrintable(htmlPart.body, htmlCharset);
  } else if (htmlEncoding === 'base64') {
    decodedHtml = decodeBase64Text(htmlPart.body, htmlCharset);
  } else {
    decodedHtml = htmlPart.body;
  }

  // 6. Decode Images and Build Mapping
  const extractedImages: MhtmlImage[] = [];
  const imageKeyToDataUrl = new Map<string, string>();

  for (let i = 0; i < imageParts.length; i++) {
    const item = imageParts[i];
    let dataUrl = '';
    let blob: Blob;

    if (item.encoding === 'base64') {
      const cleanB64 = item.raw.body.replace(/[\r\n\s]+/g, '');
      dataUrl = `data:${item.mimeType};base64,${cleanB64}`;
      blob = base64ToBlob(cleanB64, item.mimeType);
    } else if (item.encoding === 'quoted-printable') {
      const decodedText = decodeQuotedPrintable(item.raw.body);
      blob = new Blob([decodedText], { type: item.mimeType });
      dataUrl = `data:${item.mimeType};base64,${btoa(decodedText)}`;
    } else {
      blob = new Blob([item.raw.body], { type: item.mimeType });
      dataUrl = `data:${item.mimeType};base64,${btoa(item.raw.body)}`;
    }

    const mhtmlImg: MhtmlImage = {
      id: `mhtml-img-${Date.now()}-${i + 1}`,
      fileName: item.fileName,
      mimeType: item.mimeType,
      dataUrl,
      blob,
      size: blob.size,
      contentLocation: item.location,
      contentId: item.contentId,
    };

    extractedImages.push(mhtmlImg);

    // Register mapping aliases
    if (item.contentId) {
      imageKeyToDataUrl.set(`cid:${item.contentId}`, dataUrl);
      imageKeyToDataUrl.set(item.contentId, dataUrl);
    }
    if (item.location) {
      imageKeyToDataUrl.set(item.location, dataUrl);
      try {
        const parsedUrl = new URL(item.location, 'http://localhost');
        imageKeyToDataUrl.set(parsedUrl.pathname, dataUrl);
        const fileName = parsedUrl.pathname.split('/').filter(Boolean).pop();
        if (fileName) {
          imageKeyToDataUrl.set(fileName, dataUrl);
        }
      } catch {
        const fileName = item.location.split('/').filter(Boolean).pop();
        if (fileName) {
          imageKeyToDataUrl.set(fileName, dataUrl);
        }
      }
    }
    if (item.fileName) {
      imageKeyToDataUrl.set(item.fileName, dataUrl);
    }
  }

  // 7. Extract Note Title
  let noteTitle = defaultTitle;

  const titleTagMatch = decodedHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTagMatch && titleTagMatch[1]) {
    const cleanTitle = titleTagMatch[1].replace(/<[^>]+>/g, '').trim();
    if (cleanTitle) {
      noteTitle = cleanTitle;
    }
  } else {
    const ogTitleMatch = decodedHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      noteTitle = ogTitleMatch[1].trim();
    } else {
      const h1Match = decodedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        const cleanH1 = h1Match[1].replace(/<[^>]+>/g, '').trim();
        if (cleanH1) {
          noteTitle = cleanH1;
        }
      }
    }
  }

  // Decode common HTML entities in title
  noteTitle = noteTitle
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

  // 8. Replace image sources in HTML with decoded data URLs
  let htmlWithResolvedImages = decodedHtml;

  // Replace src="..."
  htmlWithResolvedImages = htmlWithResolvedImages.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      const resolved = imageKeyToDataUrl.get(src) || imageKeyToDataUrl.get(decodeURIComponent(src));
      if (resolved) {
        return `<img${before} src="${resolved}"${after}>`;
      }
      return match;
    }
  );

  // Replace srcset="..."
  htmlWithResolvedImages = htmlWithResolvedImages.replace(
    /<source([^>]*)\ssrcset=["']([^"']+)["']([^>]*)>/gi,
    (match, before, srcset, after) => {
      const firstSrc = srcset.split(',')[0].trim().split(' ')[0];
      const resolved = imageKeyToDataUrl.get(firstSrc);
      if (resolved) {
        return `<source${before} srcset="${resolved}"${after}>`;
      }
      return match;
    }
  );

  // 9. Clean HTML prior to Markdown conversion
  let cleanedHtml = htmlWithResolvedImages
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 10. Convert HTML to Clean Markdown
  let markdown = convertHtmlToMarkdown(cleanedHtml);

  // 11. Prepend Source URL / Metadata header
  let metaHeader = '';
  if (sourceUrl) {
    metaHeader += `> 🌐 **Source:** [${sourceUrl}](${sourceUrl})\n`;
  }
  if (snapshotDate) {
    metaHeader += `> 📅 **Snapshot Date:** ${snapshotDate}\n`;
  }
  if (metaHeader) {
    markdown = `${metaHeader}\n${markdown}`.trim();
  }

  // If the markdown is empty, add note summary
  if (!markdown) {
    markdown = `Webpage imported from MHTML archive: **${noteTitle}**`;
    if (extractedImages.length > 0) {
      markdown += `\n\nContains ${extractedImages.length} image attachment(s).`;
    }
  }

  return {
    title: noteTitle,
    markdownContent: markdown,
    htmlContent: decodedHtml,
    sourceUrl,
    date: snapshotDate,
    images: extractedImages,
  };
}


export interface ImportMhtmlIntoNoteOptions {
  file: File;
  currentTitle?: string;
  onUpdateTitle?: (title: string) => void;
  onAppendContent?: (markdown: string) => void;
  onAddImages?: (imageUrls: string[]) => void;
  onInsertEditorContent?: (html: string) => void;
}

/**
 * Imports an MHTML file directly into the active note being edited.
 * Saves extracted images to IndexedDB & memory cache, updates title if empty,
 * adds image attachments, and inserts the formatted markdown/HTML into content.
 */
export async function importMhtmlIntoNote({
  file,
  currentTitle,
  onUpdateTitle,
  onAppendContent,
  onAddImages,
  onInsertEditorContent,
}: ImportMhtmlIntoNoteOptions): Promise<MhtmlParsedResult> {
  const parsed = await parseMhtmlFile(file);
  const now = Date.now();

  // 1. If note title is blank or Untitled, update with webpage title
  if (
    parsed.title &&
    onUpdateTitle &&
    (!currentTitle || currentTitle.trim() === '' || currentTitle.trim().toLowerCase() === 'untitled note')
  ) {
    onUpdateTitle(parsed.title);
  }

  // 2. Save extracted images into IndexedDB media store & register memory blob cache
  const extractedImageUrls: string[] = [];
  for (const img of parsed.images) {
    try {
      await saveMediaToDB({
        id: img.fileName,
        fileName: img.fileName,
        blob: img.blob,
        mimeType: img.mimeType,
        size: img.blob.size,
        updatedAt: now,
      });

      const blobUrl = URL.createObjectURL(img.blob);
      registerMediaBlobUrl(img.fileName, blobUrl);
      if (img.contentId) {
        registerMediaBlobUrl(`cid:${img.contentId}`, blobUrl);
      }
      if (img.contentLocation) {
        registerMediaBlobUrl(img.contentLocation, blobUrl);
      }
      registerMediaBlobUrl(img.dataUrl, blobUrl);

      extractedImageUrls.push(img.dataUrl);
    } catch (err) {
      console.warn('Failed to save extracted image from MHTML:', img.fileName, err);
    }
  }

  if (onAddImages && extractedImageUrls.length > 0) {
    onAddImages(extractedImageUrls);
  }

  // 3. Insert or append content
  if (onInsertEditorContent) {
    const html = convertMarkdownToHtml(parsed.markdownContent);
    onInsertEditorContent(html);
  } else if (onAppendContent) {
    onAppendContent(parsed.markdownContent);
  }

  return parsed;
}
