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
        else if (mark.type === 'link' && mark.attrs?.href) text = `[${text}](${mark.attrs.href})`;
      }
    }
    return text;
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
    case 'media':
      return node.attrs?.id ? `\n\n[Attachment: ${node.attrs.id}]\n\n` : '';
    default:
      return children;
  }
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
  text = text.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_match, inner) => {
    const codeTagMatch = inner.match(/<code\b([^>]*)>([\s\S]*?)<\/code>/i);
    const codeInner = codeTagMatch ? codeTagMatch[2] : inner;
    const clean = codeInner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    const idx = codeBlocks.length;
    codeBlocks.push(`\n\n\`\`\`\n${clean.trim()}\n\`\`\`\n\n`);
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
 * Fetches up to maxToFetch comments for a Jira issue with pagination support.
 */
async function fetchAllJiraComments(
  baseUrl: string,
  issueKey: string,
  headers: Record<string, string>,
  maxToFetch: number = 100
): Promise<any[]> {
  const allComments: any[] = [];
  let startAt = 0;
  const pageSize = 100;

  while (allComments.length < maxToFetch) {
    const limit = Math.min(pageSize, maxToFetch - allComments.length);
    let commentRes: Response | null = null;

    try {
      commentRes = await fetch(
        `${baseUrl}/rest/api/3/issue/${issueKey}/comment?startAt=${startAt}&maxResults=${limit}&orderBy=created&expand=renderedBody`,
        { headers }
      );
    } catch {
      // Ignore network errors
    }

    if (!commentRes || !commentRes.ok) {
      // Fallback to API v2
      try {
        commentRes = await fetch(
          `${baseUrl}/rest/api/2/issue/${issueKey}/comment?startAt=${startAt}&maxResults=${limit}&orderBy=created&expand=renderedBody`,
          { headers }
        );
      } catch {
        // Ignore
      }
    }

    if (!commentRes || !commentRes.ok) {
      break;
    }

    try {
      const data = await commentRes.json();
      const batch = Array.isArray(data.comments) ? data.comments : [];
      if (batch.length === 0) break;

      allComments.push(...batch);
      startAt += batch.length;

      if (allComments.length >= (data.total || 0) || batch.length < limit) {
        break;
      }
    } catch {
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
    const author = c.author?.displayName || 'Unknown';
    const cDate = c.created ? new Date(c.created).toLocaleString() : '';
    let body = '';

    if (c.renderedBody) {
      body = c.renderedBody
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
    } else if (c.body && typeof c.body === 'object') {
      body = adfToMarkdown(c.body).trim();
    } else if (typeof c.body === 'string') {
      body = c.body.trim();
    }

    md += `> 💬 **${author}** *(${cDate})*:\n`;
    const lines = body.split('\n');
    for (const line of lines) {
      md += `> ${line}\n`;
    }
    md += `\n`;
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
    const jiraIssueMatch =
      parsedUrl.pathname.match(/(?:\/jira)?\/(?:browse|issues|projects\/[^/]+\/issues)\/([A-Z0-9]+-[0-9]+)/i) ||
      parsedUrl.pathname.match(/\/rest\/api\/[23]\/issue\/([A-Z0-9]+-[0-9]+)/i) ||
      parsedUrl.pathname.match(/\/([A-Z0-9]+-[0-9]+)$/i);
    if (jiraIssueMatch && (headers['Authorization'] || headers['Cookie'])) {
      const issueKey = jiraIssueMatch[1].toUpperCase();
      const origin = parsedUrl.origin;
      const apiEndpoint = `${origin}/rest/api/3/issue/${issueKey}?expand=renderedFields,names,schema`;

      try {
        const jiraRes = await fetch(apiEndpoint, {
          headers: {
            ...headers,
            Accept: 'application/json',
          },
        });

        if (jiraRes.ok) {
          const issueData = await jiraRes.json();
          const fields = issueData.fields || {};
          const summary = fields.summary || issueKey;
          const status = fields.status?.name || 'Unknown';
          const priority = fields.priority?.name || 'None';
          const issueType = fields.issuetype?.name || 'Issue';
          const assignee = fields.assignee?.displayName || 'Unassigned';
          const reporter = fields.reporter?.displayName || 'Unknown';
          const labels = Array.isArray(fields.labels) ? fields.labels : [];
          const descriptionNode = fields.description;

          // Convert description (ADF or rendered HTML or string)
          let descriptionMd = '';
          if (issueData.renderedFields?.description) {
            descriptionMd = htmlToCleanMarkdown(issueData.renderedFields.description, new Map(), imagePathStyle);
          } else if (descriptionNode && typeof descriptionNode === 'object') {
            descriptionMd = adfToMarkdown(descriptionNode).trim();
          } else if (typeof descriptionNode === 'string') {
            descriptionMd = descriptionNode;
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
            const comments = await fetchAllJiraComments(origin, issueKey, headers, 100);
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
        }
      } catch (err) {
        console.warn('Jira API fetch attempt error, falling back to HTML fetch:', err);
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
