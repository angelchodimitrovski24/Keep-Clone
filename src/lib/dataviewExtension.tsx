'use client';

import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { DataviewView } from '@/components/DataviewView';

const DataviewNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, deleteNode }) => {
  const query = (node.attrs.query as string) || 'NOTION\nWHERE !isArchived\nSORT updatedAt DESC';

  return (
    <NodeViewWrapper className="notion-dataview-tiptap-node my-3" contentEditable={false}>
      <DataviewView
        query={query}
        onUpdateQuery={(newQuery) => updateAttributes({ query: newQuery })}
        isEditable={true}
      />
    </NodeViewWrapper>
  );
};

export const DataviewExtension = Node.create({
  name: 'dataview',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      query: {
        default: 'NOTION\nWHERE !isArchived\nSORT updatedAt DESC',
        parseHTML: (el) => {
          const attrQuery = el.getAttribute('data-dataview-query');
          if (attrQuery) return attrQuery;
          const codeEl = el.querySelector('code');
          if (codeEl) return codeEl.textContent?.trim() || '';
          return el.textContent?.trim() || '';
        },
        renderHTML: (attrs) => ({
          'data-dataview-query': attrs.query,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-dataview-block]',
        priority: 70,
      },
      {
        tag: 'div[data-dataview-query]',
        priority: 70,
      },
      {
        tag: 'pre',
        priority: 65,
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const el = node as HTMLElement;
          const codeEl = el.querySelector('code');
          const className = (codeEl?.getAttribute('class') || el.getAttribute('class') || '').toLowerCase();
          const text = (codeEl?.textContent || el.textContent || '').trim();

          if (className.includes('language-dataview') || className.includes('dataview')) {
            return { query: text };
          }

          // If text clearly starts with a Dataview keyword block
          if (/^(?:TABLE|LIST|TASK|NOTION|GALLERY|CARDS)\s*(?:\r?\n|FROM|WHERE|SORT|$)/i.test(text)) {
            return { query: text };
          }

          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const query = HTMLAttributes['data-dataview-query'] || 'NOTION';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-dataview-block': 'true',
        'data-dataview-query': query,
        class: 'notion-dataview-block',
      }),
      [
        'pre',
        { class: 'hidden-dataview-raw', style: 'display:none' },
        ['code', { class: 'language-dataview' }, query],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DataviewNodeView);
  },
});
