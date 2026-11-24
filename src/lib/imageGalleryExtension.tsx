'use client';

import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Node as ProseMirrorNode, DOMOutputSpec } from '@tiptap/pm/model';
import { Loader2 } from 'lucide-react';
import { GalleryImageItem } from './imageGalleryUtils';
import { ImageGalleryGrid } from '@/components/ImageGalleryGrid';
import { copyFilesToLocalFolder } from './localPaste';

const ImageGalleryNodeView: React.FC<NodeViewProps> = ({
  node,
  editor,
  getPos,
  updateAttributes,
  deleteNode,
  selected,
}) => {
  const images = (Array.isArray(node.attrs.images) ? node.attrs.images : []) as GalleryImageItem[];
  const [isAdding, setIsAdding] = useState(false);

  const handleRemoveImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    if (next.length === 0) {
      deleteNode();
      return;
    }

    if (next.length === 1) {
      const pos = typeof getPos === 'function' ? getPos() : undefined;
      const imgType = editor.state.schema.nodes.image;
      if (typeof pos === 'number' && imgType) {
        const single = next[0];
        const singleNode = imgType.create({
          src: single.src,
          alt: single.alt || null,
          title: single.title || null,
        });
        const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, singleNode);
        editor.view.dispatch(tr);
        return;
      }
    }

    updateAttributes({ images: next });
  };

  const handleMoveImage = (fromIdx: number, toIdx: number) => {
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= images.length ||
      toIdx >= images.length ||
      fromIdx === toIdx
    ) {
      return;
    }
    const next = [...images];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateAttributes({ images: next });
  };

  const handleAddImages = async (files: File[]) => {
    const imageFiles = files.filter(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name)
    );
    if (imageFiles.length === 0) return;

    try {
      setIsAdding(true);
      const saved = await copyFilesToLocalFolder(imageFiles);
      const added: GalleryImageItem[] = saved
        .filter((f) => f.isImage)
        .map((f) => ({
          src: f.serveUrl,
          alt: f.fileName,
          title: f.savedPath,
        }));
      if (added.length > 0) {
        updateAttributes({ images: [...images, ...added] });
      }
    } catch (err) {
      console.error('Failed adding images to gallery:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUngroup = () => {
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    const imgType = editor.state.schema.nodes.image;
    const paraType = editor.state.schema.nodes.paragraph;
    if (typeof pos !== 'number' || !imgType) return;

    const nodes: ProseMirrorNode[] = [];
    images.forEach((img, i) => {
      nodes.push(
        imgType.create({
          src: img.src,
          alt: img.alt || null,
          title: img.title || null,
          ungrouped: true,
        })
      );
      if (paraType && i < images.length - 1) {
        nodes.push(paraType.create());
      }
    });

    if (nodes.length === 0) return;
    const tr = editor.state.tr
      .replaceWith(pos, pos + node.nodeSize, nodes)
      .setMeta('skipGalleryAutoMerge', true);
    editor.view.dispatch(tr);
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`my-2.5 select-none w-full max-w-full rounded-xl transition-shadow ${
        selected ? 'ring-2 ring-amber-500/70' : ''
      }`}
      contentEditable={false}
    >
      <div className="relative">
        <ImageGalleryGrid
          images={images}
          variant="editor"
          editable={true}
          interactive={true}
          onRemoveImage={handleRemoveImage}
          onMoveImage={handleMoveImage}
          onAddImages={handleAddImages}
          onUngroup={images.length >= 2 ? handleUngroup : undefined}
        />
        {isAdding && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Adding images to gallery…</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ImageGalleryExtension = Node.create({
  name: 'imageGallery',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [] as GalleryImageItem[],
        parseHTML: (el) => {
          const imgs = Array.from(el.querySelectorAll('img'))
            .map((img) => ({
              src: img.getAttribute('src') || '',
              alt: img.getAttribute('alt') || undefined,
              title: img.getAttribute('title') || undefined,
            }))
            .filter((item) => Boolean(item.src));
          return imgs;
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-keep-gallery="true"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const imgs = (Array.isArray(node.attrs.images) ? node.attrs.images : []) as GalleryImageItem[];
    const children: DOMOutputSpec[] = imgs.map((img) => [
      'img',
      {
        src: img.src,
        ...(img.alt ? { alt: img.alt } : {}),
        ...(img.title ? { title: img.title } : {}),
        loading: 'lazy',
      },
    ]);

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-keep-gallery': 'true',
        'data-count': String(imgs.length),
        class: 'keep-image-gallery-block',
      }),
      ...children,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNodeView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return Boolean(target?.closest?.('[data-keep-gallery-ui="true"]'));
      },
    });
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageGalleryAutoMerge'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (transactions.some((tr) => tr.getMeta('skipGalleryAutoMerge'))) return null;

          const { schema, doc, selection } = newState;
          const imageType = schema.nodes.image;
          const galleryType = schema.nodes.imageGallery;
          if (!imageType || !galleryType) return null;

          const isGroupable = (n: ProseMirrorNode) => {
            if (n.type === galleryType) {
              return Array.isArray(n.attrs.images) && n.attrs.images.length > 0;
            }
            if (n.type === imageType) {
              return Boolean(n.attrs.src) && !n.attrs.ungrouped;
            }
            return false;
          };

          const extractNodeImages = (n: ProseMirrorNode): GalleryImageItem[] => {
            if (n.type === galleryType) {
              return (n.attrs.images as GalleryImageItem[]).filter((x) => Boolean(x?.src));
            }
            if (n.type === imageType && n.attrs.src) {
              return [
                {
                  src: String(n.attrs.src),
                  ...(n.attrs.alt ? { alt: String(n.attrs.alt) } : {}),
                  ...(n.attrs.title ? { title: String(n.attrs.title) } : {}),
                },
              ];
            }
            return [];
          };

          const isEmptySpacer = (n: ProseMirrorNode, nodePos: number, nodeEnd: number) => {
            if (n.type.name !== 'paragraph' || n.childCount > 0 || n.textContent.length > 0) {
              return false;
            }
            if (selection.from >= nodePos && selection.to <= nodeEnd) {
              return false;
            }
            return true;
          };

          // Build child position index
          const children: { node: ProseMirrorNode; pos: number; end: number }[] = [];
          let offset = 0;
          for (let i = 0; i < doc.childCount; i++) {
            const child = doc.child(i);
            const pos = offset;
            const end = offset + child.nodeSize;
            children.push({ node: child, pos, end });
            offset = end;
          }

          let i = 0;
          while (i < children.length) {
            const first = children[i];
            if (!isGroupable(first.node)) {
              i++;
              continue;
            }

            const runStartPos = first.pos;
            const collected: GalleryImageItem[] = [...extractNodeImages(first.node)];
            let groupableCount = 1;
            let lastGroupableEnd = first.end;
            let lastGroupableIdx = i;

            let j = i + 1;
            while (j < children.length) {
              const cand = children[j];
              if (isGroupable(cand.node)) {
                collected.push(...extractNodeImages(cand.node));
                groupableCount++;
                lastGroupableEnd = cand.end;
                lastGroupableIdx = j;
                j++;
                continue;
              }
              if (isEmptySpacer(cand.node, cand.pos, cand.end)) {
                j++;
                continue;
              }
              break;
            }

            // Merge if 2+ groupable nodes form a run, or unwrap a 1-image gallery node
            if (groupableCount >= 2 && collected.length >= 2) {
              const galleryNode = galleryType.create({ images: collected });
              return newState.tr.replaceWith(runStartPos, lastGroupableEnd, galleryNode);
            }

            if (
              groupableCount === 1 &&
              first.node.type === galleryType &&
              collected.length === 1
            ) {
              const single = collected[0];
              const singleImgNode = imageType.create({
                src: single.src,
                alt: single.alt || null,
                title: single.title || null,
              });
              return newState.tr.replaceWith(first.pos, first.end, singleImgNode);
            }

            i = lastGroupableIdx + 1;
          }

          return null;
        },
      }),
      new Plugin({
        key: new PluginKey('imageGalleryTrailingParagraph'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const lastChild = newState.doc.lastChild;
          if (lastChild && lastChild.type.name === 'imageGallery') {
            const paragraphType = newState.schema.nodes.paragraph;
            if (paragraphType) {
              return newState.tr.insert(newState.doc.content.size, paragraphType.create());
            }
          }
          return null;
        },
      }),
    ];
  },
});
