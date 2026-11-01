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
 * Parses any Jira comment body (rendered HTML, ADF object, or Wiki markup string)
 */
function parseJiraCommentBody(c: any): string {
  if (!c) return '';

  if (c.renderedBody && typeof c.renderedBody === 'string') {
    return c.renderedBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
      .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
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

    md += `> 💬 **${author}** *(${cDate})*:\n`;
    if (body) {
      const lines = body.split('\n');
      for (const line of lines) {
        md += `> ${line}\n`;
      }
    } else {
      md += `> *(empty comment or attachment)*\n`;
    }
    md += `\n`;
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

    const targetFolder = folderPath && fs.existsSync(/*turbopackIgnore: true*/ folderPath)
      ? folderPath
      : getDefaultMediaFolder();

    if (!fs.existsSync(/*turbopackIgnore: true*/ targetFolder)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ targetFolder, { recursive: true });
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

    // 3. Action: Search JQL
    if (action === 'search-jql') {
      const query = (jql || 'order by updated desc').trim();
      const searchUrl = `${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(query)}&maxResults=${maxResults}&fields=summary,status,priority,assignee,reporter,issuetype,updated,attachment`;

      let searchRes = await fetch(searchUrl, { headers: jiraHeaders });

      if (!searchRes.ok) {
        // Fallback to v2
        const searchV2 = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(query)}&maxResults=${maxResults}&fields=summary,status,priority,assignee,reporter,issuetype,updated,attachment`;
        searchRes = await fetch(searchV2, { headers: jiraHeaders });
      }

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        return NextResponse.json(
          { error: `JQL query failed (HTTP ${searchRes.status}): ${errText}` },
          { status: searchRes.status }
        );
      }

      const data = await searchRes.json();
      const issues = (data.issues || []).map((iss: any) => ({
        key: iss.key,
        summary: iss.fields?.summary || '',
        status: iss.fields?.status?.name || 'Unknown',
        statusCategory: iss.fields?.status?.statusCategory?.key || 'indeterminate',
        priority: iss.fields?.priority?.name || 'None',
        assignee: iss.fields?.assignee?.displayName || 'Unassigned',
        updated: iss.fields?.updated ? new Date(iss.fields.updated).toLocaleDateString() : '',
        issueType: iss.fields?.issuetype?.name || 'Issue',
        attachmentCount: Array.isArray(iss.fields?.attachment) ? iss.fields.attachment.length : 0,
      }));

      return NextResponse.json({
        success: true,
        total: data.total || issues.length,
        issues,
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

      for (const k of keys.slice(0, 30)) {
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
