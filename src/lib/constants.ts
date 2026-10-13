import { NoteColor, NoteBackgroundTheme } from '@/types/note';

export interface ColorOption {
  id: NoteColor;
  name: string;
  lightBg: string;
  darkBg: string;
  lightBorder: string;
  darkBorder: string;
  swatch: string;
}

export const NOTE_COLORS: ColorOption[] = [
  {
    id: 'default',
    name: 'Default',
    lightBg: 'bg-white',
    darkBg: 'dark:bg-[#202124]',
    lightBorder: 'border-stone-200',
    darkBorder: 'dark:border-[#5f6368]',
    swatch: '#ffffff',
  },
  {
    id: 'coral',
    name: 'Coral',
    lightBg: 'bg-[#faafa8]',
    darkBg: 'dark:bg-[#77172e]',
    lightBorder: 'border-[#faafa8]',
    darkBorder: 'dark:border-[#77172e]',
    swatch: '#faafa8',
  },
  {
    id: 'peach',
    name: 'Peach',
    lightBg: 'bg-[#f39f76]',
    darkBg: 'dark:bg-[#692b17]',
    lightBorder: 'border-[#f39f76]',
    darkBorder: 'dark:border-[#692b17]',
    swatch: '#f39f76',
  },
  {
    id: 'sand',
    name: 'Sand',
    lightBg: 'bg-[#fff8b8]',
    darkBg: 'dark:bg-[#7c4a03]',
    lightBorder: 'border-[#fff8b8]',
    darkBorder: 'dark:border-[#7c4a03]',
    swatch: '#fff8b8',
  },
  {
    id: 'mint',
    name: 'Mint',
    lightBg: 'bg-[#e2f6d3]',
    darkBg: 'dark:bg-[#264d3b]',
    lightBorder: 'border-[#e2f6d3]',
    darkBorder: 'dark:border-[#264d3b]',
    swatch: '#e2f6d3',
  },
  {
    id: 'sage',
    name: 'Sage',
    lightBg: 'bg-[#b4ddd3]',
    darkBg: 'dark:bg-[#0c625d]',
    lightBorder: 'border-[#b4ddd3]',
    darkBorder: 'dark:border-[#0c625d]',
    swatch: '#b4ddd3',
  },
  {
    id: 'fog',
    name: 'Fog',
    lightBg: 'bg-[#d4e4ed]',
    darkBg: 'dark:bg-[#256377]',
    lightBorder: 'border-[#d4e4ed]',
    darkBorder: 'dark:border-[#256377]',
    swatch: '#d4e4ed',
  },
  {
    id: 'storm',
    name: 'Storm',
    lightBg: 'bg-[#aeccdc]',
    darkBg: 'dark:bg-[#284255]',
    lightBorder: 'border-[#aeccdc]',
    darkBorder: 'dark:border-[#284255]',
    swatch: '#aeccdc',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    lightBg: 'bg-[#d3bfdb]',
    darkBg: 'dark:bg-[#472e5b]',
    lightBorder: 'border-[#d3bfdb]',
    darkBorder: 'dark:border-[#472e5b]',
    swatch: '#d3bfdb',
  },
  {
    id: 'blossom',
    name: 'Blossom',
    lightBg: 'bg-[#f6e2dd]',
    darkBg: 'dark:bg-[#6c394f]',
    lightBorder: 'border-[#f6e2dd]',
    darkBorder: 'dark:border-[#6c394f]',
    swatch: '#f6e2dd',
  },
  {
    id: 'clay',
    name: 'Clay',
    lightBg: 'bg-[#e9e3d4]',
    darkBg: 'dark:bg-[#4b443a]',
    lightBorder: 'border-[#e9e3d4]',
    darkBorder: 'dark:border-[#4b443a]',
    swatch: '#e9e3d4',
  },
  {
    id: 'chalk',
    name: 'Chalk',
    lightBg: 'bg-[#efeff1]',
    darkBg: 'dark:bg-[#232427]',
    lightBorder: 'border-[#efeff1]',
    darkBorder: 'dark:border-[#232427]',
    swatch: '#efeff1',
  },
];

export interface ThemeOption {
  id: NoteBackgroundTheme;
  name: string;
  icon: string;
  bgGradient: string;
  darkGradient: string;
}

export const NOTE_THEMES: ThemeOption[] = [
  { id: 'none', name: 'Default', icon: '🚫', bgGradient: '', darkGradient: '' },
  { id: 'groceries', name: 'Groceries', icon: '🛒', bgGradient: 'bg-gradient-to-b from-amber-50 to-orange-100/85 border-amber-300/70 text-stone-900', darkGradient: 'dark:from-[#2e2316] dark:to-[#382312] dark:border-amber-900/60 dark:text-stone-100' },
  { id: 'food', name: 'Food', icon: '🍔', bgGradient: 'bg-gradient-to-b from-rose-50 to-amber-100/85 border-rose-300/70 text-stone-900', darkGradient: 'dark:from-[#33171e] dark:to-[#3b2014] dark:border-rose-900/60 dark:text-stone-100' },
  { id: 'music', name: 'Music', icon: '🎧', bgGradient: 'bg-gradient-to-b from-indigo-50 to-purple-100/85 border-indigo-300/70 text-stone-900', darkGradient: 'dark:from-[#1e1c38] dark:to-[#2e1d3d] dark:border-indigo-900/60 dark:text-stone-100' },
  { id: 'recipes', name: 'Recipes', icon: '🍳', bgGradient: 'bg-gradient-to-b from-yellow-50 to-lime-100/85 border-yellow-300/70 text-stone-900', darkGradient: 'dark:from-[#2a2916] dark:to-[#223315] dark:border-yellow-900/60 dark:text-stone-100' },
  { id: 'notes', name: 'Notes', icon: '📝', bgGradient: 'bg-gradient-to-b from-sky-50 to-blue-100/85 border-sky-300/70 text-stone-900', darkGradient: 'dark:from-[#162536] dark:to-[#172238] dark:border-sky-900/60 dark:text-stone-100' },
  { id: 'places', name: 'Places', icon: '📍', bgGradient: 'bg-gradient-to-b from-teal-50 to-emerald-100/85 border-teal-300/70 text-stone-900', darkGradient: 'dark:from-[#142d2a] dark:to-[#132d20] dark:border-teal-900/60 dark:text-stone-100' },
  { id: 'travel', name: 'Travel', icon: '✈️', bgGradient: 'bg-gradient-to-b from-cyan-50 to-blue-100/85 border-cyan-300/70 text-stone-900', darkGradient: 'dark:from-[#122a36] dark:to-[#16223b] dark:border-cyan-900/60 dark:text-stone-100' },
  { id: 'celebration', name: 'Celebration', icon: '🎉', bgGradient: 'bg-gradient-to-b from-fuchsia-50 to-pink-100/85 border-pink-300/70 text-stone-900', darkGradient: 'dark:from-[#361533] dark:to-[#381628] dark:border-pink-900/60 dark:text-stone-100' },
];

export function getNoteColorClasses(colorId: NoteColor = 'default', themeId: NoteBackgroundTheme = 'none'): string {
  const color = NOTE_COLORS.find((c) => c.id === colorId) || NOTE_COLORS[0];
  const theme = NOTE_THEMES.find((t) => t.id === themeId);

  if (theme && theme.id !== 'none') {
    return `${theme.bgGradient} ${theme.darkGradient}`;
  }

  return `${color.lightBg} ${color.darkBg} ${color.lightBorder} ${color.darkBorder}`;
}
