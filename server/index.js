import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import adminRouter from './routes/admin.js';
import { loadData } from './services/database.js';
import { startSyncScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static client files
app.use(express.static(path.join(__dirname, '../client')));

// API routes
app.use('/api', apiRouter);
app.use('/admin', adminRouter);

// SPA fallback - serve index.html for non-API routes
app.get(/^\/(?!api|admin)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Initialize and start
async function bootstrap() {
  try {
    loadData();
    console.log('✅ Database initialized');

    startSyncScheduler();
    console.log('✅ Sync scheduler started');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Prompt Hub running at http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();
