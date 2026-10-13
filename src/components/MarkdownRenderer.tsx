'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { toggleHtmlCheckbox, resolveLocalMediaUrl, renderMarkdownImagesInString } from '@/lib/formatUtils';
import { formatWikiLinksInHtml } from '@/lib/noteLinks';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onToggleCheckbox?: (lineIndex: number, newChecked: boolean) => void;
  onToggleHtmlCheckbox?: (newHtml: string) => void;
  onOpenLinkedNote?: (noteTitleOrId: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  onToggleCheckbox,
  onToggleHtmlCheckbox,
  onOpenLinkedNote,
}) => {
  if (!content) return null;

  // If content is HTML (from Tiptap editor)
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    let html = renderMarkdownImagesInString(content);
    html = renderMarkdownTablesInHtml(html);
    const renderedHtml = formatWikiLinksInHtml(html);
    return (
      <div
        className={`keep-rendered ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        onClick={(e) => {
          // Handle note link clicks
          const linkTarget = (e.target as HTMLElement).closest('[data-note-link-title]') as HTMLElement | null;
          if (linkTarget && onOpenLinkedNote) {
            e.stopPropagation();
            const title = linkTarget.getAttribute('data-note-link-title');
            if (title) onOpenLinkedNote(title);
            return;
          }

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
  const processedContent = formatWikiLinksInHtml(
    renderMarkdownTablesInHtml(renderMarkdownImagesInString(content))
  );

  return (
    <div
      className={`keep-markdown ${className}`}
      onClick={(e) => {
        const linkTarget = (e.target as HTMLElement).closest('[data-note-link-title]') as HTMLElement | null;
        if (linkTarget && onOpenLinkedNote) {
          e.stopPropagation();
          const title = linkTarget.getAttribute('data-note-link-title');
          if (title) onOpenLinkedNote(title);
        }
      }}
    >
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
          img: ({ node, src, alt, ...props }) => {
            const rawSrc = typeof src === 'string' ? src : '';
            const resolvedSrc = resolveLocalMediaUrl(rawSrc);
            return (
              <span className="block my-2">
                <span className="block text-xs font-mono text-stone-400 select-all my-0.5 truncate max-w-full">
                  ![{alt || 'image'}]({rawSrc})
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  {...props}
                  src={resolvedSrc}
                  alt={alt || 'Image'}
                  className="rounded-xl max-h-80 w-auto my-1 border border-black/10 dark:border-white/10"
                  loading="lazy"
                />
              </span>
            );
          },
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
          code: ({ node, className, children, ...props }) => {
            const isInline = !className && !String(children).includes('\n');
            if (isInline) {
              return (
                <code
                  {...props}
                  className="font-mono text-[0.85em] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-rose-600 dark:text-rose-400 border border-black/5 dark:border-white/5"
                >
                  {children}
                </code>
              );
            }
            return (
              <code {...props} className={className}>
                {children}
              </code>
            );
          },
          pre: ({ node, children, ...props }) => {
            return (
              <pre
                {...props}
                className="font-mono text-xs p-3.5 my-2.5 rounded-xl bg-stone-900 text-stone-100 dark:bg-stone-950 dark:text-stone-200 overflow-x-auto border border-black/10 dark:border-white/10 leading-relaxed"
              >
                {children}
              </pre>
            );
          },
          blockquote: ({ node, children, ...props }) => (
            <blockquote
              {...props}
              className="border-l-3 border-amber-500 pl-3 my-2 text-stone-600 dark:text-stone-400 italic"
            >
              {children}
            </blockquote>
          ),
          hr: ({ node, ...props }) => (
            <hr {...props} className="my-3 border-stone-200 dark:border-stone-700" />
          ),
          table: ({ node, children, ...props }) => (
            <div className="keep-table-wrapper my-3 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700/80 shadow-xs bg-white/80 dark:bg-stone-900/60 backdrop-blur-xs">
              <table {...props} className="keep-table w-full text-left border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ node, children, ...props }) => (
            <thead {...props} className="bg-stone-100/90 dark:bg-stone-800/90 text-stone-750 dark:text-stone-200 font-semibold border-b border-stone-200 dark:border-stone-700">
              {children}
            </thead>
          ),
          tbody: ({ node, children, ...props }) => (
            <tbody {...props} className="divide-y divide-stone-200/60 dark:divide-stone-800/80">
              {children}
            </tbody>
          ),
          tr: ({ node, children, ...props }) => (
            <tr {...props} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors even:bg-black/[0.015] dark:even:bg-white/[0.015]">
              {children}
            </tr>
          ),
          th: ({ node, children, ...props }) => (
            <th {...props} className="px-3.5 py-2.5 font-semibold border-r border-stone-200/50 dark:border-stone-800 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ node, children, ...props }) => (
            <td {...props} className="px-3.5 py-2 border-r border-stone-200/40 dark:border-stone-800/60 last:border-r-0">
              {children}
            </td>
          ),
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
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
