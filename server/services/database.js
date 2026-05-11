import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const DATA_FILE = path.join(DATA_DIR, 'prompts.json');
const CATS_FILE = path.join(DATA_DIR, 'categories.json');
const LOG_FILE = path.join(DATA_DIR, 'sync_log.json');

let data = { prompts: [], categories: [] };
let log = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadData() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (fs.existsSync(CATS_FILE)) data.categories = JSON.parse(fs.readFileSync(CATS_FILE, 'utf-8'));
    if (fs.existsSync(LOG_FILE)) log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
  } catch (e) { console.warn('Load error:', e.message); }
  if (!data.categories || !data.categories.length) {
    data.categories = [{ id: 'other', name: '未分类', description: '', sort_order: 999 }];
    saveData();
  }
  if (!data.prompts) data.prompts = [];
  if (!log) log = [];
  return data;
}

export function saveData() {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ prompts: data.prompts }, null, 2));
  fs.writeFileSync(CATS_FILE, JSON.stringify(data.categories, null, 2));
}

export function saveLog() {
  ensureDataDir();
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

export function getPrompts({ category, sub, search, page = 1, limit = 50, sort = 'updated_at', order = 'desc' } = {}) {
  let result = data.prompts.filter(p => p.prompt_text);
  if (category) result = result.filter(p => p.category_id === category);
  if (sub) result = result.filter(p => p.subcategory === sub);
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(p => (p.title||'').toLowerCase().includes(s) || (p.prompt_text||'').toLowerCase().includes(s));
  }
  result.sort((a, b) => {
    const va = a[sort] || 0, vb = b[sort] || 0;
    if (order === 'asc') return va > vb ? 1 : va < vb ? -1 : 0;
    return va > vb ? -1 : va < vb ? 1 : 0;
  });
  const total = result.length;
  const start = (page - 1) * limit;
  return { prompts: result.slice(start, start + limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export function getPrompt(id) { return data.prompts.find(p => p.id === id) || null; }

export function upsertPrompt(prompt) {
  const idx = data.prompts.findIndex(p => p.wiki_node_token === prompt.wiki_node_token && p.title === prompt.title);
  if (idx >= 0) {
    const existing = data.prompts[idx];
    // Only overwrite image fields if new value is truthy (preserve existing otherwise)
    const merged = {
      ...existing,
      ...prompt,
      updated_at: Date.now(),
    };
    if (!prompt.image_url) merged.image_url = existing.image_url;
    if (!prompt.image_token) merged.image_token = existing.image_token;
    data.prompts[idx] = merged;
  } else {
    data.prompts.push({ ...prompt, created_at: Date.now(), updated_at: Date.now() });
  }
  saveData();
}

export function incrementViewCount(id) {
  const p = data.prompts.find(p => p.id === id);
  if (p) { p.view_count = (p.view_count || 0) + 1; saveData(); }
}

export function getSubs(categoryId) {
  const m = {};
  data.prompts.filter(p => p.category_id === categoryId && p.subcategory && p.prompt_text)
    .forEach(p => { if (!m[p.subcategory]) m[p.subcategory] = 0; m[p.subcategory]++; });
  return Object.entries(m).map(([subcategory, count]) => ({ subcategory, count }));
}

export function getCategories() {
  return data.categories
    .map(c => ({ ...c, prompt_count: data.prompts.filter(p => p.category_id === c.id && p.prompt_text).length }))
    .sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
}

export function upsertCategory({ id, name, description = '', sort_order = 99 }) {
  const idx = data.categories.findIndex(c => c.id === id);
  if (idx >= 0) {
    data.categories[idx] = { ...data.categories[idx], name, description, sort_order };
  } else {
    data.categories.push({ id, name, description, sort_order });
  }
  saveData();
}

export function deleteCategory(categoryId) {
  data.categories = data.categories.filter(c => c.id !== categoryId);
  // Also remove prompts in this category
  const before = data.prompts.length;
  data.prompts = data.prompts.filter(p => p.category_id !== categoryId);
  saveData();
  console.log(`Deleted category "${categoryId}" and ${before - data.prompts.length} prompts`);
}

export function getStats() {
  return {
    total: data.prompts.filter(p => p.prompt_text).length,
    categories: data.categories.length,
    lastSync: log[log.length - 1] || null,
    recentActivity: [...data.prompts].filter(p => p.prompt_text)
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0)).slice(0, 10),
  };
}

export function getGalleryImages(promptId) {
  const prompt = data.prompts.find(p => p.id === promptId);
  if (!prompt) return [];
  if (!prompt.gallery_images) { prompt.gallery_images = []; saveData(); }
  return prompt.gallery_images;
}

export function addGalleryImage(promptId, imageEntry) {
  const prompt = data.prompts.find(p => p.id === promptId);
  if (!prompt) throw new Error('Prompt not found');
  if (!prompt.gallery_images) prompt.gallery_images = [];
  prompt.gallery_images.push(imageEntry);
  prompt.updated_at = Date.now();
  saveData();
  return imageEntry;
}

export function deleteGalleryImage(promptId, imageId) {
  const prompt = data.prompts.find(p => p.id === promptId);
  if (!prompt || !prompt.gallery_images) return false;
  const idx = prompt.gallery_images.findIndex(i => i.id === imageId);
  if (idx < 0) return false;
  prompt.gallery_images.splice(idx, 1);
  prompt.updated_at = Date.now();
  saveData();
  return true;
}

export function markGalleryImageSynced(promptId, imageId, feishuBlockId, feishuToken) {
  const prompt = data.prompts.find(p => p.id === promptId);
  if (!prompt || !prompt.gallery_images) return;
  const img = prompt.gallery_images.find(i => i.id === imageId);
  if (img) {
    img.synced = true;
    img.feishu_block_id = feishuBlockId;
    img.feishu_token = feishuToken;
    prompt.updated_at = Date.now();
    saveData();
  }
}

export function updatePromptField(promptId, field, value) {
  const prompt = data.prompts.find(p => p.id === promptId);
  if (!prompt) return;
  prompt[field] = value;
  prompt.updated_at = Date.now();
  saveData();
}

export function addSyncLog(syncType, status, itemsSynced = 0, errors = []) {
  const entry = {
    id: log.length + 1, sync_type: syncType, status, items_synced: itemsSynced,
    errors: errors.length ? JSON.stringify(errors) : null,
    started_at: Math.floor(Date.now() / 1000),
    completed_at: status !== 'running' ? Math.floor(Date.now() / 1000) : null,
  };
  log.push(entry);
  if (log.length > 100) log = log.slice(-100);
  saveLog();
  return entry;
}

export function updateSyncLog(id, status, itemsSynced, errors) {
  const e = log.find(l => l.id === id);
  if (e) { e.status = status; e.items_synced = itemsSynced; if (errors) e.errors = JSON.stringify(errors); e.completed_at = Math.floor(Date.now() / 1000); saveLog(); }
}

export function getSyncLog() { return log.slice(-20).reverse(); }
export function getLastSync() { return log[log.length - 1] || null; }
