'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface ChecklistItemInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  completed?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * ChecklistItemInput:
 * An auto-resizing, responsive multi-line input for checklist/todo items.
 * Word wraps perfectly on small mobile screens (Android) without horizontal scrolling,
 * and seamlessly expands vertically as text wraps or grows.
 */
export const ChecklistItemInput: React.FC<ChecklistItemInputProps> = ({
  id,
  value,
  onChange,
  onKeyDown,
  placeholder,
  completed = false,
  autoFocus = false,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Adjust on screen resize (e.g. mobile orientation change or virtual keyboard appearance)
  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      id={id}
      rows={1}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      onKeyDown={onKeyDown}
      className={`flex-1 min-w-0 w-full bg-transparent outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed py-0.5 ${
        completed ? 'line-through text-stone-400 dark:text-stone-500' : 'text-stone-800 dark:text-stone-200'
      } placeholder:text-stone-400 dark:placeholder:text-stone-500 ${className}`}
      style={{ fontSize: 'var(--note-font-size, 15px)' }}
    />
  );
};
