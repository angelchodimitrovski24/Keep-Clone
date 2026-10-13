import { renderMarkdownTablesInHtml } from './tableUtils';

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
    trimmed.startsWith('/api/')
  ) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  let folder = '';
  let file = normalized;

  if (lastSlash !== -1) {
    folder = normalized.substring(0, lastSlash);
    file = normalized.substring(lastSlash + 1);
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
    return `<div class="my-2"><p class="text-xs font-mono text-stone-400 select-all my-0.5">![${displayAlt}](${rawPath})</p><img src="${serveUrl}" alt="${displayAlt}" class="rounded-xl max-h-96 w-auto my-1 border border-black/10 dark:border-white/10" loading="lazy" /></div>`;
  });
}

/**
 * Converts Markdown string or plain text to standard Google Keep HTML for Tiptap
 */
export function convertMarkdownToHtml(content: string): string {
  if (!content) return '';
  // If already HTML, also ensure any embedded markdown images and tables get rendered
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return renderMarkdownTablesInHtml(renderMarkdownImagesInString(content));
  }

  const lines = content.split('\n');
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
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<u>$1</u>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:opacity-80">$1</a>');
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Fenced Code Block delimiters: ``` or ```lang
    if (trimmed.startsWith('```')) {
      closeOpenLists();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = trimmed.substring(3).trim();
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
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      closeOpenLists();
      continue;
    }

    // 2. Task List item: - [ ] or - [x] or [ ] or [x]
    const taskMatch = rawLine.match(/^\s*(?:[-*+]\s+)?\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      if (inBulletList) { result += '</ul>'; inBulletList = false; }
      if (inNumberList) { result += '</ol>'; inNumberList = false; }
      if (!inTaskList) {
        result += '<ul data-type="taskList">';
        inTaskList = true;
      }
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const itemText = formatInline(taskMatch[2]);
      result += `<li data-type="taskItem" data-checked="${isChecked}"><label><input type="checkbox"${isChecked ? ' checked="checked"' : ''}><span></span></label><div><p>${itemText}</p></div></li>`;
      continue;
    }

    // 3. Headings: #, ##, ###, ####
    const h1Match = rawLine.match(/^#\s+(.*)$/);
    if (h1Match) {
      closeOpenLists();
      result += `<h1>${formatInline(h1Match[1])}</h1>`;
      continue;
    }
    const h2Match = rawLine.match(/^##\s+(.*)$/);
    if (h2Match) {
      closeOpenLists();
      result += `<h2>${formatInline(h2Match[1])}</h2>`;
      continue;
    }
    const h3Match = rawLine.match(/^###\s+(.*)$/);
    if (h3Match) {
      closeOpenLists();
      result += `<h3>${formatInline(h3Match[1])}</h3>`;
      continue;
    }
    const h4Match = rawLine.match(/^####\s+(.*)$/);
    if (h4Match) {
      closeOpenLists();
      result += `<h4>${formatInline(h4Match[1])}</h4>`;
      continue;
    }

    // 4. Blockquotes: > quote
    const bqMatch = rawLine.match(/^\s*>\s*(.*)$/);
    if (bqMatch) {
      closeOpenLists();
      result += `<blockquote><p>${formatInline(bqMatch[1])}</p></blockquote>`;
      continue;
    }

    // 5. Horizontal rules: --- or *** or ___
    if (/^([-*_]){3,}$/.test(trimmed)) {
      closeOpenLists();
      result += `<hr />`;
      continue;
    }

    // 6. Bullet list: - or *
    const bulletMatch = rawLine.match(/^\s*[-*+]\s+(.*)$/);
    if (bulletMatch) {
      if (inTaskList) { result += '</ul>'; inTaskList = false; }
      if (inNumberList) { result += '</ol>'; inNumberList = false; }
      if (!inBulletList) {
        result += '<ul>';
        inBulletList = true;
      }
      result += `<li><p>${formatInline(bulletMatch[1])}</p></li>`;
      continue;
    }

    // 7. Number list: 1.
    const numberMatch = rawLine.match(/^\s*\d+\.\s+(.*)$/);
    if (numberMatch) {
      if (inTaskList) { result += '</ul>'; inTaskList = false; }
      if (inBulletList) { result += '</ul>'; inBulletList = false; }
      if (!inNumberList) {
        result += '<ol>';
        inNumberList = true;
      }
      result += `<li><p>${formatInline(numberMatch[1])}</p></li>`;
      continue;
    }

    // 8. Markdown Image line: ![alt](path)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      closeOpenLists();
      const fileName = imgMatch[1] || 'image';
      const rawPath = imgMatch[2];
      const serveUrl = resolveLocalMediaUrl(rawPath);
      result += `<div class="my-2"><p class="text-xs font-mono text-stone-400 select-all my-0.5">![${fileName}](${rawPath})</p><img src="${serveUrl}" alt="${fileName}" class="rounded-xl max-h-96 w-auto my-1 border border-black/10 dark:border-white/10" loading="lazy" /></div>`;
      continue;
    }

    // 9. Normal paragraph
    closeOpenLists();
    result += `<p>${formatInline(rawLine)}</p>`;
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
  return renderMarkdownTablesInHtml(result);
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

