export type SlashCommandGroup = 'suggested' | 'basic' | 'connections' | 'media' | 'actions';

export type SlashBlockActionId =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'bullet-list'
  | 'number-list'
  | 'task-list'
  | 'quote'
  | 'divider'
  | 'code-block'
  | 'table'
  | 'dataview'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'inline-code'
  | 'clear-format';

export type SlashNoteActionId =
  | 'wiki-link'
  | 'subpage'
  | 'toggle-subpages'
  | 'link-note'
  | 'file-hub'
  | 'next-note'
  | 'source-note'
  | 'toggle-hub'
  | 'connections'
  | 'knowledge-map'
  | 'image'
  | 'drawing'
  | 'extract-url'
  | 'import-mhtml'
  | 'notion-template'
  | 'date-digest'
  | 'category'
  | 'label'
  | 'color'
  | 'reminder'
  | 'checklist-mode'
  | 'formatting-toolbar'
  | 'stopwatch'
  | 'edit-reading-time'
  | 'ai-chat'
  | 'ai-suggest'
  | 'extract-selection'
  | 'encrypt'
  | 'history'
  | 'preview'
  | 'pin'
  | 'copy-url'
  | 'copy-content'
  | 'share'
  | 'duplicate'
  | 'print'
  | 'archive'
  | 'trash'
  | 'close';

export type SlashCommandId = SlashBlockActionId | SlashNoteActionId;

export interface SlashAnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SlashContextFlags {
  isList?: boolean;
  isFormattingOpen?: boolean;
  isHub?: boolean;
  isPreviewMode?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isEncrypted?: boolean;
  showSubpages?: boolean;
  showConnections?: boolean;
  category?: string | null;
  labelsCount?: number;
}

export interface SlashCommandItem {
  id: SlashCommandId;
  kind: 'block' | 'note';
  group: SlashCommandGroup;
  label: string;
  description?: string;
  shortcut?: string;
  badge?: string;
  iconKey: string;
  keywords: string[];
  getLabel?: (flags?: SlashContextFlags) => string;
  getDescription?: (flags?: SlashContextFlags) => string | undefined;
}

export const SLASH_GROUP_ORDER: SlashCommandGroup[] = [
  'suggested',
  'basic',
  'connections',
  'media',
  'actions',
];

export const SLASH_GROUP_LABELS: Record<SlashCommandGroup, string> = {
  suggested: 'Suggested',
  basic: 'Basic blocks',
  connections: 'Pages & connections',
  media: 'Media & embeds',
  actions: 'Menus & actions',
};

export const SLASH_COMMANDS: SlashCommandItem[] = [
  // Suggested (quick Notion favorites)
  {
    id: 'task-list',
    kind: 'block',
    group: 'suggested',
    label: 'To-do list',
    description: 'Inline checkboxes',
    shortcut: '[]',
    iconKey: 'todo',
    keywords: ['todo', 'task', 'checkbox', 'check', 'done', 'list'],
  },
  {
    id: 'subpage',
    kind: 'note',
    group: 'suggested',
    label: 'Sub-page',
    description: 'Create nested page',
    iconKey: 'subpage',
    keywords: ['subpage', 'page', 'child', 'nest', 'notion'],
  },
  {
    id: 'wiki-link',
    kind: 'note',
    group: 'suggested',
    label: 'Link to page',
    description: 'Insert [[ note link',
    shortcut: '[[',
    iconKey: 'link',
    keywords: ['link', 'mention', 'wiki', 'note', 'reference', 'connect'],
  },
  {
    id: 'category',
    kind: 'note',
    group: 'suggested',
    label: 'Category',
    description: 'Assign category',
    iconKey: 'folder',
    keywords: ['category', 'folder', 'organize', 'section'],
    getLabel: (flags) => (flags?.category ? `Category (${flags.category})` : 'Category'),
  },

  // Basic blocks
  {
    id: 'text',
    kind: 'block',
    group: 'basic',
    label: 'Text',
    description: 'Plain paragraph',
    iconKey: 'text',
    keywords: ['text', 'paragraph', 'normal', 'plain', 'aa'],
  },
  {
    id: 'h1',
    kind: 'block',
    group: 'basic',
    label: 'Heading 1',
    shortcut: '#',
    iconKey: 'h1',
    keywords: ['h1', 'heading1', 'heading 1', 'title', 'big'],
  },
  {
    id: 'h2',
    kind: 'block',
    group: 'basic',
    label: 'Heading 2',
    shortcut: '##',
    iconKey: 'h2',
    keywords: ['h2', 'heading2', 'heading 2', 'subtitle', 'section'],
  },
  {
    id: 'h3',
    kind: 'block',
    group: 'basic',
    label: 'Heading 3',
    shortcut: '###',
    iconKey: 'h3',
    keywords: ['h3', 'heading3', 'heading 3', 'subheading'],
  },
  {
    id: 'h4',
    kind: 'block',
    group: 'basic',
    label: 'Heading 4',
    shortcut: '####',
    iconKey: 'h4',
    keywords: ['h4', 'heading4', 'heading 4', 'small heading'],
  },
  {
    id: 'bullet-list',
    kind: 'block',
    group: 'basic',
    label: 'Bulleted list',
    shortcut: '-',
    iconKey: 'bullet',
    keywords: ['bullet', 'ul', 'list', 'unordered', 'dots'],
  },
  {
    id: 'number-list',
    kind: 'block',
    group: 'basic',
    label: 'Numbered list',
    shortcut: '1.',
    iconKey: 'numbered',
    keywords: ['numbered', 'ordered', 'ol', '1.', 'steps'],
  },
  {
    id: 'quote',
    kind: 'block',
    group: 'basic',
    label: 'Quote',
    shortcut: '"',
    iconKey: 'quote',
    keywords: ['quote', 'blockquote', 'callout', 'cite'],
  },
  {
    id: 'divider',
    kind: 'block',
    group: 'basic',
    label: 'Divider',
    shortcut: '---',
    iconKey: 'divider',
    keywords: ['divider', 'hr', 'line', 'separator', 'rule'],
  },
  {
    id: 'code-block',
    kind: 'block',
    group: 'basic',
    label: 'Code block',
    shortcut: '```',
    iconKey: 'codeblock',
    keywords: ['code', 'snippet', 'pre', 'fenced', 'programming'],
  },
  {
    id: 'table',
    kind: 'block',
    group: 'basic',
    label: 'Table',
    description: 'Insert 3x3 table',
    iconKey: 'table',
    keywords: ['table', 'grid', 'spreadsheet', 'rows', 'columns'],
  },
  {
    id: 'dataview',
    kind: 'block',
    group: 'basic',
    label: 'Dataview query',
    description: 'Live note table/list query',
    badge: 'Query',
    iconKey: 'dataview',
    keywords: ['dataview', 'query', 'database', 'obsidian', 'filter'],
  },

  // Connections & Pages
  {
    id: 'toggle-subpages',
    kind: 'note',
    group: 'connections',
    label: 'Sub-pages section',
    description: 'Show or toggle sub-pages',
    iconKey: 'subpages',
    keywords: ['subpages', 'children', 'notion', 'gallery', 'pages'],
    getLabel: (flags) => (flags?.showSubpages ? 'Sub-pages section (shown)' : 'Show sub-pages section'),
  },
  {
    id: 'link-note',
    kind: 'note',
    group: 'connections',
    label: 'Connect to note',
    description: 'Related, Next, Source or Hub',
    iconKey: 'link2',
    keywords: ['connect', 'link', 'related', 'relationship'],
  },
  {
    id: 'file-hub',
    kind: 'note',
    group: 'connections',
    label: 'File inside Hub',
    description: 'Move under a Knowledge Hub',
    iconKey: 'home',
    keywords: ['hub', 'file', 'parent', 'move', 'folder'],
  },
  {
    id: 'next-note',
    kind: 'note',
    group: 'connections',
    label: 'Connect Next note',
    description: 'Sequence after this note',
    iconKey: 'arrow-right',
    keywords: ['next', 'sequence', 'after', 'flow'],
  },
  {
    id: 'source-note',
    kind: 'note',
    group: 'connections',
    label: 'Connect Source note',
    description: 'Add reference or inspiration',
    iconKey: 'book',
    keywords: ['source', 'reference', 'citation', 'from'],
  },
  {
    id: 'toggle-hub',
    kind: 'note',
    group: 'connections',
    label: 'Make Knowledge Hub',
    description: 'Pin as Hub in sidebar tree',
    iconKey: 'home',
    keywords: ['hub', 'make hub', 'knowledge hub', 'moc', 'index'],
    getLabel: (flags) => (flags?.isHub ? 'Remove Knowledge Hub status' : 'Make Knowledge Hub'),
  },
  {
    id: 'connections',
    kind: 'note',
    group: 'connections',
    label: 'Connections & Backlinks',
    description: 'Toggle structured connections drawer',
    iconKey: 'network',
    keywords: ['connections', 'backlinks', 'structure', 'graph', 'links'],
    getLabel: (flags) => (flags?.showConnections ? 'Hide connections panel' : 'Show connections panel'),
  },
  {
    id: 'knowledge-map',
    kind: 'note',
    group: 'connections',
    label: 'Knowledge Map',
    description: 'Inspect interactive link graph',
    iconKey: 'map',
    keywords: ['map', 'graph', 'mindmap', 'visual'],
  },

  // Media & Imports
  {
    id: 'image',
    kind: 'note',
    group: 'media',
    label: 'Image or file',
    description: 'Upload image, PDF or attachment',
    iconKey: 'image',
    keywords: ['image', 'photo', 'picture', 'file', 'upload', 'attachment', 'pdf'],
  },
  {
    id: 'drawing',
    kind: 'note',
    group: 'media',
    label: 'Drawing',
    description: 'Open freehand sketch canvas',
    iconKey: 'drawing',
    keywords: ['draw', 'sketch', 'pen', 'canvas', 'whiteboard'],
  },
  {
    id: 'extract-url',
    kind: 'note',
    group: 'media',
    label: 'Web Clipper (URL)',
    description: 'Import article or webpage',
    iconKey: 'globe',
    keywords: ['url', 'web', 'clip', 'extract', 'website', 'article'],
  },
  {
    id: 'import-mhtml',
    kind: 'note',
    group: 'media',
    label: 'Import MHTML file',
    description: 'Save full .mhtml webpage snapshot',
    iconKey: 'globe',
    keywords: ['mhtml', 'html', 'snapshot', 'archive', 'webpage'],
  },
  {
    id: 'notion-template',
    kind: 'note',
    group: 'media',
    label: 'Notion Template',
    description: 'Create structured template page',
    iconKey: 'template',
    keywords: ['template', 'notion', 'hub', 'project', 'meeting'],
  },
  {
    id: 'date-digest',
    kind: 'note',
    group: 'media',
    label: 'Compile from Date Range',
    description: 'Build summary note from dates',
    iconKey: 'calendar',
    keywords: ['date', 'range', 'compile', 'digest', 'summary'],
  },

  // Menus & Note Actions (previously in clutter toolbars)
  {
    id: 'label',
    kind: 'note',
    group: 'actions',
    label: 'Labels',
    description: 'Tag this note',
    iconKey: 'tag',
    keywords: ['label', 'tag', 'tags', 'hashtag'],
    getLabel: (flags) => (flags?.labelsCount ? `Labels (${flags.labelsCount})` : 'Add labels'),
  },
  {
    id: 'color',
    kind: 'note',
    group: 'actions',
    label: 'Color & theme',
    description: 'Background color or artwork',
    iconKey: 'palette',
    keywords: ['color', 'theme', 'background', 'palette', 'appearance'],
  },
  {
    id: 'reminder',
    kind: 'note',
    group: 'actions',
    label: 'Reminder',
    description: 'Schedule follow-up alert',
    iconKey: 'bell',
    keywords: ['reminder', 'alarm', 'schedule', 'alert', 'notify'],
  },
  {
    id: 'checklist-mode',
    kind: 'note',
    group: 'actions',
    label: 'Keep checklist mode',
    description: 'Toggle dedicated Keep checklist',
    iconKey: 'checklist',
    keywords: ['checklist', 'checkbox', 'keep list', 'items'],
    getLabel: (flags) => (flags?.isList ? 'Convert Keep checklist to text' : 'Switch to Keep checklist'),
  },
  {
    id: 'formatting-toolbar',
    kind: 'note',
    group: 'actions',
    label: 'Formatting toolbar',
    description: 'Show/hide classic formatting strip',
    iconKey: 'format',
    keywords: ['toolbar', 'format', 'formatting', 'classic', 'bar', 'aa'],
    getLabel: (flags) => (flags?.isFormattingOpen ? 'Hide formatting toolbar' : 'Show formatting toolbar'),
  },
  {
    id: 'stopwatch',
    kind: 'note',
    group: 'actions',
    label: 'Reading stopwatch',
    description: 'Track reading session time',
    iconKey: 'timer',
    keywords: ['stopwatch', 'timer', 'reading', 'time', 'focus'],
  },
  {
    id: 'edit-reading-time',
    kind: 'note',
    group: 'actions',
    label: 'Edit reading stats',
    description: 'Adjust logged reading time',
    iconKey: 'clock',
    keywords: ['reading time', 'stats', 'duration', 'edit time'],
  },
  {
    id: 'ai-chat',
    kind: 'note',
    group: 'actions',
    label: 'Ask AI / Summarize',
    description: 'Chat with AI about this note',
    iconKey: 'sparkles',
    keywords: ['ai', 'summarize', 'ollama', 'chat', 'summary', 'ask'],
  },
  {
    id: 'ai-suggest',
    kind: 'note',
    group: 'actions',
    label: 'AI Suggest connections',
    description: 'Find semantically related notes',
    iconKey: 'sparkles',
    keywords: ['suggest', 'ai suggest', 'related', 'connections'],
  },
  {
    id: 'extract-selection',
    kind: 'note',
    group: 'actions',
    label: 'Extract selection to note',
    description: 'Split selected text into linked note',
    iconKey: 'extract',
    keywords: ['extract', 'split', 'selection', 'new note'],
  },
  {
    id: 'preview',
    kind: 'note',
    group: 'actions',
    label: 'Markdown preview',
    description: 'Toggle rendered preview mode',
    iconKey: 'eye',
    keywords: ['preview', 'markdown', 'read', 'view'],
    getLabel: (flags) => (flags?.isPreviewMode ? 'Switch to editor' : 'Markdown preview'),
  },
  {
    id: 'history',
    kind: 'note',
    group: 'actions',
    label: 'Version history',
    description: 'Inspect or restore snapshots',
    iconKey: 'history',
    keywords: ['history', 'versions', 'snapshots', 'restore', 'undo'],
  },
  {
    id: 'encrypt',
    kind: 'note',
    group: 'actions',
    label: 'Encrypt note (AES-256)',
    description: 'Password-protect note contents',
    iconKey: 'lock',
    keywords: ['encrypt', 'lock', 'password', 'security', 'private', 'aes'],
    getLabel: (flags) => (flags?.isEncrypted ? 'Encryption settings' : 'Encrypt note (AES-256)'),
  },
  {
    id: 'pin',
    kind: 'note',
    group: 'actions',
    label: 'Pin note',
    description: 'Keep pinned to top / sidebar',
    iconKey: 'pin',
    keywords: ['pin', 'unpin', 'star', 'favorite'],
    getLabel: (flags) => (flags?.isPinned ? 'Unpin note' : 'Pin note'),
  },
  {
    id: 'share',
    kind: 'note',
    group: 'actions',
    label: 'Share note',
    description: 'Short link & share sheet',
    iconKey: 'share',
    keywords: ['share', 'link', 'public', 'export'],
  },
  {
    id: 'copy-url',
    kind: 'note',
    group: 'actions',
    label: 'Copy note URL',
    description: 'Copy direct workspace URL',
    iconKey: 'copy',
    keywords: ['copy url', 'url', 'link', 'permalink'],
  },
  {
    id: 'copy-content',
    kind: 'note',
    group: 'actions',
    label: 'Copy title & content',
    description: 'Copy formatted text to clipboard',
    iconKey: 'copy',
    keywords: ['copy', 'clipboard', 'text'],
  },
  {
    id: 'duplicate',
    kind: 'note',
    group: 'actions',
    label: 'Duplicate note',
    description: 'Clone a copy of this note',
    iconKey: 'duplicate',
    keywords: ['duplicate', 'clone', 'copy note'],
  },
  {
    id: 'print',
    kind: 'note',
    group: 'actions',
    label: 'Print / Export PDF',
    description: 'Print formatted note',
    iconKey: 'print',
    keywords: ['print', 'pdf', 'export'],
  },
  {
    id: 'archive',
    kind: 'note',
    group: 'actions',
    label: 'Archive note',
    description: 'Move out of active inbox',
    iconKey: 'archive',
    keywords: ['archive', 'unarchive', 'hide'],
    getLabel: (flags) => (flags?.isArchived ? 'Unarchive note' : 'Archive note'),
  },
  {
    id: 'trash',
    kind: 'note',
    group: 'actions',
    label: 'Move to Trash',
    description: 'Delete this note',
    iconKey: 'trash',
    keywords: ['trash', 'delete', 'remove'],
  },
  {
    id: 'close',
    kind: 'note',
    group: 'actions',
    label: 'Close & Save',
    description: 'Save changes and close page',
    iconKey: 'close',
    keywords: ['close', 'save', 'done', 'exit'],
  },
  // Inline quick formatting shortcuts when searching by /bold, /italic, /underline
  {
    id: 'bold',
    kind: 'block',
    group: 'basic',
    label: 'Bold',
    shortcut: 'Ctrl+B',
    iconKey: 'bold',
    keywords: ['bold', 'strong', 'format'],
  },
  {
    id: 'italic',
    kind: 'block',
    group: 'basic',
    label: 'Italic',
    shortcut: 'Ctrl+I',
    iconKey: 'italic',
    keywords: ['italic', 'em', 'format'],
  },
  {
    id: 'underline',
    kind: 'block',
    group: 'basic',
    label: 'Underline',
    shortcut: 'Ctrl+U',
    iconKey: 'underline',
    keywords: ['underline', 'format'],
  },
  {
    id: 'inline-code',
    kind: 'block',
    group: 'basic',
    label: 'Inline code',
    shortcut: '`code`',
    iconKey: 'code',
    keywords: ['inline code', 'mono', 'code'],
  },
  {
    id: 'clear-format',
    kind: 'block',
    group: 'basic',
    label: 'Clear formatting',
    iconKey: 'clear',
    keywords: ['clear', 'reset', 'strip', 'unformat'],
  },
];

export function filterSlashCommands(
  rawQuery: string,
  supportedNoteActions?: Set<SlashNoteActionId>,
  flags?: SlashContextFlags
): SlashCommandItem[] {
  const q = rawQuery.trim().toLowerCase();

  const available = SLASH_COMMANDS.filter((item) => {
    if (item.kind === 'note' && supportedNoteActions && !supportedNoteActions.has(item.id as SlashNoteActionId)) {
      return false;
    }
    return true;
  });

  if (!q) {
    // When idle (/ just typed), keep inline character marks tucked away from primary scroll list unless searched
    return available.filter(
      (item) =>
        item.id !== 'bold' &&
        item.id !== 'italic' &&
        item.id !== 'underline' &&
        item.id !== 'inline-code' &&
        item.id !== 'clear-format'
    );
  }

  const scored = available
    .map((item) => {
      const displayLabel = (item.getLabel ? item.getLabel(flags) : item.label).toLowerCase();
      const idLower = item.id.toLowerCase();
      const shortcutLower = (item.shortcut || '').toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      const keywords = item.keywords;

      let score = -1;
      if (displayLabel === q || idLower === q || shortcutLower === q) score = 100;
      else if (displayLabel.startsWith(q)) score = 90;
      else if (keywords.some((kw) => kw.startsWith(q))) score = 80;
      else if (displayLabel.split(/\s+/).some((w) => w.startsWith(q))) score = 70;
      else if (shortcutLower.includes(q)) score = 65;
      else if (displayLabel.includes(q)) score = 60;
      else if (keywords.some((kw) => kw.includes(q))) score = 50;
      else if (descLower.includes(q)) score = 35;

      return { item, score };
    })
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.item);
}

const CLASSIC_TOOLBARS_KEY = 'keep_classic_toolbars';
const classicToolbarListeners = new Set<() => void>();

export function subscribeClassicToolbars(listener: () => void): () => void {
  classicToolbarListeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      classicToolbarListeners.delete(listener);
    };
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === CLASSIC_TOOLBARS_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    classicToolbarListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getClassicToolbarsSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CLASSIC_TOOLBARS_KEY) === 'true';
}

export function getClassicToolbarsServerSnapshot(): boolean {
  return false;
}

export function toggleClassicToolbarsPreference(): boolean {
  if (typeof window === 'undefined') return false;
  const next = !getClassicToolbarsSnapshot();
  localStorage.setItem(CLASSIC_TOOLBARS_KEY, String(next));
  classicToolbarListeners.forEach((listener) => listener());
  return next;
}

