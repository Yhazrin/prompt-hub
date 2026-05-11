import cron from 'node-cron';
import { syncAllFromWiki } from './sync.mjs';

let schedulerRunning = false;

export function startSyncScheduler() {
  const interval = parseInt(process.env.SYNC_INTERVAL_MINUTES || '30');
  const cronExpr = `*/${interval} * * * *`;

  cron.schedule(cronExpr, async () => {
    if (schedulerRunning) {
      console.log('⏳ Sync already in progress, skipping...');
      return;
    }

    schedulerRunning = true;
    try {
      await syncAllFromWiki();
    } catch (err) {
      console.error('Scheduled sync failed:', err);
    } finally {
      schedulerRunning = false;
    }
  });

  console.log(`🔄 Wiki sync scheduler started (every ${interval} minutes)`);
}

export function triggerSync() {
  if (schedulerRunning) {
    throw new Error('Sync already in progress');
  }

  schedulerRunning = true;
  return syncAllFromWiki()
    .finally(() => { schedulerRunning = false; });
}
