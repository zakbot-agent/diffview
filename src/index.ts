#!/usr/bin/env node

/**
 * DiffView CLI - Beautiful side-by-side diff viewer
 */

import * as fs from 'fs';
import * as path from 'path';
import { diffFiles, FileDiff } from './differ';
import { formatUnified, formatSideBySide, formatStats, formatHTML, formatJSON } from './formatter';
import { getGitDiff } from './git';
import { startServer } from './server';

interface Options {
  side: boolean;
  unified: boolean;
  html: boolean;
  json: boolean;
  serve: boolean;
  git: boolean;
  gitRef?: string;
  output?: string;
  context: number;
  stats: boolean;
  files: string[];
}

function parseArgs(args: string[]): Options {
  const opts: Options = {
    side: false,
    unified: true,
    html: false,
    json: false,
    serve: false,
    git: false,
    context: 3,
    stats: false,
    files: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case '--side':
      case '-s':
        opts.side = true;
        opts.unified = false;
        break;
      case '--unified':
      case '-u':
        opts.unified = true;
        opts.side = false;
        break;
      case '--html':
        opts.html = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--serve':
        opts.serve = true;
        break;
      case '--git':
      case '-g':
        opts.git = true;
        // Check if next arg is a ref (not a flag)
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          opts.gitRef = args[i + 1];
          i++;
        }
        break;
      case '-o':
      case '--output':
        if (i + 1 < args.length) {
          opts.output = args[i + 1];
          i++;
        }
        break;
      case '--context':
      case '-c':
        if (i + 1 < args.length) {
          opts.context = parseInt(args[i + 1], 10) || 3;
          i++;
        }
        break;
      case '--stats':
        opts.stats = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-')) {
          opts.files.push(arg);
        }
        break;
    }
    i++;
  }

  return opts;
}

function printHelp(): void {
  console.log(`
  ${'\x1b[1m'}diffview${'\x1b[0m'} - Beautiful diff viewer for terminal & browser

  ${'\x1b[1m'}USAGE${'\x1b[0m'}
    diffview <file1> <file2> [options]
    diffview <dir1> <dir2> [options]
    diffview --git [ref] [options]
    diffview --serve

  ${'\x1b[1m'}OPTIONS${'\x1b[0m'}
    --unified, -u     Unified diff view (default)
    --side, -s        Side-by-side diff view
    --html            Export as HTML
    --json            Output as JSON
    --serve           Start web UI on port 3473
    --git, -g [ref]   Show git diff (optionally against ref)
    --context, -c N   Lines of context (default: 3)
    --stats           Show summary statistics
    -o, --output FILE Write output to file
    -h, --help        Show this help
  `);
}

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Error: cannot read file "${filePath}"`);
    process.exit(1);
    return ''; // unreachable, satisfies TS
  }
}

function compareDirs(dir1: string, dir2: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  const files1 = getFilesRecursive(dir1);
  const files2 = getFilesRecursive(dir2);
  const allFiles = new Set([...files1, ...files2]);

  for (const file of [...allFiles].sort()) {
    const path1 = path.join(dir1, file);
    const path2 = path.join(dir2, file);
    const content1 = fs.existsSync(path1) ? fs.readFileSync(path1, 'utf-8') : '';
    const content2 = fs.existsSync(path2) ? fs.readFileSync(path2, 'utf-8') : '';

    if (content1 !== content2) {
      diffs.push(diffFiles(content1, content2, path.join(dir1, file), path.join(dir2, file)));
    }
  }

  return diffs;
}

function getFilesRecursive(dir: string, base: string = ''): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...getFilesRecursive(path.join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

function writeOutput(content: string, outputPath?: string): void {
  if (outputPath) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`Output written to ${outputPath}`);
  } else {
    process.stdout.write(content + '\n');
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const opts = parseArgs(args);

  // Web UI mode
  if (opts.serve) {
    startServer();
    return;
  }

  // Git mode
  if (opts.git) {
    const diffs = getGitDiff(opts.gitRef);
    if (diffs.length === 0) return;
    outputDiffs(diffs, opts);
    return;
  }

  // File/directory comparison
  if (opts.files.length < 2) {
    console.error('Error: two files or directories required');
    process.exit(1);
  }

  const [path1, path2] = opts.files;
  const stat1 = fs.statSync(path1, { throwIfNoEntry: false });
  const stat2 = fs.statSync(path2, { throwIfNoEntry: false });

  if (!stat1) {
    console.error(`Error: "${path1}" not found`);
    process.exit(1);
  }
  if (!stat2) {
    console.error(`Error: "${path2}" not found`);
    process.exit(1);
  }

  let diffs: FileDiff[] = [];

  if (stat1.isDirectory() && stat2.isDirectory()) {
    diffs = compareDirs(path1, path2);
    if (diffs.length === 0) {
      console.log('No differences found.');
      return;
    }
  } else if (stat1.isFile() && stat2.isFile()) {
    const content1 = readFile(path1);
    const content2 = readFile(path2);
    diffs = [diffFiles(content1, content2, path1, path2)];
  } else {
    console.error('Error: cannot compare a file with a directory');
    process.exit(1);
  }

  outputDiffs(diffs, opts);
}

function outputDiffs(diffs: FileDiff[], opts: Options): void {
  if (opts.json) {
    writeOutput(formatJSON(diffs), opts.output);
    return;
  }

  if (opts.html) {
    const html = formatHTML(diffs, opts.context);
    writeOutput(html, opts.output || undefined);
    return;
  }

  for (const diff of diffs) {
    if (opts.side) {
      writeOutput(formatSideBySide(diff, opts.context));
    } else {
      writeOutput(formatUnified(diff, opts.context));
    }
  }

  if (opts.stats) {
    console.log('');
    console.log(formatStats(diffs));
  }
}

main();
