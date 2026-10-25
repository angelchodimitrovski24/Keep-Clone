import { Note, TodoItem, NoteColor } from '@/types/note';

export type DateFilterField = 'created' | 'updated';

export type DateRangePreset =
  | 'today'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'last_6_months'
  | 'last_year';

export interface DateRangeOption {
  id: DateRangePreset;
  label: string;
  shortLabel: string;
  description: string;
}

export const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { id: 'today', label: 'All notes today', shortLabel: 'Today', description: 'Created or updated since midnight' },
  { id: 'last_7_days', label: 'All notes last 7 days', shortLabel: 'Last 7 days', description: 'Within the past week' },
  { id: 'last_14_days', label: 'All notes last 14 days', shortLabel: 'Last 14 days', description: 'Within the past 2 weeks' },
  { id: 'last_30_days', label: 'All notes last 30 days', shortLabel: 'Last 30 days', description: 'Within the past month' },
  { id: 'last_60_days', label: 'All notes last 60 days', shortLabel: 'Last 60 days', description: 'Within the past 2 months' },
  { id: 'last_90_days', label: 'All notes last 90 days', shortLabel: 'Last 90 days', description: 'Within the past quarter' },
  { id: 'last_6_months', label: 'All notes last 6 months', shortLabel: 'Last 6 months', description: 'Within the past half-year' },
  { id: 'last_year', label: 'All notes last year', shortLabel: 'Last year', description: 'Within the past 365 days' },
];

/**
 * Calculates the starting timestamp (in ms) for a given date range preset.
 */
export function getMinTimestampForPreset(preset: DateRangePreset): number {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return startOfToday.getTime();
    }
    case 'last_7_days': {
      return Date.now() - 7 * 86400 * 1000;
    }
    case 'last_14_days': {
      return Date.now() - 14 * 86400 * 1000;
    }
    case 'last_30_days': {
      return Date.now() - 30 * 86400 * 1000;
    }
    case 'last_60_days': {
      return Date.now() - 60 * 86400 * 1000;
    }
    case 'last_90_days': {
      return Date.now() - 90 * 86400 * 1000;
    }
    case 'last_6_months': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return d.getTime();
    }
    case 'last_year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d.getTime();
    }
  }
}

/**
 * Filters notes matching the selected date field and preset range.
 */
export function filterNotesByDateRange(
  notes: Note[],
  field: DateFilterField,
  preset: DateRangePreset,
  includeArchived: boolean = false
): Note[] {
  const minTs = getMinTimestampForPreset(preset);

  return notes
    .filter((note) => {
      // Exclude trashed notes
      if (note.isTrash) return false;
      // Optionally exclude archived notes
      if (!includeArchived && note.isArchived) return false;

      const noteTs = field === 'created' ? note.createdAt : (note.updatedAt || note.createdAt);
      return noteTs >= minTs;
    })
    .sort((a, b) => {
      const tsA = field === 'created' ? a.createdAt : (a.updatedAt || a.createdAt);
      const tsB = field === 'created' ? b.createdAt : (b.updatedAt || b.createdAt);
      return tsB - tsA; // newest first
    });
}

export interface CompileOptions {
  customTitle?: string;
  style: 'full' | 'summary' | 'todos';
  includeMeta: boolean;
  color?: NoteColor;
}

/**
 * Compiles a list of notes into payload for a newly created note.
 */
export function compileNotesToPayload(
  notes: Note[],
  field: DateFilterField,
  preset: DateRangePreset,
  options: CompileOptions
): {
  title: string;
  content: string;
  isList: boolean;
  todos: TodoItem[];
  color: NoteColor;
  linkedNoteIds: string[];
} {
  const presetOpt = DATE_RANGE_OPTIONS.find((p) => p.id === preset);
  const rangeName = presetOpt?.label || 'Notes';
  const fieldName = field === 'created' ? 'Created' : 'Updated';
  const dateStr = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const defaultTitle = options.customTitle?.trim() || `${rangeName} (${fieldName})`;

  // Collect linked note IDs
  const linkedNoteIds = Array.from(new Set(notes.map((n) => n.id)));

  // If style is master checklist
  if (options.style === 'todos') {
    const compiledTodos: TodoItem[] = [];

    notes.forEach((n) => {
      const noteTitlePrefix = n.title ? `[${n.title}] ` : '';

      if (n.isList && n.todos && n.todos.length > 0) {
        n.todos.forEach((t) => {
          compiledTodos.push({
            id: `todo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            text: `${noteTitlePrefix}${t.text}`,
            completed: t.completed,
          });
        });
      } else if (n.content) {
        const plainLines = n.content
          .replace(/<[^>]+>/g, '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        plainLines.forEach((l) => {
          compiledTodos.push({
            id: `todo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            text: `${noteTitlePrefix}${l.replace(/^[-*]\s*(\[[ xX]\]\s*)?/, '')}`,
            completed: false,
          });
        });
      }
    });

    return {
      title: defaultTitle,
      content: '',
      isList: true,
      todos: compiledTodos,
      color: options.color || 'default',
      linkedNoteIds,
    };
  }

  // Markdown Document Compilation
  const introBlock = `> 📅 **${rangeName}** (${fieldName})\n> *Compiled on ${dateStr} • ${notes.length} note${notes.length === 1 ? '' : 's'} included*\n\n`;

  const noteBlocks = notes.map((n, idx) => {
    const ts = field === 'created' ? n.createdAt : (n.updatedAt || n.createdAt);
    const dateFormatted = new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const metaItems: string[] = [`${fieldName}: ${dateFormatted}`];
    if (options.includeMeta) {
      if (n.category) metaItems.push(`Category: **${n.category}**`);
      if (n.labels && n.labels.length > 0) {
        metaItems.push(`Labels: ${n.labels.map((l) => `#${l}`).join(' ')}`);
      }
    }
    const metaLine = `*${metaItems.join(' • ')}*`;

    let bodyText = '';
    if (options.style === 'summary') {
      if (n.isList && n.todos && n.todos.length > 0) {
        const sample = n.todos.slice(0, 3).map((t) => `- [${t.completed ? 'x' : ' '}] ${t.text}`).join('\n');
        bodyText = sample + (n.todos.length > 3 ? `\n*... and ${n.todos.length - 3} more items*` : '');
      } else if (n.content) {
        const clean = n.content.replace(/<[^>]+>/g, '').trim();
        bodyText = clean.length > 220 ? `${clean.slice(0, 220)}...` : clean;
      } else {
        bodyText = '*(Empty content)*';
      }
    } else {
      // Full fidelity content
      if (n.isList && n.todos && n.todos.length > 0) {
        bodyText = n.todos.map((t) => `- [${t.completed ? 'x' : ' '}] ${t.text}`).join('\n');
      } else {
        bodyText = n.content || '*(Empty content)*';
      }
    }

    const noteHeading = `### ${idx + 1}. [[${n.title || 'Untitled Note'}]]`;

    return `${noteHeading}\n${metaLine}\n\n${bodyText}`;
  });

  const fullContent = introBlock + noteBlocks.join('\n\n---\n\n');

  return {
    title: defaultTitle,
    content: fullContent,
    isList: false,
    todos: [],
    color: options.color || 'default',
    linkedNoteIds,
  };
}
