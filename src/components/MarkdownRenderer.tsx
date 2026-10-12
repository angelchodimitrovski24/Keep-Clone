'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { toggleHtmlCheckbox } from '@/lib/formatUtils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onToggleCheckbox?: (lineIndex: number, newChecked: boolean) => void;
  onToggleHtmlCheckbox?: (newHtml: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  onToggleCheckbox,
  onToggleHtmlCheckbox,
}) => {
  if (!content) return null;

  // If content is HTML (from Tiptap editor)
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    return (
      <div
        className={`keep-rendered ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
        onClick={(e) => {
          // Allow clicking checkboxes in rendered HTML directly from note cards
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
            e.stopPropagation();
            const container = e.currentTarget;
            const allCheckboxes = Array.from(
              container.querySelectorAll('li[data-type="taskItem"] input[type="checkbox"]')
            );
            const index = allCheckboxes.indexOf(target as HTMLInputElement);
            if (index !== -1 && onToggleHtmlCheckbox) {
              const updated = toggleHtmlCheckbox(content, index);
              onToggleHtmlCheckbox(updated);
            }
          }
        }}
      />
    );
  }

  // Otherwise render Markdown fallback
  let checkboxCount = 0;

  return (
    <div className={`keep-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            />
          ),
          li: ({ node, children, className: liClassName, ...props }) => {
            const isTaskList = liClassName?.includes('task-list-item');
            return (
              <li
                {...props}
                className={`${liClassName || ''} ${
                  isTaskList ? 'list-none flex items-start gap-2.5 my-1' : ''
                }`}
              >
                {children}
              </li>
            );
          },
          input: ({ node, ...props }) => {
            if (props.type === 'checkbox') {
              const currentIdx = checkboxCount++;
              const isChecked = !!props.checked;

              return (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleCheckbox?.(currentIdx, !isChecked);
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600 shrink-0"
                />
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
