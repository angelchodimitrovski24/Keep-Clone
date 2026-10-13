import { Note } from '@/types/note';

export interface NoteLinkTarget {
  id: string;
  title: string;
}

export interface BidirectionalLinksResult {
  outgoing: NoteLinkTarget[];
  backlinks: NoteLinkTarget[];
}

/**
 * Extracts note titles or note IDs referenced inside content via [[Title]] or [[id|Title]]
 */
export function extractNoteLinksFromContent(content: string): string[] {
  if (!content) return [];
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

  return Array.from(new Set(matches));
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

    const isMentionedByTitle = otherTitleLower && currentExtracted.includes(otherTitleLower);
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
    const otherExtracted = extractNoteLinksFromContent(other.content);
    const otherLinkedIds = new Set(other.linkedNoteIds || []);

    const mentionsCurrentTitle =
      currentTitleLower && otherExtracted.includes(currentTitleLower);
    const mentionsCurrentId =
      otherExtracted.includes(currentIdLower) || otherLinkedIds.has(currentNote.id);

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
  if (!html) return '';
  return html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, raw1, raw2) => {
    const title = (raw2 || raw1).trim();
    return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 font-medium text-xs border border-amber-500/20 cursor-pointer hover:bg-amber-500/25 transition-colors select-none keep-note-link" data-note-link-title="${title}" title="Open linked note: ${title}">🔗 ${title}</span>`;
  });
}
