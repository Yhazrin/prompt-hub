import type { PromptsResponse, Prompt, Category, Subcategory, GalleryImage, Stats, SyncLogEntry } from './types';

const BASE = '';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── SWR Keys ───────────────────────────────────────────────
export const swrKeys = {
  prompts: (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    return `/api/prompts?${sp.toString()}`;
  },
  prompt: (id: string) => `/api/prompts/${id}`,
  categories: '/api/categories',
  subs: (catId: string) => `/api/subs/${catId}`,
  search: (q: string) => `/api/search?q=${encodeURIComponent(q)}`,
  stats: '/api/stats',
  gallery: (id: string) => `/api/prompts/${id}/gallery`,
  galleryBatch: (ids: string[]) => `/api/gallery/batch?ids=${ids.join(',')}`,
  syncLog: '/api/sync-log',
  syncStatus: '/api/sync-status',
};

// ── Fetcher ────────────────────────────────────────────────
export const fetcher = <T>(url: string) => fetchJSON<T>(url);

// ── API Functions ──────────────────────────────────────────
export async function getPrompts(params: {
  category?: string;
  sub?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
} = {}): Promise<PromptsResponse> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  });
  return fetchJSON(`/api/prompts?${sp.toString()}`);
}

export async function getPrompt(id: string): Promise<Prompt> {
  return fetchJSON(`/api/prompts/${id}`);
}

export async function getCategories(): Promise<Category[]> {
  return fetchJSON('/api/categories');
}

export async function getSubs(categoryId: string): Promise<Subcategory[]> {
  return fetchJSON(`/api/subs/${categoryId}`);
}

export async function searchPrompts(q: string): Promise<Prompt[]> {
  return fetchJSON(`/api/search?q=${encodeURIComponent(q)}`);
}

export async function getStats(): Promise<Stats> {
  return fetchJSON('/api/stats');
}

export async function getGalleryImages(promptId: string): Promise<GalleryImage[]> {
  return fetchJSON(`/api/prompts/${promptId}/gallery`);
}

export async function getGalleryBatch(ids: string[]): Promise<Record<string, GalleryImage[]>> {
  return fetchJSON(`/api/gallery/batch?ids=${ids.join(',')}`);
}

export async function toggleFavorite(promptId: string): Promise<{ favorite: boolean }> {
  return fetchJSON(`/api/prompts/${promptId}/favorite`, { method: 'POST' });
}

export async function triggerSync(): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
  return fetchJSON('/api/sync', { method: 'POST' });
}

export async function uploadGalleryImage(promptId: string, file: File): Promise<{ success: boolean; image: GalleryImage }> {
  const form = new FormData();
  form.append('image', file);
  return fetchJSON(`/api/prompts/${promptId}/gallery`, { method: 'POST', body: form });
}

export async function deleteGalleryImage(promptId: string, imageId: string): Promise<{ success: boolean }> {
  return fetchJSON(`/api/prompts/${promptId}/gallery/${imageId}`, { method: 'DELETE' });
}

export async function syncGalleryImage(promptId: string, imageId: string): Promise<{ success: boolean; feishu_token: string; feishu_block_id: string }> {
  return fetchJSON(`/api/prompts/${promptId}/gallery/${imageId}/sync`, { method: 'POST' });
}
