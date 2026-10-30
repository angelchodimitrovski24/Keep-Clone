'use client';

import React, { useMemo } from 'react';
import {
  convertMarkdownToHtml,
  renderMarkdownImagesInString,
  toggleCheckboxInAnyContent,
  isDataviewCode,
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

  const segments = useMemo(() => {
    const blockRegex = /(?:<div\b[^>]*data-dataview-(?:block|query)[^>]*>[\s\S]*?<\/div>|<pre\b[^>]*>[\s\S]*?<\/pre>)/gi;
    const segs: Array<{ type: 'html' | 'dataview'; content: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let hasAnyDataview = false;

    while ((match = blockRegex.exec(renderedHtml)) !== null) {
      const fullMatch = match[0];
      const start = match.index;

      // 1. Explicit data-dataview-block / data-dataview-query
      if (fullMatch.includes('data-dataview-')) {
        hasAnyDataview = true;
        if (start > lastIndex) {
          segs.push({ type: 'html', content: renderedHtml.substring(lastIndex, start) });
        }
        const qMatch = fullMatch.match(/data-dataview-query=["']([^"']+)["']/i);
        let query = qMatch ? qMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
        if (!query) {
          const codeMatch = fullMatch.match(/<code\b[^>]*>([\s\S]*?)<\/code>/i);
          query = codeMatch ? codeMatch[1] : '';
        }
        segs.push({ type: 'dataview', content: query.trim() });
        lastIndex = blockRegex.lastIndex;
        continue;
      }

      // 2. <pre> block with Dataview code or language-dataview
      if (fullMatch.startsWith('<pre')) {
        const codeMatch = fullMatch.match(/<code\b([^>]*)>([\s\S]*?)<\/code>/i);
        const codeAttrs = codeMatch ? codeMatch[1] : '';
        const codeInner = (codeMatch ? codeMatch[2] : fullMatch.replace(/<\/?pre\b[^>]*>/gi, ''))
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();

        const isDv = codeAttrs.includes('language-dataview') || isDataviewCode(codeInner);
        if (isDv) {
          hasAnyDataview = true;
          if (start > lastIndex) {
            segs.push({ type: 'html', content: renderedHtml.substring(lastIndex, start) });
          }
          segs.push({ type: 'dataview', content: codeInner });
          lastIndex = blockRegex.lastIndex;
          continue;
        }
      }
    }

    if (!hasAnyDataview) return null;

    if (lastIndex < renderedHtml.length) {
      segs.push({
        type: 'html',
        content: renderedHtml.substring(lastIndex),
      });
    }

    return segs;
  }, [renderedHtml]);

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
