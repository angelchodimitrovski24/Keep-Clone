export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface NoteDrawing {
  id: string;
  dataUrl: string; // base64 canvas image data
  createdAt: number;
}

export type NoteColor =
  | 'default'
  | 'coral'
  | 'peach'
  | 'sand'
  | 'mint'
  | 'sage'
  | 'fog'
  | 'storm'
  | 'dusk'
  | 'blossom'
  | 'clay'
  | 'chalk';

export type NoteBackgroundTheme =
  | 'none'
  | 'groceries'
  | 'food'
  | 'music'
  | 'recipes'
  | 'notes'
  | 'places'
  | 'travel'
  | 'celebration';

export interface Note {
  id: string;
  title: string;
  content: string; // Plain text or markdown
  isList: boolean;
  todos: TodoItem[];
  color: NoteColor;
  theme: NoteBackgroundTheme;
  labels: string[]; // List of label names
  isPinned: boolean;
  isArchived: boolean;
  isTrash: boolean;
  trashedAt?: number | null; // For 7-day auto-purge reference
  reminder?: string | null; // ISO string date-time
  images: string[]; // Base64 data URLs
  drawings?: NoteDrawing[];
  audioRecordings?: { id: string; url: string; duration: number; createdAt: number }[];
  collaborators?: string[]; // email/names for local simulated or user collaboration
  createdAt: number;
  updatedAt: number;
  order: number;
}

export interface Label {
  id: string;
  name: string;
  createdAt: number;
}

export type ViewFilter =
  | 'notes'
  | 'reminders'
  | 'label'
  | 'archive'
  | 'trash'
  | 'search';

export type LayoutViewMode = 'grid' | 'list';
