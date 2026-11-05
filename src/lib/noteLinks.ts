import { Note } from '@/types/note';

export interface NoteLinkTarget {
  id: string;
  title: string;
}

export interface BidirectionalLinksResult {
  outgoing: NoteLinkTarget[];
  backlinks: NoteLinkTarget[];
}

// Bounded in-memory cache for extracted note links
const linkExtractionCache = new Map<string, string[]>();
const MAX_CACHE_SIZE = 1000;

/**
 * Extracts note titles or note IDs referenced inside content via [[Title]] or [[id|Title]]
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

  // 1. Matches [[Note Title]] or [[id|Note Title]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const rawTarget = (match[2] || match[1]).trim();
    if (rawTarget) {
      matches.push(rawTarget.toLowerCase());
    }
  }

  // 2. Matches HTML data-note-title or data-note-id
  const dataRegex = /data-note-(?:title|id)=["']([^"']+)["']/g;
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
 * Computes both Outgoing links and Backlinks for a given note across all notes
 */
export function getBidirectionalLinks(
  currentNote: Note,
  allNotes: Note[]
): BidirectionalLinksResult {
  if (!currentNote || !allNotes || allNotes.length === 0) {
    return { outgoing: [], backlinks: [] };
  }

  const activeNotes = allNotes.filter((n) => !n.isTrash && n.id !== currentNote.id);
  const outgoingMap = new Map<string, NoteLinkTarget>();
  const backlinksMap = new Map<string, NoteLinkTarget>();

  const currentExtracted = extractNoteLinksFromContent(currentNote.content);
  const currentLinkedIds = new Set(currentNote.linkedNoteIds || []);

  // 1. Compute Outgoing links (Notes mentioned by currentNote)
  for (const other of activeNotes) {
    const otherTitleLower = (other.title || '').trim().toLowerCase();
    const otherIdLower = other.id.toLowerCase();

    const isMentionedByTitle = Boolean(otherTitleLower && currentExtracted.includes(otherTitleLower));
    const isMentionedById = currentExtracted.includes(otherIdLower) || currentLinkedIds.has(other.id);

    if (isMentionedByTitle || isMentionedById) {
      outgoingMap.set(other.id, {
        id: other.id,
        title: other.title || 'Untitled Note',
      });
    }
  }

  // 2. Compute Backlinks (Other notes that mention currentNote)
  const currentTitleLower = (currentNote.title || '').trim().toLowerCase();
  const currentIdLower = currentNote.id.toLowerCase();

  for (const other of activeNotes) {
    const otherLinkedIds = other.linkedNoteIds ? new Set(other.linkedNoteIds) : null;
    const directIdLink = Boolean(otherLinkedIds?.has(currentNote.id));

    // FAST PATH: If other note does not contain links and has no direct id link, skip!
    const otherHasLinkSyntax = Boolean(
      other.content && (other.content.includes('[[') || other.content.includes('data-note-'))
    );

    if (!directIdLink && !otherHasLinkSyntax) {
      continue;
    }

    // FAST PATH: Substring check before parsing
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
      backlinksMap.set(other.id, {
        id: other.id,
        title: other.title || 'Untitled Note',
      });
    }
  }

  return {
    outgoing: Array.from(outgoingMap.values()),
    backlinks: Array.from(backlinksMap.values()),
  };
}

/**
 * Replaces [[Title]] with interactive HTML links inside rendered markdown or HTML
 */
export function formatWikiLinksInHtml(html: string): string {
  if (!html || !html.includes('[[')) return html || '';
  return html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, raw1, raw2) => {
    const title = (raw2 || raw1).trim();
    return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded-md bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200 font-medium text-xs border border-stone-300 dark:border-stone-700 cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors select-none keep-note-link" data-note-link-title="${title}" title="Open linked note: ${title}">🔗 ${title}</span>`;
  });
}
