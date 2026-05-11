'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useSync } from '@/hooks/useSync';
import { Topbar } from '@/components/Topbar';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeSlide } from '@/lib/animations';
import type { SyncLogEntry } from '@/lib/types';

export default function AdminPage() {
  const { syncing, result, progress, sync } = useSync();

  const { data: syncLog } = useSWR<SyncLogEntry[]>(
    '/api/sync-log',
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: status } = useSWR<{ last_sync: SyncLogEntry | null; server_time: string }>(
    '/api/sync-status',
    fetcher,
    { refreshInterval: 10000 }
  );

  const progressData = progress?.data;
  const total = (progressData?.total as number) || 0;
  const processed = (progressData?.processed as number) || 0;

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
              onClick={() => sync()}
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

          {/* Real-time progress */}
          <AnimatePresence>
            {syncing && progress && (
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="p-4 rounded-[12px] bg-[var(--color-surface-dim)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {progress.event === 'start' && '准备中...'}
                      {progress.event === 'nodes_fetched' && `发现 ${progressData?.total || 0} 个文档`}
                      {progress.event === 'processing' && `正在处理文档...`}
                      {progress.event === 'doc_done' && `处理: ${progressData?.title || ''}`}
                      {progress.event === 'complete' && '同步完成!'}
                      {progress.event === 'error' && '同步出错'}
                    </span>
                    {progress.event === 'doc_done' && typeof progressData?.status === 'string' && (() => {
                      const st = progressData.status;
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          st === 'synced' ? 'bg-green-100 text-green-700' :
                          st === 'unchanged' ? 'bg-gray-100 text-gray-600' :
                          st === 'skipped' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {st === 'synced' ? '已同步' :
                           st === 'unchanged' ? '无变化' :
                           st === 'skipped' ? '已跳过' : '错误'}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Progress bar */}
                  {total > 0 && (
                    <div className="w-full h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[var(--color-accent)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((progressData?.idx as number) || 0) / total * 100)}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {result && (
            <div className={`text-sm p-3 rounded-[12px] ${
              result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {result.success ? '✅' : '❌'} {result.message}
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
