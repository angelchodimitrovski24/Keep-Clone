import { Note, TodoItem, NoteColor } from '@/types/note';
import { convertMarkdownToHtml } from '@/lib/formatUtils';

export interface MergeNotesOptions {
  customTitle?: string;
  includeTitles?: boolean;
  includeLabels?: boolean;
  includeDates?: boolean;
  includeCategory?: boolean;
  includeDividers?: boolean;
  addMergedLabel?: boolean;
  postMergeAction?: 'keep' | 'archive' | 'trash';
}

/**
 * Builds the merged Markdown/HTML content for a list of notes.
 * For each note, it includes its title as a heading, its labels, dates, and its content.
 */
export function buildMergedContent(
  notes: Note[],
  options: {
    includeTitles: boolean;
    includeLabels: boolean;
    includeDates: boolean;
    includeCategory: boolean;
    includeDividers: boolean;
  }
): string {
  const sectionMds: string[] = [];

  notes.forEach((note, idx) => {
    let section = '';

    // 1. Note Title Heading
    if (options.includeTitles) {
      const title = note.title?.trim() || `Note ${idx + 1}`;
      section += `## 📌 ${title}\n\n`;
    }

    // 2. Metadata Block (Labels, Date, Category)
    const metaParts: string[] = [];

    if (options.includeLabels && Array.isArray(note.labels) && note.labels.length > 0) {
      metaParts.push(`🏷️ **Labels:** ${note.labels.map((l) => `\`#${l}\``).join(' ')}`);
    }

    if (options.includeDates && note.createdAt) {
      const dateStr = new Date(note.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      metaParts.push(`📅 **Date:** ${dateStr}`);
    }

    if (options.includeCategory && note.category) {
      const catName = typeof note.category === 'string' ? note.category : (note.category as any)?.name;
      if (catName) {
        metaParts.push(`📁 **Category:** ${catName}`);
      }
    }

    if (metaParts.length > 0) {
      section += `> ${metaParts.join(' | ')}\n\n`;
    }

    // 3. Body Content / Checklists
    if (note.isList && Array.isArray(note.todos) && note.todos.length > 0) {
      const todoLines = note.todos
        .map((t) => `- [${t.completed ? 'x' : ' '}] ${t.text}`)
        .join('\n');
      section += `${todoLines}\n\n`;
    } else if (note.content && typeof note.content === 'string' && note.content.trim()) {
      section += `${note.content.trim()}\n\n`;
    } else {
      section += `*(Empty note)*\n\n`;
    }

    sectionMds.push(section.trim());
  });

  const separator = options.includeDividers ? '\n\n---\n\n' : '\n\n';
  const fullMarkdown = sectionMds.join(separator);

  return convertMarkdownToHtml(fullMarkdown);
}

/**
 * Creates the full payload for the new merged note.
 */
export function compileMergedNotePayload(
  notes: Note[],
  options: MergeNotesOptions = {}
): {
  title: string;
  content: string;
  labels: string[];
  images: string[];
  drawings: any[];
  category: string | null;
  color: NoteColor;
  linkedNoteIds: string[];
} {
  const {
    customTitle,
    includeTitles = true,
    includeLabels = true,
    includeDates = true,
    includeCategory = true,
    includeDividers = true,
    addMergedLabel = true,
  } = options;

  // Title: use custom if provided, otherwise sensible joined title
  let finalTitle = customTitle?.trim();
  if (!finalTitle) {
    const titles = notes
      .map((n) => n.title?.trim())
      .filter((t): t is string => Boolean(t && t.length > 0));

    if (titles.length === 0) {
      finalTitle = `Merged Note (${notes.length} notes)`;
    } else if (titles.length <= 2) {
      finalTitle = `Merged: ${titles.join(' & ')}`;
    } else {
      finalTitle = `Merged: ${titles.slice(0, 2).join(', ')} (+${titles.length - 2} more)`;
    }
  }

  // Combined labels: union of all labels + optional 'merged' tag
  const allLabels = new Set<string>();
  notes.forEach((n) => {
    if (Array.isArray(n.labels)) {
      n.labels.forEach((l) => {
        if (l && typeof l === 'string') allLabels.add(l.trim());
      });
    }
  });
  if (addMergedLabel) {
    allLabels.add('merged');
  }

  // Combined images & drawings
  const allImages = Array.from(new Set(notes.flatMap((n) => n.images || [])));
  const allDrawings = notes.flatMap((n) => n.drawings || []);

  // Category: first valid category among notes
  const categoryNote = notes.find((n) => Boolean(n.category));
  const category = categoryNote
    ? typeof categoryNote.category === 'string'
      ? categoryNote.category
      : (categoryNote.category as any)?.name || null
    : null;

  // Color: first non-default color, or default
  const colorNote = notes.find((n) => n.color && n.color !== 'default');
  const color: NoteColor = colorNote?.color || 'default';

  // Linked Note IDs
  const linkedNoteIds = Array.from(new Set(notes.map((n) => n.id)));

  // Generate HTML content
  const content = buildMergedContent(notes, {
    includeTitles,
    includeLabels,
    includeDates,
    includeCategory,
    includeDividers,
  });

  return {
    title: finalTitle,
    content,
    labels: Array.from(allLabels),
    images: allImages,
    drawings: allDrawings,
    category,
    color,
    linkedNoteIds,
  };
}
