import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

function getUniqueFilePath(dir: string, desiredName: string): { finalName: string; fullPath: string } {
  const safeName = sanitizeFileName(desiredName) || `supportbench-file-${Date.now()}`;
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
 * Normalizes Supportbench domain or URL to the canonical API base URL.
 * The official Supportbench API is hosted on https://api.supportbench.net.
 * If user enters app.supportbench.net, supportbench.com, or a tenant name,
 * we map to https://api.supportbench.net or the custom instance API.
 */
export function normalizeSupportbenchBaseUrl(input: string): string {
  let clean = (input || '').trim().replace(/\/+$/, '');
  if (!clean) {
    return 'https://api.supportbench.net';
  }

  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }

  try {
    const url = new URL(clean);
    const host = url.hostname.toLowerCase();
    // Supportbench web app domains map to api.supportbench.net
    if (
      host === 'supportbench.net' ||
      host === 'app.supportbench.net' ||
      host === 'supportbench.com' ||
      host === 'app.supportbench.com' ||
      host === 'www.supportbench.com' ||
      host === 'api.supportbench.com'
    ) {
      return 'https://api.supportbench.net';
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://api.supportbench.net';
  }
}

/**
 * Builds request headers for Supportbench API.
 * Supportbench uses ASP.NET Core Kestrel with Authorization: Bearer <token>.
 * Also supplies x-api-key and api-key for complete compatibility.
 */
export function buildSupportbenchHeaders(token: string): Record<string, string> {
  const cleanToken = (token || '').trim();
  const bearerToken = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
  const rawToken = cleanToken.replace(/^Bearer\s+/i, '');

  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'User-Agent': 'Keep-Clone-Supportbench-Agent/1.0',
  };

  if (rawToken) {
    headers['Authorization'] = bearerToken;
    headers['x-api-key'] = rawToken;
    headers['api-key'] = rawToken;
    headers['apikey'] = rawToken;
    headers['token'] = rawToken;
  }

  return headers;
}

/**
 * Converts HTML to clean, readable Markdown without arbitrary blockquotes.
 * Code blocks become ```lang\n...```, inline code becomes `...`,
 * lists, bold, italics, links, and paragraphs are preserved.
 */
function htmlToCleanMarkdown(html: string): string {
  if (!html) return '';
  let text = html;

  // Remove scripts, styles, comments
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Preserve pre/code blocks
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
    return `___SUPPORTBENCH_CODE_BLOCK_${idx}___`;
  });

  // Headers
  text = text.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  text = text.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  text = text.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  text = text.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // Real blockquotes (from HTML <blockquote>)
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

  // Paragraphs & breaks
  text = text.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Links
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, linkText) => {
    const cleanLink = linkText.replace(/<[^>]+>/g, '').trim();
    if (!cleanLink) return '';
    return `[${cleanLink}](${href})`;
  });

  // Formatting
  text = text.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  text = text.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  text = text.replace(/<(?:del|s|strike)\b[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~');
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Restore preserved code blocks
  text = text.replace(/___SUPPORTBENCH_CODE_BLOCK_(\d+)___/g, (_match, idx) => {
    return codeBlocks[parseInt(idx, 10)] || '';
  });

  // Clean HTML entities & whitespace
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Downloads an image or attachment file locally to target directory
 */
async function downloadMediaLocally(
  url: string,
  targetFolder: string,
  headers: Record<string, string>,
  suggestedName?: string
): Promise<{ fileName: string; fullPath: string; serveUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        ...headers,
        Accept: '*/*',
      },
    });

    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    let ext = '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('svg')) ext = '.svg';
    else if (contentType.includes('pdf')) ext = '.pdf';
    else if (contentType.includes('zip')) ext = '.zip';

    let fallbackName = suggestedName || `sb-media-${Date.now()}${ext}`;
    if (!path.extname(fallbackName)) fallbackName += ext;

    if (!fs.existsSync(/*turbopackIgnore: true*/ targetFolder)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ targetFolder, { recursive: true });
    }

    const { finalName, fullPath } = getUniqueFilePath(targetFolder, fallbackName);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(/*turbopackIgnore: true*/ fullPath, buffer);

    return {
      fileName: finalName,
      fullPath,
      serveUrl: `/api/local-media?file=${encodeURIComponent(finalName)}`,
    };
  } catch (err) {
    console.warn(`[Supportbench] Media download failed for ${url}:`, err);
    return null;
  }
}

/**
 * Extracts case ID or number from string or URL
 */
function extractCaseId(input: string): string {
  let clean = input.trim();
  if (!clean) return '';

  const urlMatch = clean.match(/(?:cases|case|tickets|ticket)\/(?:view\/|details\/|get\/)?([A-Za-z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  clean = clean.replace(/^[#\s]+/, '').replace(/^case:\s*/i, '');
  return clean;
}

/**
 * Parses and formats an activity / comment item into clean markdown
 */
function formatActivityItem(act: any): { author: string; date: string; type: string; markdown: string } {
  const author =
    act.Author?.Name ||
    act.Author?.DisplayName ||
    act.Author?.Email ||
    act.author?.name ||
    act.author?.displayName ||
    act.author?.email ||
    act.User?.Name ||
    act.User?.DisplayName ||
    act.user?.name ||
    act.user?.displayName ||
    act.CreatedBy?.Name ||
    act.created_by?.name ||
    act.From ||
    act.from ||
    act.Agent?.Name ||
    act.agent ||
    'Agent';

  const date =
    act.CreatedDate ||
    act.created_date ||
    act.CreatedAt ||
    act.created_at ||
    act.Created ||
    act.created ||
    act.Date ||
    act.date ||
    act.Timestamp ||
    act.timestamp ||
    '';

  const formattedDate = date ? new Date(date).toLocaleString() : '';
  const type = (
    act.Type ||
    act.type ||
    act.ActivityType ||
    act.activity_type ||
    act.ActionType ||
    act.action_type ||
    act.Action ||
    act.action ||
    'Comment'
  ).toUpperCase();

  const rawBody =
    act.HtmlBody ||
    act.html_body ||
    act.Body ||
    act.body ||
    act.Content ||
    act.content ||
    act.Comment ||
    act.comment ||
    act.Text ||
    act.text ||
    act.Message ||
    act.message ||
    act.Description ||
    act.description ||
    '';

  const cleanMd = typeof rawBody === 'string' ? htmlToCleanMarkdown(rawBody) : JSON.stringify(rawBody);

  return {
    author,
    date: formattedDate,
    type,
    markdown: cleanMd,
  };
}

/**
 * Fetches a single case from Supportbench using its real ASP.NET Core endpoints.
 * Prioritizes:
 * 1. GET /case/{id}
 * 2. GET /case/get?id={id} or ?caseNumber={id}
 * 3. GET /case/find?id={id}
 * 4. GET /case/all (filtered)
 */
async function fetchCaseData(
  baseUrl: string,
  headers: Record<string, string>,
  caseId: string
): Promise<{ caseObj: any; sourceUrl: string }> {
  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);

  const candidates = [
    // Real Supportbench endpoints (ASP.NET Core)
    `${cleanBase}/case/${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/get?id=${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/get?caseNumber=${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/get?number=${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/find?id=${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/find?case_number=${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/find?number=${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/details/${encodeURIComponent(caseId)}`,
    `${cleanBase}/case/info/${encodeURIComponent(caseId)}`,
    // Fallback standard REST
    `${cleanBase}/cases/${encodeURIComponent(caseId)}`,
    `${cleanBase}/v1/cases/${encodeURIComponent(caseId)}`,
    `${cleanBase}/api/v1/cases/${encodeURIComponent(caseId)}`,
  ];

  let caseObj: any = null;
  let successfulUrl = `${cleanBase}/case/${caseId}`;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.Case && typeof data.Case === 'object') {
          caseObj = data.Case;
        } else if (data.case && typeof data.case === 'object') {
          caseObj = data.case;
        } else if (data.Data && typeof data.Data === 'object' && !Array.isArray(data.Data)) {
          caseObj = data.Data;
        } else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
          caseObj = data.data;
        } else if (Array.isArray(data.Data) && data.Data.length > 0) {
          caseObj = data.Data[0];
        } else if (Array.isArray(data.data) && data.data.length > 0) {
          caseObj = data.data[0];
        } else if (Array.isArray(data.Cases) && data.Cases.length > 0) {
          caseObj = data.Cases[0];
        } else if (Array.isArray(data.cases) && data.cases.length > 0) {
          caseObj = data.cases[0];
        } else if (Array.isArray(data) && data.length > 0) {
          caseObj = data[0];
        } else if (
          data.Id ||
          data.id ||
          data.CaseNumber ||
          data.case_number ||
          data.Number ||
          data.number ||
          data.Subject ||
          data.subject ||
          data.Title ||
          data.title
        ) {
          caseObj = data;
        }

        if (caseObj) {
          successfulUrl = url;
          break;
        }
      }
    } catch {
      // try next candidate
    }
  }

  // If still not found, try querying /case/all and filtering by ID or Number
  if (!caseObj) {
    try {
      const allRes = await fetch(`${cleanBase}/case/all`, { headers });
      if (allRes.ok) {
        const allData = await allRes.json();
        const list = Array.isArray(allData)
          ? allData
          : Array.isArray(allData.Cases)
          ? allData.Cases
          : Array.isArray(allData.cases)
          ? allData.cases
          : Array.isArray(allData.Data)
          ? allData.Data
          : Array.isArray(allData.data)
          ? allData.data
          : [];

        const found = list.find((c: any) => {
          const num = String(c.CaseNumber || c.case_number || c.Number || c.number || c.Id || c.id || '');
          return num.toLowerCase() === caseId.toLowerCase();
        });

        if (found) {
          caseObj = found;
          successfulUrl = `${cleanBase}/case/${caseId}`;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!caseObj) {
    throw new Error(`Case '${caseId}' not found on Supportbench (${cleanBase}). Please check the case number and your API token permissions.`);
  }

  return { caseObj, sourceUrl: successfulUrl };
}

/**
 * Fetches activities/comments for a case from embedded objects or Supportbench endpoints
 */
async function fetchCaseActivities(
  baseUrl: string,
  headers: Record<string, string>,
  caseObj: any,
  caseId: string
): Promise<any[]> {
  // Check embedded activities (Supportbench returns them directly inside the case object)
  const embeddedCandidates = [
    caseObj.Activities,
    caseObj.activities,
    caseObj.Actions,
    caseObj.actions,
    caseObj.Comments,
    caseObj.comments,
    caseObj.Notes,
    caseObj.notes,
    caseObj.Timeline,
    caseObj.timeline,
    caseObj.Messages,
    caseObj.messages,
  ];

  for (const arr of embeddedCandidates) {
    if (Array.isArray(arr) && arr.length > 0) {
      return arr;
    }
  }

  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  const targetId = caseObj.Id || caseObj.id || caseObj.CaseId || caseObj.case_id || caseId;

  const activityEndpoints = [
    `${cleanBase}/activity/get?caseId=${encodeURIComponent(targetId)}`,
    `${cleanBase}/activity/get?case_id=${encodeURIComponent(targetId)}`,
    `${cleanBase}/activity/get?id=${encodeURIComponent(targetId)}`,
    `${cleanBase}/activity/${encodeURIComponent(targetId)}`,
    `${cleanBase}/case/${encodeURIComponent(targetId)}/activities`,
    `${cleanBase}/case/${encodeURIComponent(targetId)}/activity`,
    `${cleanBase}/case/${encodeURIComponent(targetId)}/comments`,
    `${cleanBase}/case/${encodeURIComponent(targetId)}/actions`,
  ];

  for (const url of activityEndpoints) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.Activities)
          ? data.Activities
          : Array.isArray(data.activities)
          ? data.activities
          : Array.isArray(data.Comments)
          ? data.Comments
          : Array.isArray(data.comments)
          ? data.comments
          : Array.isArray(data.Actions)
          ? data.Actions
          : Array.isArray(data.actions)
          ? data.actions
          : Array.isArray(data.Data)
          ? data.Data
          : Array.isArray(data.data)
          ? data.data
          : [];
        if (list.length > 0) {
          return list;
        }
      }
    } catch {
      // try next
    }
  }

  return [];
}

/**
 * Processes case data into a clean Keep note
 */
async function processSupportbenchCaseToNote(
  caseObj: any,
  activities: any[],
  baseUrl: string,
  headers: Record<string, string>,
  targetFolder: string,
  downloadAttachments: boolean = true
) {
  const caseId = String(
    caseObj.Id || caseObj.id || caseObj.CaseId || caseObj.case_id || caseObj.CaseNumber || caseObj.case_number || 'Case'
  );
  const caseNumber = String(
    caseObj.CaseNumber || caseObj.case_number || caseObj.Number || caseObj.number || caseObj.Id || caseObj.id || caseId
  );
  const subject =
    caseObj.Subject ||
    caseObj.subject ||
    caseObj.Title ||
    caseObj.title ||
    caseObj.Summary ||
    caseObj.summary ||
    caseObj.Name ||
    caseObj.name ||
    `Case #${caseNumber}`;

  const statusRaw = caseObj.Status ?? caseObj.status ?? caseObj.State ?? caseObj.state ?? 'Open';
  const status =
    typeof statusRaw === 'object'
      ? statusRaw?.Name || statusRaw?.name || statusRaw?.Label || statusRaw?.label || 'Open'
      : String(statusRaw);

  const priorityRaw = caseObj.Priority ?? caseObj.priority ?? caseObj.Severity ?? caseObj.severity ?? 'Normal';
  const priority =
    typeof priorityRaw === 'object'
      ? priorityRaw?.Name || priorityRaw?.name || priorityRaw?.Label || priorityRaw?.label || 'Normal'
      : String(priorityRaw);

  const stageRaw = caseObj.Stage ?? caseObj.stage ?? '';
  const stage =
    typeof stageRaw === 'object'
      ? stageRaw?.Name || stageRaw?.name || stageRaw?.Label || stageRaw?.label || ''
      : String(stageRaw);

  const assignee =
    caseObj.Assignee?.Name ||
    caseObj.Assignee?.DisplayName ||
    caseObj.assignee?.name ||
    caseObj.assignee?.displayName ||
    caseObj.AssignedTo?.Name ||
    caseObj.AssignedTo?.DisplayName ||
    caseObj.assigned_to?.name ||
    caseObj.Agent?.Name ||
    caseObj.Agent?.Email ||
    caseObj.agent?.name ||
    (typeof caseObj.Assignee === 'string' ? caseObj.Assignee : '') ||
    (typeof caseObj.assigned_to === 'string' ? caseObj.assigned_to : '') ||
    'Unassigned';

  const contact =
    caseObj.Contact?.Name ||
    caseObj.Contact?.DisplayName ||
    caseObj.Contact?.Email ||
    caseObj.contact?.name ||
    caseObj.contact?.displayName ||
    caseObj.contact?.email ||
    caseObj.Customer?.Name ||
    caseObj.customer?.name ||
    caseObj.Reporter?.Name ||
    caseObj.reporter?.name ||
    caseObj.Requester?.Name ||
    (typeof caseObj.Contact === 'string' ? caseObj.Contact : '') ||
    (typeof caseObj.contact === 'string' ? caseObj.contact : '') ||
    'Unknown';

  const account =
    caseObj.Company?.Name ||
    caseObj.company?.name ||
    caseObj.Account?.Name ||
    caseObj.account?.name ||
    caseObj.Organization?.Name ||
    (typeof caseObj.Company === 'string' ? caseObj.Company : '') ||
    (typeof caseObj.Account === 'string' ? caseObj.Account : '') ||
    '';

  const createdDate =
    caseObj.CreatedDate ||
    caseObj.created_date ||
    caseObj.CreatedAt ||
    caseObj.created_at ||
    caseObj.Created ||
    caseObj.created;

  const updatedDate =
    caseObj.UpdatedDate ||
    caseObj.updated_date ||
    caseObj.UpdatedAt ||
    caseObj.updated_at ||
    caseObj.Updated ||
    caseObj.updated;

  // Process raw description
  const rawDescription =
    caseObj.Description ||
    caseObj.description ||
    caseObj.HtmlBody ||
    caseObj.html_body ||
    caseObj.Body ||
    caseObj.body ||
    caseObj.Content ||
    caseObj.content ||
    caseObj.Details ||
    caseObj.details ||
    '';

  let descriptionMd = htmlToCleanMarkdown(rawDescription);

  // Extract tags / labels
  const labels: string[] = ['supportbench', `case-${caseNumber}`];
  if (status) labels.push(status.toLowerCase().replace(/\s+/g, '-'));
  const tagsList = caseObj.Tags || caseObj.tags || caseObj.Labels || caseObj.labels;
  if (Array.isArray(tagsList)) {
    for (const t of tagsList) {
      const tagStr = typeof t === 'string' ? t : t?.Name || t?.name || '';
      if (tagStr) labels.push(tagStr.toLowerCase().replace(/\s+/g, '-'));
    }
  }

  // Find all attachments in case and activities
  const allAttachments: any[] = [];
  if (Array.isArray(caseObj.Attachments)) allAttachments.push(...caseObj.Attachments);
  if (Array.isArray(caseObj.attachments)) allAttachments.push(...caseObj.attachments);
  if (Array.isArray(caseObj.Files)) allAttachments.push(...caseObj.Files);
  if (Array.isArray(caseObj.files)) allAttachments.push(...caseObj.files);

  for (const act of activities) {
    if (Array.isArray(act.Attachments)) allAttachments.push(...act.Attachments);
    if (Array.isArray(act.attachments)) allAttachments.push(...act.attachments);
    if (Array.isArray(act.Files)) allAttachments.push(...act.Files);
    if (Array.isArray(act.files)) allAttachments.push(...act.files);
  }

  // Download media files locally
  const downloadedFiles: Array<{ fileName: string; fullPath: string; serveUrl: string }> = [];
  if (downloadAttachments && allAttachments.length > 0) {
    for (const att of allAttachments) {
      const fileUrl =
        att.Url ||
        att.url ||
        att.DownloadUrl ||
        att.download_url ||
        att.FileUrl ||
        att.file_url ||
        att.Link ||
        att.link ||
        att.Href ||
        att.href;
      if (!fileUrl) continue;
      const fileName =
        att.Name ||
        att.name ||
        att.Filename ||
        att.filename ||
        att.FileName ||
        att.file_name ||
        `attachment-${att.Id || att.id || Date.now()}`;
      const downloaded = await downloadMediaLocally(fileUrl, targetFolder, headers, fileName);
      if (downloaded) {
        downloadedFiles.push(downloaded);
      }
    }
  }

  // Construct Clean Markdown Note
  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  const portalUrl = `${cleanBase}/case/${caseNumber}`;

  let markdown = `> 🎫 **Supportbench Case:** [**#${caseNumber} - ${subject}**](${portalUrl})  \n`;
  markdown += `> 📊 **Status:** \`${status}\` | ⚡ **Priority:** ${priority}${stage ? ` | 🏷️ **Stage:** ${stage}` : ''}  \n`;
  markdown += `> 👤 **Assignee:** ${assignee} | 👥 **Customer:** ${contact}${account ? ` (${account})` : ''}  \n`;
  if (createdDate || updatedDate) {
    markdown += `> 🕒 **Created:** ${createdDate ? new Date(createdDate).toLocaleString() : 'N/A'}${updatedDate ? ` | **Updated:** ${new Date(updatedDate).toLocaleString()}` : ''}  \n`;
  }
  markdown += `\n---\n\n`;

  // Description section
  if (descriptionMd.trim()) {
    markdown += `### Case Description\n\n${descriptionMd.trim()}\n\n`;
  }

  // Downloaded attachments section
  if (downloadedFiles.length > 0) {
    markdown += `### Attachments & Files (${downloadedFiles.length})\n\n`;
    for (const f of downloadedFiles) {
      const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(f.fileName);
      if (isImg) {
        markdown += `![${f.fileName}](${f.serveUrl})\n\n`;
      } else {
        markdown += `- [📎 ${f.fileName}](${f.serveUrl})\n`;
      }
    }
    markdown += '\n';
  }

  // Activities & Comments Section (Chronological)
  if (activities.length > 0) {
    markdown += `### Case Timeline & Comments (${activities.length})\n\n`;
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const parsed = formatActivityItem(act);

      markdown += `#### 💬 **${parsed.author}** · *${parsed.date || 'Recent'}* \`[${parsed.type}]\`\n\n`;
      if (parsed.markdown) {
        markdown += `${parsed.markdown}\n\n`;
      } else {
        markdown += `*(empty update or status change)*\n\n`;
      }

      if (i < activities.length - 1) {
        markdown += `---\n\n`;
      }
    }
  }

  return {
    caseId,
    caseNumber,
    title: `[Case #${caseNumber}] ${subject}`,
    markdown: markdown.trim(),
    labels,
    images: downloadedFiles.filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f.fileName)).map((f) => f.fullPath),
    sourceUrl: portalUrl,
    status,
    priority,
    assignee,
    contact,
    account,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, baseUrl, apiToken, caseIdentifier, caseIdentifiers, downloadAttachments = true, folderPath } = body;

    const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
    const headers = buildSupportbenchHeaders(apiToken);
    const targetFolder = folderPath && fs.existsSync(folderPath) ? folderPath : getDefaultMediaFolder();

    // 1. Action: Test Connection
    if (action === 'test-connection') {
      const testCandidates = [
        `${cleanBase}/users/me`,
        `${cleanBase}/users/get`,
        `${cleanBase}/case/all`,
        `${cleanBase}/case/get`,
        `${cleanBase}/case/query`,
        `${cleanBase}/activity/get`,
      ];

      let lastError = '';
      for (const endpoint of testCandidates) {
        try {
          const res = await fetch(endpoint, { headers });
          if (res.ok) {
            let userData: any = { displayName: 'Supportbench User', email: 'connected@supportbench' };
            try {
              const data = await res.json();
              const userObj = data.User || data.user || data.Profile || data.profile || data.Data || data.data || data;
              if (userObj.Name || userObj.name || userObj.Email || userObj.email || userObj.DisplayName || userObj.displayName) {
                userData = {
                  displayName: userObj.Name || userObj.name || userObj.DisplayName || userObj.displayName || 'Supportbench User',
                  email: userObj.Email || userObj.email || 'connected',
                  id: userObj.Id || userObj.id || undefined,
                };
              }
            } catch {
              // json parse failure is ok if HTTP status was 200
            }
            return NextResponse.json({ success: true, user: userData, endpoint });
          } else if (res.status === 401 || res.status === 403) {
            return NextResponse.json(
              {
                success: false,
                error: `Authentication failed (HTTP ${res.status}): Please check your API Token or Key. Make sure you generated the token from Supportbench Settings.`,
              },
              { status: 401 }
            );
          } else if (res.status !== 404 && res.status !== 405) {
            lastError = `HTTP ${res.status} from ${endpoint}`;
          }
        } catch (err: any) {
          lastError = err?.message || 'Network error';
        }
      }

      return NextResponse.json(
        { success: false, error: `Could not connect to Supportbench at ${cleanBase}. (${lastError || 'Endpoint unreachable'})` },
        { status: 400 }
      );
    }

    // 2. Action: Fetch Single Case
    if (action === 'fetch-case') {
      if (!caseIdentifier) {
        return NextResponse.json({ success: false, error: 'Case identifier is required.' }, { status: 400 });
      }

      const caseId = extractCaseId(caseIdentifier);
      const { caseObj } = await fetchCaseData(cleanBase, headers, caseId);
      const activities = await fetchCaseActivities(cleanBase, headers, caseObj, caseId);

      const notePayload = await processSupportbenchCaseToNote(
        caseObj,
        activities,
        cleanBase,
        headers,
        targetFolder,
        downloadAttachments
      );

      return NextResponse.json({ success: true, note: notePayload });
    }

    // 3. Action: Batch Download Multiple Cases
    if (action === 'batch-download') {
      const ids: string[] = Array.isArray(caseIdentifiers) ? caseIdentifiers : [];
      if (ids.length === 0) {
        return NextResponse.json({ success: false, error: 'No case identifiers provided.' }, { status: 400 });
      }

      const notes: any[] = [];
      const errors: any[] = [];

      for (const rawId of ids) {
        const cId = extractCaseId(rawId);
        if (!cId) continue;
        try {
          const { caseObj } = await fetchCaseData(cleanBase, headers, cId);
          const activities = await fetchCaseActivities(cleanBase, headers, caseObj, cId);
          const notePayload = await processSupportbenchCaseToNote(
            caseObj,
            activities,
            cleanBase,
            headers,
            targetFolder,
            downloadAttachments
          );
          notes.push(notePayload);
        } catch (err: any) {
          errors.push({ id: rawId, error: err?.message || 'Failed fetching case' });
        }
      }

      return NextResponse.json({ success: true, notes, errors });
    }

    // 4. Action: Search or List Cases
    if (action === 'search-cases') {
      const query = (body.query || '').trim().toLowerCase();
      const limit = Math.min(Math.max(body.limit || 25, 1), 50);

      const searchEndpoints = [
        `${cleanBase}/case/all`,
        `${cleanBase}/case/query`,
        `${cleanBase}/case/find`,
        `${cleanBase}/case/filter`,
        `${cleanBase}/case/get`,
      ];

      for (const url of searchEndpoints) {
        try {
          const res = await fetch(url, { headers });
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data)
              ? data
              : Array.isArray(data.Cases)
              ? data.Cases
              : Array.isArray(data.cases)
              ? data.cases
              : Array.isArray(data.Data)
              ? data.Data
              : Array.isArray(data.data)
              ? data.data
              : [];

            let filtered = list;
            if (query) {
              filtered = list.filter((c: any) => {
                const sub = (c.Subject || c.subject || c.Title || c.title || '').toLowerCase();
                const num = String(c.CaseNumber || c.case_number || c.Number || c.number || c.Id || c.id || '');
                const contactName = (c.Contact?.Name || c.contact?.name || '').toLowerCase();
                return sub.includes(query) || num.includes(query) || contactName.includes(query);
              });
            }

            const summaries = filtered.slice(0, limit).map((c: any) => ({
              id: String(c.Id || c.id || c.CaseNumber || c.case_number || ''),
              caseNumber: String(c.CaseNumber || c.case_number || c.Number || c.number || c.Id || c.id || ''),
              subject: c.Subject || c.subject || c.Title || c.title || c.Summary || c.summary || 'Untitled Case',
              status:
                typeof (c.Status || c.status) === 'object'
                  ? (c.Status || c.status)?.Name || (c.Status || c.status)?.name || 'Open'
                  : c.Status || c.status || 'Open',
              priority:
                typeof (c.Priority || c.priority) === 'object'
                  ? (c.Priority || c.priority)?.Name || (c.Priority || c.priority)?.name || 'Normal'
                  : c.Priority || c.priority || 'Normal',
              assignee:
                c.Assignee?.Name ||
                c.assignee?.name ||
                c.AssignedTo?.Name ||
                c.assigned_to?.name ||
                c.Agent?.Name ||
                (typeof c.Assignee === 'string' ? c.Assignee : 'Unassigned'),
              contact: c.Contact?.Name || c.contact?.name || c.Customer?.Name || c.customer?.name || 'Unknown',
              account: c.Company?.Name || c.company?.name || c.Account?.Name || c.account?.name || '',
              updated: c.UpdatedDate || c.updated_date || c.CreatedAt || c.created_at || '',
              attachmentCount: Array.isArray(c.Attachments || c.attachments) ? (c.Attachments || c.attachments).length : 0,
              commentCount: Array.isArray(c.Activities || c.activities) ? (c.Activities || c.activities).length : 0,
            }));

            return NextResponse.json({ success: true, cases: summaries });
          }
        } catch {
          // try next
        }
      }

      return NextResponse.json({ success: true, cases: [] });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[Supportbench API Error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
