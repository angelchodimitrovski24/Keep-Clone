import JSZip from 'jszip';
import { Note } from '@/types/note';

export interface ExcelExportColumnConfig {
  includeTitle?: boolean;
  includeLabels?: boolean;
  includeContent?: boolean;
  includeCategory?: boolean;
  includeCreatedAt?: boolean;
  includeUpdatedAt?: boolean;
}

export interface ExcelExportOptions {
  notes: Note[];
  fileName?: string;
  format?: 'xlsx' | 'csv';
  columns?: ExcelExportColumnConfig;
}

/**
 * Strips invalid XML characters (control characters < 0x20 except tab, LF, CR)
 */
function cleanXmlText(text: string): string {
  if (!text) return '';
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts note content (which may contain HTML, Markdown, or checklist items)
 * into clean, readable multi-line plain text for an Excel spreadsheet cell.
 */
export function cleanNoteContentForExcel(note: Note): string {
  const parts: string[] = [];

  // 1. Checklist items
  if (note.isList && note.todos && note.todos.length > 0) {
    const listLines = note.todos.map(
      (t) => `${t.completed ? '[x]' : '[ ]'} ${t.text || ''}`
    );
    parts.push(listLines.join('\n'));
  }

  // 2. Note body
  let body = note.content || '';
  if (body) {
    // If body contains HTML markup, convert block tags to line breaks
    if (/<[a-z][\s\S]*>/i.test(body)) {
      body = body
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '');
    }

    // Decode standard HTML entities
    body = body
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'");

    // Normalize consecutive blank lines
    body = body.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    if (body) {
      parts.push(body);
    }
  }

  return parts.join('\n\n').trim();
}

/**
 * Formats note labels as a clean comma-separated string
 */
export function formatNoteLabels(note: Note): string {
  if (!note.labels || note.labels.length === 0) return '';
  return note.labels.join(', ');
}

function formatDateStr(timestamp?: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Maps a column index (0, 1, 2, ...) to an Excel column letter ('A', 'B', 'C', ...)
 */
function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Generates a genuine OpenXML Microsoft Excel (.xlsx) file using JSZip
 */
export async function generateXlsxBlob(options: ExcelExportOptions): Promise<Blob> {
  const {
    notes,
    columns = {
      includeTitle: true,
      includeLabels: true,
      includeContent: true,
      includeCategory: false,
      includeCreatedAt: false,
      includeUpdatedAt: false,
    },
  } = options;

  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  // 3. xl/_rels/workbook.xml.rels
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. xl/workbook.xml
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Keep Notes" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  );

  // 5. xl/styles.xml (Amber styled header, clean borders, wrap text)
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><b/><name val="Calibri"/><sz val="11"/><color rgb="FFFFFFFF"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF59E0B"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <!-- 0: normal -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <!-- 1: header bold with amber fill -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: data row with top align and wrap text -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment vertical="top" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`
  );

  // 6. Build Columns definition & Header
  interface ColDef {
    header: string;
    width: number;
    getValue: (n: Note) => string;
  }

  const activeCols: ColDef[] = [];

  if (columns.includeTitle !== false) {
    activeCols.push({
      header: 'Note Title',
      width: 32,
      getValue: (n) => n.title || 'Untitled Note',
    });
  }

  if (columns.includeLabels !== false) {
    activeCols.push({
      header: 'Note Labels',
      width: 26,
      getValue: (n) => formatNoteLabels(n),
    });
  }

  if (columns.includeContent !== false) {
    activeCols.push({
      header: 'Note Content',
      width: 75,
      getValue: (n) => cleanNoteContentForExcel(n),
    });
  }

  if (columns.includeCategory) {
    activeCols.push({
      header: 'Category',
      width: 20,
      getValue: (n) => n.category || '',
    });
  }

  if (columns.includeCreatedAt) {
    activeCols.push({
      header: 'Created Date',
      width: 22,
      getValue: (n) => formatDateStr(n.createdAt),
    });
  }

  if (columns.includeUpdatedAt) {
    activeCols.push({
      header: 'Last Updated',
      width: 22,
      getValue: (n) => formatDateStr(n.updatedAt),
    });
  }

  // Column width XML
  const colsXml = activeCols
    .map(
      (c, idx) =>
        `<col min="${idx + 1}" max="${idx + 1}" width="${c.width}" customWidth="1"/>`
    )
    .join('');

  // Row 1: Headers
  const headerCells = activeCols
    .map((c, colIdx) => {
      const cellRef = `${getColumnLetter(colIdx)}1`;
      return `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${cleanXmlText(c.header)}</t></is></c>`;
    })
    .join('');

  const rowsXml: string[] = [
    `<row r="1" ht="28" customHeight="1">${headerCells}</row>`,
  ];

  // Data rows
  notes.forEach((note, rowIdx) => {
    const rowNum = rowIdx + 2;
    const cells = activeCols
      .map((col, colIdx) => {
        const cellRef = `${getColumnLetter(colIdx)}${rowNum}`;
        const val = col.getValue(note);
        const cleanVal = cleanXmlText(val).replace(/\n/g, '&#10;');
        return `<c r="${cellRef}" s="2" t="inlineStr"><is><t xml:space="preserve">${cleanVal}</t></is></c>`;
      })
      .join('');
    rowsXml.push(`<row r="${rowNum}">${cells}</row>`);
  });

  // 7. xl/worksheets/sheet1.xml
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    ${colsXml}
  </cols>
  <sheetData>
    ${rowsXml.join('\n')}
  </sheetData>
</worksheet>`;

  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates a clean UTF-8 CSV with BOM for universal spreadsheet compatibility
 */
export function generateCsvBlob(options: ExcelExportOptions): Blob {
  const {
    notes,
    columns = {
      includeTitle: true,
      includeLabels: true,
      includeContent: true,
      includeCategory: false,
      includeCreatedAt: false,
      includeUpdatedAt: false,
    },
  } = options;

  interface ColDef {
    header: string;
    getValue: (n: Note) => string;
  }

  const activeCols: ColDef[] = [];

  if (columns.includeTitle !== false) {
    activeCols.push({
      header: 'Note Title',
      getValue: (n) => n.title || 'Untitled Note',
    });
  }

  if (columns.includeLabels !== false) {
    activeCols.push({
      header: 'Note Labels',
      getValue: (n) => formatNoteLabels(n),
    });
  }

  if (columns.includeContent !== false) {
    activeCols.push({
      header: 'Note Content',
      getValue: (n) => cleanNoteContentForExcel(n),
    });
  }

  if (columns.includeCategory) {
    activeCols.push({
      header: 'Category',
      getValue: (n) => n.category || '',
    });
  }

  if (columns.includeCreatedAt) {
    activeCols.push({
      header: 'Created Date',
      getValue: (n) => formatDateStr(n.createdAt),
    });
  }

  if (columns.includeUpdatedAt) {
    activeCols.push({
      header: 'Last Updated',
      getValue: (n) => formatDateStr(n.updatedAt),
    });
  }

  const csvRows: string[] = [];

  // Header row
  csvRows.push(
    activeCols.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',')
  );

  // Data rows
  for (const note of notes) {
    const row = activeCols
      .map((c) => {
        const val = c.getValue(note);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',');
    csvRows.push(row);
  }

  // UTF-8 BOM prefix (\uFEFF) ensures Excel opens special characters and accents cleanly
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
}

/**
 * Triggers a browser download for a Blob
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
