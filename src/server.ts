/**
 * Web UI server: paste two texts, see real-time diff
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { diffFiles } from './differ';
import { formatHTML, formatJSON } from './formatter';

const PORT = 3473;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export function startServer(): void {
  const publicDir = path.join(__dirname, '..', 'public');

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/diff') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { oldText, newText, oldName, newName } = JSON.parse(body);
          const diff = diffFiles(oldText || '', newText || '', oldName || 'old', newName || 'new');
          const html = formatHTML([diff], 3);
          const json = {
            html,
            stats: diff.stats,
            json: JSON.parse(formatJSON([diff])),
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(json));
        } catch (e: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Static file serving
    let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';
    filePath = path.join(publicDir, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(PORT, () => {
    console.log(`DiffView web UI running at http://localhost:${PORT}`);
  });
}
