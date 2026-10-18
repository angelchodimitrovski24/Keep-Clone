'use client';

import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { FileText, ExternalLink, Copy, Check, Trash2, FolderOpen } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const KeepMediaNodeView: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  const {
    isImage,
    fileName,
    savedPath,
    serveUrl,
    markdownLink,
    fileSize,
  } = node.attrs as {
    isImage: boolean;
    fileName: string;
    savedPath: string;
    serveUrl: string;
    markdownLink: string;
    fileSize: number;
  };

  const [copied, setCopied] = useState(false);

  const displayMarkdown =
    markdownLink ||
    (isImage
      ? `![${fileName || 'image'}](${savedPath || serveUrl})`
      : `[${fileName || 'file'}](${savedPath || serveUrl})`);

  const handleCopyMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(displayMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <NodeViewWrapper
      className="my-2.5 rounded-xl border border-stone-300/80 dark:border-stone-700/80 bg-black/[0.03] dark:bg-white/[0.03] overflow-hidden select-none group/media"
      contentEditable={false}
    >
      {/* Top Bar: Markdown Link Display + Actions */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-black/[0.04] dark:bg-white/[0.04] border-b border-stone-200/70 dark:border-stone-700/60 text-xs font-mono text-stone-600 dark:text-stone-300">
        <span className="truncate select-all" title={displayMarkdown}>
          {displayMarkdown}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-stone-500 hover:text-stone-800 dark:hover:text-stone-100 transition-colors"
            title="Copy Markdown link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            className="p-1 rounded hover:bg-red-500/10 text-stone-400 hover:text-red-500 transition-colors"
            title="Remove from note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Rendered Content: Image or File Card */}
      {isImage ? (
        <div className="p-2 flex flex-col items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={serveUrl}
            alt={fileName || 'Pasted image'}
            className="max-h-80 w-auto rounded-lg object-contain border border-black/5 dark:border-white/5"
            loading="lazy"
          />
          {savedPath && (
            <span className="mt-1 text-[11px] text-stone-400 dark:text-stone-500 flex items-center gap-1 truncate max-w-full">
              <FolderOpen className="w-3 h-3 shrink-0" />
              <span className="truncate">{savedPath}</span>
            </span>
          )}
        </div>
      ) : (
        <a
          href={serveUrl}
          download={fileName || 'attachment'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-between gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                {fileName || 'Attached file'}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {fileSize ? `${formatBytes(fileSize)} • ` : ''}
                {savedPath || 'Local file'}
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-stone-400 shrink-0" />
        </a>
      )}
    </NodeViewWrapper>
  );
};

export const KeepMediaExtension = Node.create({
  name: 'keepMedia',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      isImage: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-is-image') !== 'false',
        renderHTML: (attrs) => ({ 'data-is-image': String(attrs.isImage) }),
      },
      fileName: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-file-name') || '',
        renderHTML: (attrs) => ({ 'data-file-name': attrs.fileName }),
      },
      savedPath: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-saved-path') || '',
        renderHTML: (attrs) => ({ 'data-saved-path': attrs.savedPath }),
      },
      serveUrl: {
        default: '',
        parseHTML: (el) =>
          el.getAttribute('data-serve-url') ||
          el.querySelector('img')?.getAttribute('src') ||
          el.querySelector('a')?.getAttribute('href') ||
          '',
        renderHTML: (attrs) => ({ 'data-serve-url': attrs.serveUrl }),
      },
      markdownLink: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-markdown-link') || '',
        renderHTML: (attrs) => ({ 'data-markdown-link': attrs.markdownLink }),
      },
      fileSize: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-file-size') || 0),
        renderHTML: (attrs) => ({ 'data-file-size': String(attrs.fileSize || 0) }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-keep-media]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const isImage = HTMLAttributes['data-is-image'] !== 'false';
    const fileName = HTMLAttributes['data-file-name'] || 'attachment';
    const savedPath = HTMLAttributes['data-saved-path'] || '';
    const serveUrl = HTMLAttributes['data-serve-url'] || '';
    const markdownLink =
      HTMLAttributes['data-markdown-link'] ||
      (isImage ? `![${fileName}](${savedPath || serveUrl})` : `[${fileName}](${savedPath || serveUrl})`);

    if (isImage) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-keep-media': 'true',
          class: 'keep-media-block',
        }),
        ['div', { class: 'keep-media-md' }, markdownLink],
        [
          'img',
          {
            src: serveUrl,
            alt: fileName,
            class: 'keep-media-img',
          },
        ],
      ];
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-keep-media': 'true',
        class: 'keep-media-block',
      }),
      ['div', { class: 'keep-media-md' }, markdownLink],
      [
        'a',
        {
          href: serveUrl,
          download: fileName || 'attachment',
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'keep-media-file-link',
        },
        `📎 ${fileName}`,
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KeepMediaNodeView);
  },
});
