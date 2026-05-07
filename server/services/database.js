import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = process.env.DATA_DIR || './data';
const DATA_FILE = path.join(DATA_DIR, 'prompts.json');
const CATS_FILE = path.join(DATA_DIR, 'categories.json');
const LOG_FILE = path.join(DATA_DIR, 'sync_log.json');

let data = { prompts: [], categories: [] };
let log = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadData() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    if (fs.existsSync(CATS_FILE)) {
      data.categories = JSON.parse(fs.readFileSync(CATS_FILE, 'utf-8'));
    }
    if (fs.existsSync(LOG_FILE)) {
      log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.warn('Failed to load data files:', e.message);
  }

  // Seed default categories
  if (!data.categories || data.categories.length === 0) {
    data.categories = [
      { id: 'meme', name: 'Meme 提示词', description: '极简抽象海报风格', sort_order: 1 },
      { id: 'hanzi', name: '汉字意象徽记', description: '汉字与徽记设计', sort_order: 2 },
      { id: 'playful', name: '趣味图形标志', description: 'Playful 图形风格', sort_order: 3 },
      { id: 'illustration', name: '插画', description: '各类插画风格', sort_order: 4 },
      { id: 'travel', name: '旅行', description: '旅行博主风格', sort_order: 5 },
      { id: 'edu', name: '教学科普', description: '知识卡片插画', sort_order: 6 },
      { id: 'poster', name: '海报', description: '各类海报风格', sort_order: 7 },
      { id: 'tech', name: '科技风格', description: '科技未来感', sort_order: 8 },
      { id: 'arch', name: '建筑渲染', description: '建筑白模渲染', sort_order: 9 },
      { id: 'logo', name: 'Logo 设计', description: '破格编排标题型', sort_order: 10 },
      { id: 'effect', name: '特效', description: '破屏穿越特效', sort_order: 11 },
    ];
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

// ── Prompts CRUD ──────────────────────────────────────────
export function getPrompts({ category, sub, search, page = 1, limit = 50, sort = 'updated_at', order = 'desc' } = {}) {
  let result = data.prompts.filter(p => p.prompt_text && p.prompt_text.length > 0);

  if (category) result = result.filter(p => p.category_id === category);
  if (sub) result = result.filter(p => p.subcategory === sub);
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(p =>
      (p.title || '').toLowerCase().includes(s) ||
      (p.prompt_text || '').toLowerCase().includes(s) ||
      (p.wiki_doc_title || '').toLowerCase().includes(s)
    );
  }

  // Sort
  result.sort((a, b) => {
    let va = a[sort] || 0, vb = b[sort] || 0;
    if (sort === 'title') { va = a.title || ''; vb = b.title || ''; }
    if (order === 'asc') return va < vb ? -1 : va > vb ? 1 : 0;
    return va > vb ? -1 : va < vb ? 1 : 0;
  });

  const total = result.length;
  const start = (page - 1) * limit;
  const items = result.slice(start, start + limit);

  return { prompts: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export function getPrompt(id) {
  return data.prompts.find(p => p.id === id) || null;
}

export function upsertPrompt(prompt) {
  const idx = data.prompts.findIndex(
    p => p.wiki_node_token === prompt.wiki_node_token && p.title === prompt.title
  );
  if (idx >= 0) {
    data.prompts[idx] = { ...data.prompts[idx], ...prompt, updated_at: Date.now() };
  } else {
    data.prompts.push({ ...prompt, created_at: Date.now(), updated_at: Date.now(), id: prompt.id || `${prompt.wiki_node_token}_${Date.now()}` });
  }
  saveData();
}

export function incrementViewCount(id) {
  const p = data.prompts.find(p => p.id === id);
  if (p) { p.view_count = (p.view_count || 0) + 1; saveData(); }
}

// ── Categories ────────────────────────────────────────────
export function getCategories() {
  return data.categories.map(cat => ({
    ...cat,
    prompt_count: data.prompts.filter(p => p.category_id === cat.id && p.prompt_text).length,
  })).sort((a, b) => a.sort_order - b.sort_order);
}

export function getSubs(categoryId) {
  const subs = {};
  data.prompts
    .filter(p => p.category_id === categoryId && p.subcategory && p.prompt_text)
    .forEach(p => {
      if (!subs[p.subcategory]) subs[p.subcategory] = 0;
      subs[p.subcategory]++;
    });
  return Object.entries(subs).map(([subcategory, count]) => ({ subcategory, count }));
}

// ── Stats ─────────────────────────────────────────────────
export function getStats() {
  return {
    total: data.prompts.filter(p => p.prompt_text).length,
    categories: data.categories.length,
    lastSync: log[log.length - 1] || null,
    recentActivity: [...data.prompts]
      .filter(p => p.prompt_text)
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
      .slice(0, 10),
  };
}

// ── Sync log ──────────────────────────────────────────────
export function addSyncLog(syncType, status, itemsSynced = 0, errors = []) {
  const entry = {
    id: log.length + 1,
    sync_type: syncType,
    status,
    items_synced: itemsSynced,
    errors: errors.length > 0 ? JSON.stringify(errors) : null,
    started_at: Math.floor(Date.now() / 1000),
    completed_at: status !== 'running' ? Math.floor(Date.now() / 1000) : null,
  };
  log.push(entry);
  if (log.length > 100) log = log.slice(-100);
  saveLog();
  return entry;
}

export function updateSyncLog(id, status, itemsSynced, errors) {
  const entry = log.find(l => l.id === id);
  if (entry) {
    entry.status = status;
    entry.items_synced = itemsSynced;
    if (errors) entry.errors = JSON.stringify(errors);
    entry.completed_at = Math.floor(Date.now() / 1000);
    saveLog();
  }
}

export function getSyncLog() { return log.slice(-20).reverse(); }
export function getLastSync() { return log[log.length - 1] || null; }
