import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

function getUniqueFilePath(dir: string, desiredName: string): { finalName: string; fullPath: string } {
  const safeName = sanitizeFileName(desiredName) || `image-${Date.now()}.png`;
  const ext = path.extname(safeName) || '.png';
  const base = path.basename(safeName, ext);

  let candidate = safeName;
  let counter = 1;
  while (fs.existsSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter++;
  }
  return {
    finalName: candidate,
    fullPath: path.join(/*turbopackIgnore: true*/ dir, candidate),
  };
}

function getDefaultMediaFolder(): string {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'local-media');
  }
  return path.join(process.cwd(), 'local-media');
}

export interface ExtractedImageInfo {
  originalUrl: string;
  fileName: string;
  savedPath: string;
  serveUrl: string;
  relativeMarkdownPath: string;
  size: number;
  mimeType: string;
}

/**
 * Converts Atlassian Document Format (ADF) node to readable Markdown
 */
function adfToMarkdown(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;

  if (node.type === 'text') {
    let text = node.text || '';
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (mark.type === 'strong') text = `**${text}**`;
        else if (mark.type === 'em') text = `*${text}*`;
        else if (mark.type === 'code') text = `\`${text}\``;
        else if (mark.type === 'strike') text = `~~${text}~~`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'link' && mark.attrs?.href) text = `[${text}](${mark.attrs.href})`;
      }
    }
    return text;
  }

  // Handle inline non-text ADF nodes
  if (node.type === 'mention') {
    const name = node.attrs?.text || node.attrs?.displayName || node.attrs?.id || 'user';
    return `@${name.replace(/^@/, '')}`;
  }
  if (node.type === 'emoji') {
    return node.attrs?.text || node.attrs?.shortName || '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (node.type === 'inlineCard') {
    const cardUrl = node.attrs?.url || '';
    return cardUrl ? `[${cardUrl}](${cardUrl})` : '';
  }
  if (node.type === 'blockCard') {
    const cardUrl = node.attrs?.url || '';
    return cardUrl ? `\n\n[${cardUrl}](${cardUrl})\n\n` : '';
  }
  if (node.type === 'date') {
    const ts = node.attrs?.timestamp;
    return ts ? new Date(Number(ts)).toLocaleDateString() : '';
  }
  if (node.type === 'status') {
    return ` \`[${node.attrs?.text || 'STATUS'}]\` `;
  }

  const children = Array.isArray(node.content) ? node.content.map(adfToMarkdown).join('') : '';

  switch (node.type) {
    case 'doc':
      return children;
    case 'paragraph':
      return `\n\n${children}\n\n`;
    case 'heading': {
      const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
      return `\n\n${'#'.repeat(level)} ${children}\n\n`;
    }
    case 'bulletList':
      return `\n${children}\n`;
    case 'orderedList':
      return `\n${children}\n`;
    case 'listItem':
      return `- ${children.trim()}\n`;
    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      return `\n\n\`\`\`${lang}\n${children}\n\`\`\`\n\n`;
    }
    case 'blockquote':
      return `\n\n> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
    case 'panel': {
      const panelType = node.attrs?.panelType || 'info';
      return `\n\n> **[${panelType.toUpperCase()}]**\n> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
    }
    case 'rule':
      return '\n\n---\n\n';
    case 'table':
      return `\n\n${children}\n\n`;
    case 'tableRow':
      return `| ${children} |\n`;
    case 'tableHeader':
    case 'tableCell':
      return `${children.trim()} | `;
    case 'mediaSingle':
    case 'mediaGroup':
      return `\n\n${children}\n\n`;
    case 'media':
      return node.attrs?.id ? `[Attachment: ${node.attrs.id}]` : '';
    default:
      return children;
  }
}

/**
 * Fallback to extract any plain text from an ADF tree if adfToMarkdown yields empty.
 */
function extractAllTextFromADF(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  if (node.attrs?.text) return node.attrs.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractAllTextFromADF).join(' ');
  }
  return '';
}

/**
 * Converts Jira Wiki Markup (used on Jira Server & Data Center) to standard Markdown.
 */
function jiraWikiMarkupToMarkdown(wikiText: string): string {
  if (!wikiText) return '';
  let text = wikiText;

  // Code blocks: {code:lang}...{code} or {code}...{code}
  text = text.replace(/\{code(?::([a-zA-Z0-9_-]+))?\}([\s\S]*?)\{code\}/gi, (_m, lang, code) => {
    return `\n\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`;
  });

  // Noformat blocks: {noformat}...{noformat}
  text = text.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_m, content) => {
    return `\n\`\`\`\n${content.trim()}\n\`\`\`\n`;
  });

  // Quotes: {quote}...{quote}
  text = text.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, (_m, quote) => {
    return `\n> ${quote.trim().replace(/\n/g, '\n> ')}\n`;
  });

  // Panels: {panel:title=...}...{panel}
  text = text.replace(/\{panel(?::title=([^}]+))?\}([\s\S]*?)\{panel\}/gi, (_m, title, content) => {
    const titleHeader = title ? `**${title}**\n> ` : '';
    return `\n> ${titleHeader}${content.trim().replace(/\n/g, '\n> ')}\n`;
  });

  // Headings: h1. text to h6. text
  text = text.replace(/^h([1-6])\.\s+(.*)$/gim, (_m, level, content) => {
    return `${'#'.repeat(parseInt(level, 10))} ${content}`;
  });

  // Links: [title|url] or [url]
  text = text.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '[$1]($2)');
  text = text.replace(/\[([^\]]+)\]/g, (match, inner) => {
    if (inner.startsWith('http://') || inner.startsWith('https://')) {
      return `[${inner}](${inner})`;
    }
    return match;
  });

  // Lists: * item or # item
  text = text.replace(/^(\s*)\*\s+(.*)$/gm, '$1- $2');
  text = text.replace(/^(\s*)#\s+(.*)$/gm, '$11. $2');

  // Inline formatting
  text = text.replace(/\{\{([^{}\n]+)\}\}/g, '`$1`');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*([\s).,!?:;]|$)/g, '$1**$2**$3');
  text = text.replace(/(^|[\s(])_([_\n]+)_([\s).,!?:;]|$)/g, '$1*$2*$3');
  text = text.replace(/(^|[\s(])-([-\n]+)-([\s).,!?:;]|$)/g, '$1~~$2~~$3');
  text = text.replace(/(^|[\s(])\+([+\n]+)\+([\s).,!?:;]|$)/g, '$1<u>$2</u>$3');

  return text;
}

/**
 * Simplistic HTML to Markdown parser for extracted article/body content.
 * Handles headings, paragraphs, lists, tables, code blocks, blockquotes, links, and images.
 */
function htmlToCleanMarkdown(html: string, imageMap: Map<string, ExtractedImageInfo>, imagePathStyle: string): string {
  if (!html) return '';

  let text = html;

  // Remove scripts, styles, iframes, noscript
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Pre-process code blocks
  const codeBlocks: string[] = [];
  text = text.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_match, preAttrs, inner) => {
    const codeTagMatch = inner.match(/<code\b([^>]*)>([\s\S]*?)<\/code>/i);
    const codeInner = codeTagMatch ? codeTagMatch[2] : inner;
    const combinedAttrs = `${preAttrs} ${codeTagMatch ? codeTagMatch[1] : ''}`;
    const langMatch = combinedAttrs.match(/(?:class|data-language)=["'][^"']*(?:lang(?:uage)?-|code-)([a-zA-Z0-9_-]+)/i);
    const lang = langMatch ? langMatch[1] : '';

    const clean = codeInner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    const idx = codeBlocks.length;
    codeBlocks.push(`\n\n\`\`\`${lang}\n${clean.trim()}\n\`\`\`\n\n`);
    return `___EXTRACT_CODE_BLOCK_${idx}___`;
  });

  // Convert <img> tags to Markdown using our downloaded image mappings
  text = text.replace(/<img\b([^>]*)>/gi, (_match, attrs) => {
    const srcMatch = attrs.match(/\b(?:src|data-src|data-original)=["']([^"']+)["']/i);
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
    const titleMatch = attrs.match(/\btitle=["']([^"']*)["']/i);

    const src = srcMatch ? srcMatch[1] : '';
    const alt = (altMatch ? altMatch[1] : titleMatch ? titleMatch[1] : 'image').trim();

    if (!src) return '';

    // Check if we downloaded this image
    const downloaded = imageMap.get(src);
    if (downloaded) {
      let targetPath = downloaded.relativeMarkdownPath;
      if (imagePathStyle === 'api') targetPath = downloaded.serveUrl;
      else if (imagePathStyle === 'filename') targetPath = downloaded.fileName;
      return `\n\n![${alt}](${targetPath})\n\n`;
    }

    // Otherwise keep remote or data URL
    return `\n\n![${alt}](${src})\n\n`;
  });

  // Headings
  text = text.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  text = text.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  text = text.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  text = text.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // Blockquotes
  text = text.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, inner) => {
    const clean = inner.replace(/<[^>]+>/g, '').trim();
    return `\n\n> ${clean.replace(/\n/g, '\n> ')}\n\n`;
  });

  // Horizontal rules
  text = text.replace(/<hr\b[^>]*\/?>/gi, '\n\n---\n\n');

  // Tables
  text = text.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableInner) => {
    const rows = tableInner.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    if (rows.length === 0) return '';

    const parsedRows: string[][] = [];
    for (const r of rows) {
      const cells = r.match(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
      const rowData = cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim().replace(/\|/g, '\\|'));
      if (rowData.length > 0) parsedRows.push(rowData);
    }

    if (parsedRows.length === 0) return '';
    const colCount = Math.max(...parsedRows.map((r) => r.length));
    let mdTable = '\n\n';

    // Header row
    const header = parsedRows[0];
    mdTable += '| ' + Array.from({ length: colCount }, (_, i) => header[i] || '').join(' | ') + ' |\n';
    mdTable += '| ' + Array.from({ length: colCount }, () => '---').join(' | ') + ' |\n';

    // Body rows
    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      mdTable += '| ' + Array.from({ length: colCount }, (_, c) => row[c] || '').join(' | ') + ' |\n';
    }

    return mdTable + '\n';
  });

  // Lists
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, inner) => {
    // Check if task checkbox
    const hasChecked = /type=["']checkbox["'][^>]*checked/i.test(inner);
    const hasUnchecked = /type=["']checkbox["']/i.test(inner);
    const cleanText = inner.replace(/<input\b[^>]*>/gi, '').replace(/<[^>]+>/g, '').trim();
    if (hasChecked) return `\n- [x] ${cleanText}`;
    if (hasUnchecked) return `\n- [ ] ${cleanText}`;
    return `\n- ${cleanText}`;
  });

  // Paragraphs and breaks
  text = text.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Links
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, linkText) => {
    const cleanLink = linkText.replace(/<[^>]+>/g, '').trim();
    if (!cleanLink) return '';
    return `[${cleanLink}](${href})`;
  });

  // Inline formatting
  text = text.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  text = text.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  text = text.replace(/<(?:del|s|strike)\b[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~');
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Restore code blocks
  text = text.replace(/___EXTRACT_CODE_BLOCK_(\d+)___/g, (_match, idx) => {
    return codeBlocks[parseInt(idx, 10)] || '';
  });

  // Decode HTML entities
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Extracts Jira base URL and issue key from arbitrary Jira URLs (Cloud, Server, Board, Browse, Rest)
 */
function extractJiraInfo(urlStr: string): { baseUrl: string; issueKey: string } | null {
  try {
    const parsed = new URL(urlStr);
    let issueKey = '';
    let prefix = '';

    // Check query params (e.g. Jira Agile boards: ?selectedIssue=CA-123)
    const selectedIssue = parsed.searchParams.get('selectedIssue');
    if (selectedIssue && /^[A-Za-z0-9]+-[0-9]+$/.test(selectedIssue)) {
      issueKey = selectedIssue.toUpperCase();
      const boardMatch = parsed.pathname.match(/^(.*?)\/(?:jira|secure|boards|software)/i);
      prefix = boardMatch ? boardMatch[1] : '';
    } else {
      const browseMatch = parsed.pathname.match(/^(.*?)(?:\/jira)?\/(?:browse|issues|projects\/[^/]+\/issues)\/([A-Za-z0-9]+-[0-9]+)/i);
      const restMatch = parsed.pathname.match(/^(.*?)(?:\/jira)?\/rest\/api\/[23]\/issue\/([A-Za-z0-9]+-[0-9]+)/i);
      const endMatch = parsed.pathname.match(/^(.*?)\/([A-Za-z0-9]+-[0-9]+)$/i);

      if (browseMatch) {
        prefix = browseMatch[1];
        issueKey = browseMatch[2].toUpperCase();
      } else if (restMatch) {
        prefix = restMatch[1];
        issueKey = restMatch[2].toUpperCase();
      } else if (endMatch && /^[A-Za-z0-9]+-[0-9]+$/.test(endMatch[2])) {
        prefix = endMatch[1];
        issueKey = endMatch[2].toUpperCase();
      }
    }

    if (!issueKey) return null;

    prefix = prefix.replace(/\/+$/, '');
    const baseUrl = `${parsed.origin}${prefix}`;
    return { baseUrl, issueKey };
  } catch {
    return null;
  }
}

/**
 * Parses any Jira comment body (renderedBody HTML, ADF object, or Wiki Markup string) into clean Markdown.
 */
function parseJiraCommentBody(c: any): string {
  if (!c) return '';

  // 1. If renderedBody HTML is provided (standard in Jira with expand=renderedBody)
  if (c.renderedBody && typeof c.renderedBody === 'string') {
    const md = htmlToCleanMarkdown(c.renderedBody, new Map(), 'relative').trim();
    if (md) return md;
  }

  // 2. If ADF object (Jira Cloud v3)
  if (c.body && typeof c.body === 'object') {
    const md = adfToMarkdown(c.body).trim();
    if (md) return md;
    // Deep fallback extraction if adfToMarkdown missed complex nodes
    const deep = extractAllTextFromADF(c.body).trim();
    if (deep) return deep;
  }

  // 3. If string (Jira Server / Data Center / v2 Wiki markup)
  if (typeof c.body === 'string') {
    return jiraWikiMarkupToMarkdown(c.body.trim());
  }

  if (c.body) {
    try {
      return JSON.stringify(c.body);
    } catch {
      return String(c.body);
    }
  }

  return '';
}

/**
 * Fetches up to maxToFetch comments for a Jira issue with pagination support.
 * Resilient against Jira Cloud API v3 and Jira Server/Data Center API v2 variations.
 */
async function fetchAllJiraComments(
  baseUrl: string,
  issueKey: string,
  headers: Record<string, string>,
  maxToFetch: number = 100
): Promise<any[]> {
  const allComments: any[] = [];
  let startAt = 0;
  const pageSize = 50;
  const cleanBase = baseUrl.replace(/\/+$/, '');

  const apiHeaders: Record<string, string> = {
    ...headers,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Atlassian-Token': 'no-check',
  };

  let chosenApi: { version: '3' | '2'; expand: boolean } | null = null;

  while (allComments.length < maxToFetch) {
    const limit = Math.min(pageSize, maxToFetch - allComments.length);
    let batch: any[] = [];
    let total: number | null = null;

    if (!chosenApi) {
      // Test endpoints to find the active API on this Jira instance (omitting orderBy to prevent 400 Bad Request)
      const candidates: Array<{ version: '3' | '2'; expand: boolean }> = [
        { version: '3', expand: true },
        { version: '3', expand: false },
        { version: '2', expand: true },
        { version: '2', expand: false },
      ];

      for (const cand of candidates) {
        try {
          const testUrl = `${cleanBase}/rest/api/${cand.version}/issue/${issueKey}/comment?startAt=0&maxResults=${limit}${cand.expand ? '&expand=renderedBody' : ''}`;
          const r = await fetch(testUrl, { headers: apiHeaders });
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data.comments)) {
              batch = data.comments;
              total = typeof data.total === 'number' ? data.total : null;
              chosenApi = cand;
              break;
            }
          }
        } catch {
          // ignore candidate failure
        }
      }
    } else {
      const pageUrl = `${cleanBase}/rest/api/${chosenApi.version}/issue/${issueKey}/comment?startAt=${startAt}&maxResults=${limit}${chosenApi.expand ? '&expand=renderedBody' : ''}`;
      try {
        const r = await fetch(pageUrl, { headers: apiHeaders });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data.comments)) {
            batch = data.comments;
            total = typeof data.total === 'number' ? data.total : null;
          }
        }
      } catch {
        break;
      }
    }

    if (batch.length === 0) {
      break;
    }

    allComments.push(...batch);
    startAt += batch.length;

    if (total !== null && allComments.length >= total) {
      break;
    }
    if (batch.length < limit) {
      break;
    }
  }

  return allComments;
}

/**
 * Formats Jira comments array into readable Markdown block
 */
function formatJiraCommentsMarkdown(comments: any[]): string {
  if (!comments || comments.length === 0) return '';
  let md = `### Comments (${comments.length})\n\n`;
  for (let i = 0; i < comments.length; i++) {
    const c = comments[i];
    const author = c.author?.displayName || c.updateAuthor?.displayName || c.author?.name || 'Unknown';
    const cDate = c.created ? new Date(c.created).toLocaleString() : '';
    const body = parseJiraCommentBody(c);

    md += `#### 💬 **${author}** · *${cDate}*\n\n`;
    if (body) {
      md += `${body}\n\n`;
    } else {
      md += `*(empty comment or attachment)*\n\n`;
    }
    if (i < comments.length - 1) {
      md += `---\n\n`;
    }
  }
  return md;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url,
      authType = 'none',
      username,
      password,
      token,
      cookie,
      customHeaders,
      downloadImages = true,
      imagePathStyle = 'relative',
      folderPath,
    } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const targetFolder = folderPath && fs.existsSync(/*turbopackIgnore: true*/ folderPath)
      ? folderPath
      : getDefaultMediaFolder();

    if (!fs.existsSync(/*turbopackIgnore: true*/ targetFolder)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ targetFolder, { recursive: true });
    }

    // Build Request Headers
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 KeepClone/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Apply Authentication
    if (authType === 'jira' || (username && password && parsedUrl.hostname.includes('atlassian.net'))) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
      headers['X-Atlassian-Token'] = 'no-check';
    } else if (authType === 'basic' && username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (authType === 'bearer' && token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    } else if (authType === 'cookie' && cookie) {
      headers['Cookie'] = cookie.trim();
    }

    if (customHeaders && typeof customHeaders === 'object') {
      for (const [k, v] of Object.entries(customHeaders)) {
        if (typeof v === 'string') {
          headers[k] = v;
        }
      }
    }

    // Check for Jira Issue URL (e.g. https://company.atlassian.net/browse/PROJ-123 or /issues/PROJ-123)
    const jiraInfo = extractJiraInfo(url);
    if (jiraInfo && (headers['Authorization'] || headers['Cookie'])) {
      const { baseUrl: jiraBaseUrl, issueKey } = jiraInfo;
      const headersForJira = {
        ...headers,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Atlassian-Token': 'no-check',
      };

      let issueData: any = null;

      // 1. Try Jira Cloud v3 first
      try {
        const jiraRes3 = await fetch(
          `${jiraBaseUrl}/rest/api/3/issue/${issueKey}?fields=*all&expand=renderedFields,names,schema,renderedBody`,
          { headers: headersForJira }
        );
        if (jiraRes3.ok) {
          issueData = await jiraRes3.json();
        }
      } catch (err) {
        // v3 fetch error, fallback to v2 below
      }

      // 2. Fallback to Jira Server / Data Center v2
      if (!issueData) {
        try {
          const jiraRes2 = await fetch(
            `${jiraBaseUrl}/rest/api/2/issue/${issueKey}?fields=*all&expand=renderedFields,names,schema,renderedBody`,
            { headers: headersForJira }
          );
          if (jiraRes2.ok) {
            issueData = await jiraRes2.json();
          }
        } catch (err) {
          console.warn('Jira v2 issue fetch attempt error:', err);
        }
      }

      if (issueData) {
        try {
          const fields = issueData.fields || {};
          const summary = fields.summary || issueKey;
          const status = fields.status?.name || 'Unknown';
          const priority = fields.priority?.name || 'None';
          const issueType = fields.issuetype?.name || 'Issue';
          const assignee = fields.assignee?.displayName || fields.assignee?.name || 'Unassigned';
          const reporter = fields.reporter?.displayName || fields.reporter?.name || 'Unknown';
          const labels = Array.isArray(fields.labels) ? fields.labels : [];
          const descriptionNode = fields.description;

          // Convert description (Rendered HTML, ADF, or Wiki Markup)
          let descriptionMd = '';
          if (issueData.renderedFields?.description) {
            descriptionMd = htmlToCleanMarkdown(issueData.renderedFields.description, new Map(), imagePathStyle);
          } else if (descriptionNode && typeof descriptionNode === 'object') {
            descriptionMd = adfToMarkdown(descriptionNode).trim();
            if (!descriptionMd) {
              descriptionMd = extractAllTextFromADF(descriptionNode).trim();
            }
          } else if (typeof descriptionNode === 'string') {
            descriptionMd = jiraWikiMarkupToMarkdown(descriptionNode);
          }

          // Process and download Jira attachments (screenshots, images)
          const downloadedImages: ExtractedImageInfo[] = [];
          const attachments = Array.isArray(fields.attachment) ? fields.attachment : [];

          if (downloadImages && attachments.length > 0) {
            for (const att of attachments) {
              const isImg = att.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.filename || '');
              if (!isImg || !att.content) continue;

              try {
                const imgRes = await fetch(att.content, { headers });
                if (imgRes.ok) {
                  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                  const desiredName = att.filename || `jira-att-${att.id}.png`;
                  const { finalName, fullPath } = getUniqueFilePath(targetFolder, desiredName);
                  fs.writeFileSync(/*turbopackIgnore: true*/ fullPath, imgBuf);

                  const normPath = fullPath.replace(/\\/g, '/');
                  const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
                  const serveUrl = `/api/local-media?folder=${encodeURIComponent(targetFolder)}&file=${encodeURIComponent(finalName)}`;

                  downloadedImages.push({
                    originalUrl: att.content,
                    fileName: finalName,
                    savedPath: normPath,
                    serveUrl,
                    relativeMarkdownPath: relPath.startsWith('local-media') ? relPath : `local-media/${finalName}`,
                    size: imgBuf.length,
                    mimeType: att.mimeType || 'image/png',
                  });
                }
              } catch (err) {
                console.warn(`Failed downloading Jira attachment ${att.filename}:`, err);
              }
            }
          }

          // Build Jira Note Markdown
          let jiraMarkdown = `> 🎫 **Jira Issue:** [${issueKey}](${url})  \n`;
          jiraMarkdown += `> 📊 **Status:** \`${status}\` | ⚡ **Priority:** ${priority} | 📌 **Type:** ${issueType}  \n`;
          jiraMarkdown += `> 👤 **Assignee:** ${assignee} | 🗣️ **Reporter:** ${reporter}  \n`;
          if (labels.length > 0) {
            jiraMarkdown += `> 🏷️ **Labels:** ${labels.map((l: string) => `\`#${l}\``).join(' ')}  \n`;
          }
          jiraMarkdown += `\n---\n\n`;

          if (descriptionMd) {
            jiraMarkdown += `### Description\n\n${descriptionMd}\n\n`;
          }

          if (downloadedImages.length > 0) {
            jiraMarkdown += `### Attachments (${downloadedImages.length})\n\n`;
            for (const img of downloadedImages) {
              const link = imagePathStyle === 'api' ? img.serveUrl : img.relativeMarkdownPath;
              jiraMarkdown += `![${img.fileName}](${link})\n\n`;
            }
          }

          // Subtasks
          const subtasks = Array.isArray(fields.subtasks) ? fields.subtasks : [];
          if (subtasks.length > 0) {
            jiraMarkdown += `### Subtasks (${subtasks.length})\n\n`;
            for (const st of subtasks) {
              const isDone = st.fields?.status?.statusCategory?.key === 'done';
              jiraMarkdown += `- [${isDone ? 'x' : ' '}] **${st.key}**: ${st.fields?.summary || ''} *(${st.fields?.status?.name || ''})*\n`;
            }
            jiraMarkdown += '\n';
          }

          // Fetch up to 100 comments from dedicated Jira comments API
          let commentsMd = '';
          try {
            const comments = await fetchAllJiraComments(jiraBaseUrl, issueKey, headers, 100);
            if (comments.length > 0) {
              commentsMd = formatJiraCommentsMarkdown(comments);
            } else if (fields.comment?.comments && Array.isArray(fields.comment.comments) && fields.comment.comments.length > 0) {
              commentsMd = formatJiraCommentsMarkdown(fields.comment.comments);
            }
          } catch (cErr) {
            console.warn('Failed fetching Jira comments:', cErr);
            if (fields.comment?.comments && Array.isArray(fields.comment.comments) && fields.comment.comments.length > 0) {
              commentsMd = formatJiraCommentsMarkdown(fields.comment.comments);
            }
          }

          if (commentsMd) {
            jiraMarkdown += commentsMd;
          }

          return NextResponse.json({
            success: true,
            isJira: true,
            title: `[${issueKey}] ${summary}`,
            markdown: jiraMarkdown,
            sourceUrl: url,
            siteName: 'Jira',
            author: reporter,
            labels: ['jira', issueKey.toLowerCase(), ...labels],
            images: downloadedImages,
          });
        } catch (procErr) {
          console.error('Error processing Jira issue data:', procErr);
        }
      }
    }

    // Standard Webpage Fetch
    const pageRes = await fetch(url, { headers });

    if (!pageRes.ok) {
      if (pageRes.status === 401 || pageRes.status === 403) {
        return NextResponse.json(
          {
            error: `Authentication failed (HTTP ${pageRes.status}). Please check your API token, username/password, or session cookies.`,
            status: pageRes.status,
          },
          { status: pageRes.status }
        );
      }
      return NextResponse.json(
        { error: `Webpage returned HTTP ${pageRes.status} (${pageRes.statusText})` },
        { status: 502 }
      );
    }

    const contentType = pageRes.headers.get('content-type') || '';
    const rawHtml = await pageRes.text();

    // Extract Title
    let pageTitle = '';
    const ogTitleMatch = rawHtml.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const titleTagMatch = rawHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = rawHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

    if (ogTitleMatch && ogTitleMatch[1]) {
      pageTitle = ogTitleMatch[1].trim();
    } else if (titleTagMatch && titleTagMatch[1]) {
      pageTitle = titleTagMatch[1].replace(/<[^>]+>/g, '').trim();
    } else if (h1Match && h1Match[1]) {
      pageTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();
    } else {
      pageTitle = parsedUrl.hostname + parsedUrl.pathname;
    }

    // Decode title entities
    pageTitle = pageTitle
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();

    // Extract Author & Site Name
    const authorMatch =
      rawHtml.match(/<meta\b[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i) ||
      rawHtml.match(/<meta\b[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i);
    const author = authorMatch ? authorMatch[1].trim() : '';

    const siteNameMatch = rawHtml.match(/<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    const siteName = siteNameMatch ? siteNameMatch[1].trim() : parsedUrl.hostname;

    // Isolate Article Content
    let contentHtml = rawHtml;

    // Remove boilerplate elements: header, nav, footer, script, style, comments
    contentHtml = contentHtml.replace(/<header\b[\s\S]*?<\/header>/gi, '');
    contentHtml = contentHtml.replace(/<nav\b[\s\S]*?<\/nav>/gi, '');
    contentHtml = contentHtml.replace(/<footer\b[\s\S]*?<\/footer>/gi, '');
    contentHtml = contentHtml.replace(/<aside\b[\s\S]*?<\/aside>/gi, '');
    contentHtml = contentHtml.replace(/<svg\b[\s\S]*?<\/svg>/gi, '');

    // Look for standard main/article containers
    const articleMatch =
      contentHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
      contentHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
      contentHtml.match(/<div\b[^>]*(?:class|id)=["'][^"']*(?:post-content|article-body|entry-content|main-content|story-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      contentHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);

    if (articleMatch && articleMatch[1]) {
      contentHtml = articleMatch[1];
    }

    // Scan all images in the content
    const imgRegex = /<img\b([^>]*)>/gi;
    const foundImageUrls = new Set<string>();
    let imgM: RegExpExecArray | null;

    while ((imgM = imgRegex.exec(contentHtml)) !== null) {
      const attrs = imgM[1];
      const srcM = attrs.match(/\b(?:src|data-src|data-original)=["']([^"']+)["']/i);
      if (srcM && srcM[1]) {
        let fullSrc = srcM[1].trim();
        if (fullSrc.startsWith('//')) {
          fullSrc = `${parsedUrl.protocol}${fullSrc}`;
        } else if (fullSrc.startsWith('/')) {
          fullSrc = `${parsedUrl.origin}${fullSrc}`;
        } else if (!fullSrc.startsWith('http://') && !fullSrc.startsWith('https://') && !fullSrc.startsWith('data:')) {
          try {
            fullSrc = new URL(fullSrc, url).href;
          } catch {
            continue;
          }
        }
        if (!fullSrc.startsWith('data:image/svg+xml') && !fullSrc.includes('1x1') && !fullSrc.includes('spacer')) {
          foundImageUrls.add(fullSrc);
        }
      }
    }

    // Download images locally using the same auth headers
    const downloadedImages: ExtractedImageInfo[] = [];
    const imageMap = new Map<string, ExtractedImageInfo>();

    if (downloadImages && foundImageUrls.size > 0) {
      // Limit to 30 images to prevent timeouts on massive photo galleries
      const imagesToFetch = Array.from(foundImageUrls).slice(0, 30);

      for (const imgUrl of imagesToFetch) {
        try {
          let imgBuffer: Buffer | null = null;
          let mime = 'image/png';
          let desiredName = `extracted-${Date.now()}.png`;

          if (imgUrl.startsWith('data:image/')) {
            const dataMatch = imgUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (dataMatch) {
              mime = dataMatch[1];
              imgBuffer = Buffer.from(dataMatch[2], 'base64');
              const ext = mime.includes('jpeg') || mime.includes('jpg')
                ? '.jpg'
                : mime.includes('gif')
                ? '.gif'
                : mime.includes('webp')
                ? '.webp'
                : '.png';
              desiredName = `pasted-${Date.now()}${ext}`;
            }
          } else {
            const imgRes = await fetch(imgUrl, {
              headers: {
                ...headers,
                Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              },
            });

            if (imgRes.ok) {
              const ab = await imgRes.arrayBuffer();
              imgBuffer = Buffer.from(ab);
              mime = imgRes.headers.get('content-type') || 'image/png';
              const uPath = new URL(imgUrl).pathname;
              const base = path.basename(uPath);
              if (base && /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(base)) {
                desiredName = base;
              } else {
                const ext = MIME_MAP[`.${mime.split('/')[1]}`] ? `.${mime.split('/')[1]}` : '.png';
                desiredName = `web-${Date.now()}${ext}`;
              }
            }
          }

          if (imgBuffer && imgBuffer.length > 500) {
            // Skip tracking pixels (< 500 bytes)
            const { finalName, fullPath } = getUniqueFilePath(targetFolder, desiredName);
            fs.writeFileSync(/*turbopackIgnore: true*/ fullPath, imgBuffer);

            const normPath = fullPath.replace(/\\/g, '/');
            const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
            const serveUrl = `/api/local-media?folder=${encodeURIComponent(targetFolder)}&file=${encodeURIComponent(finalName)}`;

            const info: ExtractedImageInfo = {
              originalUrl: imgUrl,
              fileName: finalName,
              savedPath: normPath,
              serveUrl,
              relativeMarkdownPath: relPath.startsWith('local-media') ? relPath : `local-media/${finalName}`,
              size: imgBuffer.length,
              mimeType: mime,
            };

            downloadedImages.push(info);
            imageMap.set(imgUrl, info);
          }
        } catch (err) {
          console.warn(`Failed downloading image ${imgUrl}:`, err);
        }
      }
    }

    // Convert HTML to Markdown
    const bodyMarkdown = htmlToCleanMarkdown(contentHtml, imageMap, imagePathStyle);

    // Build Final Note Markdown with metadata header
    const nowStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    let fullMarkdown = `> 🔗 **Source:** [${pageTitle || url}](${url})  \n`;
    fullMarkdown += `> 🌐 **Domain:** ${siteName} | 📅 **Clipped:** ${nowStr}  \n`;
    if (author) {
      fullMarkdown += `> 👤 **Author:** ${author}  \n`;
    }
    fullMarkdown += `\n---\n\n`;
    fullMarkdown += bodyMarkdown;

    return NextResponse.json({
      success: true,
      title: pageTitle,
      markdown: fullMarkdown,
      sourceUrl: url,
      siteName,
      author,
      images: downloadedImages,
    });
  } catch (error: any) {
    console.error('Extract from URL error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to extract content from URL' },
      { status: 500 }
    );
  }
}
