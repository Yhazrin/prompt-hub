import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import next from 'next';
import { loadData } from './lib/database.mjs';
import { startSyncScheduler } from './lib/scheduler.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const IMAGE_DIR = process.env.IMAGE_DIR || '/opt/prompt-hub/images';
const GALLERY_DIR = process.env.GALLERY_DIR || join(process.env.DATA_DIR || './data', '../images/gallery');

const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function serveStaticFile(res, filePath) {
  const stat = statSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(res);
}

app.prepare().then(() => {
  // Initialize database
  loadData();
  console.log('✅ Database initialized');

  // Start cron scheduler
  startSyncScheduler();
  console.log('✅ Sync scheduler started');

  // Create HTTP server
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const pathname = parsedUrl.pathname;

      // Serve /images/ from IMAGE_DIR (synced feishu images)
      if (pathname.startsWith('/images/') && !pathname.startsWith('/images/gallery/')) {
        const filePath = join(IMAGE_DIR, pathname.slice('/images/'.length));
        if (existsSync(filePath)) {
          serveStaticFile(res, filePath);
          return;
        }
      }

      // Serve /images/gallery/ from GALLERY_DIR
      if (pathname.startsWith('/images/gallery/')) {
        const filePath = join(GALLERY_DIR, pathname.slice('/images/gallery/'.length));
        if (existsSync(filePath)) {
          serveStaticFile(res, filePath);
          return;
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, () => {
    console.log(`🚀 Prompt Hub ready at http://${hostname}:${port}`);
  });
});
