/**
 * Utility to parse and render Markdown tables into beautiful semantic HTML tables
 */

function cleanCell(cell: string): string {
  return cell.replace(/&nbsp;/gi, ' ').trim();
}

/**
 * Checks if a line is a markdown table separator (e.g., |---|:---:|---:| or --- | ---)
 */
export function isTableSeparatorLine(line: string): boolean {
  const stripped = cleanCell(line.replace(/<[^>]+>/g, ''));
  if (!stripped.includes('-')) return false;

  let cells = stripped.split('|').map(cleanCell);
  if (cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  if (cells.length === 0) return false;

  return cells.every((c) => /^:?-+:?$/.test(c));
}

function parseAlignment(sep: string): string {
  const trimmed = cleanCell(sep.replace(/<[^>]+>/g, ''));
  const startsWithColon = trimmed.startsWith(':');
  const endsWithColon = trimmed.endsWith(':');

  if (startsWithColon && endsWithColon) {
    return 'text-center';
  }
  if (endsWithColon) {
    return 'text-right';
  }
  return 'text-left';
}

function splitRowCells(rowStr: string): string[] {
  let clean = cleanCell(rowStr);
  if (clean.startsWith('|')) clean = clean.substring(1);
  if (clean.endsWith('|')) clean = clean.substring(0, clean.length - 1);

  return clean.split('|').map(cleanCell);
}

/**
 * Formats inline markdown styling within table cells
 */
function formatCellContent(str: string): string {
  if (!str) return '&nbsp;';
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<u>$1</u>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:opacity-80">$1</a>');
}

/**
 * Formats a block of markdown table lines into an HTML table
 */
export function convertTableLinesToHtml(lines: string[]): string {
  if (lines.length < 2) return lines.join('\n');

  const headerCells = splitRowCells(lines[0]);
  const separatorCells = splitRowCells(lines[1].replace(/<[^>]+>/g, ''));

  if (headerCells.length === 0 || separatorCells.length === 0) {
    return lines.join('\n');
  }

  const alignments: string[] = separatorCells.map(parseAlignment);

  // Build thead
  let theadHtml = '<thead class="bg-black/5 dark:bg-white/5 border-b border-stone-200 dark:border-stone-700 font-semibold text-stone-850 dark:text-stone-200"><tr>';
  for (let i = 0; i < headerCells.length; i++) {
    const alignClass = alignments[i] || 'text-left';
    theadHtml += `<th class="px-3.5 py-2.5 font-semibold tracking-wide border-r border-stone-200/50 dark:border-stone-800 last:border-r-0 ${alignClass}">${formatCellContent(headerCells[i])}</th>`;
  }
  theadHtml += '</tr></thead>';

  // Build tbody
  let tbodyHtml = '<tbody class="divide-y divide-stone-200/60 dark:divide-stone-800/80">';
  for (let r = 2; r < lines.length; r++) {
    const rowCells = splitRowCells(lines[r]);
    // Skip empty lines that have no cells or pipes
    if (rowCells.length === 0 || (rowCells.length === 1 && rowCells[0] === '' && !lines[r].includes('|'))) continue;

    tbodyHtml += '<tr class="hover:bg-black/3 dark:hover:bg-white/3 transition-colors even:bg-black/[0.015] dark:even:bg-white/[0.015]">';
    for (let c = 0; c < headerCells.length; c++) {
      const cellContent = rowCells[c] ?? '';
      const alignClass = alignments[c] || 'text-left';
      tbodyHtml += `<td class="px-3.5 py-2 border-r border-stone-200/40 dark:border-stone-800/60 last:border-r-0 ${alignClass}">${formatCellContent(cellContent)}</td>`;
    }
    tbodyHtml += '</tr>';
  }
  tbodyHtml += '</tbody>';

  return `<div class="keep-table-wrapper my-3 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700/80 shadow-xs bg-white/80 dark:bg-stone-900/60 backdrop-blur-xs"><table class="keep-table w-full text-left border-collapse">${theadHtml}${tbodyHtml}</table></div>`;
}

/**
 * Formats a non-table line, recognizing headings (#, ##, ###, ####) and styling them
 */
export function formatNonTableContent(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '';

  // Check if it is a heading: # Title, ## Title, ### Title, #### Title
  // e.g. ### **Core Functional Comparison** or <p>### **Core Functional Comparison**</p>
  const pHeadingMatch = trimmed.match(/^<p[^>]*>(?:<strong>)?\s*(#{1,4})\s+([\s\S]*?)<\/p>$/i);
  if (pHeadingMatch) {
    const level = pHeadingMatch[1].length;
    const content = pHeadingMatch[2].replace(/<\/strong>$/, '').trim();
    return `<h${level}>${formatCellContent(content)}</h${level}>`;
  }

  const headingMatch = trimmed.match(/^(?:<strong>)?\s*(#{1,4})\s+(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = headingMatch[2].replace(/<\/strong>$/, '').trim();
    return `<h${level}>${formatCellContent(content)}</h${level}>`;
  }

  if (
    trimmed.startsWith('<div') ||
    trimmed.startsWith('<table') ||
    trimmed.startsWith('<h1') ||
    trimmed.startsWith('<h2') ||
    trimmed.startsWith('<h3') ||
    trimmed.startsWith('<h4') ||
    trimmed.startsWith('<p') ||
    trimmed.startsWith('<ul') ||
    trimmed.startsWith('<ol') ||
    trimmed.startsWith('<blockquote') ||
    trimmed.startsWith('<hr')
  ) {
    return trimmed;
  }

  return `<p>${formatCellContent(trimmed)}</p>`;
}

/**
 * Normalizes any markdown headings in HTML strings (e.g. <p>### Heading</p> or raw ### Heading)
 * into semantic <h1>-<h4> tags with inline markdown formatting.
 */
export function normalizeHtmlHeadings(html: string): string {
  if (!html) return '';
  return html
    .replace(/<p[^>]*>(?:<strong>)?\s*####\s+([\s\S]*?)<\/p>/gi, (_m, inner) => {
      const cleaned = inner.replace(/<\/strong>$/, '').trim();
      return `<h4>${formatCellContent(cleaned)}</h4>`;
    })
    .replace(/<p[^>]*>(?:<strong>)?\s*###\s+([\s\S]*?)<\/p>/gi, (_m, inner) => {
      const cleaned = inner.replace(/<\/strong>$/, '').trim();
      return `<h3>${formatCellContent(cleaned)}</h3>`;
    })
    .replace(/<p[^>]*>(?:<strong>)?\s*##\s+([\s\S]*?)<\/p>/gi, (_m, inner) => {
      const cleaned = inner.replace(/<\/strong>$/, '').trim();
      return `<h2>${formatCellContent(cleaned)}</h2>`;
    })
    .replace(/<p[^>]*>(?:<strong>)?\s*#\s+([\s\S]*?)<\/p>/gi, (_m, inner) => {
      const cleaned = inner.replace(/<\/strong>$/, '').trim();
      return `<h1>${formatCellContent(cleaned)}</h1>`;
    })
    .replace(/(?:^|\n)\s*(#{1,4})\s+([^\n<]+)(?:\n|$)/g, (_m, hashes, text) => {
      const level = hashes.length;
      return `\n<h${level}>${formatCellContent(text.trim())}</h${level}>\n`;
    });
}

/**
 * Helper to process an array of lines and turn any detected markdown tables into HTML tables
 */
function processTableInLines(lines: string[]): { result: string[]; hasTable: boolean } {
  const result: string[] = [];
  let i = 0;
  let hasTable = false;

  while (i < lines.length) {
    if (
      i + 1 < lines.length &&
      lines[i].includes('|') &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      hasTable = true;
      const tableLines = [lines[i], lines[i + 1]];
      i += 2;
      while (i < lines.length && (lines[i].includes('|') || isTableSeparatorLine(lines[i]))) {
        tableLines.push(lines[i]);
        i++;
      }
      result.push(convertTableLinesToHtml(tableLines));
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return { result, hasTable };
}

/**
 * Searches for and renders Markdown tables within HTML content or raw text
 */
export function renderMarkdownTablesInHtml(htmlOrText: string): string {
  if (!htmlOrText) return htmlOrText;
  if (!htmlOrText.includes('|')) return normalizeHtmlHeadings(htmlOrText);
  let processed = htmlOrText;

  // Case 1: Detect tables inside a paragraph separated by <br> tags (even with surrounding heading/text lines)
  processed = processed.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    if (!inner.includes('|')) return match;
    const rawLines = inner.split(/<br\s*\/?>/gi);
    const { result, hasTable } = processTableInLines(rawLines);
    if (!hasTable) return match;

    return result
      .map((item) => {
        const trimmed = item.trim();
        if (trimmed.startsWith('<div class="keep-table-wrapper"')) return trimmed;
        return formatNonTableContent(trimmed);
      })
      .filter(Boolean)
      .join('');
  });

  // Case 2: Adjacent <p> tags forming a table (typical output from rich text editors when typing tables line by line)
  const pBlockRegex = /(?:<p[^>]*>[\s\S]*?<\/p>\s*){2,}/gi;
  processed = processed.replace(pBlockRegex, (match) => {
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const lines: string[] = [];
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(match)) !== null) {
      lines.push(pMatch[1].trim());
    }

    const { result, hasTable } = processTableInLines(lines);
    if (!hasTable) return match;

    return result
      .map((item) => {
        const trimmed = item.trim();
        if (trimmed.startsWith('<div class="keep-table-wrapper"')) return trimmed;
        return formatNonTableContent(trimmed);
      })
      .filter(Boolean)
      .join('');
  });

  // Case 3: Raw multi-line Markdown tables (e.g. from plain markdown notes or text blocks)
  const lines = processed.split(/\r?\n/);
  const { result, hasTable } = processTableInLines(lines);
  if (hasTable) {
    processed = result
      .map((item) => {
        const trimmed = item.trim();
        if (trimmed.startsWith('<div class="keep-table-wrapper"')) return trimmed;
        return formatNonTableContent(trimmed);
      })
      .join('\n');
  }

  return normalizeHtmlHeadings(processed);
}
