'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, triggerSync } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import type { SyncLogEntry } from '@/lib/types';

export default function AdminPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const { data: syncLog, mutate: mutateLog } = useSWR<SyncLogEntry[]>(
    '/api/sync-log',
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: status } = useSWR<{ last_sync: SyncLogEntry | null; server_time: string }>(
    '/api/sync-status',
    fetcher,
    { refreshInterval: 10000 }
  );

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await triggerSync();
      setSyncResult(`✅ 同步完成: ${result.syncedCount} 个提示词${result.errors.length > 0 ? `, ${result.errors.length} 个错误` : ''}`);
      mutateLog();
    } catch (err: any) {
      setSyncResult(`❌ ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Topbar />
      <main className="min-h-screen pt-24 px-4 sm:px-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-8">管理面板</h1>

        {/* Sync section */}
        <div className="glass noise rounded-[20px] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">飞书同步</h2>

          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded-full px-6 py-2.5 text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)] disabled:opacity-50 transition-colors"
            >
              {syncing ? '同步中...' : '立即同步'}
            </button>

            {status?.last_sync && (
              <span className="text-sm text-[var(--color-text-secondary)]">
                上次同步: {new Date(status.last_sync.completed_at! * 1000).toLocaleString('zh-CN')}
                ({status.last_sync.items_synced} 个提示词)
              </span>
            )}
          </div>

          {syncResult && (
            <div className="text-sm p-3 rounded-[12px] bg-[var(--color-surface-dim)] text-[var(--color-text)]">
              {syncResult}
            </div>
          )}
        </div>

        {/* Sync log */}
        <div className="glass noise rounded-[20px] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">同步日志</h2>

          {syncLog && syncLog.length > 0 ? (
            <div className="space-y-2">
              {syncLog.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 text-sm p-3 rounded-[12px] bg-[var(--color-surface-dim)]"
                >
                  <span className={`w-2 h-2 rounded-full ${
                    entry.status === 'success' ? 'bg-[var(--color-success)]' :
                    entry.status === 'failed' ? 'bg-[var(--color-error)]' :
                    'bg-[var(--color-warning)]'
                  }`} />
                  <span className="text-[var(--color-text)] font-medium">
                    {entry.sync_type}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">
                    {entry.items_synced} 个
                  </span>
                  <span className="text-[var(--color-text-tertiary)] ml-auto">
                    {new Date(entry.started_at * 1000).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">暂无同步记录</p>
          )}
        </div>
      </main>
    </>
  );
}
