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
 * Sends Authorization: Bearer <token>, x-api-key, and tenant headers.
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
 * Parses case details from HTML in case an authenticated web page is returned
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
 * Recursively searches any JSON object or array to extract the case record
 */
function extractCaseObject(data: any, targetId: string, numericTargetId: string): any {
  if (!data) return null;
  if (typeof data !== 'object') return null;

  // If array of cases
  if (Array.isArray(data)) {
    const found = data.find((c: any) => {
      const num = String(
        c.CaseNumber ||
        c.case_number ||
        c.Number ||
        c.number ||
        c.Id ||
        c.id ||
        c.Reference ||
        c.reference ||
        ''
      );
      return (
        num.toLowerCase() === targetId.toLowerCase() ||
        num.toLowerCase() === numericTargetId.toLowerCase() ||
        num.toLowerCase() === `c-${numericTargetId}`.toLowerCase()
      );
    });
    return found || data[0] || null;
  }

  // Nested in data / case / result
  if (data.Case && typeof data.Case === 'object') return extractCaseObject(data.Case, targetId, numericTargetId);
  if (data.case && typeof data.case === 'object') return extractCaseObject(data.case, targetId, numericTargetId);
  if (data.Data && typeof data.Data === 'object') return extractCaseObject(data.Data, targetId, numericTargetId);
  if (data.data && typeof data.data === 'object') return extractCaseObject(data.data, targetId, numericTargetId);
  if (data.Result && typeof data.Result === 'object') return extractCaseObject(data.Result, targetId, numericTargetId);
  if (data.result && typeof data.result === 'object') return extractCaseObject(data.result, targetId, numericTargetId);
  if (data.Cases && Array.isArray(data.Cases)) return extractCaseObject(data.Cases, targetId, numericTargetId);
  if (data.cases && Array.isArray(data.cases)) return extractCaseObject(data.cases, targetId, numericTargetId);

  return data;
}

/**
 * Parses and formats an activity / comment item into clean markdown
 */
/**
 * Extracts the author name and email of an activity from the many shapes Supportbench may use
 * (nested objects like Author/User/CreatedBy/Agent, or flat fields like AgentName/FromEmail).
 */
function buildUserDirectory(caseObj: any): Map<string, { name: string; email: string }> {
  const map = new Map<string, { name: string; email: string }>();
  if (!caseObj || typeof caseObj !== 'object') return map;

  const isGenericName = (s: string) => /^(agent|user|staff|support|system|admin|jira|supportbench|unknown|none)$/i.test(s.trim());

  const register = (o: any) => {
    if (!o || typeof o !== 'object') return;
    const first = typeof o.FirstName === 'string' ? o.FirstName.trim() : typeof o.firstName === 'string' ? o.firstName.trim() : '';
    const last = typeof o.LastName === 'string' ? o.LastName.trim() : typeof o.lastName === 'string' ? o.lastName.trim() : '';
    const fullName = [first, last].filter(Boolean).join(' ');
    let name = (
      (typeof o.DisplayName === 'string' ? o.DisplayName.trim() : typeof o.displayName === 'string' ? o.displayName.trim() : '') ||
      (typeof o.FullName === 'string' ? o.FullName.trim() : typeof o.fullName === 'string' ? o.fullName.trim() : '') ||
      (typeof o.Name === 'string' ? o.Name.trim() : typeof o.name === 'string' ? o.name.trim() : '') ||
      fullName
    );
    if (name && isGenericName(name)) name = '';

    const email = (
      (typeof o.Email === 'string' ? o.Email.trim() : typeof o.email === 'string' ? o.email.trim() : '') ||
      (typeof o.EmailAddress === 'string' ? o.EmailAddress.trim() : typeof o.email_address === 'string' ? o.email_address.trim() : '')
    );

    const idCandidates = [
      o.Id, o.id, o.UserId, o.userId, o.AgentId, o.agentId, o.Guid, o.guid, o.UUID, o.uuid, o.Key, o.key,
      o.AuthorId, o.authorId, o.CreatedById, o.createdById, o.ActorId, o.actorId
    ];

    if (name || email) {
      for (const rawId of idCandidates) {
        if (rawId !== undefined && rawId !== null && String(rawId).trim()) {
          map.set(String(rawId).trim().toLowerCase(), { name, email });
        }
      }
      if (email) {
        map.set(email.toLowerCase(), { name, email });
      }
    }
  };

  // Deep scan caseObj (up to 4 levels) for user/agent objects
  const visited = new Set<any>();
  const scan = (obj: any, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 4 || visited.has(obj)) return;
    visited.add(obj);

    if (Array.isArray(obj)) {
      for (const item of obj) scan(item, depth + 1);
      return;
    }

    register(obj);

    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') {
        scan(v, depth + 1);
      }
    }
  };

  scan(caseObj);
  return map;
}

function extractActivityAuthor(act: any, caseObj?: any, userDirectory?: Map<string, { name: string; email: string }>): { name: string; email: string } {
  const str = (v: any): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const isGeneric = (s: string) => /^(agent|user|staff|support|system|admin|jira|supportbench|unknown|none)$/i.test(s.trim());

  const actType = str(act?.Type || act?.type || act?.ActivityType || act?.activity_type || act?.Action || act?.action).toUpperCase();
  const isJiraUpdate = /jira/i.test(actType) || /jira/i.test(str(act?.SourceName)) || /jira/i.test(str(act?.Integration)) || /jira/i.test(str(act?.App));

  if (isJiraUpdate) {
    return { name: 'Jira Integration', email: '' };
  }

  let name = '';
  let email = '';

  const personKeys = [
    'Author', 'author', 'Creator', 'creator', 'CreatedBy', 'createdBy', 'created_by',
    'User', 'user', 'Agent', 'agent', 'Sender', 'sender', 'From', 'from',
    'PostedBy', 'postedBy', 'Owner', 'owner', 'Contact', 'contact', 'Actor', 'actor',
    'Staff', 'staff', 'Member', 'member',
  ];

  // 1. Check nested objects on person keys
  for (const k of personKeys) {
    const v = act?.[k];
    if (!v) continue;
    if (typeof v === 'object') {
      const first = str(v.FirstName ?? v.firstName ?? v.first_name);
      const last = str(v.LastName ?? v.lastName ?? v.last_name);
      const objName = str(v.DisplayName ?? v.displayName ?? v.FullName ?? v.fullName ?? v.Name ?? v.name) || [first, last].filter(Boolean).join(' ');
      const objEmail = str(v.Email ?? v.email ?? v.EmailAddress ?? v.emailAddress ?? v.email_address);
      if (objName && !isGeneric(objName)) name = name || objName;
      if (objEmail && isEmail(objEmail)) email = email || objEmail;
    } else {
      const s = str(v);
      if (isEmail(s)) {
        email = email || s;
      } else if (s && !isGeneric(s) && !/^\d+$/.test(s)) {
        name = name || s;
      }
    }
    if (name && email) break;
  }

  // 2. Flat fields (FirstName + LastName, AgentName, CreatedByName, FromEmail, UserEmail, AuthorName, etc.)
  if (!name || !email) {
    const directFirst = str(act?.FirstName ?? act?.firstName ?? act?.first_name);
    const directLast = str(act?.LastName ?? act?.lastName ?? act?.last_name);
    const directFullName = [directFirst, directLast].filter(Boolean).join(' ');
    if (directFullName && !isGeneric(directFullName)) {
      name = name || directFullName;
    }

    for (const [k, v] of Object.entries(act || {})) {
      const s = str(v);
      if (!s) continue;
      if (!email && /email/i.test(k) && isEmail(s)) {
        email = s;
      } else if (
        !name &&
        /(author|creator|agent|user|createdby|created_by|owner|sender|from|postedby|actor).*name|^name$|displayname|fullname/i.test(k) &&
        !isEmail(s) &&
        !isGeneric(s) &&
        !/^\d+$/.test(s)
      ) {
        name = s;
      }
    }
  }

  // 3. User directory lookup by author/user/agent ID or email
  if ((!name || !email) && userDirectory) {
    const idCandidates = [
      act?.UserId, act?.userId, act?.AuthorId, act?.authorId, act?.AgentId, act?.agentId,
      act?.CreatedById, act?.createdById, act?.CreatorId, act?.creatorId, act?.ActorId, act?.actorId,
      act?.CreatedBy, act?.Author, act?.User, act?.Agent,
      email
    ];
    for (const id of idCandidates) {
      if (id && userDirectory.has(String(id).toLowerCase())) {
        const found = userDirectory.get(String(id).toLowerCase())!;
        if (!name && found.name && !isGeneric(found.name)) name = found.name;
        if (!email && found.email) email = found.email;
        if (name && email) break;
      }
    }
  }

  // 4. Fallback to case assignee / agent if note was created by internal staff or without specific author
  if (!name && caseObj) {
    const assigneeObj = caseObj.Assignee || caseObj.assignee || caseObj.AssignedTo || caseObj.assigned_to || caseObj.Agent || caseObj.agent || caseObj.Owner || caseObj.owner;
    if (assigneeObj && typeof assigneeObj === 'object') {
      const first = str(assigneeObj.FirstName ?? assigneeObj.firstName ?? assigneeObj.first_name);
      const last = str(assigneeObj.LastName ?? assigneeObj.lastName ?? assigneeObj.last_name);
      const caseAgentName =
        str(assigneeObj.DisplayName ?? assigneeObj.displayName ?? assigneeObj.FullName ?? assigneeObj.fullName ?? assigneeObj.Name ?? assigneeObj.name) ||
        [first, last].filter(Boolean).join(' ');
      const caseAgentEmail = str(assigneeObj.Email ?? assigneeObj.email ?? assigneeObj.EmailAddress ?? assigneeObj.emailAddress);
      if (caseAgentName && !isGeneric(caseAgentName)) name = caseAgentName;
      if (caseAgentEmail && isEmail(caseAgentEmail)) email = email || caseAgentEmail;
    } else if (typeof assigneeObj === 'string' && !isGeneric(assigneeObj) && !/^\d+$/.test(assigneeObj)) {
      name = assigneeObj.trim();
    }

    if (!name) {
      const flatCaseAgent = str(
        caseObj.AssigneeName ?? caseObj.assignee_name ??
        caseObj.AgentName ?? caseObj.agent_name ??
        caseObj.AssignedAgentName ?? caseObj.assigned_agent_name ??
        caseObj.OwnerName ?? caseObj.owner_name
      );
      if (flatCaseAgent && !isGeneric(flatCaseAgent)) name = flatCaseAgent;
    }
    if (!email) {
      const flatCaseEmail = str(
        caseObj.AssigneeEmail ?? caseObj.assignee_email ??
        caseObj.AgentEmail ?? caseObj.agent_email ??
        caseObj.OwnerEmail ?? caseObj.owner_email
      );
      if (flatCaseEmail && isEmail(flatCaseEmail)) email = flatCaseEmail;
    }
  }

  // Handle "John Doe <john@x.com>" style strings
  const angle = name.match(/^(.*?)\s*<([^>]+@[^>]+)>$/);
  if (angle) {
    name = angle[1].trim();
    email = email || angle[2].trim();
  }

  return { name, email };
}

function formatActivityItem(act: any, caseObj?: any, userDirectory?: Map<string, { name: string; email: string }>): { author: string; date: string; type: string; markdown: string } {
  const { name, email } = extractActivityAuthor(act, caseObj, userDirectory);
  const actType = (act?.Type || act?.type || act?.Action || act?.ActivityType || '').toUpperCase();
  const defaultLabel = /jira/i.test(actType) ? 'Jira Integration' : 'Agent';
  const author = name && email && name !== email ? `${name} (${email})` : name || email || defaultLabel;

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
    act.Note ||
    act.note ||
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
 * Resolves the REST API base. The tenant web domain (e.g. myaffiliates.supportbench.net)
 * only serves the agent portal, so API calls for it go to https://api.supportbench.net.
 */
function resolveApiBase(baseUrl: string): string {
  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  try {
    const host = new URL(cleanBase).hostname.toLowerCase();
    if (/\.supportbench\.(net|com)$/.test(host) && host !== 'api.supportbench.net') {
      return 'https://api.supportbench.net';
    }
  } catch {
    return 'https://api.supportbench.net';
  }
  return cleanBase;
}

/**
 * Reads a response body as JSON regardless of the Content-Type header
 * (Supportbench returns JSON with text/plain). Handles double-encoded JSON strings.
 * Returns { json } on success or { text } if the body is not JSON.
 */
async function readBodyAsJson(res: Response): Promise<{ json?: any; text: string }> {
  let text = '';
  try {
    const arrayBuffer = await res.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    text = decoder.decode(arrayBuffer);
  } catch {
    text = await res.text();
  }
  const trimmed = text.trim();
  if (!trimmed) return { text };
  try {
    let parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return { text: parsed };
      }
    }
    return { json: parsed, text };
  } catch {
    return { text };
  }
}

/**
 * Fetches a single case from Supportbench using the only real read endpoint:
 *   GET {apiBase}/case/{C-id}
 */
async function fetchCaseData(
  baseUrl: string,
  headers: Record<string, string>,
  caseIdentifier: string
): Promise<{ caseObj: any; sourceUrl: string; finalPortalUrl: string }> {
  const { caseId, numericId, subdomain: inputSubdomain, fullUrl } = extractCaseInfo(caseIdentifier);
  const cleanBase = normalizeSupportbenchBaseUrl(baseUrl);
  const baseSubdomain = extractSubdomain(cleanBase) || inputSubdomain;

  // Supportbench case IDs use the "C-<number>" format
  const apiCaseId = /^\d+$/.test(numericId) ? `C-${numericId}` : caseId;

  // If the user pasted a full API URL, use it as-is; otherwise build it on the API base
  let url: string;
  if (fullUrl && /^https?:\/\/api\.supportbench\.net\/case\//i.test(fullUrl)) {
    url = fullUrl;
  } else {
    url = `${resolveApiBase(baseUrl)}/case/${encodeURIComponent(apiCaseId)}`;
  }

  const portalHost = baseSubdomain ? `https://${baseSubdomain}.supportbench.net` : cleanBase;
  const finalPortalUrl =
    fullUrl && !/api\.supportbench\.net/i.test(fullUrl) ? fullUrl : `${portalHost}/agent/case/c-${numericId}/`;

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (err: any) {
    throw new Error(`Network error calling ${url}: ${err?.message || 'request failed'}`);
  }

  const contentType = res.headers.get('content-type') || 'none';
  const { json, text } = await readBodyAsJson(res);
  const snippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

  if (!res.ok) {
    let hint = '';
    if (res.status === 401 || res.status === 403) {
      hint = ' The API token was rejected or the agent it belongs to cannot see this case/division.';
    } else if (res.status === 404) {
      hint = ' Case not found.';
    }
    throw new Error(`GET ${url} returned HTTP ${res.status} [${contentType}].${hint} Response: ${snippet || '(empty)'}`);
  }

  if (json === undefined || json === null) {
    throw new Error(
      `GET ${url} returned HTTP 200 [${contentType}] but the body is not case JSON. Response: ${snippet || '(empty body)'}`
    );
  }

  const caseObj = extractCaseObject(json, apiCaseId, numericId);
  if (!caseObj || typeof caseObj !== 'object') {
    throw new Error(`GET ${url} returned HTTP 200 but no case object was found. Response: ${snippet}`);
  }

  return { caseObj, sourceUrl: url, finalPortalUrl };
}

/**
 * Returns activities/comments embedded in the case object.
 * (No guessed endpoints are called — only /case/{id} is a real read endpoint.)
 */
async function fetchCaseActivities(
  _baseUrl: string,
  _headers: Record<string, string>,
  caseObj: any,
  _caseId: string,
  _numericId?: string
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
    caseObj.History,
    caseObj.history,
    caseObj.Emails,
    caseObj.emails,
  ];

  for (const arr of embeddedCandidates) {
    if (Array.isArray(arr) && arr.length > 0) {
      return arr;
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
    caseObj.Id ||
    caseObj.id ||
    caseObj.CaseId ||
    caseObj.case_id ||
    caseObj.CaseNumber ||
    caseObj.case_number ||
    caseObj.Reference ||
    caseObj.reference ||
    'Case'
  );
  const caseNumber = String(
    caseObj.CaseNumber ||
    caseObj.case_number ||
    caseObj.Number ||
    caseObj.number ||
    caseObj.Reference ||
    caseObj.reference ||
    caseObj.Id ||
    caseObj.id ||
    caseId
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
    caseObj.Topic ||
    caseObj.topic ||
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
    caseObj.InitialMessage ||
    caseObj.initial_message ||
    caseObj.Text ||
    caseObj.text ||
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
  const userDirectory = buildUserDirectory(caseObj);
  if (activities.length > 0) {
    markdown += `### Case Timeline & Comments (${activities.length})\n\n`;
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const parsed = formatActivityItem(act, caseObj, userDirectory);

      markdown += `#### 💬 **${parsed.author}** • *${parsed.date || 'Recent'}* \`[${parsed.type}]\`\n\n`;
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

    // 1. Action: Test Connection directly on the base URL (separate from case downloading)
    if (action === 'test-connection') {
      const testCandidates = [
        `${cleanBase}/users/me`,
        `${cleanBase}/users/get`,
        `${cleanBase}/case/all`,
        `${cleanBase}/case/get`,
        `${cleanBase}/case/query`,
        `${cleanBase}/activity/get`,
      ];
      if (!cleanBase.includes('api.supportbench.net')) {
        testCandidates.push('https://api.supportbench.net/users/me');
        testCandidates.push('https://api.supportbench.net/case/all');
      }

      let lastError = '';
      let attemptedUrl = '';

      for (const endpoint of testCandidates) {
        attemptedUrl = endpoint;
        try {
          const res = await fetch(endpoint, { headers });

          if (res.ok) {
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
                error: `Authentication failed (HTTP ${res.status}): Please check your API Token or Key on ${cleanBase}.`,
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
          error: `Could not connect to Supportbench at ${cleanBase}. Check the URL and token. (${lastError || 'Endpoint unreachable'})`,
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
      const { caseId, numericId } = extractCaseInfo(caseIdentifier);
      const finalCaseId = caseObj.Id || caseObj.id || caseObj.CaseNumber || caseObj.case_number || caseId;
      const activities = await fetchCaseActivities(cleanBase, headers, caseObj, String(finalCaseId), numericId);

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
          const { caseId: parsedId, numericId } = extractCaseInfo(rawId);
          const finalCaseId = caseObj.Id || caseObj.id || caseObj.CaseNumber || caseObj.case_number || parsedId;
          const activities = await fetchCaseActivities(cleanBase, itemHeaders, caseObj, String(finalCaseId), numericId);

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
