import { EventEmitter } from 'events';

export const syncProgress: EventEmitter;

export function syncAllFromWiki(): Promise<{ syncedCount: number; errors: string[]; changedIds: string[] }>;

export function getLastSyncTimestamp(): number;
