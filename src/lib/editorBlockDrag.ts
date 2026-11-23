'use client';

import { Editor } from '@tiptap/react';
import { Fragment, Node as ProseMirrorNode, Attrs } from '@tiptap/pm/model';

export interface MovableEditorBlock {
  index: number;
  pos: number;
  endPos: number;
  node: ProseMirrorNode;
  dom: HTMLElement;
  rect: DOMRect;
  listTypeName: string | null;
  listAttrs: Attrs | null;
  label: string;
}

interface FlatDocEntry {
  node: ProseMirrorNode;
  pos: number;
  endPos: number;
  listTypeName: string | null;
  listAttrs: Attrs | null;
}

const LIST_CONTAINER_TYPES = new Set(['taskList', 'bulletList', 'orderedList']);

function flattenDocEntries(doc: ProseMirrorNode): FlatDocEntry[] {
  const entries: FlatDocEntry[] = [];
  let offset = 0;

  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    const childPos = offset;
    const childEnd = offset + child.nodeSize;

    if (LIST_CONTAINER_TYPES.has(child.type.name) && child.childCount > 0) {
      let itemOffset = childPos + 1;
      for (let j = 0; j < child.childCount; j++) {
        const listItem = child.child(j);
        entries.push({
          node: listItem,
          pos: itemOffset,
          endPos: itemOffset + listItem.nodeSize,
          listTypeName: child.type.name,
          listAttrs: child.attrs,
        });
        itemOffset += listItem.nodeSize;
      }
    } else {
      entries.push({
        node: child,
        pos: childPos,
        endPos: childEnd,
        listTypeName: null,
        listAttrs: null,
      });
    }

    offset = childEnd;
  }

  return entries;
}

function getBlockLabel(node: ProseMirrorNode): string {
  if (node.type.name === 'subpageBlock') {
    return String(node.attrs?.noteTitle || 'Sub-page');
  }
  if (node.type.name === 'horizontalRule') return 'Divider';
  if (node.type.name === 'table') return 'Table';
  if (node.type.name === 'keepMedia') return 'Attachment';
  if (node.type.name === 'dataview') return 'Dataview query';
  const txt = (node.textContent || '').trim();
  if (txt) return txt.slice(0, 42);
  if (node.type.name === 'taskItem') return 'To-do item';
  return 'Block';
}

function resolveDomForPos(editor: Editor, pos: number): HTMLElement | null {
  try {
    const direct = editor.view.nodeDOM(pos);
    if (direct instanceof HTMLElement) return direct;
    if (direct && direct.parentElement) return direct.parentElement;
    const domPos = editor.view.domAtPos(Math.min(pos + 1, editor.state.doc.content.size));
    const node = domPos.node;
    if (node instanceof HTMLElement) return node;
    if (node?.parentElement) return node.parentElement;
  } catch {
    return null;
  }
  return null;
}

export function getMovableEditorBlocks(editor: Editor): MovableEditorBlock[] {
  const entries = flattenDocEntries(editor.state.doc);
  const blocks: MovableEditorBlock[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const dom = resolveDomForPos(editor, entry.pos);
    if (!dom) continue;
    const rect = dom.getBoundingClientRect();
    blocks.push({
      index: i,
      pos: entry.pos,
      endPos: entry.endPos,
      node: entry.node,
      dom,
      rect,
      listTypeName: entry.listTypeName,
      listAttrs: entry.listAttrs,
      label: getBlockLabel(entry.node),
    });
  }

  return blocks;
}

/**
 * Moves a block (or individual taskItem/listItem) at `sourceIndex` to sit
 * directly before `targetBoundaryIndex` (where `targetBoundaryIndex === entries.length`
 * moves it to the very end). Adjacent items sharing a list type are folded cleanly.
 */
export function moveEditorBlock(
  editor: Editor,
  sourceIndex: number,
  targetBoundaryIndex: number
): boolean {
  const doc = editor.state.doc;
  const entries = flattenDocEntries(doc);
  if (
    sourceIndex < 0 ||
    sourceIndex >= entries.length ||
    targetBoundaryIndex < 0 ||
    targetBoundaryIndex > entries.length
  ) {
    return false;
  }

  if (targetBoundaryIndex === sourceIndex || targetBoundaryIndex === sourceIndex + 1) {
    return false;
  }

  const reordered = [...entries];
  const [moved] = reordered.splice(sourceIndex, 1);
  const insertAt = targetBoundaryIndex > sourceIndex ? targetBoundaryIndex - 1 : targetBoundaryIndex;
  reordered.splice(insertAt, 0, moved);

  const schema = editor.state.schema;
  const topNodes: ProseMirrorNode[] = [];
  let idx = 0;

  while (idx < reordered.length) {
    const current = reordered[idx];
    if (current.listTypeName && schema.nodes[current.listTypeName]) {
      const listType = schema.nodes[current.listTypeName];
      const listAttrs = current.listAttrs;
      const groupedItems: ProseMirrorNode[] = [current.node];
      idx++;
      while (
        idx < reordered.length &&
        reordered[idx].listTypeName === listType.name
      ) {
        groupedItems.push(reordered[idx].node);
        idx++;
      }
      topNodes.push(listType.create(listAttrs, groupedItems));
    } else {
      topNodes.push(current.node);
      idx++;
    }
  }

  if (topNodes.length === 0 && schema.nodes.paragraph) {
    topNodes.push(schema.nodes.paragraph.create());
  }

  const tr = editor.state.tr.replaceWith(0, doc.content.size, Fragment.from(topNodes));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
