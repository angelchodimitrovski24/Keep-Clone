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

export interface EncryptedNoteBundle {
  ciphertext: string; // Base64 AES-GCM ciphertext
  iv: string;         // Base64 12-byte IV
  salt: string;       // Base64 16-byte PBKDF2 salt
  hint?: string;      // Password hint
  timestamp: number;
}

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
  isEncrypted?: boolean;
  encryptedData?: EncryptedNoteBundle | null;
  linkedNoteIds?: string[]; // IDs of linked notes
  category?: string | null; // Note category name
  createdAt: number;
  updatedAt: number;
  order: number;
}

export interface Label {
  id: string;
  name: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color?: string; // Accent color hex
  icon?: string;  // Category emoji / icon
  createdAt: number;
}

export type ViewFilter =
  | 'notes'
  | 'reminders'
  | 'label'
  | 'category'
  | 'archive'
  | 'trash'
  | 'search';

export type LayoutViewMode = 'grid' | 'list';

export type FontSizeOption = 'small' | 'medium' | 'large' | 'xlarge';
export type AppThemeMode = 'system' | 'light' | 'dark';
