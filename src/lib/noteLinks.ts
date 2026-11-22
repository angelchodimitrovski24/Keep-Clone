import { Note, NoteConnectionRole } from '@/types/note';

export interface NoteLinkTarget {
  id: string;
  title: string;
  category?: string | null;
  role?: NoteConnectionRole;
  isHub?: boolean;
  label?: string;
}

export interface BidirectionalLinksResult {
  outgoing: NoteLinkTarget[];
  backlinks: NoteLinkTarget[];
  prevNotes: NoteLinkTarget[];
  nextNotes: NoteLinkTarget[];
  sources: NoteLinkTarget[];
}

export interface ExtractedNoteLinkToken {
  id?: string;
  title?: string;
  role?: NoteConnectionRole;
}

// Bounded in-memory cache for extracted note links
const linkExtractionCache = new Map<string, string[]>();
const tokenExtractionCache = new Map<string, ExtractedNoteLinkToken[]>();
const MAX_CACHE_SIZE = 1000;

function normalizeRole(raw?: string | null): NoteConnectionRole | undefined {
  if (raw === 'part_of' || raw === 'next' || raw === 'source' || raw === 'related') {
    return raw;
  }
  return undefined;
}

function escapeAttr(val: string): string {
  return (val || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Extracts structured note link tokens (preserving ID, Title, and optional Role)
 * from [[Title]], [[id|Title]], and <span data-note-mention ...> elements.
 */
export function extractNoteLinkTargetsFromContent(content: string): ExtractedNoteLinkToken[] {
  if (!content) return [];

  if (
    !content.includes('[[') &&
    !content.includes('data-note-')
  ) {
    return [];
  }

  const cached = tokenExtractionCache.get(content);
  if (cached) return cached;

  const tokens: ExtractedNoteLinkToken[] = [];

  // 1. Matches [[Note Title]] or [[id|Note Title]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    if (match[2]) {
      const id = match[1].trim();
      const title = match[2].trim();
      if (id || title) {
        tokens.push({ id: id || undefined, title: title || undefined });
      }
    } else {
      const title = match[1].trim();
      if (title) {
        tokens.push({ title });
      }
    }
  }

  // 2. Matches HTML <span data-note-mention="true" ...> or data-note-* attributes
  const tagRegex = /<[^>]*data-note-(?:mention|id|title|link-title)[^>]*>/gi;
  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[0];
    const idMatch = tag.match(/data-note-(?:id|link-id)=["']([^"']+)["']/i);
    const titleMatch = tag.match(/data-note-(?:title|link-title)=["']([^"']+)["']/i);
    const roleMatch = tag.match(/data-note-role=["']([^"']+)["']/i);
    const id = idMatch?.[1]?.trim();
    const title = titleMatch?.[1]?.trim();
    const role = normalizeRole(roleMatch?.[1]?.trim());
    if (id || title) {
      tokens.push({ id, title, role });
    }
  }

  if (tokenExtractionCache.size >= MAX_CACHE_SIZE) {
    tokenExtractionCache.clear();
  }
  tokenExtractionCache.set(content, tokens);

  return tokens;
}

/**
 * Extracts note titles or note IDs referenced inside content via [[Title]], [[id|Title]], or HTML mention attributes
 */
export function extractNoteLinksFromContent(content: string): string[] {
  if (!content) return [];

  // FAST PATH: If content doesn't even contain '[[' or 'data-note-', return empty immediately
  if (!content.includes('[[') && !content.includes('data-note-')) {
    return [];
  }

  const cached = linkExtractionCache.get(content);
  if (cached) return cached;

  const matches: string[] = [];
  const tokens = extractNoteLinkTargetsFromContent(content);
  for (const t of tokens) {
    if (t.id) matches.push(t.id.toLowerCase());
    if (t.title) matches.push(t.title.toLowerCase());
  }

  // Fallback attribute scan in case of non-tag attributes
  const dataRegex = /data-note-(?:title|id|link-title|link-id)=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = dataRegex.exec(content)) !== null) {
    if (match[1]?.trim()) {
      matches.push(match[1].trim().toLowerCase());
    }
  }

  const result = Array.from(new Set(matches));

  if (linkExtractionCache.size >= MAX_CACHE_SIZE) {
    linkExtractionCache.clear();
  }
  linkExtractionCache.set(content, result);

  return result;
}

/**
 * Computes Outgoing links, Backlinks, Prev/Next sequences, and Sources for a given note across all notes
 */
export function getBidirectionalLinks(
  currentNote: Note,
  allNotes: Note[]
): BidirectionalLinksResult {
  if (!currentNote || !allNotes || allNotes.length === 0) {
    return { outgoing: [], backlinks: [], prevNotes: [], nextNotes: [], sources: [] };
  }

  const activeNotes = allNotes.filter((n) => !n.isTrash && n.id !== currentNote.id);
  const outgoingMap = new Map<string, NoteLinkTarget>();
  const backlinksMap = new Map<string, NoteLinkTarget>();
  const prevMap = new Map<string, NoteLinkTarget>();
  const nextMap = new Map<string, NoteLinkTarget>();
  const sourcesMap = new Map<string, NoteLinkTarget>();

  const currentTokens = extractNoteLinkTargetsFromContent(currentNote.content);
  const currentExtracted = extractNoteLinksFromContent(currentNote.content);
  const currentLinkedIds = new Set(currentNote.linkedNoteIds || []);
  const currentConnectionsMap = new Map<string, { role: NoteConnectionRole; label?: string }>();
  for (const conn of currentNote.connections || []) {
    if (conn.targetId) {
      currentConnectionsMap.set(conn.targetId, { role: conn.role, label: conn.label });
    }
  }

  // Also capture role hints from inline mentions
  for (const tok of currentTokens) {
    if (tok.id && tok.role && !currentConnectionsMap.has(tok.id)) {
      currentConnectionsMap.set(tok.id, { role: tok.role });
    }
  }

  // 1. Compute Outgoing links (Notes mentioned or connected by currentNote)
  for (const other of activeNotes) {
    const otherTitleLower = (other.title || '').trim().toLowerCase();
    const otherIdLower = other.id.toLowerCase();

    const connMeta = currentConnectionsMap.get(other.id);
    const isMentionedById =
      currentExtracted.includes(otherIdLower) ||
      currentLinkedIds.has(other.id) ||
      Boolean(connMeta);
    const isMentionedByTitle = Boolean(
      otherTitleLower && currentExtracted.includes(otherTitleLower)
    );

    if (isMentionedById || isMentionedByTitle) {
      const role: NoteConnectionRole = connMeta?.role || 'related';
      const targetObj: NoteLinkTarget = {
        id: other.id,
        title: other.title || 'Untitled Note',
        category: other.category || null,
        role,
        isHub: Boolean(other.isHub),
        label: connMeta?.label,
      };
      outgoingMap.set(other.id, targetObj);
      if (role === 'next') {
        nextMap.set(other.id, targetObj);
      } else if (role === 'source') {
        sourcesMap.set(other.id, targetObj);
      }
    }
  }

  // 2. Compute Backlinks & Incoming Next (Prev) links
  const currentTitleLower = (currentNote.title || '').trim().toLowerCase();
  const currentIdLower = currentNote.id.toLowerCase();

  for (const other of activeNotes) {
    const otherConn = (other.connections || []).find((c) => c.targetId === currentNote.id);
    const otherLinkedIds = other.linkedNoteIds ? new Set(other.linkedNoteIds) : null;
    const directIdLink = Boolean(otherLinkedIds?.has(currentNote.id)) || Boolean(otherConn);

    const otherHasLinkSyntax = Boolean(
      other.content && (other.content.includes('[[') || other.content.includes('data-note-'))
    );

    if (!directIdLink && !otherHasLinkSyntax) {
      continue;
    }

    if (!directIdLink && other.content) {
      const contentLower = other.content.toLowerCase();
      const hasTitle = Boolean(currentTitleLower && contentLower.includes(currentTitleLower));
      const hasId = contentLower.includes(currentIdLower);
      if (!hasTitle && !hasId) {
        continue;
      }
    }

    const otherExtracted = extractNoteLinksFromContent(other.content || '');
    const mentionsCurrentTitle = Boolean(
      currentTitleLower && otherExtracted.includes(currentTitleLower)
    );
    const mentionsCurrentId = directIdLink || otherExtracted.includes(currentIdLower);

    if (mentionsCurrentTitle || mentionsCurrentId) {
      const role: NoteConnectionRole = otherConn?.role || 'related';
      const sourceObj: NoteLinkTarget = {
        id: other.id,
        title: other.title || 'Untitled Note',
        category: other.category || null,
        role,
        isHub: Boolean(other.isHub),
        label: otherConn?.label,
      };
      backlinksMap.set(other.id, sourceObj);
      if (role === 'next') {
        prevMap.set(other.id, sourceObj);
      }
    }
  }

  // Fallback entries for linkedNoteIds / connections whose targets reside outside current page
  for (const conn of currentNote.connections || []) {
    if (conn.targetId && conn.targetId !== currentNote.id && !outgoingMap.has(conn.targetId)) {
      const fallback: NoteLinkTarget = {
        id: conn.targetId,
        title: 'Linked Note',
        category: null,
        role: conn.role,
        label: conn.label,
      };
      outgoingMap.set(conn.targetId, fallback);
      if (conn.role === 'next') nextMap.set(conn.targetId, fallback);
      if (conn.role === 'source') sourcesMap.set(conn.targetId, fallback);
    }
  }

  for (const linkedId of currentLinkedIds) {
    if (linkedId && linkedId !== currentNote.id && !outgoingMap.has(linkedId)) {
      outgoingMap.set(linkedId, {
        id: linkedId,
        title: 'Linked Note',
        category: null,
        role: 'related',
      });
    }
  }

  return {
    outgoing: Array.from(outgoingMap.values()),
    backlinks: Array.from(backlinksMap.values()),
    prevNotes: Array.from(prevMap.values()),
    nextNotes: Array.from(nextMap.values()),
    sources: Array.from(sourcesMap.values()),
  };
}

/**
 * Replaces [[Title]] or [[id|Title]] with interactive HTML link chips inside rendered markdown or HTML
 */
export function formatWikiLinksInHtml(html: string): string {
  if (!html || !html.includes('[[')) return html || '';
  return html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, raw1, raw2) => {
    const hasId = Boolean(raw2);
    const id = hasId ? raw1.trim() : '';
    const title = (hasId ? raw2 : raw1).trim();
    const safeTitle = escapeAttr(title);
    const idAttr = id ? ` data-note-link-id="${escapeAttr(id)}" data-note-id="${escapeAttr(id)}"` : '';
    return `<span class="keep-note-chip inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded-md bg-amber-500/12 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 font-medium text-xs border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 dark:hover:bg-amber-500/30 transition-colors select-none keep-note-link"${idAttr} data-note-link-title="${safeTitle}" data-note-title="${safeTitle}" title="Open linked note: ${safeTitle}">🔗 ${safeTitle}</span>`;
  });
}
