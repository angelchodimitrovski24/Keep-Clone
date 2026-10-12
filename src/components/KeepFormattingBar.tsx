'use client';

import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  CheckSquare,
  RemoveFormatting,
} from 'lucide-react';
import { GoogleKeepFormatCommand } from '@/lib/formatUtils';

interface KeepFormattingBarProps {
  onFormat: (cmd: GoogleKeepFormatCommand) => void;
  className?: string;
}

export const KeepFormattingBar: React.FC<KeepFormattingBarProps> = ({
  onFormat,
  className = '',
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex flex-wrap items-center gap-0.5 sm:gap-1 px-2 py-1.5 bg-stone-100/90 dark:bg-[#2d2e30] rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 shadow-xs animate-in fade-in duration-150 ${className}`}
    >
      {/* Headings */}
      <button
        type="button"
        onClick={() => onFormat('h1')}
        className="px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-xs transition-colors flex items-center justify-center min-w-[28px]"
        title="Heading 1"
      >
        H1
      </button>

      <button
        type="button"
        onClick={() => onFormat('h2')}
        className="px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-xs transition-colors flex items-center justify-center min-w-[28px]"
        title="Heading 2"
      >
        H2
      </button>

      <button
        type="button"
        onClick={() => onFormat('normal')}
        className="px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 font-medium text-xs transition-colors flex items-center justify-center min-w-[28px]"
        title="Normal text"
      >
        Aa
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-stone-300 dark:bg-stone-600 mx-0.5 sm:mx-1" />

      {/* Text Styles */}
      <button
        type="button"
        onClick={() => onFormat('bold')}
        className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        title="Bold"
      >
        <Bold className="w-4 h-4 font-bold" />
      </button>

      <button
        type="button"
        onClick={() => onFormat('italic')}
        className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => onFormat('underline')}
        className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        title="Underline"
      >
        <Underline className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-stone-300 dark:bg-stone-600 mx-0.5 sm:mx-1" />

      {/* Lists & Checkboxes */}
      <button
        type="button"
        onClick={() => onFormat('bullet-list')}
        className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        title="Bullet list (continuous)"
      >
        <List className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => onFormat('number-list')}
        className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        title="Numbered list (continuous)"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => onFormat('checkbox-list')}
        className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-blue-600 dark:text-blue-400"
        title="Checklist items (- [ ])"
      >
        <CheckSquare className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-stone-300 dark:bg-stone-600 mx-0.5 sm:mx-1" />

      {/* Clear Formatting */}
      <button
        type="button"
        onClick={() => onFormat('clear')}
        className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        title="Clear formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </button>
    </div>
  );
};
