'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { triggerSync } from '@/lib/api';

export interface SyncProgress {
  event: string;
  data: Record<string, unknown>;
}

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const { mutate } = useSWRConfig();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE when syncing starts, disconnect when done
  useEffect(() => {
    if (!syncing) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const es = new EventSource('/api/sync/progress');
    eventSourceRef.current = es;

    const events = ['start', 'nodes_fetched', 'processing', 'doc_done', 'complete', 'error'];
    events.forEach((event) => {
      es.addEventListener(event, ((e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setProgress({ event, data });
        } catch {}
      }) as EventListener);
    });

    es.onerror = () => {
      // Reconnect is handled by EventSource automatically
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [syncing]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setResult(null);
    setProgress(null);
    try {
      const res = await triggerSync();
      const msg = `同步完成: ${res.syncedCount} 个提示词${res.errors.length > 0 ? `, ${res.errors.length} 个错误` : ''}`;
      setResult({ success: true, message: msg });

      // Invalidate all data caches
      await Promise.all([
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/prompts')),
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/categories')),
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/gallery')),
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/subs')),
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/stats')),
        mutate('/api/sync-log'),
        mutate('/api/sync-status'),
      ]);

      return res;
    } catch (err: any) {
      setResult({ success: false, message: err.message });
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [mutate]);

  return { syncing, result, progress, sync };
}
