/**
 * Output formatters: terminal (unified + side-by-side), HTML, JSON
 */

import { DiffChange, FileDiff, diffWithContext } from './differ';

// ANSI color codes
const RED = '\x1b[41m\x1b[37m';
const GREEN = '\x1b[42m\x1b[30m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const RED_FG = '\x1b[31m';
const GREEN_FG = '\x1b[32m';
const CYAN = '\x1b[36m';

export function formatUnified(diff: FileDiff, contextLines: number): string {
  const lines: string[] = [];
  lines.push(`${BOLD}--- ${diff.oldFile}${RESET}`);
  lines.push(`${BOLD}+++ ${diff.newFile}${RESET}`);

  const hunks = diffWithContext(diff, contextLines);

  for (const hunk of hunks) {
    if (hunk.length === 0) continue;

    // Compute hunk header
    let oldStart = Infinity, oldCount = 0, newStart = Infinity, newCount = 0;
    for (const c of hunk) {
      if (c.type === 'remove' || c.type === 'equal') {
        if (c.oldLine !== undefined && c.oldLine < oldStart) oldStart = c.oldLine;
        oldCount++;
      }
      if (c.type === 'add' || c.type === 'equal') {
        if (c.newLine !== undefined && c.newLine < newStart) newStart = c.newLine;
        newCount++;
      }
    }
    if (oldStart === Infinity) oldStart = 1;
    if (newStart === Infinity) newStart = 1;

    lines.push(`${CYAN}@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${RESET}`);

    for (const change of hunk) {
      if (change.type === 'add') {
        lines.push(`${GREEN}+${change.content}${RESET}`);
      } else if (change.type === 'remove') {
        lines.push(`${RED_FG}-${change.content}${RESET}`);
      } else {
        lines.push(`${GRAY} ${change.content}${RESET}`);
      }
    }
  }

  return lines.join('\n');
}

export function formatSideBySide(diff: FileDiff, contextLines: number, termWidth?: number): string {
  const width = termWidth || (process.stdout.columns || 120);
  const colWidth = Math.floor((width - 3) / 2); // -3 for separator " | "
  const numWidth = 4;
  const contentWidth = colWidth - numWidth - 2; // -2 for padding

  const lines: string[] = [];
  const sep = `${GRAY}|${RESET}`;

  // Header
  const leftHeader = padRight(diff.oldFile, colWidth);
  const rightHeader = padRight(diff.newFile, colWidth);
  lines.push(`${BOLD}${leftHeader}${RESET} ${sep} ${BOLD}${rightHeader}${RESET}`);
  lines.push(`${GRAY}${'─'.repeat(colWidth)} | ${'─'.repeat(colWidth)}${RESET}`);

  const hunks = diffWithContext(diff, contextLines);

  for (const hunk of hunks) {
    // Group changes: pair removes with adds for side-by-side
    const paired = pairChanges(hunk);

    for (const [left, right] of paired) {
      const leftNum = left?.oldLine?.toString().padStart(numWidth) || '    ';
      const rightNum = right?.newLine?.toString().padStart(numWidth) || '    ';

      let leftContent = left ? truncate(left.content, contentWidth) : '';
      let rightContent = right ? truncate(right.content, contentWidth) : '';

      leftContent = padRight(leftContent, contentWidth);
      rightContent = padRight(rightContent, contentWidth);

      if (left?.type === 'remove') {
        lines.push(`${RED}${leftNum}  ${leftContent}${RESET} ${sep} ${right ? formatRight(right, rightNum, contentWidth) : padRight('', colWidth)}`);
      } else if (left?.type === 'equal') {
        lines.push(`${GRAY}${leftNum}  ${leftContent}${RESET} ${sep} ${GRAY}${rightNum}  ${rightContent}${RESET}`);
      } else if (!left && right) {
        lines.push(`${padRight('', colWidth)} ${sep} ${formatRight(right, rightNum, contentWidth)}`);
      }
    }

    lines.push(`${GRAY}${'─'.repeat(colWidth)} | ${'─'.repeat(colWidth)}${RESET}`);
  }

  return lines.join('\n');
}

function formatRight(change: DiffChange, num: string, width: number): string {
  const content = padRight(truncate(change.content, width), width);
  if (change.type === 'add') return `${GREEN}${num}  ${content}${RESET}`;
  if (change.type === 'equal') return `${GRAY}${num}  ${content}${RESET}`;
  return `${num}  ${content}`;
}

function pairChanges(hunk: DiffChange[]): [DiffChange | null, DiffChange | null][] {
  const result: [DiffChange | null, DiffChange | null][] = [];
  const removes: DiffChange[] = [];
  const adds: DiffChange[] = [];

  for (const change of hunk) {
    if (change.type === 'equal') {
      // Flush pending removes/adds
      flushPairs(removes, adds, result);
      result.push([change, change]);
    } else if (change.type === 'remove') {
      removes.push(change);
    } else {
      adds.push(change);
    }
  }

  flushPairs(removes, adds, result);
  return result;
}

function flushPairs(removes: DiffChange[], adds: DiffChange[], result: [DiffChange | null, DiffChange | null][]) {
  const max = Math.max(removes.length, adds.length);
  for (let i = 0; i < max; i++) {
    result.push([removes[i] || null, adds[i] || null]);
  }
  removes.length = 0;
  adds.length = 0;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

export function formatStats(diffs: FileDiff[]): string {
  const lines: string[] = [];
  let totalAdded = 0, totalRemoved = 0, totalFiles = 0;

  for (const diff of diffs) {
    if (diff.stats.added > 0 || diff.stats.removed > 0) {
      totalFiles++;
      totalAdded += diff.stats.added;
      totalRemoved += diff.stats.removed;
      const bar = makeBar(diff.stats.added, diff.stats.removed, 30);
      lines.push(` ${diff.oldFile === diff.newFile ? diff.oldFile : `${diff.oldFile} → ${diff.newFile}`} | ${diff.stats.added + diff.stats.removed} ${bar}`);
    }
  }

  lines.push('');
  lines.push(` ${totalFiles} file${totalFiles !== 1 ? 's' : ''} changed, ${GREEN_FG}${totalAdded} insertions(+)${RESET}, ${RED_FG}${totalRemoved} deletions(-)${RESET}`);
  return lines.join('\n');
}

function makeBar(added: number, removed: number, maxWidth: number): string {
  const total = added + removed;
  if (total === 0) return '';
  const addLen = Math.max(1, Math.round((added / total) * Math.min(total, maxWidth)));
  const remLen = Math.max(1, Math.round((removed / total) * Math.min(total, maxWidth)));
  return `${GREEN_FG}${'+'.repeat(addLen)}${RESET}${RED_FG}${'-'.repeat(remLen)}${RESET}`;
}

// HTML output
export function formatHTML(diffs: FileDiff[], contextLines: number): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DiffView</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 13px; background: #0d1117; color: #c9d1d9; }
  .file-header { background: #161b22; padding: 10px 16px; border-bottom: 1px solid #30363d; font-weight: bold; color: #f0f6fc; }
  .diff-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .diff-table td { padding: 1px 10px; white-space: pre-wrap; word-break: break-all; vertical-align: top; }
  .line-num { width: 50px; text-align: right; color: #484f58; user-select: none; border-right: 1px solid #30363d; }
  .line-add { background: rgba(63, 185, 80, 0.15); }
  .line-add .line-content { color: #3fb950; }
  .line-remove { background: rgba(248, 81, 73, 0.15); }
  .line-remove .line-content { color: #f85149; }
  .line-equal { background: transparent; }
  .line-equal .line-content { color: #8b949e; }
  .hunk-header { background: #1c2128; color: #79c0ff; padding: 4px 10px; }
  .stats { padding: 16px; background: #161b22; border-top: 1px solid #30363d; margin-top: 16px; }
  .stats .added { color: #3fb950; }
  .stats .removed { color: #f85149; }
  .prefix { user-select: none; display: inline-block; width: 12px; }
</style>
</head>
<body>
`;

  for (const diff of diffs) {
    html += `<div class="file-header">--- ${escapeHtml(diff.oldFile)} → +++ ${escapeHtml(diff.newFile)}</div>\n`;
    html += `<table class="diff-table">\n`;

    const hunks = diffWithContext(diff, contextLines);
    for (const hunk of hunks) {
      if (hunk.length === 0) continue;

      let oldStart = Infinity, oldCount = 0, newStart = Infinity, newCount = 0;
      for (const c of hunk) {
        if (c.type === 'remove' || c.type === 'equal') {
          if (c.oldLine !== undefined && c.oldLine < oldStart) oldStart = c.oldLine;
          oldCount++;
        }
        if (c.type === 'add' || c.type === 'equal') {
          if (c.newLine !== undefined && c.newLine < newStart) newStart = c.newLine;
          newCount++;
        }
      }
      if (oldStart === Infinity) oldStart = 1;
      if (newStart === Infinity) newStart = 1;

      html += `<tr><td colspan="4" class="hunk-header">@@ -${oldStart},${oldCount} +${newStart},${newCount} @@</td></tr>\n`;

      for (const change of hunk) {
        const cls = change.type === 'add' ? 'line-add' : change.type === 'remove' ? 'line-remove' : 'line-equal';
        const prefix = change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' ';
        const oldNum = change.oldLine ?? '';
        const newNum = change.newLine ?? '';
        html += `<tr class="${cls}"><td class="line-num">${oldNum}</td><td class="line-num">${newNum}</td><td class="line-content"><span class="prefix">${prefix}</span>${escapeHtml(change.content)}</td></tr>\n`;
      }
    }

    html += `</table>\n`;
  }

  // Stats
  let totalAdded = 0, totalRemoved = 0;
  for (const d of diffs) { totalAdded += d.stats.added; totalRemoved += d.stats.removed; }
  html += `<div class="stats">${diffs.length} file(s) | <span class="added">+${totalAdded}</span> <span class="removed">-${totalRemoved}</span></div>`;

  html += `</body></html>`;
  return html;
}

export function formatJSON(diffs: FileDiff[]): string {
  const output = diffs.map(d => ({
    oldFile: d.oldFile,
    newFile: d.newFile,
    stats: d.stats,
    changes: d.changes.map(c => ({
      type: c.type,
      oldLine: c.oldLine ?? null,
      newLine: c.newLine ?? null,
      content: c.content,
    })),
  }));
  return JSON.stringify(output, null, 2);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
