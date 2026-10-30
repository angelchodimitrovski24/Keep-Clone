import { Note, TodoItem } from '@/types/note';

export type DataviewViewType = 'notion' | 'table' | 'list' | 'gallery' | 'task';

export interface DataviewCondition {
  field: string;
  operator: '=' | '!=' | 'contains' | '!contains' | '>' | '<' | '>=' | '<=' | 'is' | 'is_not';
  value: any;
}

export interface DataviewParsedQuery {
  viewType: DataviewViewType;
  columns?: string[];
  fromTags: string[];
  fromCategories: string[];
  excludeTags: string[];
  excludeCategories: string[];
  conditions: DataviewCondition[];
  sortField: 'updatedAt' | 'createdAt' | 'title' | 'category' | 'order';
  sortDirection: 'asc' | 'desc';
  limit?: number;
  rawQuery: string;
}

export interface DataviewTaskItem {
  id: string;
  noteId: string;
  noteTitle: string;
  text: string;
  completed: boolean;
  category?: string | null;
}

export interface DataviewQueryResult {
  notes: Note[];
  tasks?: DataviewTaskItem[];
  totalMatches: number;
  viewType: DataviewViewType;
  columns: string[];
}

/**
 * Parses relative or absolute date string to timestamp (ms).
 * Examples: 'today', 'today - 7d', '7d', '2026-10-01'
 */
function parseDateValue(val: string): number | null {
  const trimmed = val.trim().toLowerCase();
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  if (trimmed === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // today - Xd or today - X days
  const todayOffsetMatch = trimmed.match(/^today\s*([+-])\s*(\d+)\s*(d|day|days|w|week|weeks|m|month|months|h|hours?)?$/i);
  if (todayOffsetMatch) {
    const sign = todayOffsetMatch[1] === '-' ? -1 : 1;
    const num = parseInt(todayOffsetMatch[2], 10);
    const unit = (todayOffsetMatch[3] || 'd').charAt(0);
    let ms = num * ONE_DAY;
    if (unit === 'w') ms = num * 7 * ONE_DAY;
    else if (unit === 'm') ms = num * 30 * ONE_DAY;
    else if (unit === 'h') ms = num * 60 * 60 * 1000;

    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() + sign * ms;
  }

  // Relative: '7d' or '-7d'
  const relMatch = trimmed.match(/^(-?\d+)\s*(d|day|days|w|week|weeks|h|hours?)?$/i);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = (relMatch[2] || 'd').charAt(0);
    let ms = Math.abs(num) * ONE_DAY;
    if (unit === 'w') ms = Math.abs(num) * 7 * ONE_DAY;
    else if (unit === 'h') ms = Math.abs(num) * 60 * 60 * 1000;
    return now - ms;
  }

  // ISO / standard date string e.g. '2026-10-01'
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) return parsed;

  return null;
}

/**
 * Normalizes field names from Obsidian Dataview notation to Note properties.
 */
function normalizeFieldName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === 'file.name' || lower === 'name' || lower === 'file.title' || lower === 'title') return 'title';
  if (lower === 'file.folder' || lower === 'folder' || lower === 'category') return 'category';
  if (lower === 'file.tags' || lower === 'file.etags' || lower === 'tags' || lower === 'tag' || lower === 'labels' || lower === 'label') return 'labels';
  if (lower === 'file.mtime' || lower === 'file.mday' || lower === 'mtime' || lower === 'updated' || lower === 'updatedat') return 'updatedAt';
  if (lower === 'file.ctime' || lower === 'file.cday' || lower === 'ctime' || lower === 'created' || lower === 'createdat') return 'createdAt';
  if (lower === 'pinned' || lower === 'ispinned') return 'isPinned';
  if (lower === 'archived' || lower === 'isarchived') return 'isArchived';
  if (lower === 'trash' || lower === 'istrash') return 'isTrash';
  if (lower === 'checklist' || lower === 'islist' || lower === 'tasks' || lower === 'todos') return 'isList';
  if (lower === 'reminder' || lower === 'hasreminder') return 'reminder';
  if (lower === 'content' || lower === 'text' || lower === 'file.text') return 'content';
  if (lower === 'completed' || lower === 'iscompleted' || lower === 'done') return 'completed';
  return lower;
}

/**
 * Parses an Obsidian-style Dataview query string.
 * Example queries:
 *
 * TABLE category, labels, updatedAt
 * FROM #project
 * WHERE isPinned = true
 * SORT updatedAt DESC
 * LIMIT 10
 *
 * LIST
 * FROM "Work"
 * WHERE !isArchived
 *
 * TASK
 * WHERE !completed
 */
export function parseDataviewQuery(queryText: string): DataviewParsedQuery {
  const clean = queryText.replace(/```(?:dataview)?/gi, '').trim();
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let viewType: DataviewViewType = 'notion';
  let columns: string[] = ['title', 'category', 'labels', 'updatedAt'];
  const fromTags: string[] = [];
  const fromCategories: string[] = [];
  const excludeTags: string[] = [];
  const excludeCategories: string[] = [];
  const conditions: DataviewCondition[] = [];
  let sortField: 'updatedAt' | 'createdAt' | 'title' | 'category' | 'order' = 'updatedAt';
  let sortDirection: 'asc' | 'desc' = 'desc';
  let limit: number | undefined = undefined;

  let currentClause = '';
  let clauseBuffers: Record<string, string[]> = {
    view: [],
    from: [],
    where: [],
    sort: [],
    limit: [],
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('TABLE') || upper.startsWith('LIST') || upper.startsWith('TASK') || upper.startsWith('NOTION') || upper.startsWith('GALLERY') || upper.startsWith('CARDS') || upper.startsWith('PAGES')) {
      currentClause = 'view';
      clauseBuffers.view.push(line);
    } else if (upper.startsWith('FROM ') || upper === 'FROM') {
      currentClause = 'from';
      clauseBuffers.from.push(line.replace(/^FROM\s*/i, ''));
    } else if (upper.startsWith('WHERE ') || upper === 'WHERE') {
      currentClause = 'where';
      clauseBuffers.where.push(line.replace(/^WHERE\s*/i, ''));
    } else if (upper.startsWith('SORT ') || upper === 'SORT') {
      currentClause = 'sort';
      clauseBuffers.sort.push(line.replace(/^SORT\s*/i, ''));
    } else if (upper.startsWith('LIMIT ') || upper === 'LIMIT') {
      currentClause = 'limit';
      clauseBuffers.limit.push(line.replace(/^LIMIT\s*/i, ''));
    } else if (currentClause) {
      clauseBuffers[currentClause].push(line);
    } else {
      // Default line: check if contains FROM or WHERE
      if (/^from\s+/i.test(line)) {
        currentClause = 'from';
        clauseBuffers.from.push(line.replace(/^FROM\s*/i, ''));
      } else if (/^where\s+/i.test(line)) {
        currentClause = 'where';
        clauseBuffers.where.push(line.replace(/^WHERE\s*/i, ''));
      } else {
        clauseBuffers.where.push(line);
      }
    }
  }

  // 1. Process VIEW Clause
  const viewLine = clauseBuffers.view.join(' ').trim();
  if (viewLine) {
    const viewUpper = viewLine.toUpperCase();
    if (viewUpper.startsWith('TABLE')) {
      viewType = 'table';
      const colStr = viewLine.substring(5).trim();
      if (colStr) {
        const customCols = colStr
          .split(',')
          .map((c) => normalizeFieldName(c))
          .filter(Boolean);
        if (customCols.length > 0) {
          columns = ['title', ...customCols.filter((c) => c !== 'title')];
        }
      }
    } else if (viewUpper.startsWith('LIST')) {
      viewType = 'list';
    } else if (viewUpper.startsWith('TASK')) {
      viewType = 'task';
    } else if (viewUpper.startsWith('GALLERY') || viewUpper.startsWith('CARDS')) {
      viewType = 'gallery';
    } else if (viewUpper.startsWith('NOTION') || viewUpper.startsWith('PAGES')) {
      viewType = 'notion';
    }
  }

  // 2. Process FROM Clause
  const fromRaw = clauseBuffers.from.join(' ').trim();
  if (fromRaw) {
    // Extract tags #tag or !#tag
    const tagMatches = fromRaw.matchAll(/(!)?#([a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF\/-]+)/g);
    for (const tm of tagMatches) {
      const isNeg = tm[1] === '!';
      const tagName = tm[2].toLowerCase();
      if (isNeg) excludeTags.push(tagName);
      else fromTags.push(tagName);
    }

    // Extract categories/folders in quotes "Work" or !"Trash" or [[WikiLinks]]
    const quotedMatches = fromRaw.matchAll(/(!)?["'“]([^"'“”]+)["'”]/g);
    for (const qm of quotedMatches) {
      const isNeg = qm[1] === '!';
      const catName = qm[2].trim().toLowerCase();
      if (isNeg) excludeCategories.push(catName);
      else fromCategories.push(catName);
    }

    // Also support unquoted plain categories if no tags or quotes (e.g. FROM Work)
    if (fromTags.length === 0 && fromCategories.length === 0) {
      const tokens = fromRaw.split(/\s+(?:AND|OR|,)\s+/i);
      for (const t of tokens) {
        const cleanT = t.trim();
        if (cleanT.startsWith('#')) {
          fromTags.push(cleanT.substring(1).toLowerCase());
        } else if (cleanT) {
          fromCategories.push(cleanT.toLowerCase());
        }
      }
    }
  }

  // 3. Process WHERE Clause
  const whereRaw = clauseBuffers.where.join(' ').trim();
  if (whereRaw) {
    // Split by AND / && (OR handled within conditions)
    const conditionStrings = whereRaw.split(/\s+(?:AND|&&)\s+/i);

    for (const cStr of conditionStrings) {
      const trimmed = cStr.trim();
      if (!trimmed) continue;

      // contains(field, "value") or !contains(...)
      const containsMatch = trimmed.match(/^(!)?contains\(([^,]+),\s*["']?([^"')]+)["']?\)$/i);
      if (containsMatch) {
        const isNeg = containsMatch[1] === '!';
        const field = normalizeFieldName(containsMatch[2]);
        const value = containsMatch[3].trim().toLowerCase();
        conditions.push({
          field,
          operator: isNeg ? '!contains' : 'contains',
          value,
        });
        continue;
      }

      // field contains "value"
      const infixContainsMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s+contains\s+["']?([^"']+)["']?$/i);
      if (infixContainsMatch) {
        conditions.push({
          field: normalizeFieldName(infixContainsMatch[1]),
          operator: 'contains',
          value: infixContainsMatch[2].trim().toLowerCase(),
        });
        continue;
      }

      // Binary operator comparison: field (=, !=, >=, <=, >, <) value
      const opMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
      if (opMatch) {
        const field = normalizeFieldName(opMatch[1]);
        const op = opMatch[2] as DataviewCondition['operator'];
        let rawVal = opMatch[3].trim().replace(/^["']|["']$/g, '');
        let parsedVal: any = rawVal;

        if (rawVal.toLowerCase() === 'true') parsedVal = true;
        else if (rawVal.toLowerCase() === 'false') parsedVal = false;
        else if (rawVal.toLowerCase() === 'null') parsedVal = null;
        else if (!isNaN(Number(rawVal))) parsedVal = Number(rawVal);
        else {
          const dateMs = parseDateValue(rawVal);
          if (dateMs !== null && (field === 'updatedAt' || field === 'createdAt')) {
            parsedVal = dateMs;
          }
        }

        conditions.push({
          field,
          operator: op,
          value: parsedVal,
        });
        continue;
      }

      // Negated boolean: !isPinned, !isArchived, !completed
      if (trimmed.startsWith('!')) {
        const field = normalizeFieldName(trimmed.substring(1));
        conditions.push({
          field,
          operator: '=',
          value: false,
        });
        continue;
      }

      // Positive boolean flag: isPinned, isArchived, completed, reminder
      const field = normalizeFieldName(trimmed);
      conditions.push({
        field,
        operator: '=',
        value: true,
      });
    }
  }

  // 4. Process SORT Clause
  const sortRaw = clauseBuffers.sort.join(' ').trim();
  if (sortRaw) {
    const parts = sortRaw.split(/\s+/);
    if (parts[0]) {
      const normalized = normalizeFieldName(parts[0]);
      if (
        normalized === 'updatedAt' ||
        normalized === 'createdAt' ||
        normalized === 'title' ||
        normalized === 'category' ||
        normalized === 'order'
      ) {
        sortField = normalized;
      }
    }
    if (parts[1] && parts[1].toLowerCase() === 'asc') {
      sortDirection = 'asc';
    } else {
      sortDirection = 'desc';
    }
  }

  // 5. Process LIMIT Clause
  const limitRaw = clauseBuffers.limit.join(' ').trim();
  if (limitRaw) {
    const num = parseInt(limitRaw, 10);
    if (!isNaN(num) && num > 0) {
      limit = num;
    }
  }

  return {
    viewType,
    columns,
    fromTags,
    fromCategories,
    excludeTags,
    excludeCategories,
    conditions,
    sortField,
    sortDirection,
    limit,
    rawQuery: clean,
  };
}

/**
 * Executes a parsed Dataview query over the provided notes collection.
 */
export function executeDataviewQuery(
  query: DataviewParsedQuery,
  allNotes: Note[],
  currentNoteId?: string
): DataviewQueryResult {
  let filtered = allNotes.filter((note) => {
    // 0. Exclude self note (to avoid infinite recursion) and trash by default unless requested
    if (currentNoteId && note.id === currentNoteId) return false;

    // Check if trash explicitly requested in conditions
    const checksTrash = query.conditions.some((c) => c.field === 'isTrash' && c.value === true);
    if (!checksTrash && note.isTrash) return false;

    // 1. Evaluate FROM Tags
    if (query.fromTags.length > 0) {
      const noteLabelsLower = (note.labels || []).map((l) => l.toLowerCase());
      const hasMatch = query.fromTags.some((tag) =>
        noteLabelsLower.includes(tag) || noteLabelsLower.some((nl) => nl.includes(tag))
      );
      if (!hasMatch) return false;
    }

    // 2. Evaluate Exclude Tags
    if (query.excludeTags.length > 0) {
      const noteLabelsLower = (note.labels || []).map((l) => l.toLowerCase());
      const hasExcluded = query.excludeTags.some((tag) =>
        noteLabelsLower.includes(tag) || noteLabelsLower.some((nl) => nl.includes(tag))
      );
      if (hasExcluded) return false;
    }

    // 3. Evaluate FROM Categories
    if (query.fromCategories.length > 0) {
      const catLower = (note.category || '').toLowerCase();
      const hasMatch = query.fromCategories.some((cat) => catLower === cat || catLower.includes(cat));
      if (!hasMatch) return false;
    }

    // 4. Evaluate Exclude Categories
    if (query.excludeCategories.length > 0) {
      const catLower = (note.category || '').toLowerCase();
      const hasExcluded = query.excludeCategories.some((cat) => catLower === cat || catLower.includes(cat));
      if (hasExcluded) return false;
    }

    // 5. Evaluate WHERE Conditions
    for (const cond of query.conditions) {
      const { field, operator, value } = cond;

      // Boolean conditions
      if (field === 'isPinned') {
        const matches = Boolean(note.isPinned) === Boolean(value);
        if (!matches) return false;
        continue;
      }

      if (field === 'isArchived') {
        const matches = Boolean(note.isArchived) === Boolean(value);
        if (!matches) return false;
        continue;
      }

      if (field === 'isTrash') {
        const matches = Boolean(note.isTrash) === Boolean(value);
        if (!matches) return false;
        continue;
      }

      if (field === 'isList') {
        const matches = Boolean(note.isList) === Boolean(value);
        if (!matches) return false;
        continue;
      }

      if (field === 'reminder') {
        const hasRem = Boolean(note.reminder);
        const matches = hasRem === Boolean(value);
        if (!matches) return false;
        continue;
      }

      // Title
      if (field === 'title') {
        const titleLower = (note.title || '').toLowerCase();
        const targetVal = String(value).toLowerCase();
        if (operator === '=' && titleLower !== targetVal) return false;
        if (operator === '!=' && titleLower === targetVal) return false;
        if (operator === 'contains' && !titleLower.includes(targetVal)) return false;
        if (operator === '!contains' && titleLower.includes(targetVal)) return false;
        continue;
      }

      // Category
      if (field === 'category') {
        const catLower = (note.category || '').toLowerCase();
        const targetVal = String(value).toLowerCase();
        if (operator === '=' && catLower !== targetVal) return false;
        if (operator === '!=' && catLower === targetVal) return false;
        if (operator === 'contains' && !catLower.includes(targetVal)) return false;
        if (operator === '!contains' && catLower.includes(targetVal)) return false;
        continue;
      }

      // Labels / Tags
      if (field === 'labels') {
        const noteLabelsLower = (note.labels || []).map((l) => l.toLowerCase());
        const targetVal = String(value).toLowerCase();
        const has = noteLabelsLower.includes(targetVal) || noteLabelsLower.some((l) => l.includes(targetVal));
        if ((operator === '=' || operator === 'contains') && !has) return false;
        if ((operator === '!=' || operator === '!contains') && has) return false;
        continue;
      }

      // Content text
      if (field === 'content') {
        const contentLower = (note.content || '').toLowerCase();
        const targetVal = String(value).toLowerCase();
        if (operator === 'contains' && !contentLower.includes(targetVal)) return false;
        if (operator === '!contains' && contentLower.includes(targetVal)) return false;
        continue;
      }

      // Dates (updatedAt / createdAt)
      if (field === 'updatedAt' || field === 'createdAt') {
        const noteDate = Number(note[field] || 0);
        const compareVal = typeof value === 'number' ? value : parseDateValue(String(value));
        if (compareVal !== null) {
          if (operator === '>' && !(noteDate > compareVal)) return false;
          if (operator === '>=' && !(noteDate >= compareVal)) return false;
          if (operator === '<' && !(noteDate < compareVal)) return false;
          if (operator === '<=' && !(noteDate <= compareVal)) return false;
        }
        continue;
      }

      // Completed (for notes with checklist)
      if (field === 'completed') {
        if (!note.isList || !note.todos || note.todos.length === 0) return false;
        const allDone = note.todos.every((t) => t.completed);
        if (Boolean(value) !== allDone) return false;
        continue;
      }
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let aVal: any = a[query.sortField];
    let bVal: any = b[query.sortField];

    if (query.sortField === 'title') {
      aVal = (a.title || '').toLowerCase();
      bVal = (b.title || '').toLowerCase();
      return query.sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    if (query.sortField === 'category') {
      aVal = (a.category || '').toLowerCase();
      bVal = (b.category || '').toLowerCase();
      return query.sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    aVal = Number(aVal || 0);
    bVal = Number(bVal || 0);
    return query.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const totalMatches = filtered.length;

  // Limit
  if (query.limit && query.limit > 0) {
    filtered = filtered.slice(0, query.limit);
  }

  // Extract individual task items if viewType is 'task'
  let tasks: DataviewTaskItem[] | undefined = undefined;
  if (query.viewType === 'task') {
    const taskList: DataviewTaskItem[] = [];
    for (const n of filtered) {
      if (n.isList && Array.isArray(n.todos)) {
        for (const todo of n.todos) {
          // Check completed filter in conditions
          const completedFilter = query.conditions.find((c) => c.field === 'completed');
          if (completedFilter && Boolean(completedFilter.value) !== todo.completed) {
            continue;
          }
          taskList.push({
            id: todo.id,
            noteId: n.id,
            noteTitle: n.title || 'Untitled note',
            text: todo.text,
            completed: todo.completed,
            category: n.category,
          });
        }
      }
    }
    tasks = taskList;
  }

  return {
    notes: filtered,
    tasks,
    totalMatches,
    viewType: query.viewType,
    columns: query.columns || ['title', 'category', 'labels', 'updatedAt'],
  };
}

/**
 * Useful example queries for user inspiration & quick insertion.
 */
export const DATAVIEW_TEMPLATES = [
  {
    name: '📌 Pinned Notes',
    description: 'Display all pinned notes in a Notion list',
    query: `NOTION\nWHERE isPinned\nSORT updatedAt DESC`,
  },
  {
    name: '🏷️ Notes by Tag',
    description: 'Filter notes matching a specific tag',
    query: `TABLE category, labels, updatedAt\nFROM #project\nSORT updatedAt DESC\nLIMIT 10`,
  },
  {
    name: '📁 Notes by Category',
    description: 'Show notes belonging to a specific category',
    query: `GALLERY\nFROM "Work"\nSORT updatedAt DESC`,
  },
  {
    name: '☑️ Pending Tasks',
    description: 'Checklist items that are not yet completed',
    query: `TASK\nWHERE !completed`,
  },
  {
    name: '🕒 Recently Updated',
    description: 'The 5 most recently edited notes',
    query: `LIST\nSORT updatedAt DESC\nLIMIT 5`,
  },
  {
    name: '📊 Full Database Table',
    description: 'All active notes in a Notion database table',
    query: `TABLE category, labels, updatedAt\nWHERE !isArchived\nSORT updatedAt DESC\nLIMIT 20`,
  },
];
