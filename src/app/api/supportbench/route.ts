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
 * Extracts subdomain / tenant from a Supportbench URL or domain string.
 * e.g. "https://myaffiliates.supportbench.net/agent/case/c-159343/" -> "myaffiliates"
 */
function extractSubdomain(input: string): string | undefined {
  if (!input) return undefined;
  try {
    const raw = input.trim();
    const candidate = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const u = new URL(candidate);
    const m = u.hostname.match(/^([a-z0-9_-]+)\.supportbench\.(?:net|com)$/i);
    if (m && m[1] && m[1].toLowerCase() !== 'api' && m[1].toLowerCase() !== 'app' && m[1].toLowerCase() !== 'www') {
      return m[1].toLowerCase();
    }
  } catch {
    //
  }
  return undefined;
}

/**
 * Normalizes the user's provided Base URL.
 */
export function normalizeSupportbenchBaseUrl(input: string): string {
  let clean = (input || '').trim().replace(/\/+$/, '');
  if (!clean) {
    return 'https://api.supportbench.net';
  }

  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }

  return clean;
}

/**
 * Extracts case ID, numeric ID, and subdomain from an input string or full URL.
 * e.g. "https://myaffiliates.supportbench.net/agent/case/c-159343/"
 * -> caseId: "c-159343", numericId: "159343", subdomain: "myaffiliates"
 */
function extractCaseInfo(input: string): {
  caseId: string;
  numericId: string;
  subdomain?: string;
  fullUrl?: string;
} {
  let clean = input.trim().replace(/\/+$/, '');
  let subdomain: string | undefined;
  let fullUrl: string | undefined;

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    fullUrl = clean;
    subdomain = extractSubdomain(clean);
  }

  const match = clean.match(/(?:case|cases|ticket|tickets)\/([A-Za-z0-9_-]+)/i);
  let raw = match ? match[1] : clean;
  raw = raw.replace(/^[#\s]+/, '').replace(/^case:\s*/i, '').replace(/\/+$/, '').trim();

  // "c-159343" -> numeric is "159343"
  const numericId = raw.replace(/^[A-Za-z]+-/, '');
  const caseId = raw;

  return { caseId, numericId, subdomain, fullUrl };
}

/**
 * Builds request headers for Supportbench API.
 * Sends Authorization: Bearer <token>, x-api-key, and optional tenant subdomain headers.
 */
export function buildSupportbenchHeaders(token: string, subdomain?: string): Record<string, string> {
  const cleanToken = (token || '').trim();
  const bearerToken = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
  const rawToken = cleanToken.replace(/^Bearer\s+/i, '');

  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'User-Agent': 'Keep-Clone-Supportbench/1.0',
  };

  if (rawToken) {
    headers['Authorization'] = bearerToken;
    headers['x-api-key'] = rawToken;
    headers['X-API-KEY'] = rawToken;
    headers['api-key'] = rawToken;
    headers['apikey'] = rawToken;
    headers['token'] = rawToken;
  }

  if (subdomain) {
    headers['x-subdomain'] = subdomain;
    headers['subdomain'] = subdomain;
    headers['x-organization'] = subdomain;
    headers['organization'] = subdomain;
    headers['x-tenant'] = subdomain;
    headers['tenant'] = subdomain;
    headers['x-company'] = subdomain;
  }

  return headers;
}

/**
 * Converts HTML to clean, readable Markdown without arbitrary blockquotes.
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
    return `___SUPPORTBENCH_CODE_BLOCK_${idx}___`;
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

  text = text.replace(/___SUPPORTBENCH_CODE_BLOCK_(\d+)___/g, (_match, idx) => {
    return codeBlocks[parseInt(idx, 10)] || '';
  });

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
 * Parses case details from HTML in case the web page was fetched
 */
function parseCaseFromHtml(html: string, caseId: string, sourceUrl: string): any {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].replace(/-\s*Supportbench.*$/i, '').trim() : `Case #${caseId}`;

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1].trim()) {
    title = h1Match[1].replace(/<[^>]+>/g, '').trim();
  }

  // Look for comments/activities in HTML
  const activities: any[] = [];
  const commentBlocks = html.match(/<div[^>]*class=["'][^"']*(?:comment|activity|timeline-item|message)[^"']*["'][\s\S]*?<\/div>/gi) || [];
  for (const block of commentBlocks.slice(0, 50)) {
    const text = htmlToCleanMarkdown(block);
    if (text.length > 10) {
      activities.push({
        author: 'Agent',
        date: '',
        type: 'Comment',
        markdown: text,
      });
    }
  }

  return {
    id: caseId,
    case_number: caseId,
    subject: title,
    description: htmlToCleanMarkdown(html),
    status: 'Open',
    priority: 'Normal',
    activities,
    sourceUrl,
  };
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
 * Fetches a single case from Supportbench trying both the dedicated API cluster
 * and the user's instance URL, using both raw and numeric case IDs.
 */
async function fetchCaseData(
  baseUrl: string,
  headers: Record<string, string>,
  caseIdentifier: string
): Promise<{ caseObj: any; sourceUrl: string; finalPortalUrl: string }> {
  const { caseId, numericId, subdomain: inputSubdomain, fullUrl } = extractCaseInfo(caseIdentifier);
  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  const baseSubdomain = extractSubdomain(cleanBase) || inputSubdomain;

  // Determine base URLs to test
  const basesToTry = [cleanBase];
  if (!cleanBase.includes('api.supportbench.net')) {
    basesToTry.push('https://api.supportbench.net');
  }

  const idsToTry = Array.from(new Set([caseId, numericId, `c-${numericId}`].filter(Boolean)));

  const candidates: string[] = [];
  for (const b of basesToTry) {
    for (const id of idsToTry) {
      candidates.push(`${b}/case/${encodeURIComponent(id)}`);
      candidates.push(`${b}/case/get?id=${encodeURIComponent(id)}`);
      candidates.push(`${b}/case/get?caseNumber=${encodeURIComponent(id)}`);
      candidates.push(`${b}/case/get?number=${encodeURIComponent(id)}`);
      candidates.push(`${b}/case/find?id=${encodeURIComponent(id)}`);
      candidates.push(`${b}/case/find?number=${encodeURIComponent(id)}`);
      candidates.push(`${b}/api/v1/cases/${encodeURIComponent(id)}`);
      candidates.push(`${b}/cases/${encodeURIComponent(id)}`);
      candidates.push(`${b}/agent/api/case/${encodeURIComponent(id)}`);
      candidates.push(`${b}/agent/case/${encodeURIComponent(id)}`);
      if (baseSubdomain) {
        candidates.push(`${b}/case/get?id=${encodeURIComponent(id)}&subdomain=${encodeURIComponent(baseSubdomain)}`);
        candidates.push(`${b}/case/${encodeURIComponent(id)}?subdomain=${encodeURIComponent(baseSubdomain)}`);
      }
    }
  }

  // Also if full URL was provided, attempt direct fetch with auth
  if (fullUrl) {
    candidates.unshift(fullUrl);
  }

  let caseObj: any = null;
  let successfulUrl = fullUrl || `${cleanBase}/agent/case/c-${numericId}/`;
  let lastAuthError = '';

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers });
      const contentType = res.headers.get('content-type') || '';

      if (res.ok) {
        if (contentType.includes('json')) {
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
        } else if (contentType.includes('html')) {
          const html = await res.text();
          // Make sure it is not the login or sign-in page
          if (!html.includes('Login into Supportbench') && !html.includes('Signin to') && !html.includes('Sign in')) {
            caseObj = parseCaseFromHtml(html, caseId, url);
            if (caseObj) {
              successfulUrl = url;
              break;
            }
          }
        }
      } else if (res.status === 401 || res.status === 403) {
        lastAuthError = `HTTP ${res.status} Unauthorized`;
      }
    } catch {
      // try next
    }
  }

  // Construct canonical browser portal link
  const portalHost = baseSubdomain ? `https://${baseSubdomain}.supportbench.net` : cleanBase;
  const finalPortalUrl = fullUrl || `${portalHost}/agent/case/c-${numericId}/`;

  if (!caseObj) {
    if (lastAuthError) {
      throw new Error(
        `Supportbench rejected authorization (${lastAuthError}) for case ${caseId}. Please ensure your API token has case read permissions.`
      );
    }
    throw new Error(
      `Case '${caseId}' (or #${numericId}) not found on Supportbench. Please verify the case URL/number and that your token has access to it.`
    );
  }

  return { caseObj, sourceUrl: successfulUrl, finalPortalUrl };
}

/**
 * Fetches activities/comments for a case from embedded objects or direct endpoints
 */
async function fetchCaseActivities(
  baseUrl: string,
  headers: Record<string, string>,
  caseObj: any,
  caseId: string
): Promise<any[]> {
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

  const bases = [cleanBase, 'https://api.supportbench.net'];
  const activityEndpoints: string[] = [];

  for (const b of bases) {
    activityEndpoints.push(`${b}/case/${encodeURIComponent(targetId)}/activities`);
    activityEndpoints.push(`${b}/case/${encodeURIComponent(targetId)}/comments`);
    activityEndpoints.push(`${b}/case/${encodeURIComponent(targetId)}/actions`);
    activityEndpoints.push(`${b}/activity/get?caseId=${encodeURIComponent(targetId)}`);
    activityEndpoints.push(`${b}/activity/get?id=${encodeURIComponent(targetId)}`);
    activityEndpoints.push(`${b}/api/v1/cases/${encodeURIComponent(targetId)}/comments`);
    activityEndpoints.push(`${b}/api/v1/cases/${encodeURIComponent(targetId)}/activities`);
  }

  for (const url of activityEndpoints) {
    try {
      const res = await fetch(url, { headers });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('json')) {
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
  portalUrl: string,
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
    const subdomain = extractSubdomain(cleanBase) || (caseIdentifier ? extractSubdomain(caseIdentifier) : undefined);
    const headers = buildSupportbenchHeaders(apiToken, subdomain);
    const targetFolder = folderPath && fs.existsSync(folderPath) ? folderPath : getDefaultMediaFolder();

    // 1. Action: Test Connection directly verifying valid JSON authentication
    if (action === 'test-connection') {
      const testCandidates = [
        'https://api.supportbench.net/users/me',
        'https://api.supportbench.net/case/all',
        'https://api.supportbench.net/users/get',
        `${cleanBase}/api/v1/cases?limit=1`,
        `${cleanBase}/cases?limit=1`,
        `${cleanBase}/users/me`,
      ];

      let lastError = '';
      let attemptedUrl = '';

      for (const endpoint of testCandidates) {
        attemptedUrl = endpoint;
        try {
          const res = await fetch(endpoint, { headers });
          const contentType = res.headers.get('content-type') || '';

          if (res.ok && contentType.includes('json')) {
            let userData: any = { displayName: 'Supportbench User', email: subdomain || cleanBase };
            try {
              const data = await res.json();
              const userObj = data.User || data.user || data.Profile || data.profile || data.Data || data.data || data;
              if (userObj.Name || userObj.name || userObj.Email || userObj.email || userObj.DisplayName || userObj.displayName) {
                userData = {
                  displayName: userObj.Name || userObj.name || userObj.DisplayName || userObj.displayName || 'Supportbench User',
                  email: userObj.Email || userObj.email || subdomain || cleanBase,
                  id: userObj.Id || userObj.id || undefined,
                };
              }
            } catch {
              // Valid 200 response
            }
            return NextResponse.json({ success: true, user: userData, endpoint });
          } else if (res.status === 401 || res.status === 403) {
            return NextResponse.json(
              {
                success: false,
                error: `Authentication failed (HTTP ${res.status}): API Token was rejected. Please verify your token permissions.`,
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
        {
          success: false,
          error: `Could not authenticate with Supportbench. (${lastError || 'Endpoint unreachable'})`,
          endpoint: attemptedUrl,
        },
        { status: 400 }
      );
    }

    // 2. Action: Fetch Single Case
    if (action === 'fetch-case') {
      if (!caseIdentifier) {
        return NextResponse.json({ success: false, error: 'Case identifier or URL is required.' }, { status: 400 });
      }

      const { caseObj, finalPortalUrl } = await fetchCaseData(cleanBase, headers, caseIdentifier);
      const caseId = caseObj.Id || caseObj.id || caseObj.CaseNumber || caseObj.case_number || caseIdentifier;
      const activities = await fetchCaseActivities(cleanBase, headers, caseObj, String(caseId));

      const notePayload = await processSupportbenchCaseToNote(
        caseObj,
        activities,
        cleanBase,
        headers,
        targetFolder,
        finalPortalUrl,
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
        if (!rawId || !rawId.trim()) continue;
        try {
          const itemSubdomain = extractSubdomain(rawId) || subdomain;
          const itemHeaders = buildSupportbenchHeaders(apiToken, itemSubdomain);
          const { caseObj, finalPortalUrl } = await fetchCaseData(cleanBase, itemHeaders, rawId);
          const caseId = caseObj.Id || caseObj.id || caseObj.CaseNumber || caseObj.case_number || rawId;
          const activities = await fetchCaseActivities(cleanBase, itemHeaders, caseObj, String(caseId));

          const notePayload = await processSupportbenchCaseToNote(
            caseObj,
            activities,
            cleanBase,
            itemHeaders,
            targetFolder,
            finalPortalUrl,
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
        `https://api.supportbench.net/case/all`,
        `https://api.supportbench.net/case/query`,
        `${cleanBase}/api/v1/cases${query ? `?search=${encodeURIComponent(query)}` : `?limit=${limit}`}`,
        `${cleanBase}/cases${query ? `?search=${encodeURIComponent(query)}` : `?limit=${limit}`}`,
      ];

      for (const url of searchEndpoints) {
        try {
          const res = await fetch(url, { headers });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('json')) {
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
