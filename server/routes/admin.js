import { Router } from 'express';
import { getSyncLog, getLastSync } from '../services/database.js';
import { triggerSync } from '../services/scheduler.js';

const router = Router();

// POST /admin/sync
router.post('/sync', async (req, res) => {
  try {
    const result = await triggerSync();
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message === 'Sync already in progress') {
      return res.status(409).json({ error: 'Sync already in progress' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/sync-log
router.get('/sync-log', (req, res) => {
  try {
    res.json(getSyncLog());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/sync-status
router.get('/sync-status', (req, res) => {
  try {
    res.json({ last_sync: getLastSync(), server_time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
