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
 * Normalizes Supportbench domain or URL to a valid base URL.
 * e.g. "mycompany" -> "https://mycompany.supportbench.com"
 *      "api.supportbench.net" -> "https://api.supportbench.net"
 */
export function normalizeSupportbenchBaseUrl(input: string): string {
  let clean = (input || '').trim().replace(/\/+$/, '');
  if (!clean) {
    return 'https://api.supportbench.net';
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (clean.includes('.')) {
      clean = `https://${clean}`;
    } else {
      clean = `https://${clean}.supportbench.com`;
    }
  }
  return clean;
}

/**
 * Builds request headers for Supportbench API.
 * Supports Bearer token and x-api-key simultaneously for wide compatibility.
 */
export function buildSupportbenchHeaders(token: string): Record<string, string> {
  const cleanToken = (token || '').trim();
  const bearerToken = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
  const rawKey = cleanToken.replace(/^Bearer\s+/i, '');

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Keep-Clone-Supportbench-Agent/1.0',
  };

  if (rawKey) {
    headers['Authorization'] = bearerToken;
    headers['x-api-key'] = rawKey;
    headers['X-API-KEY'] = rawKey;
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

  // If full URL e.g. https://domain.supportbench.com/cases/1042 or /tickets/1042
  const urlMatch = clean.match(/(?:cases|tickets|case)\/(?:view\/)?([A-Za-z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Remove leading '#' or prefix 'case:' if user pasted '#1042'
  clean = clean.replace(/^[#\s]+/, '').replace(/^case:\s*/i, '');
  return clean;
}

/**
 * Parses and formats an activity / comment item into clean markdown
 */
function formatActivityItem(act: any): { author: string; date: string; type: string; markdown: string } {
  const author =
    act.author?.name ||
    act.author?.displayName ||
    act.author?.email ||
    act.user?.name ||
    act.user?.displayName ||
    act.user?.email ||
    act.created_by?.name ||
    act.from ||
    'Agent';

  const date = act.created_at || act.created || act.date || act.timestamp || '';
  const formattedDate = date ? new Date(date).toLocaleString() : '';
  const type = (act.type || act.activity_type || act.action || 'Comment').toUpperCase();

  const rawBody =
    act.html_body ||
    act.body ||
    act.content ||
    act.comment ||
    act.text ||
    act.message ||
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
 * Fetches a single case from Supportbench trying standard endpoints
 */
async function fetchCaseData(
  baseUrl: string,
  headers: Record<string, string>,
  caseId: string
): Promise<{ caseObj: any; sourceUrl: string }> {
  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  const candidates = [
    `${cleanBase}/v1/cases/${encodeURIComponent(caseId)}`,
    `${cleanBase}/api/v1/cases/${encodeURIComponent(caseId)}`,
    `${cleanBase}/v1/tickets/${encodeURIComponent(caseId)}`,
    `${cleanBase}/v1/cases?case_number=${encodeURIComponent(caseId)}`,
    `${cleanBase}/v1/cases?search=${encodeURIComponent(caseId)}`,
    `${cleanBase}/api/v1/cases?case_number=${encodeURIComponent(caseId)}`,
    `${cleanBase}/cases/${encodeURIComponent(caseId)}`,
  ];

  let caseObj: any = null;
  let successfulUrl = `${cleanBase}/cases/${caseId}`;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        // Supportbench may return { case: {...} } or { data: {...} } or array or direct object
        if (data.case && typeof data.case === 'object') {
          caseObj = data.case;
        } else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
          caseObj = data.data;
        } else if (Array.isArray(data.data) && data.data.length > 0) {
          caseObj = data.data[0];
        } else if (Array.isArray(data.cases) && data.cases.length > 0) {
          caseObj = data.cases[0];
        } else if (Array.isArray(data) && data.length > 0) {
          caseObj = data[0];
        } else if (data.id || data.case_number || data.subject || data.title) {
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

  if (!caseObj) {
    throw new Error(`Case '${caseId}' not found on Supportbench (${cleanBase})`);
  }

  return { caseObj, sourceUrl: successfulUrl };
}

/**
 * Fetches activities/comments for a case if not already embedded
 */
async function fetchCaseActivities(
  baseUrl: string,
  headers: Record<string, string>,
  caseObj: any,
  caseId: string
): Promise<any[]> {
  // Check if activities are already in caseObj
  if (Array.isArray(caseObj.activities) && caseObj.activities.length > 0) {
    return caseObj.activities;
  }
  if (Array.isArray(caseObj.comments) && caseObj.comments.length > 0) {
    return caseObj.comments;
  }
  if (Array.isArray(caseObj.actions) && caseObj.actions.length > 0) {
    return caseObj.actions;
  }
  if (Array.isArray(caseObj.notes) && caseObj.notes.length > 0) {
    return caseObj.notes;
  }
  if (Array.isArray(caseObj.messages) && caseObj.messages.length > 0) {
    return caseObj.messages;
  }

  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  const targetId = caseObj.id || caseObj.case_id || caseId;

  const activityEndpoints = [
    `${cleanBase}/v1/cases/${encodeURIComponent(targetId)}/activities`,
    `${cleanBase}/v1/cases/${encodeURIComponent(targetId)}/comments`,
    `${cleanBase}/v1/cases/${encodeURIComponent(targetId)}/notes`,
    `${cleanBase}/v1/cases/${encodeURIComponent(targetId)}/actions`,
    `${cleanBase}/api/v1/cases/${encodeURIComponent(targetId)}/activities`,
    `${cleanBase}/api/v1/cases/${encodeURIComponent(targetId)}/comments`,
  ];

  for (const url of activityEndpoints) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.activities)
          ? data.activities
          : Array.isArray(data.comments)
          ? data.comments
          : Array.isArray(data.actions)
          ? data.actions
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
  const caseId = String(caseObj.id || caseObj.case_id || caseObj.case_number || 'Case');
  const caseNumber = String(caseObj.case_number || caseObj.number || caseObj.id || caseId);
  const subject = caseObj.subject || caseObj.title || caseObj.name || `Case #${caseNumber}`;

  const status =
    typeof caseObj.status === 'object'
      ? caseObj.status?.name || caseObj.status?.label || 'Open'
      : caseObj.status || 'Open';

  const priority =
    typeof caseObj.priority === 'object'
      ? caseObj.priority?.name || caseObj.priority?.label || 'Normal'
      : caseObj.priority || 'Normal';

  const stage =
    typeof caseObj.stage === 'object'
      ? caseObj.stage?.name || caseObj.stage?.label || ''
      : caseObj.stage || '';

  const assignee =
    caseObj.assigned_to?.name ||
    caseObj.assigned_to?.displayName ||
    caseObj.assigned_to?.email ||
    caseObj.assignee?.name ||
    caseObj.assignee?.displayName ||
    caseObj.agent?.name ||
    caseObj.agent?.email ||
    (typeof caseObj.assigned_to === 'string' ? caseObj.assigned_to : '') ||
    'Unassigned';

  const contact =
    caseObj.contact?.name ||
    caseObj.contact?.displayName ||
    caseObj.contact?.email ||
    caseObj.customer?.name ||
    caseObj.customer?.email ||
    caseObj.reporter?.name ||
    caseObj.reporter?.email ||
    (typeof caseObj.contact === 'string' ? caseObj.contact : '') ||
    'Unknown';

  const account =
    caseObj.account?.name ||
    caseObj.company?.name ||
    caseObj.organization?.name ||
    (typeof caseObj.account === 'string' ? caseObj.account : '') ||
    '';

  const createdDate = caseObj.created_at || caseObj.created_date || caseObj.created;
  const updatedDate = caseObj.updated_at || caseObj.updated_date || caseObj.updated;

  // Process raw description
  const rawDescription =
    caseObj.description ||
    caseObj.html_body ||
    caseObj.body ||
    caseObj.content ||
    caseObj.details ||
    '';

  let descriptionMd = htmlToCleanMarkdown(rawDescription);

  // Extract tags / labels
  const labels: string[] = ['supportbench', `case-${caseNumber}`];
  if (status) labels.push(status.toLowerCase().replace(/\s+/g, '-'));
  if (Array.isArray(caseObj.tags)) {
    for (const t of caseObj.tags) {
      const tagStr = typeof t === 'string' ? t : t?.name || '';
      if (tagStr) labels.push(tagStr.toLowerCase().replace(/\s+/g, '-'));
    }
  }

  // Find all attachments in case and activities
  const allAttachments: any[] = [];
  if (Array.isArray(caseObj.attachments)) allAttachments.push(...caseObj.attachments);
  if (Array.isArray(caseObj.files)) allAttachments.push(...caseObj.files);

  for (const act of activities) {
    if (Array.isArray(act.attachments)) allAttachments.push(...act.attachments);
    if (Array.isArray(act.files)) allAttachments.push(...act.files);
  }

  // Download media files locally
  const downloadedFiles: Array<{ fileName: string; fullPath: string; serveUrl: string }> = [];
  if (downloadAttachments && allAttachments.length > 0) {
    for (const att of allAttachments) {
      const fileUrl = att.url || att.download_url || att.file_url || att.link || att.href;
      if (!fileUrl) continue;
      const fileName = att.name || att.filename || att.file_name || `attachment-${att.id || Date.now()}`;
      const downloaded = await downloadMediaLocally(fileUrl, targetFolder, headers, fileName);
      if (downloaded) {
        downloadedFiles.push(downloaded);
      }
    }
  }

  // Construct Clean Markdown Note
  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  const portalUrl = `${cleanBase}/cases/${caseNumber}`;

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
    // Keep header images clean (only show images inline where they belong)
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
        `${cleanBase}/v1/users/me`,
        `${cleanBase}/api/v1/users/me`,
        `${cleanBase}/v1/profile`,
        `${cleanBase}/v1/cases?limit=1`,
        `${cleanBase}/api/v1/cases?limit=1`,
        `${cleanBase}/v1/tickets?limit=1`,
        `${cleanBase}/v1/system/ping`,
      ];

      let lastError = '';
      for (const endpoint of testCandidates) {
        try {
          const res = await fetch(endpoint, { headers });
          if (res.ok) {
            let userData: any = { displayName: 'Supportbench User', email: 'connected@supportbench' };
            try {
              const data = await res.json();
              const userObj = data.user || data.profile || data.data || data;
              if (userObj.name || userObj.email || userObj.displayName) {
                userData = {
                  displayName: userObj.name || userObj.displayName || 'Supportbench User',
                  email: userObj.email || 'connected',
                  id: userObj.id || undefined,
                };
              }
            } catch {
              // json parse failure is ok if HTTP status was 200
            }
            return NextResponse.json({ success: true, user: userData, endpoint });
          } else if (res.status === 401 || res.status === 403) {
            return NextResponse.json(
              { success: false, error: `Authentication failed (HTTP ${res.status}): Please check your API Token or Key.` },
              { status: 401 }
            );
          } else {
            lastError = `HTTP ${res.status} from ${endpoint}`;
          }
        } catch (err: any) {
          lastError = err?.message || 'Network error';
        }
      }

      return NextResponse.json(
        { success: false, error: `Could not connect to Supportbench at ${cleanBase}. (${lastError})` },
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
      const query = (body.query || '').trim();
      const limit = Math.min(Math.max(body.limit || 20, 1), 50);

      const searchEndpoints = [
        query ? `${cleanBase}/v1/cases?search=${encodeURIComponent(query)}&limit=${limit}` : `${cleanBase}/v1/cases?limit=${limit}`,
        query ? `${cleanBase}/api/v1/cases?search=${encodeURIComponent(query)}&limit=${limit}` : `${cleanBase}/api/v1/cases?limit=${limit}`,
      ];

      for (const url of searchEndpoints) {
        try {
          const res = await fetch(url, { headers });
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data)
              ? data
              : Array.isArray(data.cases)
              ? data.cases
              : Array.isArray(data.data)
              ? data.data
              : [];

            const summaries = list.map((c: any) => ({
              id: String(c.id || c.case_number || ''),
              caseNumber: String(c.case_number || c.number || c.id || ''),
              subject: c.subject || c.title || c.name || 'Untitled Case',
              status: typeof c.status === 'object' ? c.status?.name || 'Open' : c.status || 'Open',
              priority: typeof c.priority === 'object' ? c.priority?.name || 'Normal' : c.priority || 'Normal',
              assignee: c.assigned_to?.name || c.assignee?.name || (typeof c.assigned_to === 'string' ? c.assigned_to : 'Unassigned'),
              contact: c.contact?.name || c.customer?.name || 'Unknown',
              account: c.account?.name || c.company?.name || '',
              updated: c.updated_at || c.created_at || '',
              attachmentCount: Array.isArray(c.attachments) ? c.attachments.length : 0,
              commentCount: Array.isArray(c.activities) ? c.activities.length : Array.isArray(c.comments) ? c.comments.length : 0,
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
