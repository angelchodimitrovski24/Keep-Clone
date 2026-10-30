'use client';

import React, { useMemo } from 'react';
import {
  convertMarkdownToHtml,
  renderMarkdownImagesInString,
  toggleCheckboxInAnyContent,
} from '@/lib/formatUtils';
import { formatWikiLinksInHtml } from '@/lib/noteLinks';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';
import { DataviewView } from './DataviewView';

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

  // Check if there are any Dataview blocks
  const hasDataview = renderedHtml.includes('data-dataview-block="true"');

  const segments = useMemo(() => {
    if (!hasDataview) return null;

    const segs: Array<{ type: 'html' | 'dataview'; content: string }> = [];
    const dataviewRegex = /<div\b[^>]*data-dataview-block="true"[^>]*data-dataview-query=["']([^"']+)["'][^>]*>[\s\S]*?<\/div>/gi;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = dataviewRegex.exec(renderedHtml)) !== null) {
      const start = match.index;
      if (start > lastIndex) {
        segs.push({
          type: 'html',
          content: renderedHtml.substring(lastIndex, start),
        });
      }

      const rawQuery = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      segs.push({
        type: 'dataview',
        content: rawQuery,
      });

      lastIndex = dataviewRegex.lastIndex;
    }

    if (lastIndex < renderedHtml.length) {
      segs.push({
        type: 'html',
        content: renderedHtml.substring(lastIndex),
      });
    }

    return segs;
  }, [hasDataview, renderedHtml]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
  };

  if (!segments) {
    return (
      <div
        className={`keep-rendered ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        onClick={handleContainerClick}
      />
    );
  }

  return (
    <div className={`keep-rendered-container space-y-2 ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'dataview') {
          return (
            <DataviewView
              key={`dataview-${idx}`}
              query={seg.content}
              isEditable={false}
            />
          );
        }
        return (
          <div
            key={`html-${idx}`}
            className="keep-rendered"
            dangerouslySetInnerHTML={{ __html: seg.content }}
            onClick={handleContainerClick}
          />
        );
      })}
    </div>
  );
};
