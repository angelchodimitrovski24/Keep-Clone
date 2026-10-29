import { renderMarkdownTablesInHtml, isTableSeparatorLine, convertTableLinesToHtml } from './tableUtils';
import { getMediaBlobUrl, getSyncLocalMediaFolder } from './localPaste';

export type GoogleKeepFormatCommand =
  | 'h1'
  | 'h2'
  | 'normal'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'bullet-list'
  | 'number-list'
  | 'checkbox-list'
  | 'code'
  | 'code-block'
  | 'clear';

export function applyKeepFormatting(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  cmd: GoogleKeepFormatCommand
): { newText: string; newStart: number; newEnd: number } {
  // Line-level format (headings, lists, checkboxes, normal)
  const isLineLevel =
    cmd === 'h1' ||
    cmd === 'h2' ||
    cmd === 'normal' ||
    cmd === 'bullet-list' ||
    cmd === 'number-list' ||
    cmd === 'checkbox-list';

  let start = selectionStart;
  let end = selectionEnd;

  if (isLineLevel) {
    // Find bounds of all selected lines
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;

    const blockText = text.substring(lineStart, lineEnd);
    const lines = blockText.split('\n');

    const formattedLines = lines.map((line, idx) => {
      // Strip existing list/heading markers
      const cleanLine = line
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*+]\s+\[[ xX]\]\s*/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '');

      if (cmd === 'h1') return `# ${cleanLine}`;
      if (cmd === 'h2') return `## ${cleanLine}`;
      if (cmd === 'normal') return cleanLine;
      if (cmd === 'bullet-list') return `- ${cleanLine}`;
      if (cmd === 'number-list') return `${idx + 1}. ${cleanLine}`;
      if (cmd === 'checkbox-list') return `- [ ] ${cleanLine}`;
      return line;
    });

    const newBlock = formattedLines.join('\n');
    const before = text.substring(0, lineStart);
    const after = text.substring(lineEnd);
    const newText = before + newBlock + after;
    const newCursor = lineStart + newBlock.length;

    return {
      newText,
      newStart: newCursor,
      newEnd: newCursor,
    };
  }

  // Inline formatting: Bold, Italic, Underline, Code, Code Block, Clear
  const selectedText = text.substring(start, end);
  const before = text.substring(0, start);
  const after = text.substring(end);

  let prefix = '';
  let suffix = '';
  let replacement = selectedText;

  switch (cmd) {
    case 'bold':
      prefix = '**';
      suffix = '**';
      replacement = selectedText || 'Bold text';
      break;
    case 'italic':
      prefix = '*';
      suffix = '*';
      replacement = selectedText || 'Italic text';
      break;
    case 'underline':
      prefix = '<u>';
      suffix = '</u>';
      replacement = selectedText || 'Underlined text';
      break;
    case 'code':
      prefix = '`';
      suffix = '`';
      replacement = selectedText || 'code';
      break;
    case 'code-block':
      prefix = '```\n';
      suffix = '\n```';
      replacement = selectedText || 'code here';
      break;
    case 'clear':
      replacement = selectedText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/<u>(.*?)<\/u>/gi, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1');
      break;
  }

  const newText = before + prefix + replacement + suffix + after;
  const newStart = before.length + prefix.length;
  const newEnd = newStart + replacement.length;

  return { newText, newStart, newEnd };
}

/**
 * Handles Enter key on text areas for continuous lists:
 * - Bullet list (- ...)
 * - Numbered list (1. ...)
 * - Checkbox list (- [ ] ... or [ ] ...)
 *
 * If the current line is just an empty item ("- " or "- [ ] " or "1. "), pressing Enter cancels the list on that line!
 */
export function handleContinuousListEnter(
  text: string,
  cursorPos: number
): { handled: boolean; newText?: string; newCursor?: number } {
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  const currentLine = text.substring(lineStart, cursorPos);

  // 1. Checkbox list item: "- [ ] " or "- [x] " or "[ ] "
  const checkboxMatch = currentLine.match(/^(\s*(?:[-*+]\s+)?\[[ xX]\]\s*)(.*)$/);
  if (checkboxMatch) {
    const [_, prefix, content] = checkboxMatch;
    // If the line content is empty, pressing Enter stops the list
    if (!content.trim()) {
      const before = text.substring(0, lineStart);
      const after = text.substring(cursorPos);
      return { handled: true, newText: before + after, newCursor: lineStart };
    }
    // Otherwise continue checkbox on next line
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos);
    const insertion = '\n- [ ] ';
    return {
      handled: true,
      newText: before + insertion + after,
      newCursor: cursorPos + insertion.length,
    };
  }

  // 2. Numbered list item: "1. " or "2. "
  const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numberMatch) {
    const [_, indent, numStr, content] = numberMatch;
    if (!content.trim()) {
      const before = text.substring(0, lineStart);
      const after = text.substring(cursorPos);
      return { handled: true, newText: before + after, newCursor: lineStart };
    }
    const nextNum = parseInt(numStr, 10) + 1;
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos);
    const insertion = `\n${indent}${nextNum}. `;
    return {
      handled: true,
      newText: before + insertion + after,
      newCursor: cursorPos + insertion.length,
    };
  }

  // 3. Bullet list item: "- " or "* " or "+ "
  const bulletMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/);
  if (bulletMatch) {
    const [_, prefix, content] = bulletMatch;
    if (!content.trim()) {
      const before = text.substring(0, lineStart);
      const after = text.substring(cursorPos);
      return { handled: true, newText: before + after, newCursor: lineStart };
    }
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos);
    const insertion = `\n${prefix}`;
    return {
      handled: true,
      newText: before + insertion + after,
      newCursor: cursorPos + insertion.length,
    };
  }

  return { handled: false };
}

/**
 * Toggles a checkbox in markdown content by its index
 */
export function toggleMarkdownCheckbox(
  content: string,
  checkboxIndex: number,
  newChecked: boolean
): string {
  let currentIndex = 0;
  // Match lines with checkboxes
  const lines = content.split('\n');
  const updatedLines = lines.map((line) => {
    const match = line.match(/^(\s*(?:[-*+]\s+)?\[)([ xX])(\]\s*.*)$/);
    if (match) {
      if (currentIndex === checkboxIndex) {
        currentIndex++;
        const checkMark = newChecked ? 'x' : ' ';
        return `${match[1]}${checkMark}${match[3]}`;
      }
      currentIndex++;
    }
    return line;
  });

  return updatedLines.join('\n');
}

export function resolveLocalMediaUrl(rawPath: string): string {
  if (!rawPath) return '';
  const trimmed = rawPath.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // If already an /api/local-media URL, check if we have a locally cached blob URL first (for offline/PWA/mobile)
  if (trimmed.startsWith('/api/local-media')) {
    try {
      const qIndex = trimmed.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(trimmed.substring(qIndex));
        const fileParam = params.get('file');
        if (fileParam) {
          const cached = getMediaBlobUrl(fileParam);
          if (cached) return cached;
        }
      }
    } catch {
      // Ignore URL parse error
    }
    return trimmed;
  }

  if (trimmed.startsWith('/api/')) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, '/');

  // Check client media blob cache first (e.g. pasted in current session, offline, or imported from Drive)
  const cachedUrl = getMediaBlobUrl(normalized);
  if (cachedUrl) return cachedUrl;

  const lastSlash = normalized.lastIndexOf('/');
  const fileName = (lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized).split('?')[0];
  const cachedByName = getMediaBlobUrl(fileName);
  if (cachedByName) return cachedByName;

  let folder = '';
  let file = normalized;

  if (lastSlash !== -1) {
    folder = normalized.substring(0, lastSlash);
    file = normalized.substring(lastSlash + 1);
  }

  if (!folder && typeof window !== 'undefined') {
    folder = getSyncLocalMediaFolder();
  }

  return `/api/local-media?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(file)}`;
}

/**
 * Replaces any markdown image patterns ![alt](path) with standard rendered HTML <img>
 */
export function renderMarkdownImagesInString(str: string): string {
  if (!str) return '';
  return str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, rawPath) => {
    const serveUrl = resolveLocalMediaUrl(rawPath.trim());
    const displayAlt = alt || 'image';
    return `<div class="my-2 keep-media-img-wrapper"><img src="${serveUrl}" alt="${displayAlt}" title="${rawPath}" class="rounded-xl max-h-96 w-auto my-1 border border-black/10 dark:border-white/10 shadow-xs object-contain" loading="lazy" /></div>`;
  });
}

/**
 * Converts Markdown string, Tiptap HTML with embedded markdown, or plain text
 * to standard semantic Google Keep HTML with complete support for headings,
 * task list checkboxes, bullet/number lists, tables, blockquotes, code blocks,
 * and inline formatting (bold, italic, strikethrough, code, links).
 */
export function convertMarkdownToHtml(content: string): string {
  if (!content) return '';

  // 1. Unpack any existing <p>, <div>, or <br> tags into discrete lines so embedded markdown inside paragraphs gets parsed
  const normalized = content
    .replace(/<\/(?:p|div)>\s*<(?:p|div)[^>]*>/gi, '\n')
    .replace(/^<(?:p|div)[^>]*>/i, '')
    .replace(/<\/(?:p|div)>$/i, '')
    .replace(/<br\s*\/?>/gi, '\n');

  const lines = normalized.split(/\r?\n/);
  let result = '';
  let inTaskList = false;
  let inBulletList = false;
  let inNumberList = false;
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  const closeOpenLists = () => {
    if (inTaskList) {
      result += '</ul>';
      inTaskList = false;
    }
    if (inBulletList) {
      result += '</ul>';
      inBulletList = false;
    }
    if (inNumberList) {
      result += '</ol>';
      inNumberList = false;
    }
  };

  const formatInline = (str: string) => {
    return str
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(^|[\s.,;:!?(])_([^_]+)_(?=[.,;:!?)\s]|$)/g, '$1<u>$2</u>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/(?<!`)`([^`\r\n]+)`(?!`)/g, '<code>$1</code>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, rawPath) => {
        const serveUrl = resolveLocalMediaUrl(rawPath.trim());
        return `<img src="${serveUrl}" alt="${alt || 'image'}" class="rounded-xl max-h-96 w-auto my-2 border border-black/10 dark:border-white/10 shadow-xs" loading="lazy" />`;
      })
      .replace(/(?<!\!)\[([^\]]*)\]\(([^)]+)\)/g, (_m, text, url) => {
        const linkText = text.trim() || 'link';
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:opacity-80">${linkText}</a>`;
      });
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Single-line code block: ```lang code ``` or ```code```
    const singleLineBlockMatch = trimmed.match(/^(`{3,}|~{3,})([a-zA-Z0-9_-]*)\s*([\s\S]+?)\s*\1$/);
    if (singleLineBlockMatch && !inCodeBlock) {
      closeOpenLists();
      const lang = singleLineBlockMatch[2].trim();
      const codeText = singleLineBlockMatch[3]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      result += `<pre><code${lang ? ` class="language-${lang}"` : ''}>${codeText}</code></pre>`;
      i++;
      continue;
    }

    // 2. Fenced Code Block delimiters: ``` or ```lang or ~~~ or ~~~lang
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      closeOpenLists();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = fenceMatch[2].trim();
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        const codeText = codeBlockLines
          .join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        result += `<pre><code${codeBlockLang ? ` class="language-${codeBlockLang}"` : ''}>${codeText}</code></pre>`;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      i++;
      continue;
    }

    if (!trimmed) {
      closeOpenLists();
      i++;
      continue;
    }

    // 2. Markdown Table detection (current line has pipe and next line is separator)
    if (i + 1 < lines.length && rawLine.includes('|') && isTableSeparatorLine(lines[i + 1])) {
      closeOpenLists();
      const tableLines = [rawLine, lines[i + 1]];
      i += 2;
      while (i < lines.length && (lines[i].includes('|') || isTableSeparatorLine(lines[i]))) {
        tableLines.push(lines[i]);
        i++;
      }
      result += convertTableLinesToHtml(tableLines);
      continue;
    }

    // 3. Task List item: - [ ] or - [x] or [ ] or [x]
    const taskMatch = rawLine.match(/^\s*(?:[-*+]\s+)?\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      if (inBulletList) { result += '</ul>'; inBulletList = false; }
      if (inNumberList) { result += '</ol>'; inNumberList = false; }
      if (!inTaskList) {
        result += '<ul data-type="taskList">';
        inTaskList = true;
      }
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const itemText = formatInline(taskMatch[2].trim());
      result += `<li data-type="taskItem" data-checked="${isChecked}"><label><input type="checkbox"${isChecked ? ' checked="checked"' : ''}><span></span></label><div><p>${itemText}</p></div></li>`;
      i++;
      continue;
    }

    // 4. Headings: #, ##, ###, ####
    const headingMatch = rawLine.match(/^\s*(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      closeOpenLists();
      const level = headingMatch[1].length;
      result += `<h${level}>${formatInline(headingMatch[2].trim())}</h${level}>`;
      i++;
      continue;
    }

    // 5. Blockquotes: > quote
    const bqMatch = rawLine.match(/^\s*(?:&gt;|>)\s*(.*)$/);
    if (bqMatch) {
      closeOpenLists();
      result += `<blockquote><p>${formatInline(bqMatch[1].trim())}</p></blockquote>`;
      i++;
      continue;
    }

    // 6. Horizontal rules: --- or *** or ___
    if (/^([-*_]){3,}$/.test(trimmed)) {
      closeOpenLists();
      result += `<hr />`;
      i++;
      continue;
    }

    // 7. Bullet list: - or *
    const bulletMatch = rawLine.match(/^\s*[-*+]\s+(.*)$/);
    if (bulletMatch) {
      if (inTaskList) { result += '</ul>'; inTaskList = false; }
      if (inNumberList) { result += '</ol>'; inNumberList = false; }
      if (!inBulletList) {
        result += '<ul>';
        inBulletList = true;
      }
      result += `<li><p>${formatInline(bulletMatch[1].trim())}</p></li>`;
      i++;
      continue;
    }

    // 8. Number list: 1.
    const numberMatch = rawLine.match(/^\s*\d+\.\s+(.*)$/);
    if (numberMatch) {
      if (inTaskList) { result += '</ul>'; inTaskList = false; }
      if (inBulletList) { result += '</ul>'; inBulletList = false; }
      if (!inNumberList) {
        result += '<ol>';
        inNumberList = true;
      }
      result += `<li><p>${formatInline(numberMatch[1].trim())}</p></li>`;
      i++;
      continue;
    }

    // 9. Markdown Image line: ![alt](path)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      closeOpenLists();
      const fileName = imgMatch[1] || 'image';
      const rawPath = imgMatch[2];
      const serveUrl = resolveLocalMediaUrl(rawPath);
      result += `<div class="my-2 keep-media-img-wrapper"><img src="${serveUrl}" alt="${fileName}" class="rounded-xl max-h-96 w-auto my-1 border border-black/10 dark:border-white/10" loading="lazy" /></div>`;
      i++;
      continue;
    }

    // 10. Existing multi-line <pre>...</pre> HTML block
    if (trimmed.startsWith('<pre')) {
      closeOpenLists();
      let preBlock = rawLine;
      while (!preBlock.includes('</pre>') && i + 1 < lines.length) {
        i++;
        preBlock += '\n' + lines[i];
      }
      result += preBlock;
      i++;
      continue;
    }

    // 11. Existing HTML blocks
    if (
      trimmed.startsWith('<div') ||
      trimmed.startsWith('<table') ||
      trimmed.startsWith('<h1') ||
      trimmed.startsWith('<h2') ||
      trimmed.startsWith('<h3') ||
      trimmed.startsWith('<h4') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<hr')
    ) {
      closeOpenLists();
      result += trimmed;
      i++;
      continue;
    }

    // 12. Normal paragraph
    closeOpenLists();
    result += `<p>${formatInline(trimmed)}</p>`;
    i++;
  }

  // Close unclosed code block if file ends inside code block
  if (inCodeBlock) {
    const codeText = codeBlockLines
      .join('\n')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    result += `<pre><code${codeBlockLang ? ` class="language-${codeBlockLang}"` : ''}>${codeText}</code></pre>`;
  }

  closeOpenLists();
  return renderMarkdownTablesInHtml(renderMarkdownImagesInString(result));
}

/**
 * Toggles a checkbox in HTML rendered content by its taskItem index
 */
export function toggleHtmlCheckbox(html: string, index: number): string {
  if (typeof window === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const taskItems = doc.querySelectorAll('li[data-type="taskItem"]');
    if (taskItems[index]) {
      const item = taskItems[index];
      const isChecked = item.getAttribute('data-checked') === 'true';
      const nextChecked = !isChecked;
      item.setAttribute('data-checked', nextChecked ? 'true' : 'false');
      const input = item.querySelector('input[type="checkbox"]');
      if (input) {
        if (nextChecked) {
          input.setAttribute('checked', 'checked');
        } else {
          input.removeAttribute('checked');
        }
      }
      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error('Error toggling HTML checkbox:', err);
  }
  return html;
}


/**
 * Toggles a checkbox in any content (HTML taskItem, paragraph markdown, or raw markdown)
 */
export function toggleCheckboxInAnyContent(content: string, index: number, newChecked?: boolean): string {
  if (!content) return content;
  if (content.includes('data-type="taskItem"')) {
    return toggleHtmlCheckbox(content, index);
  }
  let currentIndex = 0;
  return content.replace(/(\[)([ xX])(\])/g, (match, prefix, check, suffix) => {
    if (currentIndex === index) {
      currentIndex++;
      const nextChecked = newChecked !== undefined ? newChecked : check.toLowerCase() !== 'x';
      return `${prefix}${nextChecked ? 'x' : ' '}${suffix}`;
    }
    currentIndex++;
    return match;
  });
}

function detectCodeLanguage(preAttrs: string, codeAttrs?: string): string {
  const combined = `${preAttrs || ''} ${codeAttrs || ''}`;

  // 1. Check language-* or lang-*
  const langMatch = combined.match(/\b(?:language|lang)-([a-zA-Z0-9_#+-]+)\b/i);
  if (langMatch) return langMatch[1].toLowerCase();

  // 2. Check data-lang="..." or data-language="..."
  const dataLangMatch = combined.match(/\bdata-lang(?:uage)?=["']([^"']+)["']/i);
  if (dataLangMatch) return dataLangMatch[1].toLowerCase();

  // 3. Check highlight-source-*
  const hlMatch = combined.match(/\bhighlight-source-([a-zA-Z0-9_#+-]+)\b/i);
  if (hlMatch) return hlMatch[1].toLowerCase();

  // 4. Check brush:*
  const brushMatch = combined.match(/\bbrush:\s*([a-zA-Z0-9_#+-]+)\b/i);
  if (brushMatch) return brushMatch[1].toLowerCase();

  // 5. Check standalone language class names
  const knownLangs = [
    'javascript', 'typescript', 'python', 'bash', 'shell', 'sh', 'zsh',
    'html', 'css', 'scss', 'sass', 'json', 'yaml', 'yml', 'xml', 'sql',
    'cpp', 'c', 'csharp', 'cs', 'java', 'kotlin', 'swift', 'rust', 'go',
    'ruby', 'php', 'scala', 'r', 'dart', 'lua', 'perl', 'dockerfile',
    'graphql', 'markdown', 'md', 'diff', 'powershell', 'ps1'
  ];
  const classMatch = combined.match(/\bclass=["']([^"']+)["']/i);
  if (classMatch) {
    const classes = classMatch[1].toLowerCase().split(/\s+/);
    for (const cls of classes) {
      const clean = cls.replace(/^(hljs-|language-|lang-)/, '');
      if (knownLangs.includes(clean)) {
        return clean;
      }
    }
  }

  return '';
}

function cleanCodeContent(inner: string): string {
  let code = inner;

  // Remove copy buttons or action toolbars
  code = code.replace(/<button\b[\s\S]*?<\/button>/gi, '');
  code = code.replace(/<div\b[^>]*\b(?:copy|toolbar|actions)[^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove line numbers
  code = code.replace(/<span\b[^>]*\b(?:lineno|line-number|line-numbers-rows|gutter)[^>]*>[\s\S]*?<\/span>/gi, '');

  // Unwrap <code> tag if present
  const codeTagMatch = code.match(/<code\b[^>]*>([\s\S]*?)<\/code>/i);
  if (codeTagMatch) {
    code = codeTagMatch[1];
  }

  // Convert line breaks and paragraph/div line splits to \n
  code = code.replace(/<br\s*\/?>/gi, '\n');
  code = code.replace(/<\/(?:p|div|tr|li)>\s*<(?:p|div|tr|li)[^>]*>/gi, '\n');

  // Strip all remaining HTML tags (syntax highlighting spans, etc.)
  code = code.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  code = code
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Normalize line breaks
  code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Trim leading/trailing blank lines, but preserve indentation of each line!
  const lines = code.split('\n');
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Converts raw HTML string into clean standard Markdown (headings, bold, italic,
 * lists, task checkboxes, tables, code blocks, links, and blockquotes).
 */
export function convertHtmlToMarkdown(html: string): string {
  if (!html || !/<[a-z][\s\S]*>/i.test(html)) return html;

  let md = html;

  const codeBlocks: string[] = [];

  const addCodeBlock = (lang: string, codeText: string) => {
    const blockIndex = codeBlocks.length;
    codeBlocks.push(`\n\n\`\`\`${lang || ''}\n${codeText}\n\`\`\`\n\n`);
    return `\n\n___KEEP_CODE_BLOCK_${blockIndex}___\n\n`;
  };

  // 1. Browser DOMParser pre-pass: flawlessly extracts Notion code blocks, pre tags, and syntax blocks without regex nesting bugs
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const codeBlockSelectors = [
        'pre',
        '[class*="notion-code"]',
        '[class*="code-block"]',
        '[class*="codeblock"]',
        '[class*="highlight"]',
        '[class*="syntaxhighlighter"]',
        '[class*="code-container"]',
        '[class*="sourceCode"]',
        '[class*="prettyprint"]',
        '[data-language]',
        '[data-code-language]',
        '[role="region"][aria-label*="code" i]',
      ];

      const elements = Array.from(doc.querySelectorAll(codeBlockSelectors.join(', ')));
      elements.forEach((el) => {
        // Skip if nested inside an ancestor that was already selected
        if (el.parentElement?.closest(codeBlockSelectors.join(', '))) {
          return;
        }

        const preAttrs = el.getAttribute('class') || '';
        const codeEl = el.querySelector('code');
        const codeAttrs =
          (codeEl ? codeEl.getAttribute('class') : '') ||
          el.getAttribute('data-language') ||
          el.getAttribute('data-lang') ||
          '';
        const lang = detectCodeLanguage(preAttrs, codeAttrs);

        // Convert <br> and block line breaks to newlines
        el.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
        el.querySelectorAll('p, div, li, tr').forEach((block) => {
          block.append('\n');
        });

        const rawCode = el.textContent || '';
        const cleanCode = cleanCodeContent(rawCode);

        if (cleanCode.length > 0) {
          const placeholder = addCodeBlock(lang, cleanCode);
          el.replaceWith(doc.createTextNode(`\n\n${placeholder}\n\n`));
        }
      });

      // Also extract any multi-line <code> tags or <code> tags with language classes
      doc.querySelectorAll('code').forEach((codeEl) => {
        if (codeEl.closest(codeBlockSelectors.join(', '))) return;

        const codeAttrs = codeEl.getAttribute('class') || '';
        const lang = detectCodeLanguage('', codeAttrs);
        const rawText = codeEl.textContent || '';
        const isMultiLine = rawText.includes('\n') || cleanCodeContent(codeEl.innerHTML).includes('\n');

        if (lang || isMultiLine) {
          codeEl.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
          const cleanCode = cleanCodeContent(codeEl.textContent || '');
          if (cleanCode.length > 0) {
            const placeholder = addCodeBlock(lang, cleanCode);
            codeEl.replaceWith(doc.createTextNode(`\n\n${placeholder}\n\n`));
          }
        }
      });

      md = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
    } catch {
      // Fallback to regex below if DOMParser is unavailable or fails
    }
  }

  // 2. Regex fallback for server-side or non-DOMParser environments
  md = md.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_match, preAttrs, inner) => {
    const codeTagMatch = inner.match(/<code\b([^>]*)>/i);
    const codeAttrs = codeTagMatch ? codeTagMatch[1] : '';

    const lang = detectCodeLanguage(preAttrs, codeAttrs);
    const cleanCode = cleanCodeContent(inner);

    return addCodeBlock(lang, cleanCode);
  });

  // 3. Code containers with class (including notion-code)
  md = md.replace(/<(?:div|figure|section)\b([^>]*(?:notion-code|code-block|codeblock|highlight|syntaxhighlighter|code-container|sourceCode|prettyprint)[^>]*)>([\s\S]*?)<\/(?:div|figure|section)>/gi, (_match, divAttrs, inner) => {
    if (/___KEEP_CODE_BLOCK_\d+___/.test(inner)) return inner;
    const lang = detectCodeLanguage(divAttrs);
    const cleanCode = cleanCodeContent(inner);
    if (cleanCode.length > 0) {
      return addCodeBlock(lang, cleanCode);
    }
    return inner;
  });

  // 4. Multi-line <code> tags or <code> tags with language class / <br>
  md = md.replace(/<code\b([^>]*)>([\s\S]*?)<\/code>/gi, (match, codeAttrs, inner) => {
    const lang = detectCodeLanguage('', codeAttrs);
    const hasNewlines = inner.includes('\n') || /<br\s*\/?>/i.test(inner) || /<\/(?:p|div|li)>/i.test(inner);
    const isMultiLine = cleanCodeContent(inner).includes('\n');

    if (lang || hasNewlines || isMultiLine) {
      const cleanCode = cleanCodeContent(inner);
      return addCodeBlock(lang, cleanCode);
    }
    return match; // Leave single-line inline code for later step
  });

  // 2. Tables: <table>...</table> to Markdown table
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableInner) => {
    const rows: string[][] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(tableInner)) !== null) {
      const cells: string[] = [];
      const thTdRegex = /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = thTdRegex.exec(trMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    if (rows.length === 0) return '';
    const colCount = Math.max(...rows.map((r) => r.length));
    const padRow = (r: string[]) => {
      const padded = [...r];
      while (padded.length < colCount) padded.push('');
      return '| ' + padded.join(' | ') + ' |';
    };

    let tableMd = '\n\n' + padRow(rows[0]) + '\n';
    tableMd += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n';
    for (let r = 1; r < rows.length; r++) {
      tableMd += padRow(rows[r]) + '\n';
    }
    return tableMd + '\n\n';
  });

  // 3. Task list items: <li data-type="taskItem" data-checked="true/false">...
  md = md.replace(/<li[^>]*data-type="taskItem"[^>]*data-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/gi, (_m, checked, inner) => {
    const isChecked = checked === 'true';
    const text = inner.replace(/<label[\s\S]*?<\/label>/gi, '').replace(/<[^>]+>/g, '').trim();
    return `\n- [${isChecked ? 'x' : ' '}] ${text}\n`;
  });

  // 4. Checkbox inputs inside <li>: <li><input type="checkbox" checked?> text</li>
  md = md.replace(/<li[^>]*>[\s\S]*?<input[^>]*type="checkbox"([^>]*)>([\s\S]*?)<\/li>/gi, (_m, inputAttrs, text) => {
    const isChecked = /checked/i.test(inputAttrs);
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    return `\n- [${isChecked ? 'x' : ' '}] ${cleanText}\n`;
  });

  // 5. Headings: <h1> to <h6>
  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, text) => {
    const hashes = '#'.repeat(parseInt(level, 10));
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    return `\n\n${hashes} ${cleanText}\n\n`;
  });

  // 6. Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // 7. Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, text) => {
    const cleanLines = text.replace(/<[^>]+>/g, '').trim().split('\n');
    return '\n\n' + cleanLines.map((l: string) => `> ${l.trim()}`).join('\n') + '\n\n';
  });

  // 8. Bullet list items: <li>
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    return `\n- ${cleanText}\n`;
  });

  // 9. Paragraphs and divs: <p>, <div>
  md = md.replace(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/gi, (_m, text) => {
    return `\n\n${text.trim()}\n\n`;
  });

  // 10. Line breaks: <br>
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // 11. Images: <img ...>
  md = md.replace(/<img\b([^>]*)>/gi, (_m, attrs) => {
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch || !srcMatch[1]) return '';
    const src = srcMatch[1];
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    return `\n\n![${alt || 'image'}](${src})\n\n`;
  });

  // 12. Links: <a href="...">text</a>
  md = md.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    const cleanHref = href.trim();
    if (!cleanHref || cleanHref.startsWith('javascript:')) {
      return cleanText || '';
    }
    const linkText = cleanText ? cleanText : 'link';
    return `[${linkText}](${cleanHref})`;
  });

  // 13. Inline formatting
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<u>([\s\S]*?)<\/u>/gi, '_$1_');
  md = md.replace(/<(?:s|strike|del)[^>]*>([\s\S]*?)<\/(?:s|strike|del)>/gi, '~~$1~~');
  md = md.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, codeInner) => {
    const clean = codeInner
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    return `\`${clean.trim()}\``;
  });

  // 14. Strip any leftover HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // 15. Decode common HTML entities
  md = md
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // 16. Clean up excess whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  // Merge consecutive inline code lines (e.g. when each line of a code block was wrapped in its own `code`)
  md = md.replace(/(?:^|\n)(`[^`\n]+`(?:\n`[^`\n]+`)+)(?:\n|$)/g, (_match, group) => {
    const rawLines = group.split('\n');
    const unwrapped = rawLines.map((l: string) => l.trim().replace(/^`|`$/g, ''));
    return `\n\n\`\`\`\n${unwrapped.join('\n')}\n\`\`\`\n\n`;
  });

  // 17. Restore protected code blocks
  for (let idx = 0; idx < codeBlocks.length; idx++) {
    md = md.replace(new RegExp(`___KEEP_CODE_BLOCK_${idx}___`, 'g'), () => codeBlocks[idx].trim());
  }

  // Final cleanup of extra whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

/**
 * Escapes characters for HTML entities.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extracts plain text formatted title, checklist, and content for clipboard copying.
 */
export function extractNoteText(note: {
  title?: string;
  content?: string;
  isList?: boolean;
  todos?: { text: string; completed?: boolean }[];
}): string {
  const parts: string[] = [];

  const trimmedTitle = (note.title || '').trim();
  if (trimmedTitle) {
    parts.push(trimmedTitle);
  }

  // Checklist items
  if (note.isList && Array.isArray(note.todos) && note.todos.length > 0) {
    const todosText = note.todos
      .filter((t) => t.text && t.text.trim().length > 0)
      .map((t) => `${t.completed ? '[x]' : '[ ]'} ${t.text.trim()}`)
      .join('\n');
    if (todosText) {
      parts.push(todosText);
    }
  }

  // Content (converted from HTML to readable Markdown/text if needed)
  if (note.content && note.content.trim()) {
    const textContent = convertHtmlToMarkdown(note.content).trim();
    if (textContent) {
      parts.push(textContent);
    }
  }

  return parts.join('\n\n');
}

/**
 * Copies note title and content to clipboard (supports both rich HTML and plain text).
 */
export async function copyNoteToClipboard(note: {
  title?: string;
  content?: string;
  isList?: boolean;
  todos?: { text: string; completed?: boolean }[];
}): Promise<boolean> {
  const plainText = extractNoteText(note);
  if (!plainText) {
    return false;
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      if (typeof ClipboardItem !== 'undefined') {
        try {
          const htmlParts: string[] = [];
          if (note.title?.trim()) {
            htmlParts.push(`<h2>${escapeHtml(note.title.trim())}</h2>`);
          }
          if (note.isList && Array.isArray(note.todos) && note.todos.length > 0) {
            const listItems = note.todos
              .filter((t) => t.text && t.text.trim().length > 0)
              .map(
                (t) =>
                  `<li><input type="checkbox" ${t.completed ? 'checked' : ''} disabled /> ${escapeHtml(t.text.trim())}</li>`
              )
              .join('');
            if (listItems) {
              htmlParts.push(`<ul>${listItems}</ul>`);
            }
          }
          if (note.content?.trim()) {
            htmlParts.push(note.content.trim());
          }

          const richHtml = htmlParts.join('\n');
          const textBlob = new Blob([plainText], { type: 'text/plain' });
          const htmlBlob = new Blob([richHtml], { type: 'text/html' });

          await navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': textBlob,
              'text/html': htmlBlob,
            }),
          ]);
          return true;
        } catch {
          await navigator.clipboard.writeText(plainText);
          return true;
        }
      } else {
        await navigator.clipboard.writeText(plainText);
        return true;
      }
    }
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }

  // Fallback for older browsers
  try {
    const textArea = document.createElement('textarea');
    textArea.value = plainText;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback execCommand copy failed:', err);
    return false;
  }
}
