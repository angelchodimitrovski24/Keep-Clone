export interface GalleryImageItem {
  src: string;
  alt?: string;
  title?: string;
}

const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function extractAttrValue(attrs: string, name: string): string {
  const doubleRe = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i');
  const dm = attrs.match(doubleRe);
  if (dm) return decodeHtmlAttr(dm[1]);

  const singleRe = new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i');
  const sm = attrs.match(singleRe);
  if (sm) return decodeHtmlAttr(sm[1]);

  const unquotedRe = new RegExp(`\\b${name}\\s*=\\s*([^\\s"'>]+)`, 'i');
  const um = attrs.match(unquotedRe);
  if (um) return decodeHtmlAttr(um[1]);

  return '';
}

export function extractImageItemsFromHtml(html: string): GalleryImageItem[] {
  if (!html) return [];
  const items: GalleryImageItem[] = [];
  const imgRe = /<img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRe.exec(html)) !== null) {
    const attrs = match[1] || '';
    const src = extractAttrValue(attrs, 'src').trim();
    if (!src) continue;
    const alt = extractAttrValue(attrs, 'alt').trim();
    const title = extractAttrValue(attrs, 'title').trim();
    items.push({
      src,
      ...(alt ? { alt } : {}),
      ...(title ? { title } : {}),
    });
  }
  return items;
}

export function buildGalleryHtmlBlock(images: GalleryImageItem[]): string {
  if (!images || images.length === 0) return '';
  if (images.length === 1) {
    const img = images[0];
    const altAttr = escapeHtmlAttr(img.alt || 'image');
    const titleAttr = img.title ? ` title="${escapeHtmlAttr(img.title)}"` : '';
    return `<div class="my-2 keep-media-img-wrapper"><img src="${escapeHtmlAttr(
      img.src
    )}" alt="${altAttr}"${titleAttr} class="rounded-xl max-h-96 w-auto my-1 border border-black/10 dark:border-white/10 shadow-xs object-contain" loading="lazy" /></div>`;
  }

  const imgTags = images
    .map((img) => {
      const altAttr = escapeHtmlAttr(img.alt || 'image');
      const titleAttr = img.title ? ` title="${escapeHtmlAttr(img.title)}"` : '';
      return `<img src="${escapeHtmlAttr(
        img.src
      )}" alt="${altAttr}"${titleAttr} loading="lazy" />`;
    })
    .join('');

  return `<div data-keep-gallery="true" data-count="${images.length}" class="keep-image-gallery-block">${imgTags}</div>`;
}

/**
 * Finds the end index (exclusive, right after closing </div>) of a balanced <div>...</div>
 * starting at `startIndex` (which must point to `<div`). Returns -1 if unbalanced.
 */
export function findBalancedDivEndIndex(html: string, startIndex: number): number {
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = startIndex;
  let depth = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    const token = match[0];
    if (token.startsWith('</')) {
      depth--;
      if (depth <= 0) {
        return tagRe.lastIndex;
      }
    } else if (!/\/>\s*$/.test(token)) {
      depth++;
    }
  }
  return -1;
}

/**
 * Splits top-level HTML into an array of balanced element blocks and inter-tag text chunks.
 * Works identically in Node SSR and Browser without DOMParser.
 */
function splitTopLevelHtmlBlocks(html: string): string[] {
  const blocks: string[] = [];
  const len = html.length;
  let i = 0;

  while (i < len) {
    if (html[i] !== '<') {
      const nextTag = html.indexOf('<', i);
      if (nextTag === -1) {
        blocks.push(html.slice(i));
        break;
      }
      blocks.push(html.slice(i, nextTag));
      i = nextTag;
      continue;
    }

    // HTML comment <!-- ... -->
    if (html.startsWith('<!--', i)) {
      const endComment = html.indexOf('-->', i + 4);
      if (endComment === -1) {
        blocks.push(html.slice(i));
        break;
      }
      blocks.push(html.slice(i, endComment + 3));
      i = endComment + 3;
      continue;
    }

    const openTagMatch = html.slice(i).match(/^<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/);
    if (!openTagMatch) {
      // Stray '<'
      const nextTag = html.indexOf('<', i + 1);
      if (nextTag === -1) {
        blocks.push(html.slice(i));
        break;
      }
      blocks.push(html.slice(i, nextTag));
      i = nextTag;
      continue;
    }

    const fullOpen = openTagMatch[0];
    const tagName = openTagMatch[1].toLowerCase();

    if (fullOpen.startsWith('</') || VOID_HTML_TAGS.has(tagName) || /\/>\s*$/.test(fullOpen)) {
      blocks.push(fullOpen);
      i += fullOpen.length;
      continue;
    }

    // Track nesting depth for this tag name
    const tagRe = new RegExp(`</?${tagName}\\b[^>]*>`, 'gi');
    tagRe.lastIndex = i;
    let depth = 0;
    let endPos = -1;
    let m: RegExpExecArray | null;

    while ((m = tagRe.exec(html)) !== null) {
      const tok = m[0];
      if (tok.startsWith('</')) {
        depth--;
        if (depth <= 0) {
          endPos = tagRe.lastIndex;
          break;
        }
      } else if (!/\/>\s*$/.test(tok)) {
        depth++;
      }
    }

    if (endPos === -1) {
      blocks.push(html.slice(i));
      break;
    }

    blocks.push(html.slice(i, endPos));
    i = endPos;
  }

  return blocks;
}

function isSpacerBlock(block: string): boolean {
  if (/^\s*$/.test(block)) return true;
  if (/^<br\s*\/?>$/i.test(block.trim())) return true;
  if (!/^<(?:p|div)\b/i.test(block.trim())) return false;
  if (/data-keep-|data-dataview-|keep-table|<img\b|<table\b|<pre\b|<ul\b|<ol\b|<hr\b/i.test(block)) {
    return false;
  }
  const stripped = block
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return stripped.length === 0;
}

function classifyImageBlock(block: string): {
  isImageBlock: boolean;
  isExistingGallery: boolean;
  images: GalleryImageItem[];
} {
  const trimmed = block.trim();
  if (!trimmed) {
    return { isImageBlock: false, isExistingGallery: false, images: [] };
  }

  // Never touch special non-gallery blocks
  if (
    /data-keep-media=|data-keep-subpage=|data-dataview-|keep-table-wrapper|^<(?:pre|code|table|ul|ol|blockquote|h[1-6])\b/i.test(
      trimmed
    )
  ) {
    return { isImageBlock: false, isExistingGallery: false, images: [] };
  }

  // Already a gallery block
  if (/^<div\b[^>]*data-keep-gallery=["']true["'][^>]*>/i.test(trimmed)) {
    const imgs = extractImageItemsFromHtml(trimmed);
    return {
      isImageBlock: imgs.length > 0,
      isExistingGallery: true,
      images: imgs,
    };
  }

  // Must contain at least one <img>
  if (!/<img\b/i.test(trimmed)) {
    return { isImageBlock: false, isExistingGallery: false, images: [] };
  }

  // Respect explicit ungrouped images
  if (/data-ungrouped=["']true["']/i.test(trimmed)) {
    return { isImageBlock: false, isExistingGallery: false, images: [] };
  }

  // Verify it is ONLY images (plus optional pure container tags <p>, <div>, <figure>, <a>, <span>, <br>) and NO visible text
  if (!/^<(?:img|p|div|figure|a|span)\b/i.test(trimmed)) {
    return { isImageBlock: false, isExistingGallery: false, images: [] };
  }

  const remainder = trimmed
    .replace(/<\/?(?:p|div|figure|a|span)\b[^>]*>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();

  if (remainder.length > 0) {
    return { isImageBlock: false, isExistingGallery: false, images: [] };
  }

  const imgs = extractImageItemsFromHtml(trimmed);
  return {
    isImageBlock: imgs.length > 0,
    isExistingGallery: false,
    images: imgs,
  };
}

/**
 * Groups 2+ consecutive standalone images (separated only by whitespace or empty <p>/<br> spacers)
 * into `<div data-keep-gallery="true" class="keep-image-gallery-block">...</div>`.
 * Also unwraps any existing gallery that was reduced to 1 image.
 * Deterministic and SSR-safe.
 */
export function groupConsecutiveImagesInHtml(html: string): string {
  if (!html || !/<img\b/i.test(html)) return html;

  const blocks = splitTopLevelHtmlBlocks(html);
  if (blocks.length === 0) return html;

  const output: string[] = [];
  let runImages: GalleryImageItem[] = [];
  let runRawBlocks: string[] = [];
  let runHasExistingGallery = false;
  let pendingSpacers: string[] = [];

  const flushRun = () => {
    if (runImages.length >= 2) {
      output.push(buildGalleryHtmlBlock(runImages));
      if (pendingSpacers.length > 0) {
        output.push(...pendingSpacers);
      }
    } else if (runImages.length === 1) {
      if (runHasExistingGallery) {
        output.push(buildGalleryHtmlBlock(runImages));
      } else {
        output.push(...runRawBlocks);
      }
      if (pendingSpacers.length > 0) {
        output.push(...pendingSpacers);
      }
    } else if (pendingSpacers.length > 0) {
      output.push(...pendingSpacers);
    }

    runImages = [];
    runRawBlocks = [];
    runHasExistingGallery = false;
    pendingSpacers = [];
  };

  for (const block of blocks) {
    if (isSpacerBlock(block)) {
      if (runImages.length > 0) {
        pendingSpacers.push(block);
      } else {
        output.push(block);
      }
      continue;
    }

    const classified = classifyImageBlock(block);
    if (classified.isImageBlock) {
      // Absorb any spacers that sit strictly between images in this run
      if (runImages.length > 0 && pendingSpacers.length > 0) {
        runRawBlocks.push(...pendingSpacers);
      }
      pendingSpacers = [];
      runImages.push(...classified.images);
      runRawBlocks.push(block);
      if (classified.isExistingGallery) {
        runHasExistingGallery = true;
      }
      continue;
    }

    flushRun();
    output.push(block);
  }

  flushRun();
  return output.join('');
}
