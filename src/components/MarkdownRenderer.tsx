'use client';

import React, { useMemo, useState } from 'react';
import {
  convertMarkdownToHtml,
  renderMarkdownImagesInString,
  toggleCheckboxInAnyContent,
  isDataviewCode,
} from '@/lib/formatUtils';
import { formatWikiLinksInHtml } from '@/lib/noteLinks';
import { renderMarkdownTablesInHtml } from '@/lib/tableUtils';
import {
  extractImageItemsFromHtml,
  findBalancedDivEndIndex,
  GalleryImageItem,
  groupConsecutiveImagesInHtml,
} from '@/lib/imageGalleryUtils';
import { DataviewView } from './DataviewView';
import { ImageGalleryGrid } from './ImageGalleryGrid';
import { ImageGalleryLightbox } from './ImageGalleryLightbox';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'card' | 'full';
  onToggleCheckbox?: (lineIndex: number, newChecked: boolean) => void;
  onToggleHtmlCheckbox?: (newHtml: string) => void;
  onOpenLinkedNote?: (noteTitleOrId: string, fallbackTitle?: string) => void;
}

type RenderSegment =
  | { type: 'html'; content: string }
  | { type: 'dataview'; content: string }
  | { type: 'gallery'; images: GalleryImageItem[] };

function splitHtmlByGalleries(html: string): RenderSegment[] {
  if (!html.includes('data-keep-gallery')) {
    return [{ type: 'html', content: html }];
  }

  const out: RenderSegment[] = [];
  const startRe = /<div\b[^>]*data-keep-gallery=["']true["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  let cursor = 0;

  while ((match = startRe.exec(html)) !== null) {
    const startIdx = match.index;
    if (startIdx < cursor) continue;
    const endIdx = findBalancedDivEndIndex(html, startIdx);
    if (endIdx === -1) continue;

    if (startIdx > cursor) {
      out.push({ type: 'html', content: html.slice(cursor, startIdx) });
    }

    const galleryHtml = html.slice(startIdx, endIdx);
    const images = extractImageItemsFromHtml(galleryHtml);
    if (images.length >= 2) {
      out.push({ type: 'gallery', images });
    } else if (images.length === 1) {
      out.push({ type: 'gallery', images });
    } else {
      out.push({ type: 'html', content: galleryHtml });
    }

    cursor = endIdx;
    startRe.lastIndex = endIdx;
  }

  if (cursor < html.length) {
    out.push({ type: 'html', content: html.slice(cursor) });
  }

  return out;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(
  ({
    content,
    className = '',
    variant = 'full',
    onToggleCheckbox,
    onToggleHtmlCheckbox,
    onOpenLinkedNote,
  }) => {
    const [singleLightboxItem, setSingleLightboxItem] = useState<GalleryImageItem | null>(null);

    // Memoize the heavy HTML conversion pipeline based on content
    const renderedHtml = useMemo(() => {
      if (!content) return '';
      const convertedHtml = convertMarkdownToHtml(content);
      const withImages = renderMarkdownImagesInString(convertedHtml);
      const withTables = renderMarkdownTablesInHtml(withImages);
      const withLinks = formatWikiLinksInHtml(withTables);
      return groupConsecutiveImagesInHtml(withLinks);
    }, [content]);

    const segments = useMemo(() => {
      if (!renderedHtml) return null;

      const hasDataviewIndicators =
        renderedHtml.includes('data-dataview-') ||
        renderedHtml.includes('language-dataview') ||
        renderedHtml.includes('TABLE') ||
        renderedHtml.includes('LIST') ||
        renderedHtml.includes('TASK') ||
        renderedHtml.includes('NOTION') ||
        renderedHtml.includes('GALLERY') ||
        renderedHtml.includes('CARDS') ||
        renderedHtml.includes('PAGES');

      const hasGalleries = renderedHtml.includes('data-keep-gallery');

      if (!hasDataviewIndicators && !hasGalleries) {
        return null;
      }

      const baseSegs: RenderSegment[] = [];

      if (hasDataviewIndicators) {
        const blockRegex =
          /(?:<div\b[^>]*data-dataview-(?:block|query)[^>]*>[\s\S]*?<\/div>|<pre\b[^>]*>[\s\S]*?<\/pre>)/gi;
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
              baseSegs.push({ type: 'html', content: renderedHtml.substring(lastIndex, start) });
            }
            const qMatch = fullMatch.match(/data-dataview-query=["']([^"']+)["']/i);
            let query = qMatch ? qMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
            if (!query) {
              const codeMatch = fullMatch.match(/<code\b[^>]*>([\s\S]*?)<\/code>/i);
              query = codeMatch ? codeMatch[1] : '';
            }
            baseSegs.push({ type: 'dataview', content: query.trim() });
            lastIndex = blockRegex.lastIndex;
            continue;
          }

          // 2. <pre> block with Dataview code or language-dataview
          if (fullMatch.startsWith('<pre')) {
            const codeMatch = fullMatch.match(/<code\b([^>]*)>([\s\S]*?)<\/code>/i);
            const codeAttrs = codeMatch ? codeMatch[1] : '';
            const codeInner = (
              codeMatch ? codeMatch[2] : fullMatch.replace(/<\/?pre\b[^>]*>/gi, '')
            )
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .trim();

            const isDv = codeAttrs.includes('language-dataview') || isDataviewCode(codeInner);
            if (isDv) {
              hasAnyDataview = true;
              if (start > lastIndex) {
                baseSegs.push({ type: 'html', content: renderedHtml.substring(lastIndex, start) });
              }
              baseSegs.push({ type: 'dataview', content: codeInner });
              lastIndex = blockRegex.lastIndex;
              continue;
            }
          }
        }

        if (hasAnyDataview) {
          if (lastIndex < renderedHtml.length) {
            baseSegs.push({
              type: 'html',
              content: renderedHtml.substring(lastIndex),
            });
          }
        } else {
          baseSegs.push({ type: 'html', content: renderedHtml });
        }
      } else {
        baseSegs.push({ type: 'html', content: renderedHtml });
      }

      if (!hasGalleries) {
        return baseSegs.some((s) => s.type === 'dataview') ? baseSegs : null;
      }

      const finalSegs: RenderSegment[] = [];
      for (const seg of baseSegs) {
        if (seg.type === 'html') {
          finalSegs.push(...splitHtmlByGalleries(seg.content));
        } else {
          finalSegs.push(seg);
        }
      }

      return finalSegs;
    }, [renderedHtml]);

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Handle note link clicks ([[Wiki Links]] & live noteMention chips)
      const linkTarget = (e.target as HTMLElement).closest(
        '[data-note-id], [data-note-link-id], [data-note-link-title], [data-note-title]'
      ) as HTMLElement | null;
      if (linkTarget && onOpenLinkedNote) {
        e.stopPropagation();
        const explicitId =
          linkTarget.getAttribute('data-note-id') ||
          linkTarget.getAttribute('data-note-link-id') ||
          '';
        const explicitTitle =
          linkTarget.getAttribute('data-note-link-title') ||
          linkTarget.getAttribute('data-note-title') ||
          '';
        const idOrTitle = explicitId || explicitTitle;
        if (idOrTitle) onOpenLinkedNote(idOrTitle, explicitTitle || undefined);
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
            toggleCheckboxInAnyContent(content, index, isChecked);
            onToggleCheckbox(index, isChecked);
          }
        }
        return;
      }

      // Open single standalone image in lightbox when viewing full note preview / shared note
      if (
        variant !== 'card' &&
        target &&
        target.tagName === 'IMG' &&
        !target.closest('[data-keep-gallery-ui="true"]')
      ) {
        const imgEl = target as HTMLImageElement;
        const src = imgEl.getAttribute('src') || imgEl.src;
        if (src) {
          e.stopPropagation();
          setSingleLightboxItem({
            src,
            alt: imgEl.getAttribute('alt') || undefined,
            title: imgEl.getAttribute('title') || undefined,
          });
        }
      }
    };

    if (!content || !renderedHtml) return null;

    const renderedModeClass = variant === 'card' ? 'keep-rendered keep-card-rendered' : 'keep-rendered';

    if (!segments) {
      return (
        <>
          <div
            className={`${renderedModeClass} ${className}`}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            onClick={handleContainerClick}
          />
          {singleLightboxItem && (
            <ImageGalleryLightbox
              images={[singleLightboxItem]}
              initialIndex={0}
              isOpen={true}
              onClose={() => setSingleLightboxItem(null)}
            />
          )}
        </>
      );
    }

    return (
      <>
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
            if (seg.type === 'gallery') {
              return (
                <ImageGalleryGrid
                  key={`gallery-${idx}`}
                  images={seg.images}
                  variant={variant}
                  maxVisible={variant === 'card' ? 4 : undefined}
                  interactive={variant !== 'card' || seg.images.length >= 2}
                />
              );
            }
            return (
              <div
                key={`html-${idx}`}
                className={renderedModeClass}
                dangerouslySetInnerHTML={{ __html: seg.content }}
                onClick={handleContainerClick}
              />
            );
          })}
        </div>
        {singleLightboxItem && (
          <ImageGalleryLightbox
            images={[singleLightboxItem]}
            initialIndex={0}
            isOpen={true}
            onClose={() => setSingleLightboxItem(null)}
          />
        )}
      </>
    );
  }
);

MarkdownRenderer.displayName = 'MarkdownRenderer';
