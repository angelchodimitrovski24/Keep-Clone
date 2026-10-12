'use client';

import React, { useRef, useEffect } from 'react';

interface KeepInlineEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
}

export const KeepInlineEditor: React.FC<KeepInlineEditorProps> = ({
  content,
  onChange,
  onKeyDown,
  placeholder = 'Take a note…',
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  // Sync content into editable div without destroying cursor position during local edits
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerText !== content) {
        editorRef.current.innerText = content;
      }
    }
    isInternalUpdate.current = false;
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      const text = editorRef.current.innerText;
      // Handle trailing newline differences in contentEditable
      onChange(text.replace(/\r\n/g, '\n'));
    }
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={onKeyDown}
      data-placeholder={placeholder}
      className={`outline-none min-h-[200px] w-full text-sm leading-relaxed whitespace-pre-wrap select-text empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 empty:before:pointer-events-none ${className}`}
    />
  );
};
