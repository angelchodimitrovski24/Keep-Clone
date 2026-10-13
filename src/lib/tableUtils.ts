/**
 * Utility to parse and render Markdown tables into beautiful semantic HTML tables
 */

interface ColumnAlign {
  align: 'left' | 'center' | 'right';
  className: string;
}

function cleanCell(cell: string): string {
  return cell.replace(/&nbsp;/gi, ' ').trim();
}

/**
 * Checks if a line is a markdown table separator (e.g., |---|:---:|---:| or --- | ---)
 */
export function isTableSeparatorLine(line: string): boolean {
  const trimmed = cleanCell(line);
  if (!trimmed.includes('-')) return false;

  let cells = trimmed.split('|').map(cleanCell);
  if (cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  if (cells.length === 0) return false;

  return cells.every((c) => /^:?-+:?$/.test(c));
}

function parseAlignment(sep: string): string {
  const trimmed = cleanCell(sep);
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
 * Formats a block of markdown table lines into an HTML table
 */
export function convertTableLinesToHtml(lines: string[]): string {
  if (lines.length < 2) return lines.join('\n');

  const headerCells = splitRowCells(lines[0]);
  const separatorCells = splitRowCells(lines[1]);

  if (headerCells.length === 0 || separatorCells.length === 0) {
    return lines.join('\n');
  }

  const alignments: string[] = separatorCells.map(parseAlignment);

  // Build thead
  let theadHtml = '<thead class="bg-black/5 dark:bg-white/5 border-b border-stone-200 dark:border-stone-700 font-semibold text-stone-850 dark:text-stone-200"><tr>';
  for (let i = 0; i < headerCells.length; i++) {
    const alignClass = alignments[i] || 'text-left';
    theadHtml += `<th class="px-3.5 py-2.5 font-semibold text-xs sm:text-sm tracking-wide border-r border-stone-200/50 dark:border-stone-800 last:border-r-0 ${alignClass}">${headerCells[i]}</th>`;
  }
  theadHtml += '</tr></thead>';

  // Build tbody
  let tbodyHtml = '<tbody class="divide-y divide-stone-200/60 dark:divide-stone-800/80">';
  for (let r = 2; r < lines.length; r++) {
    const rowCells = splitRowCells(lines[r]);
    if (rowCells.length === 0 || (rowCells.length === 1 && rowCells[0] === '')) continue;

    tbodyHtml += '<tr class="hover:bg-black/3 dark:hover:bg-white/3 transition-colors even:bg-black/[0.015] dark:even:bg-white/[0.015]">';
    for (let c = 0; c < headerCells.length; c++) {
      const cellContent = rowCells[c] ?? '';
      const alignClass = alignments[c] || 'text-left';
      tbodyHtml += `<td class="px-3.5 py-2 text-xs sm:text-sm border-r border-stone-200/40 dark:border-stone-800/60 last:border-r-0 ${alignClass}">${cellContent}</td>`;
    }
    tbodyHtml += '</tr>';
  }
  tbodyHtml += '</tbody>';

  return `<div class="keep-table-wrapper my-3 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700/80 shadow-xs bg-white/80 dark:bg-stone-900/60 backdrop-blur-xs"><table class="keep-table w-full text-left border-collapse">${theadHtml}${tbodyHtml}</table></div>`;
}

/**
 * Searches for and renders Markdown tables within HTML content or raw text
 */
export function renderMarkdownTablesInHtml(htmlOrText: string): string {
  if (!htmlOrText || !htmlOrText.includes('|')) return htmlOrText;
  let processed = htmlOrText;

  // Case 1: Detect tables inside a single paragraph separated by <br> tags:
  processed = processed.replace(/<p>([\s\S]*?)<\/p>/gi, (match, inner) => {
    if (!inner.includes('|')) return match;
    const lines = inner
      .split(/<br\s*\/?>/gi)
      .map((l: string) => l.replace(/<[^>]+>/g, '').trim())
      .filter((l: string) => l.length > 0);

    if (lines.length >= 2 && lines[0].includes('|') && isTableSeparatorLine(lines[1])) {
      return convertTableLinesToHtml(lines);
    }
    return match;
  });

  // Case 2: Adjacent <p> tags forming a table (typical output from rich text editors when typing tables line by line):
  const pBlockRegex = /(?:<p>[\s\S]*?<\/p>\s*){2,}/gi;
  processed = processed.replace(pBlockRegex, (match) => {
    const pRegex = /<p>([\s\S]*?)<\/p>/gi;
    const paragraphs: string[] = [];
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(match)) !== null) {
      paragraphs.push(pMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    let result = '';
    let i = 0;
    let foundAnyTable = false;

    while (i < paragraphs.length) {
      if (
        i + 1 < paragraphs.length &&
        paragraphs[i].includes('|') &&
        isTableSeparatorLine(paragraphs[i + 1])
      ) {
        foundAnyTable = true;
        const tableLines = [paragraphs[i], paragraphs[i + 1]];
        i += 2;
        // collect remaining table body rows
        while (i < paragraphs.length && (paragraphs[i].includes('|') || isTableSeparatorLine(paragraphs[i]))) {
          tableLines.push(paragraphs[i]);
          i++;
        }
        result += convertTableLinesToHtml(tableLines);
      } else {
        result += `<p>${paragraphs[i]}</p>`;
        i++;
      }
    }

    return foundAnyTable ? result : match;
  });

  // Case 3: Raw multi-line Markdown tables (e.g. from plain markdown notes or text blocks):
  const rawTableRegex = /((?:^[ \t]*\|?.+?\|[ \t]*\r?\n){1,}[ \t]*\|?\s*:?-+:?.*?(?:\r?\n)(?:[ \t]*\|?.+?\|[ \t]*(?:\r?\n|$))*)/gm;
  processed = processed.replace(rawTableRegex, (match) => {
    const lines = match
      .trim()
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    if (lines.length >= 2 && lines[0].includes('|') && isTableSeparatorLine(lines[1])) {
      return convertTableLinesToHtml(lines);
    }
    return match;
  });

  return processed;
}
