import { PATTERNS } from '$lib/constants/markdown.constants';
import { TableData } from '$lib/types/markdown';
import { StringBuilder } from './string-builder';

declare global {
  interface Window {
    copyTable?: (id: string) => void;
  }
}

export class TableProcessor {
  private sb = new StringBuilder();
  private widthCache = new Map<string, number[]>();

  parseTableData(content: string): TableData | null {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;

    const table = new TableData('');
    table.rawContent = content;

    const headerMatch = lines[0].match(PATTERNS.table.row);
    if (!headerMatch) return null;

    table.headers = headerMatch[1]
      .split('|')
      .map(h => h.trim())
      .filter(Boolean);

    if (lines[1] && PATTERNS.table.separator.test(lines[1])) {
      const alignmentCells = lines[1].split('|').slice(1, -1);
      table.alignments = alignmentCells.map(cell => {
        const t = cell.trim();
        if (t.startsWith(':') && t.endsWith(':')) return 'center';
        if (t.endsWith(':')) return 'right';
        if (t.startsWith(':')) return 'left';
        return null;
      });

      for (let i = 2; i < lines.length; i++) {
        const rowMatch = lines[i].match(PATTERNS.table.row);
        if (rowMatch) {
          const cells = rowMatch[1].split('|').map(c => c.trim());
          if (cells.length === table.headers.length) {
            table.rows.push(cells);
          }
        }
      }
    }

    table.isComplete = true;
    return table;
  }

  private getColumnWidths(table: TableData): number[] {
    const key = table.headers.join('|');
    let widths = this.widthCache.get(key);
    
    if (!widths) {
      widths = table.headers.map(h => h.length);
      const samples = Math.min(5, table.rows.length);
      
      for (let i = 0; i < samples; i++) {
        table.rows[i].forEach((cell, j) => {
          widths![j] = Math.max(widths![j], cell.length);
        });
      }
      
      widths = widths.map(w => Math.max(100, w * 8));
      this.widthCache.set(key, widths);
    }
    
    return widths;
  }

  renderTable(
    table: TableData,
    processInlineMarkdown: (text: string) => string,
    isStreaming = false
  ): string {
    if (!table.headers.length) return '';

    const alignClass = (a: string | null) => 
      a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';

    this.sb.clear();

    const willOverflow = isStreaming && table.headers.length > 4;
    
    // Generate table ID for copy functionality
    const tableId = `table-${Math.random().toString(36).substr(2, 9)}`;

    // Wrapper
    this.sb.append(
      `<div class="markdown-table-wrapper"${isStreaming ? ' data-streaming="true"' : ''}>`
    );

    // Container
    this.sb.append(`<div class="markdown-table-container"${willOverflow ? ' style="overflow-x:auto;"' : ''}>`);

    // Table
    const tableStyle = willOverflow ? ' style="table-layout:fixed;"' : '';
    this.sb.append(
      `<table id="${tableId}" class="markdown-table"${isStreaming ? ' data-streaming="true"' : ''}${tableStyle}>`
    );

    const colWidths = willOverflow ? this.getColumnWidths(table) : null;

    // Headers
    this.sb.append('<thead><tr>');
    for (let i = 0; i < table.headers.length; i++) {
      const align = table.alignments?.[i] || null;
      const width = colWidths ? ` style="min-width:${colWidths[i]}px"` : '';
      this.sb.append(
        `<th class="${alignClass(align)}"${width}>${processInlineMarkdown(table.headers[i])}</th>`
      );
    }
    this.sb.append('</tr></thead><tbody>');

    // Rows
    for (const row of table.rows) {
      this.sb.append('<tr>');
      for (let i = 0; i < row.length; i++) {
        const align = table.alignments?.[i] || null;
        this.sb.append(
          `<td class="${alignClass(align)}">${processInlineMarkdown(row[i])}</td>`
        );
      }
      this.sb.append('</tr>');
    }

    this.sb.append('</tbody></table></div>');
    
    // Copy button below table
    this.sb.append(
      `<button class="markdown-table-copy" onclick="copyTable('${tableId}')" title="Copy table">` +
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
      `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>` +
      `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>` +
      `</svg><span>Copy</span></button>`
    );
    
    this.sb.append('</div>');
    
    // Add copy function using modern Clipboard API
    if (typeof window !== 'undefined' && !window.copyTable) {
      window.copyTable = async function(id: string) {
        const table = document.getElementById(id) as HTMLTableElement;
        if (!table) return;
        
        try {
          // Get table text content
          const rows = Array.from(table.rows);
          const text = rows.map(row => 
            Array.from(row.cells).map(cell => cell.textContent || '').join('\t')
          ).join('\n');
          
          // Use modern Clipboard API
          await navigator.clipboard.writeText(text);
          
          // Show feedback
          const btn = table.closest('.markdown-table-wrapper')?.querySelector('.markdown-table-copy');
          if (btn) {
            btn.classList.add('copied');
            const span = btn.querySelector('span');
            if (span) {
              const originalText = span.textContent;
              span.textContent = 'Copied!';
              setTimeout(() => {
                btn.classList.remove('copied');
                span.textContent = originalText;
              }, 2000);
            }
          }
        } catch (err) {
          console.error('Copy failed:', err);
          // Fallback for older browsers
          const range = document.createRange();
          range.selectNode(table);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
          document.execCommand('copy');
          window.getSelection()?.removeAllRanges();
        }
      };
    }
    
    return this.sb.toString();
  }

  hasCompleteTableRow(tableLines: string[]): boolean {
    if (tableLines.length < 2) return false;

    const hasSeparator = tableLines.some(line => PATTERNS.table.separator.test(line));
    if (!hasSeparator) return false;

    for (let i = tableLines.length - 1; i >= 0; i--) {
      const line = tableLines[i].trim();
      if (line && PATTERNS.table.row.test(line)) {
        const cells = line.split('|').filter(Boolean);
        return cells.length > 1;
      }
    }

    return false;
  }

  clearCache(): void {
    this.widthCache.clear();
  }
}