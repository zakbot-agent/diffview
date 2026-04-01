/**
 * Git integration: parse git diff output and convert to FileDiff
 */

import { execSync } from 'child_process';
import { FileDiff, diffFiles } from './differ';

export function getGitDiff(ref?: string): FileDiff[] {
  const cmd = ref ? `git diff ${ref}` : `git diff`;
  let raw = '';
  try {
    raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch (e: any) {
    if (e.stderr) {
      process.stderr.write(`Error running git diff: ${e.stderr}\n`);
    }
    process.exit(1);
  }

  if (!raw.trim()) {
    console.log('No changes detected.');
    return [];
  }

  return parseGitDiff(raw);
}

interface RawFileDiff {
  oldFile: string;
  newFile: string;
  oldContent: string[];
  newContent: string[];
}

function parseGitDiff(raw: string): FileDiff[] {
  const fileDiffs: FileDiff[] = [];
  const fileBlocks = raw.split(/^diff --git /m).filter(Boolean);

  for (const block of fileBlocks) {
    const lines = block.split('\n');
    let oldFile = 'unknown';
    let newFile = 'unknown';

    // Parse header
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (headerMatch) {
      oldFile = headerMatch[1];
      newFile = headerMatch[2];
    }

    // Extract old and new content from hunks
    const oldLines: string[] = [];
    const newLines: string[] = [];
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;
      if (line.startsWith('diff --git')) break;

      if (line.startsWith('-')) {
        oldLines.push(line.substring(1));
      } else if (line.startsWith('+')) {
        newLines.push(line.substring(1));
      } else if (line.startsWith(' ')) {
        oldLines.push(line.substring(1));
        newLines.push(line.substring(1));
      } else if (line === '\\ No newline at end of file') {
        continue;
      }
    }

    const fileDiff = diffFiles(
      oldLines.join('\n'),
      newLines.join('\n'),
      `a/${oldFile}`,
      `b/${newFile}`
    );
    fileDiffs.push(fileDiff);
  }

  return fileDiffs;
}
