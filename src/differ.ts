/**
 * Myers diff algorithm implementation
 * Computes the shortest edit script (SES) between two sequences
 */

export interface DiffChange {
  type: 'add' | 'remove' | 'equal';
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface FileDiff {
  oldFile: string;
  newFile: string;
  changes: DiffChange[];
  stats: { added: number; removed: number; equal: number };
}

export function myersDiff(oldLines: string[], newLines: string[]): DiffChange[] {
  const N = oldLines.length;
  const M = newLines.length;
  const MAX = N + M;

  if (MAX === 0) return [];

  // Optimization: if one side is empty
  if (N === 0) {
    return newLines.map((line, i) => ({ type: 'add' as const, newLine: i + 1, content: line }));
  }
  if (M === 0) {
    return oldLines.map((line, i) => ({ type: 'remove' as const, oldLine: i + 1, content: line }));
  }

  // Myers algorithm - find shortest edit script
  const vSize = 2 * MAX + 1;
  const v: number[] = new Array(vSize).fill(0);
  const trace: number[][] = [];

  // Forward pass - find length of SES
  let sesLength = -1;
  outer:
  for (let d = 0; d <= MAX; d++) {
    const vCopy = v.slice();
    trace.push(vCopy);

    for (let k = -d; k <= d; k += 2) {
      const kIdx = k + MAX;
      let x: number;

      if (k === -d || (k !== d && v[kIdx - 1] < v[kIdx + 1])) {
        x = v[kIdx + 1]; // move down (insert)
      } else {
        x = v[kIdx - 1] + 1; // move right (delete)
      }

      let y = x - k;

      // Follow diagonal (equal lines)
      while (x < N && y < M && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }

      v[kIdx] = x;

      if (x >= N && y >= M) {
        sesLength = d;
        break outer;
      }
    }
  }

  if (sesLength === -1) sesLength = MAX;

  // Backtrack to find the actual edit script
  let x = N;
  let y = M;
  const edits: DiffChange[] = [];

  for (let d = sesLength; d > 0; d--) {
    const vPrev = trace[d - 1];
    const k = x - y;
    const kIdx = k + MAX;

    let prevK: number;
    if (k === -d || (k !== d && vPrev[kIdx - 1] < vPrev[kIdx + 1])) {
      prevK = k + 1; // came from down (insert)
    } else {
      prevK = k - 1; // came from right (delete)
    }

    let prevX = vPrev[prevK + MAX];
    let prevY = prevX - prevK;

    // Diagonal moves (equal lines)
    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: 'equal', oldLine: x + 1, newLine: y + 1, content: oldLines[x] });
    }

    if (d > 0) {
      if (x === prevX) {
        // Insert
        y--;
        edits.unshift({ type: 'add', newLine: y + 1, content: newLines[y] });
      } else {
        // Delete
        x--;
        edits.unshift({ type: 'remove', oldLine: x + 1, content: oldLines[x] });
      }
    }
  }

  // Remaining diagonal at the start
  while (x > 0 && y > 0) {
    x--;
    y--;
    edits.unshift({ type: 'equal', oldLine: x + 1, newLine: y + 1, content: oldLines[x] });
  }

  return edits;
}

export function diffFiles(oldContent: string, newContent: string, oldFile: string, newFile: string): FileDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const changes = myersDiff(oldLines, newLines);

  let added = 0, removed = 0, equal = 0;
  for (const c of changes) {
    if (c.type === 'add') added++;
    else if (c.type === 'remove') removed++;
    else equal++;
  }

  return { oldFile, newFile, changes, stats: { added, removed, equal } };
}

export function diffWithContext(diff: FileDiff, contextLines: number): DiffChange[][] {
  const { changes } = diff;
  if (changes.length === 0) return [];

  const hunks: DiffChange[][] = [];
  let currentHunk: DiffChange[] = [];
  let lastChangeIdx = -1;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change.type !== 'equal') {
      // Find context before this change
      const contextStart = Math.max(lastChangeIdx + 1, i - contextLines);
      for (let j = contextStart; j < i; j++) {
        if (!currentHunk.includes(changes[j])) {
          currentHunk.push(changes[j]);
        }
      }
      currentHunk.push(change);
      lastChangeIdx = i;

      // Look ahead for context after
      const contextEnd = Math.min(changes.length, i + contextLines + 1);
      let nextChangeIdx = changes.length;
      for (let j = i + 1; j < changes.length; j++) {
        if (changes[j].type !== 'equal') {
          nextChangeIdx = j;
          break;
        }
      }

      // If next change is within 2*context, merge hunks
      if (nextChangeIdx - i <= 2 * contextLines + 1) {
        for (let j = i + 1; j < nextChangeIdx; j++) {
          if (!currentHunk.includes(changes[j])) {
            currentHunk.push(changes[j]);
          }
        }
      } else {
        // Add trailing context and close hunk
        for (let j = i + 1; j < contextEnd; j++) {
          if (changes[j] && !currentHunk.includes(changes[j])) {
            currentHunk.push(changes[j]);
          }
        }
        if (currentHunk.length > 0) {
          hunks.push(currentHunk);
          currentHunk = [];
        }
      }
    }
  }

  if (currentHunk.length > 0) {
    hunks.push(currentHunk);
  }

  return hunks;
}
