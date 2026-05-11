export function startSyncScheduler(): void;
export function triggerSync(): Promise<{ syncedCount: number; errors: string[]; changedIds: string[] }>;
