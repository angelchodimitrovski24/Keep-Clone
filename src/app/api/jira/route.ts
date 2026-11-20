import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

function getUniqueFilePath(dir: string, desiredName: string): { finalName: string; fullPath: string } {
  const safeName = sanitizeFileName(desiredName) || `jira-file-${Date.now()}`;
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

/**
 * Normalizes Atlassian Jira domain to standard https://domain.atlassian.net URL
 */
function normalizeJiraBaseUrl(domainOrUrl: string): string {
  let clean = domainOrUrl.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean;
}

/**
 * Builds Basic Auth header for Jira
 */
function buildJiraAuthHeader(email: string, apiToken: string): string {
  const raw = `${email.trim()}:${apiToken.trim()}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

/**
 * Converts Atlassian Document Format (ADF) to Markdown
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
 * Fallback to extract any plain text from an ADF tree
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
 * Converts Jira Wiki Markup to standard Markdown
 */
function jiraWikiMarkupToMarkdown(wikiText: string): string {
  if (!wikiText) return '';
  let text = wikiText;

  text = text.replace(/\{code(?::([a-zA-Z0-9_-]+))?\}([\s\S]*?)\{code\}/gi, (_m, lang, code) => {
    return `\n\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`;
  });
  text = text.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_m, content) => {
    return `\n\`\`\`\n${content.trim()}\n\`\`\`\n`;
  });
  text = text.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, (_m, quote) => {
    return `\n> ${quote.trim().replace(/\n/g, '\n> ')}\n`;
  });
  text = text.replace(/\{panel(?::title=([^}]+))?\}([\s\S]*?)\{panel\}/gi, (_m, title, content) => {
    const titleHeader = title ? `**${title}**\n> ` : '';
    return `\n> ${titleHeader}${content.trim().replace(/\n/g, '\n> ')}\n`;
  });
  text = text.replace(/^h([1-6])\.\s+(.*)$/gim, (_m, level, content) => {
    return `${'#'.repeat(parseInt(level, 10))} ${content}`;
  });
  text = text.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '[$1]($2)');
  text = text.replace(/\[([^\]]+)\]/g, (match, inner) => {
    if (inner.startsWith('http://') || inner.startsWith('https://')) {
      return `[${inner}](${inner})`;
    }
    return match;
  });
  text = text.replace(/^(\s*)\*\s+(.*)$/gm, '$1- $2');
  text = text.replace(/^(\s*)#\s+(.*)$/gm, '$11. $2');
  text = text.replace(/\{\{([^{}\n]+)\}\}/g, '`$1`');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*([\s).,!?:;]|$)/g, '$1**$2**$3');
  text = text.replace(/(^|[\s(])_([_\n]+)_([\s).,!?:;]|$)/g, '$1*$2*$3');
  text = text.replace(/(^|[\s(])-([-\n]+)-([\s).,!?:;]|$)/g, '$1~~$2~~$3');
  text = text.replace(/(^|[\s(])\+([+\n]+)\+([\s).,!?:;]|$)/g, '$1<u>$2</u>$3');

  return text;
}

/**
 * Converts HTML to clean Markdown with code blocks, tables, lists, and formatting.
 */
function htmlToCleanMarkdown(html: string): string {
  if (!html) return '';
  let text = html;

  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

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

  text = text.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  text = text.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  text = text.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  text = text.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  text = text.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, inner) => {
    const clean = inner.replace(/<[^>]+>/g, '').trim();
    return `\n\n> ${clean.replace(/\n/g, '\n> ')}\n\n`;
  });

  text = text.replace(/<hr\b[^>]*\/?>/gi, '\n\n---\n\n');

  // Lists
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, inner) => {
    const hasChecked = /type=["']checkbox["'][^>]*checked/i.test(inner);
    const hasUnchecked = /type=["']checkbox["']/i.test(inner);
    const cleanText = inner.replace(/<input\b[^>]*>/gi, '').replace(/<[^>]+>/g, '').trim();
    if (hasChecked) return `\n- [x] ${cleanText}`;
    if (hasUnchecked) return `\n- [ ] ${cleanText}`;
    return `\n- ${cleanText}`;
  });

  text = text.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Links
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, linkText) => {
    const cleanLink = linkText.replace(/<[^>]+>/g, '').trim();
    if (!cleanLink) return '';
    return `[${cleanLink}](${href})`;
  });

  text = text.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  text = text.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  text = text.replace(/<(?:del|s|strike)\b[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~');
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  text = text.replace(/<[^>]+>/g, '');

  text = text.replace(/___EXTRACT_CODE_BLOCK_(\d+)___/g, (_match, idx) => {
    return codeBlocks[parseInt(idx, 10)] || '';
  });

  text = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Parses any Jira comment body (rendered HTML, ADF object, or Wiki markup string)
 */
function parseJiraCommentBody(c: any): string {
  if (!c) return '';

  if (c.renderedBody && typeof c.renderedBody === 'string') {
    const md = htmlToCleanMarkdown(c.renderedBody).trim();
    if (md) return md;
  }

  if (c.body && typeof c.body === 'object') {
    const md = adfToMarkdown(c.body).trim();
    if (md) return md;
    const deep = extractAllTextFromADF(c.body).trim();
    if (deep) return deep;
  }

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
 * Robust against Jira Cloud API v3 and Jira Server/Data Center API v2 variations.
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

async function processJiraIssueToNote(
  issue: any,
  baseUrl: string,
  authHeader: string,
  targetFolder: string,
  downloadAttachments: boolean = true,
  includeComments: boolean = true
) {
  const fields = issue.fields || {};
  const key = issue.key || 'JIRA';
  const summary = fields.summary || 'Untitled Issue';
  const status = fields.status?.name || 'Unknown';
  const priority = fields.priority?.name || 'None';
  const issueType = fields.issuetype?.name || 'Issue';
  const assignee = fields.assignee?.displayName || 'Unassigned';
  const reporter = fields.reporter?.displayName || 'Unknown';
  const labels: string[] = Array.isArray(fields.labels) ? fields.labels : [];
  const createdDate = fields.created ? new Date(fields.created).toLocaleDateString() : '';
  const updatedDate = fields.updated ? new Date(fields.updated).toLocaleDateString() : '';

  // Parse Description
  let descriptionMd = '';
  if (issue.renderedFields?.description) {
    // If rendered HTML exists, use basic cleaning
    descriptionMd = issue.renderedFields.description
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  } else if (fields.description && typeof fields.description === 'object') {
    descriptionMd = adfToMarkdown(fields.description).trim();
    if (!descriptionMd) {
      descriptionMd = extractAllTextFromADF(fields.description).trim();
    }
  } else if (typeof fields.description === 'string') {
    descriptionMd = jiraWikiMarkupToMarkdown(fields.description);
  }

  // Process & Download Attachments
  const downloadedImages: string[] = [];
  const rawAttachments = Array.isArray(fields.attachment) ? fields.attachment : [];

  if (downloadAttachments && rawAttachments.length > 0) {
    for (const att of rawAttachments) {
      const isImg = att.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.filename || '');
      if (!isImg || !att.content) continue;

      try {
        const imgRes = await fetch(att.content, {
          headers: {
            Authorization: authHeader,
            'X-Atlassian-Token': 'no-check',
          },
        });

        if (imgRes.ok) {
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          const desiredName = `${key.toLowerCase()}-${sanitizeFileName(att.filename || `att-${att.id}.png`)}`;
          const { finalName, fullPath } = getUniqueFilePath(targetFolder, desiredName);
          fs.writeFileSync(/*turbopackIgnore: true*/ fullPath, imgBuf);

          const normPath = fullPath.replace(/\\/g, '/');
          downloadedImages.push(normPath);
        }
      } catch (err) {
        console.warn(`Failed downloading Jira attachment ${att.filename}:`, err);
      }
    }
  }

  // Parse Comments if requested (fetch up to 100 comments)
  let commentsMd = '';
  if (includeComments) {
    try {
      const allComments = await fetchAllJiraComments(
        baseUrl,
        key,
        { Authorization: authHeader, 'X-Atlassian-Token': 'no-check', Accept: 'application/json' },
        100
      );
      if (allComments.length > 0) {
        commentsMd = formatJiraCommentsMarkdown(allComments);
      } else if (fields.comment?.comments && Array.isArray(fields.comment.comments) && fields.comment.comments.length > 0) {
        commentsMd = formatJiraCommentsMarkdown(fields.comment.comments);
      }
    } catch (cErr) {
      console.warn('Failed fetching Jira comments:', cErr);
      if (fields.comment?.comments && Array.isArray(fields.comment.comments) && fields.comment.comments.length > 0) {
        commentsMd = formatJiraCommentsMarkdown(fields.comment.comments);
      }
    }
  }

  // Subtasks checklist
  const subtasks = Array.isArray(fields.subtasks) ? fields.subtasks : [];
  let subtasksMd = '';
  if (subtasks.length > 0) {
    subtasksMd += `### Subtasks (${subtasks.length})\n\n`;
    for (const st of subtasks) {
      const isDone = st.fields?.status?.statusCategory?.key === 'done';
      subtasksMd += `- [${isDone ? 'x' : ' '}] **${st.key}**: ${st.fields?.summary || ''} *(${st.fields?.status?.name || ''})*\n`;
    }
    subtasksMd += '\n';
  }

  // Build Markdown content
  const issueUrl = `${baseUrl}/browse/${key}`;
  let md = `> 🎫 **Jira Ticket:** [${key}](${issueUrl})  \n`;
  md += `> 📊 **Status:** \`${status}\` | ⚡ **Priority:** ${priority} | 📌 **Type:** ${issueType}  \n`;
  md += `> 👤 **Assignee:** ${assignee} | 🗣️ **Reporter:** ${reporter}  \n`;
  if (createdDate || updatedDate) {
    md += `> 📅 **Created:** ${createdDate} | 🔄 **Updated:** ${updatedDate}  \n`;
  }
  if (labels.length > 0) {
    md += `> 🏷️ **Labels:** ${labels.map((l: string) => `\`#${l}\``).join(' ')}  \n`;
  }
  md += `\n---\n\n`;

  if (descriptionMd) {
    md += `### Description\n\n${descriptionMd}\n\n`;
  }

  if (subtasksMd) {
    md += subtasksMd;
  }

  if (downloadedImages.length > 0) {
    md += `### Attachments (${downloadedImages.length})\n\n`;
    for (const imgPath of downloadedImages) {
      const fileName = path.basename(imgPath);
      md += `![${fileName}](local-media/${fileName})\n\n`;
    }
  }

  if (commentsMd) {
    md += commentsMd;
  }

  return {
    key,
    title: `[${key}] ${summary}`,
    markdown: md.trim(),
    labels: Array.from(new Set(['jira', key.toLowerCase(), ...labels])),
    images: downloadedImages,
    sourceUrl: issueUrl,
    status,
    priority,
    assignee,
    issueType,
  };
}

/**
 * Maps a raw Jira issue object to a compact summary item.
 */
function mapJiraIssueSummary(iss: any) {
  return {
    key: iss.key,
    summary: iss.fields?.summary || '',
    status: iss.fields?.status?.name || 'Unknown',
    statusCategory: iss.fields?.status?.statusCategory?.key || 'indeterminate',
    priority: iss.fields?.priority?.name || 'None',
    assignee: iss.fields?.assignee?.displayName || 'Unassigned',
    created: iss.fields?.created ? new Date(iss.fields.created).toLocaleDateString() : '',
    createdIso: iss.fields?.created || '',
    updated: iss.fields?.updated ? new Date(iss.fields.updated).toLocaleDateString() : '',
    updatedIso: iss.fields?.updated || '',
    issueType: iss.fields?.issuetype?.name || 'Issue',
    attachmentCount: Array.isArray(iss.fields?.attachment) ? iss.fields.attachment.length : 0,
  };
}

/**
 * Executes a paginated Jira JQL search supporting /rest/api/3/search/jql (POST & GET) and legacy /rest/api/2/search.
 */
async function executeJiraJqlSearch(params: {
  baseUrl: string;
  jiraHeaders: Record<string, string>;
  query: string;
  fieldsList: string[];
  targetLimit: number;
  expandList?: string[];
}): Promise<{ ok: true; issues: any[]; total: number } | { ok: false; status: number; error: string }> {
  const { baseUrl, jiraHeaders, query, fieldsList, targetLimit, expandList } = params;
  const allRawIssues: any[] = [];
  let reportedTotal = 0;
  let lastErrText = '';
  let lastErrStatus = 400;
  let successfulStrategy: 'post-v3' | 'get-v3' | 'get-v2' | null = null;
  let nextPageToken: string | undefined = undefined;

  while (allRawIssues.length < targetLimit) {
    const remaining = targetLimit - allRawIssues.length;
    const pageSize = Math.min(remaining, expandList?.length ? 50 : 100);
    let pageRes: Response | null = null;

    // Strategy 1 (Atlassian Cloud New Standard): POST /rest/api/3/search/jql
    if (!successfulStrategy || successfulStrategy === 'post-v3') {
      try {
        const bodyPayload: any = {
          jql: query,
          maxResults: pageSize,
          fields: fieldsList,
        };
        if (expandList && expandList.length > 0) {
          bodyPayload.expand = expandList;
        }
        if (nextPageToken) {
          bodyPayload.nextPageToken = nextPageToken;
        }
        const postRes: Response = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
          method: 'POST',
          headers: jiraHeaders,
          body: JSON.stringify(bodyPayload),
        });
        if (postRes.ok) {
          pageRes = postRes;
          successfulStrategy = 'post-v3';
        } else {
          lastErrStatus = postRes.status;
          lastErrText = await postRes.text();
          // If 400 without expand, it's likely a JQL syntax error; if expand was sent, allow GET fallback
          if (postRes.status === 400 && (!expandList || expandList.length === 0)) {
            pageRes = postRes;
          }
        }
      } catch (err: any) {
        lastErrText = err?.message || '';
      }
    }

    // Strategy 2: GET /rest/api/3/search/jql
    if (!pageRes && (!successfulStrategy || successfulStrategy === 'get-v3')) {
      try {
        const fieldsParam: string = fieldsList.join(',');
        const expandParam: string = expandList && expandList.length > 0 ? `&expand=${encodeURIComponent(expandList.join(','))}` : '';
        const tokenParam: string = nextPageToken ? `&nextPageToken=${encodeURIComponent(nextPageToken)}` : '';
        const getUrl: string = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(query)}&maxResults=${pageSize}&fields=${fieldsParam}${expandParam}${tokenParam}`;
        const getRes: Response = await fetch(getUrl, { headers: jiraHeaders });
        if (getRes.ok) {
          pageRes = getRes;
          successfulStrategy = 'get-v3';
        } else {
          lastErrStatus = getRes.status;
          lastErrText = await getRes.text();
          if (getRes.status === 400) {
            pageRes = getRes;
          }
        }
      } catch (err: any) {
        lastErrText = err?.message || lastErrText;
      }
    }

    // Strategy 3: Legacy GET /rest/api/2/search (for on-premise Jira Server / Data Center instances)
    if (!pageRes && (!successfulStrategy || successfulStrategy === 'get-v2')) {
      try {
        const startAt: number = allRawIssues.length;
        const expandParam: string = expandList && expandList.length > 0 ? `&expand=${encodeURIComponent(expandList.join(','))}` : '';
        const legacyUrl: string = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(query)}&startAt=${startAt}&maxResults=${pageSize}&fields=${fieldsList.join(',')}${expandParam}`;
        const legRes: Response = await fetch(legacyUrl, { headers: jiraHeaders });
        if (legRes.ok) {
          pageRes = legRes;
          successfulStrategy = 'get-v2';
        } else {
          lastErrStatus = legRes.status;
          const txt = await legRes.text();
          if (!lastErrText) lastErrText = txt;
        }
      } catch (err: any) {
        lastErrText = err?.message || lastErrText;
      }
    }

    if (!pageRes || !pageRes.ok) {
      if (allRawIssues.length > 0) {
        break;
      }
      let errMessage = lastErrText || 'Jira search request failed';
      try {
        const parsed = JSON.parse(errMessage);
        if (Array.isArray(parsed.errorMessages) && parsed.errorMessages.length > 0) {
          errMessage = parsed.errorMessages.join('; ');
        } else if (parsed.errors && Object.keys(parsed.errors).length > 0) {
          errMessage = Object.entries(parsed.errors).map(([k, v]) => `${k}: ${v}`).join('; ');
        }
      } catch {
        // Keep raw string if not JSON
      }
      const status = pageRes?.status || lastErrStatus || 400;
      return {
        ok: false,
        status,
        error: `JQL query failed (HTTP ${status}): ${errMessage}`,
      };
    }

    const pageData: any = await pageRes.json();
    const pageIssues: any[] = Array.isArray(pageData.issues) ? pageData.issues : [];
    if (typeof pageData.total === 'number') {
      reportedTotal = pageData.total;
    }

    allRawIssues.push(...pageIssues);

    if (pageData.isLast === true || pageIssues.length === 0) {
      break;
    }

    if (successfulStrategy === 'get-v2') {
      if (typeof pageData.total === 'number' && allRawIssues.length >= pageData.total) {
        break;
      }
    } else {
      if (!pageData.nextPageToken) {
        break;
      }
      nextPageToken = pageData.nextPageToken;
    }
  }

  return {
    ok: true,
    issues: allRawIssues,
    total: reportedTotal > 0 ? reportedTotal : allRawIssues.length,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action = 'fetch-issue',
      baseUrl: rawBaseUrl,
      email,
      apiToken,
      issueKey,
      issueKeys,
      jql,
      maxResults = 25,
      teamNames,
      days = 3,
      includeUpdated = true,
      downloadAttachments = true,
      includeComments = true,
      folderPath,
    } = body;

    if (!rawBaseUrl || !email || !apiToken) {
      return NextResponse.json(
        { error: 'Missing Jira credentials: baseUrl, email, and apiToken are required.' },
        { status: 400 }
      );
    }

    const baseUrl = normalizeJiraBaseUrl(rawBaseUrl);
    const authHeader = buildJiraAuthHeader(email, apiToken);

    let targetFolder = folderPath && typeof folderPath === 'string' && folderPath.trim()
      ? folderPath.trim()
      : getDefaultMediaFolder();

    try {
      if (!fs.existsSync(/*turbopackIgnore: true*/ targetFolder)) {
        fs.mkdirSync(/*turbopackIgnore: true*/ targetFolder, { recursive: true });
      }
    } catch {
      targetFolder = getDefaultMediaFolder();
    }

    const jiraHeaders: Record<string, string> = {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'User-Agent': 'KeepClone/1.0 (Atlassian Jira Integration)',
    };

    // 1. Action: Test Connection
    if (action === 'test-connection') {
      const testRes = await fetch(`${baseUrl}/rest/api/3/myself`, { headers: jiraHeaders });

      if (testRes.ok) {
        const userData = await testRes.json();
        return NextResponse.json({
          success: true,
          user: {
            displayName: userData.displayName,
            emailAddress: userData.emailAddress || email,
            accountId: userData.accountId,
            avatarUrl: userData.avatarUrls?.['48x48'] || userData.avatarUrls?.['32x32'],
            timeZone: userData.timeZone,
          },
        });
      }

      // Fallback to Jira API v2 (on-premise Jira Server / Data Center)
      const testV2 = await fetch(`${baseUrl}/rest/api/2/myself`, { headers: jiraHeaders });
      if (testV2.ok) {
        const userData = await testV2.json();
        return NextResponse.json({
          success: true,
          user: {
            displayName: userData.displayName || userData.name,
            emailAddress: userData.emailAddress || email,
            avatarUrl: userData.avatarUrls?.['48x48'],
          },
        });
      }

      const status = testRes.status || testV2.status;
      return NextResponse.json(
        {
          error: `Jira connection failed (HTTP ${status}). Please check your URL, email, and API token.`,
          status,
        },
        { status: 401 }
      );
    }

    // 2. Action: Fetch Single Issue
    if (action === 'fetch-issue') {
      if (!issueKey) {
        return NextResponse.json({ error: 'Missing issueKey parameter' }, { status: 400 });
      }

      const cleanKey = issueKey.trim().toUpperCase();
      let issueRes = await fetch(
        `${baseUrl}/rest/api/3/issue/${cleanKey}?fields=*all&expand=renderedFields,names,schema,renderedBody`,
        { headers: jiraHeaders }
      );

      if (!issueRes.ok) {
        // Fallback to API v2
        issueRes = await fetch(
          `${baseUrl}/rest/api/2/issue/${cleanKey}?fields=*all&expand=renderedFields,names,schema,renderedBody`,
          { headers: jiraHeaders }
        );
      }

      if (!issueRes.ok) {
        return NextResponse.json(
          { error: `Issue ${cleanKey} not found or permission denied (HTTP ${issueRes.status})` },
          { status: issueRes.status }
        );
      }

      const issueData = await issueRes.json();
      const notePayload = await processJiraIssueToNote(
        issueData,
        baseUrl,
        authHeader,
        targetFolder,
        downloadAttachments,
        includeComments
      );

      return NextResponse.json({
        success: true,
        note: notePayload,
      });
    }

    // 3. Action: Search JQL (Supports paginated retrieval of ALL matching issues via /rest/api/3/search/jql)
    if (action === 'search-jql') {
      const query = (jql || 'order by updated desc').trim();
      const fieldsList = [
        'summary',
        'status',
        'priority',
        'assignee',
        'reporter',
        'issuetype',
        'created',
        'updated',
        'attachment',
      ];
      const requestedMax = Number(maxResults);
      const targetLimit = requestedMax > 0 ? requestedMax : 500;

      const searchResult = await executeJiraJqlSearch({
        baseUrl,
        jiraHeaders,
        query,
        fieldsList,
        targetLimit,
      });

      if (!searchResult.ok) {
        return NextResponse.json({ error: searchResult.error }, { status: searchResult.status });
      }

      const issues = searchResult.issues.map(mapJiraIssueSummary);
      return NextResponse.json({
        success: true,
        total: searchResult.total,
        issues,
      });
    }

    // 3b. Action: Search Team Activity (tickets created/updated in last N days assigned to OR updated by team members)
    if (action === 'search-team-activity') {
      const defaultTeam = ['Angelcho', 'Jaime', 'Szabolcs', 'Scarlat', 'David', 'Luca', 'Adam'];
      const members: string[] = Array.isArray(teamNames) && teamNames.length > 0
        ? teamNames.map((n: any) => String(n).trim()).filter(Boolean)
        : defaultTeam;
      const daysNum = Math.max(1, Math.min(Number(days) || 3, 60));
      const checkUpdated = includeUpdated !== false;
      const cutoffMs = Date.now() - daysNum * 24 * 60 * 60 * 1000;

      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const memberMatchers = members.map((name) => ({
        name,
        regex: new RegExp(`(?:^|[\\s._-])${escapeRegex(name)}(?:$|[\\s._-@])`, 'i'),
      }));

      // Resolve Jira accountIds for team member names in parallel
      const accountIdToMember = new Map<string, string>();
      await Promise.all(
        members.map(async (memberName) => {
          const matcher = memberMatchers.find((m) => m.name === memberName)!;
          for (const apiVer of ['3', '2']) {
            try {
              const userRes = await fetch(
                `${baseUrl}/rest/api/${apiVer}/user/search?query=${encodeURIComponent(memberName)}&maxResults=20`,
                { headers: jiraHeaders }
              );
              if (userRes.ok) {
                const users: any[] = await userRes.json();
                if (Array.isArray(users)) {
                  for (const u of users) {
                    const hay = `${u?.displayName || ''} ${u?.emailAddress || ''} ${u?.name || ''}`;
                    if (u?.accountId && matcher.regex.test(hay)) {
                      accountIdToMember.set(u.accountId, memberName);
                    }
                  }
                }
                break;
              }
            } catch {
              // Non-fatal: fall back to displayName/email matching on returned issues
            }
          }
        })
      );

      const dateClause = checkUpdated
        ? `(created >= -${daysNum}d OR updated >= -${daysNum}d)`
        : `created >= -${daysNum}d`;

      const teamFields = [
        'summary',
        'status',
        'priority',
        'assignee',
        'reporter',
        'creator',
        'issuetype',
        'created',
        'updated',
        'attachment',
        'comment',
      ];

      const accountIds = Array.from(accountIdToMember.keys());
      const searchPromises: Array<Promise<{ ok: true; issues: any[]; total: number } | { ok: false; status: number; error: string }>> = [];

      // Query A: Direct JQL match by resolved accountIds (guarantees catching all assigned/reported/created tickets even on large sites)
      if (accountIds.length > 0) {
        const quotedIds = accountIds.map((id) => `"${id}"`).join(', ');
        const directJql = `${dateClause} AND (assignee in (${quotedIds}) OR reporter in (${quotedIds}) OR creator in (${quotedIds})) ORDER BY updated DESC`;
        searchPromises.push(
          executeJiraJqlSearch({
            baseUrl,
            jiraHeaders,
            query: directJql,
            fieldsList: teamFields,
            targetLimit: 500,
          })
        );
      }

      // Query B: Scan recent tickets with changelog & comments to catch any ticket updated/commented by team members even if assigned elsewhere
      const recentJql = `${dateClause} ORDER BY updated DESC`;
      searchPromises.push(
        executeJiraJqlSearch({
          baseUrl,
          jiraHeaders,
          query: recentJql,
          fieldsList: teamFields,
          targetLimit: 500,
          expandList: ['changelog'],
        }).then(async (res) => {
          // If changelog expansion triggers a Jira limit or rejection, fall back gracefully to comments + fields
          if (!res.ok) {
            return executeJiraJqlSearch({
              baseUrl,
              jiraHeaders,
              query: recentJql,
              fieldsList: teamFields,
              targetLimit: 500,
            });
          }
          return res;
        })
      );

      const results = await Promise.all(searchPromises);
      const anySuccess = results.some((r) => r.ok);
      if (!anySuccess) {
        const firstErr = results[0] as { ok: false; status: number; error: string };
        return NextResponse.json({ error: firstErr.error }, { status: firstErr.status });
      }

      const matchUserToMember = (userObj: any): string | null => {
        if (!userObj) return null;
        if (userObj.accountId && accountIdToMember.has(userObj.accountId)) {
          return accountIdToMember.get(userObj.accountId)!;
        }
        const hay = `${userObj.displayName || ''} ${userObj.emailAddress || ''} ${userObj.name || ''}`.trim();
        if (!hay) return null;
        for (const m of memberMatchers) {
          if (m.regex.test(hay)) {
            return m.name;
          }
        }
        return null;
      };

      // Deduplicate and merge issues while extracting matched team members & activity reasons
      const mergedMap = new Map<string, { raw: any; members: Set<string>; reasons: Set<string> }>();

      for (const res of results) {
        if (!res.ok) continue;
        for (const iss of res.issues) {
          if (!iss?.key) continue;
          let entry = mergedMap.get(iss.key);
          if (!entry) {
            entry = { raw: iss, members: new Set<string>(), reasons: new Set<string>() };
            mergedMap.set(iss.key, entry);
          } else if (iss.changelog && !entry.raw.changelog) {
            entry.raw = iss;
          }

          // 1. Check Assignee
          const assigneeMember = matchUserToMember(iss.fields?.assignee);
          if (assigneeMember) {
            entry.members.add(assigneeMember);
            entry.reasons.add(`Assigned: ${assigneeMember}`);
          }

          // 2. Check Creator / Reporter if created within the requested window
          const createdMs = iss.fields?.created ? new Date(iss.fields.created).getTime() : 0;
          if (createdMs >= cutoffMs) {
            const creatorMember = matchUserToMember(iss.fields?.creator) || matchUserToMember(iss.fields?.reporter);
            if (creatorMember) {
              entry.members.add(creatorMember);
              entry.reasons.add(`Created by ${creatorMember}`);
            }
          }

          // 3. Check Changelog Histories within window (for "updated by them")
          const histories = iss.changelog?.histories;
          if (checkUpdated && Array.isArray(histories)) {
            for (const h of histories) {
              const histMs = h?.created ? new Date(h.created).getTime() : 0;
              if (histMs >= cutoffMs) {
                const actorMember = matchUserToMember(h.author);
                if (actorMember) {
                  entry.members.add(actorMember);
                  entry.reasons.add(`Updated by ${actorMember}`);
                }
              }
            }
          }

          // 4. Check Comments within window (commenting also updates the ticket)
          const comments = iss.fields?.comment?.comments;
          if (checkUpdated && Array.isArray(comments)) {
            for (const c of comments) {
              const cMs = new Date(c?.updated || c?.created || 0).getTime();
              if (cMs >= cutoffMs) {
                const cMember = matchUserToMember(c.updateAuthor) || matchUserToMember(c.author);
                if (cMember) {
                  entry.members.add(cMember);
                  entry.reasons.add(`Commented by ${cMember}`);
                }
              }
            }
          }
        }
      }

      const matchedIssues = Array.from(mergedMap.values())
        .filter((item) => item.members.size > 0)
        .map((item) => ({
          ...mapJiraIssueSummary(item.raw),
          matchedMembers: Array.from(item.members),
          activityReasons: Array.from(item.reasons),
        }))
        .sort((a, b) => {
          const ta = a.updatedIso ? new Date(a.updatedIso).getTime() : 0;
          const tb = b.updatedIso ? new Date(b.updatedIso).getTime() : 0;
          return tb - ta;
        });

      return NextResponse.json({
        success: true,
        total: matchedIssues.length,
        resolvedUsersCount: accountIds.length,
        issues: matchedIssues,
      });
    }

    // 4. Action: Batch Download Issues
    if (action === 'batch-download') {
      const keys: string[] = Array.isArray(issueKeys)
        ? issueKeys
        : (issueKey ? [issueKey] : []);

      if (keys.length === 0) {
        return NextResponse.json({ error: 'No issue keys provided for batch download' }, { status: 400 });
      }

      const results = [];
      const errors = [];

      for (const k of keys.slice(0, 200)) {
        // Max 30 per batch to prevent long server timeouts
        try {
          const cleanK = k.trim().toUpperCase();
          let issueRes = await fetch(
            `${baseUrl}/rest/api/3/issue/${cleanK}?fields=*all&expand=renderedFields,names,schema,renderedBody`,
            { headers: jiraHeaders }
          );

          if (!issueRes.ok) {
            issueRes = await fetch(
              `${baseUrl}/rest/api/2/issue/${cleanK}?fields=*all&expand=renderedFields,names,schema,renderedBody`,
              { headers: jiraHeaders }
            );
          }

          if (issueRes.ok) {
            const issueData = await issueRes.json();
            const note = await processJiraIssueToNote(
              issueData,
              baseUrl,
              authHeader,
              targetFolder,
              downloadAttachments,
              includeComments
            );
            results.push(note);
          } else {
            errors.push({ key: cleanK, error: `HTTP ${issueRes.status}` });
          }
        } catch (err: any) {
          errors.push({ key: k, error: err?.message || 'Download failed' });
        }
      }

      return NextResponse.json({
        success: true,
        downloadedCount: results.length,
        notes: results,
        errors,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Jira API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Jira error' }, { status: 500 });
  }
}
