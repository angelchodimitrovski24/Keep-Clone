'use client';

import React from 'react';
import {
  convertMarkdownToHtml,
  renderMarkdownImagesInString,
  toggleCheckboxInAnyContent,
} from '@/lib/formatUtils';
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

  // Fully convert and render any markdown, tables, media images, and wiki links
  const convertedHtml = convertMarkdownToHtml(content);
  const withImages = renderMarkdownImagesInString(convertedHtml);
  const withTables = renderMarkdownTablesInHtml(withImages);
  const renderedHtml = formatWikiLinksInHtml(withTables);

  return (
    <div
      className={`keep-rendered ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
      onClick={(e) => {
        // Handle note link clicks ([[Wiki Links]])
        const linkTarget = (e.target as HTMLElement).closest('[data-note-link-title]') as HTMLElement | null;
        if (linkTarget && onOpenLinkedNote) {
          e.stopPropagation();
          const title = linkTarget.getAttribute('data-note-link-title');
          if (title) onOpenLinkedNote(title);
          return;
        }

        // Allow clicking checkboxes directly from rendered note cards & preview
        const target = e.target as HTMLElement;
        if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
          e.stopPropagation();
          const container = e.currentTarget;
          const allCheckboxes = Array.from(
            container.querySelectorAll('li[data-type="taskItem"] input[type="checkbox"], input[type="checkbox"]')
          );
          const index = allCheckboxes.indexOf(target as HTMLInputElement);
          if (index !== -1) {
            const isChecked = (target as HTMLInputElement).checked;
            if (onToggleHtmlCheckbox) {
              const updated = toggleCheckboxInAnyContent(content, index, isChecked);
              onToggleHtmlCheckbox(updated);
            } else if (onToggleCheckbox) {
              const updated = toggleCheckboxInAnyContent(content, index, isChecked);
              onToggleCheckbox(index, isChecked);
            }
          }
        }
      }}
    />
  );
};
