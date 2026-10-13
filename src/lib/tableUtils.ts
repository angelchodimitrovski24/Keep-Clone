/**
 * Utility to parse and render Markdown tables into beautiful semantic HTML tables
 */

interface ColumnAlign {
  align: 'left' | 'center' | 'right';
  className: string;
}

function parseAlignment(sep: string): ColumnAlign {
  const trimmed = sep.trim();
  const startsWithColon = trimmed.startsWith(':');
  const endsWithColon = trimmed.endsWith(':');

  if (startsWithColon && endsWithColon) {
    return { align: 'center', className: 'text-center' };
  }
  if (endsWithColon) {
    return { align: 'right', className: 'text-right' };
  }
  return { align: 'left', className: 'text-left' };
}

function splitRowCells(rowStr: string): string[] {
  // Strip leading and trailing pipes if present
  let clean = rowStr.trim();
  if (clean.startsWith('|')) clean = clean.substring(1);
  if (clean.endsWith('|')) clean = clean.substring(0, clean.length - 1);

  // Split by pipe (handling simple escapes if needed)
  return clean.split('|').map((cell) => cell.trim());
}

/**
 * Checks if a line is a markdown table separator (e.g., |---|:---:|---:|)
 */
function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed);
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

  const alignments: ColumnAlign[] = separatorCells.map(parseAlignment);

  // Build thead
  let theadHtml = '<thead class="bg-black/5 dark:bg-white/5 border-b border-stone-200 dark:border-stone-700 font-semibold text-stone-800 dark:text-stone-200"><tr>';
  for (let i = 0; i < headerCells.length; i++) {
    const alignClass = alignments[i]?.className || 'text-left';
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
      const alignClass = alignments[c]?.className || 'text-left';
      tbodyHtml += `<td class="px-3.5 py-2 text-xs sm:text-sm border-r border-stone-200/40 dark:border-stone-800/60 last:border-r-0 ${alignClass}">${cellContent}</td>`;
    }
    tbodyHtml += '</tr>';
  }
  tbodyHtml += '</tbody>';

  return `<div class="keep-table-wrapper my-3 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700/80 shadow-xs bg-white/80 dark:bg-stone-900/60 backdrop-blur-xs"><table class="keep-table w-full text-left border-collapse">${theadHtml}${tbodyHtml}</table></div>`;
}

/**
 * Searches for and renders Markdown tables within HTML content (e.g. from Tiptap paragraphs or plain text)
 */
export function renderMarkdownTablesInHtml(htmlOrText: string): string {
  if (!htmlOrText || !htmlOrText.includes('|')) return htmlOrText;

  // Case 1: Detect tables wrapped inside HTML paragraph tags like:
  // <p>| a | b |</p><p>|---|---|</p><p>| 1 | 2 |</p>
  // or <p>| a | b |<br>|---|---|<br>| 1 | 2 |</p>
  let processed = htmlOrText;

  // Replace <br> or <br/> with newline inside paragraph blocks for table detection
  processed = processed.replace(/<p>([\s\S]*?)<\/p>/gi, (_match, inner) => {
    const lines = inner
      .split(/<br\s*\/?>/gi)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    // Check if lines form a table
    if (lines.length >= 2 && lines[0].includes('|') && isTableSeparatorLine(lines[1])) {
      return convertTableLinesToHtml(lines);
    }
    return `<p>${inner}</p>`;
  });

  // Case 2: Adjacent paragraphs each having a table row:
  // Regex to match consecutive <p>| ... |</p> blocks
  const consecutiveParagraphTableRegex = /(?:<p>\s*\|[\s\S]*?\|?\s*<\/p>\s*){2,}/gi;
  processed = processed.replace(consecutiveParagraphTableRegex, (match) => {
    // Extract row text from each <p>
    const rowLines: string[] = [];
    const pRegex = /<p>([\s\S]*?)<\/p>/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(match)) !== null) {
      const text = pMatch[1].replace(/<[^>]+>/g, '').trim();
      if (text) rowLines.push(text);
    }

    if (rowLines.length >= 2 && isTableSeparatorLine(rowLines[1])) {
      return convertTableLinesToHtml(rowLines);
    }
    return match;
  });

  // Case 3: Raw multi-line markdown tables:
  const rawTableRegex = /((?:^[ \t]*\|.+?\|[ \t]*\r?\n){2,}(?:^[ \t]*\|.+?\|[ \t]*(?:\r?\n|$))*)/gm;
  processed = processed.replace(rawTableRegex, (match) => {
    const lines = match.trim().split(/\r?\n/).map((l) => l.trim());
    if (lines.length >= 2 && isTableSeparatorLine(lines[1])) {
      return convertTableLinesToHtml(lines);
    }
    return match;
  });

  return processed;
}
