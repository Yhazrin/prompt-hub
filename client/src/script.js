// ── State ──────────────────────────────────────────────────
const state = {
  view: 'home',           // 'home' | 'category'
  currentCat: null,       // category id
  currentSub: null,       // subcategory
  categories: [],
  prompts: [],
  currentPrompts: [],     // prompts for current view
  lightboxIndex: 0,
  totalPrompts: 0,
  page: 1,
  loading: false,
  synced: false,
};

// ── API ────────────────────────────────────────────────────
const API = '';
const ADMIN = '/admin';

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

// ── Init ───────────────────────────────────────────────────
async function init() {
  try {
    const [cats, stats] = await Promise.all([
      api('/api/categories'),
      api('/api/stats'),
    ]);

    state.categories = cats;
    state.totalPrompts = stats.total;

    renderTopNav(cats);
    renderFooterCats(cats);
    renderHomeView(cats);
    renderFooterStats(stats);
    await updateSyncStatus();
  } catch (err) {
    console.error('Init failed:', err);
    showToast('数据加载失败，请刷新页面');
  }
}

// ── Top Navigation ────────────────────────────────────────
function renderTopNav(categories) {
  const nav = document.getElementById('primaryNav');

  // Home button
  const homeBtn = document.createElement('button');
  homeBtn.textContent = '首页';
  homeBtn.dataset.cat = '';
  homeBtn.addEventListener('click', () => navigateHome());
  nav.appendChild(homeBtn);

  categories.forEach(cat => {
    if (!cat.id) return;
    const btn = document.createElement('button');
    btn.textContent = cat.name;
    btn.dataset.cat = cat.id;
    btn.addEventListener('click', () => navigateCategory(cat.id));
    nav.appendChild(btn);
  });

  // Animate indicator to active
  updateNavIndicator(document.querySelector('.primary-nav button.active') || document.querySelector('[data-cat=""]'));
}

// ── Sidebar sub-nav ────────────────────────────────────────
async function renderSubNav(categoryId) {
  const subNav = document.getElementById('subNav');
  const subPill = document.getElementById('subPill');
  subNav.innerHTML = '';

  if (!categoryId) {
    document.querySelector('.sub-wrap').style.visibility = 'hidden';
    return;
  }

  document.querySelector('.sub-wrap').style.visibility = 'visible';

  // "All" button
  const allLi = document.createElement('li');
  const allBtn = document.createElement('button');
  allBtn.textContent = `全部`;
  allBtn.dataset.sub = '';
  allBtn.addEventListener('click', () => navigateSub(null));
  allLi.appendChild(allBtn);
  subNav.appendChild(allLi);

  try {
    const subs = await api(`/api/subs/${categoryId}`);
    subs.forEach(sub => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = sub.subcategory;
      btn.dataset.sub = sub.subcategory;
      btn.addEventListener('click', () => navigateSub(sub.subcategory));
      li.appendChild(btn);
      subNav.appendChild(li);
    });
  } catch (err) {
    console.warn('Failed to load subs:', err);
  }

  updateSubPill(document.querySelector('.sub-nav button.active') || allBtn);
}

// ── Home View ──────────────────────────────────────────────
async function renderHomeView(categories) {
  const homeSections = document.getElementById('homeSections');
  homeSections.innerHTML = '';
  state.view = 'home';
  document.getElementById('homeView').hidden = false;
  document.getElementById('categoryView').hidden = true;
  document.querySelector('.layout').dataset.view = 'home';

  for (const cat of categories.slice(0, 8)) {
    if (!cat.id) continue;
    try {
      const data = await api(`/api/prompts?category=${cat.id}&limit=5&sort=updated_at`);
      if (data.prompts.length === 0) continue;

      const section = document.createElement('div');
      section.className = 'home-section';
      section.dataset.cat = cat.id;

      section.innerHTML = `
        <div class="home-section-head">
          <h2>${cat.name}</h2>
          <button class="home-view-all" data-cat="${cat.id}">查看全部 →</button>
        </div>
        <div class="home-section-row"></div>
      `;

      section.querySelector('.home-view-all').addEventListener('click', () => {
        navigateCategory(cat.id);
      });

      const row = section.querySelector('.home-section-row');
      data.prompts.forEach(p => row.appendChild(createHomeTile(p)));

      homeSections.appendChild(section);
    } catch (err) {
      console.warn(`Failed to load category ${cat.id}:`, err);
    }
  }
}

// ── Category View ─────────────────────────────────────────
async function renderCategoryView(categoryId, subcategory = null) {
  const homeView = document.getElementById('homeView');
  const catView = document.getElementById('categoryView');
  homeView.hidden = true;
  catView.hidden = false;
  state.view = 'category';
  state.currentCat = categoryId;
  state.currentSub = subcategory;
  state.page = 1;
  state.currentPrompts = [];

  document.querySelector('.layout').dataset.view = 'category';

  const cat = state.categories.find(c => c.id === categoryId);
  const header = document.getElementById('categoryHeader');
  header.innerHTML = `
    <h1>${cat?.name || categoryId}</h1>
    <p>${cat?.description || ''} · 共 ${state.categories.find(c=>c.id===categoryId)?.prompt_count || 0} 条提示词</p>
  `;

  await renderSubNav(categoryId);
  await loadPrompts(categoryId, subcategory, 1);
}

async function loadPrompts(categoryId, subcategory, page) {
  const grid = document.getElementById('grid');
  if (page === 1) {
    grid.innerHTML = '<div class="empty-state"><p class="empty-state-text">加载中...</p></div>';
    state.currentPrompts = [];
  }

  state.loading = true;
  try {
    let url = `/api/prompts?category=${categoryId}&page=${page}&limit=30&sort=updated_at`;
    if (subcategory) url += `&sub=${encodeURIComponent(subcategory)}`;

    const data = await api(url);

    if (page === 1) {
      grid.innerHTML = '';
      state.currentPrompts = [];
    }

    if (data.prompts.length === 0 && page === 1) {
      grid.innerHTML = `<div class="empty-state"><p class="empty-state-text">暂无数据</p></div>`;
      return;
    }

    data.prompts.forEach(p => {
      state.currentPrompts.push(p);
      grid.appendChild(createCard(p, state.currentPrompts.length - 1));
    });

    state.page = page;
    state.loading = false;

    // Infinite scroll
    if (data.pagination.page < data.pagination.pages) {
      const sentinel = document.createElement('div');
      sentinel.id = 'scroll-sentinel';
      sentinel.style.height = '1px';
      sentinel.style.gridColumn = '1/-1';
      grid.appendChild(sentinel);
      setupInfiniteScroll();
    }
  } catch (err) {
    console.error('Failed to load prompts:', err);
    if (page === 1) {
      grid.innerHTML = `<div class="empty-state"><p class="empty-state-text">加载失败: ${err.message}</p></div>`;
    }
    state.loading = false;
  }
}

let scrollObserver = null;
function setupInfiniteScroll() {
  if (scrollObserver) scrollObserver.disconnect();
  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) return;

  scrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !state.loading && state.view === 'category') {
      loadPrompts(state.currentCat, state.currentSub, state.page + 1);
    }
  }, { rootMargin: '200px' });
  scrollObserver.observe(sentinel);
}

// ── Card / Tile creation ───────────────────────────────────
function createHomeTile(prompt) {
  const tile = document.createElement('div');
  tile.className = 'home-tile';
  tile.dataset.index = state.currentPrompts.length;
  tile.setAttribute('role', 'button');
  tile.setAttribute('tabindex', '0');

  const img = document.createElement('img');
  img.src = (prompt.cover_url || prompt.image_url || `https://picsum.photos/seed/${prompt.id}/400/400`);
  img.alt = prompt.title;
  img.loading = 'lazy';
  img.onload = () => tile.classList.add('is-loaded');
  img.onerror = () => { tile.classList.add('is-loaded'); img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect fill="%23f3efe8" width="400" height="400"/><text fill="%23857970" font-size="34" font-family="sans-serif" text-anchor="middle" x="200" y="208">No Image</text></svg>'; };

  tile.appendChild(img);
  tile.addEventListener('click', () => openLightbox(parseInt(tile.dataset.index)));
  tile.addEventListener('keydown', e => { if (e.key === 'Enter') openLightbox(parseInt(tile.dataset.index)); });

  // Track prompts in home view
  state.currentPrompts.push(prompt);

  return tile;
}

function createCard(prompt, index) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.index = index;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  const img = document.createElement('img');
  img.src = (prompt.cover_url || prompt.image_url || `https://picsum.photos/seed/${prompt.id}/400/300`);
  img.alt = prompt.title;
  img.loading = 'lazy';
  img.onload = () => card.classList.add('is-loaded');
  img.onerror = () => { card.classList.add('is-loaded'); img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%23f3efe8" width="400" height="300"/><text fill="%23857970" font-size="28" font-family="sans-serif" text-anchor="middle" x="200" y="160">No Image</text></svg>'; };

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';

  const promptText = document.createElement('p');
  promptText.className = 'card-prompt';
  promptText.textContent = prompt.prompt_text || prompt.title;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = '复制提示词';
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    copyToClipboard(prompt.prompt_text);
    copyBtn.textContent = '已复制!';
    setTimeout(() => { copyBtn.textContent = '复制提示词'; }, 1500);
  });

  overlay.appendChild(promptText);
  overlay.appendChild(copyBtn);

  card.appendChild(img);
  card.appendChild(overlay);

  card.addEventListener('click', () => openLightbox(index));
  card.addEventListener('keydown', e => { if (e.key === 'Enter') openLightbox(index); });

  return card;
}

// ── Lightbox ──────────────────────────────────────────────
function openLightbox(index) {
  if (state.currentPrompts.length === 0) return;
  state.lightboxIndex = index;
  const prompt = state.currentPrompts[index];
  if (!prompt) return;

  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImage');
  const imgWrap = document.getElementById('lightboxImageWrap');
  const promptEl = document.getElementById('lightboxPrompt');
  const counter = document.getElementById('lightboxCounter');
  const source = document.getElementById('lightboxSource');

  imgWrap.classList.add('is-loading');
  img.classList.remove('is-loaded');

  img.onload = () => {
    imgWrap.classList.remove('is-loading');
    img.classList.add('is-loaded');
  };
  img.src = (prompt.cover_url || prompt.image_url || `https://picsum.photos/seed/${prompt.id}/800/600`);

  promptEl.textContent = prompt.prompt_text || prompt.title;
  counter.textContent = `${index + 1} / ${state.currentPrompts.length}`;
  source.textContent = prompt.wiki_doc_title || '';

  lightbox.hidden = false;
  lightbox.dataset.open = 'true';
  lightbox.dataset.layout = prompt.ratio === '16 / 9' || prompt.ratio === '9 / 16' ? 'wide' : '';
  document.body.classList.add('lightbox-open');

  // Update nav buttons
  document.getElementById('lightboxPrev').disabled = index === 0;
  document.getElementById('lightboxNext').disabled = index === state.currentPrompts.length - 1;
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.dataset.open = 'false';
  setTimeout(() => { lightbox.hidden = true; }, 300);
  document.body.classList.remove('lightbox-open');
}

// ── Navigation ─────────────────────────────────────────────
function navigateHome() {
  state.view = 'home';
  state.currentCat = null;
  state.currentSub = null;
  document.getElementById('homeView').hidden = false;
  document.getElementById('categoryView').hidden = true;
  document.querySelector('.layout').dataset.view = 'home';
  updateNavIndicator(document.querySelector('[data-cat=""]'));
}

async function navigateCategory(catId) {
  await renderCategoryView(catId, null);
  updateNavIndicator(document.querySelector(`[data-cat="${catId}"]`));
}

async function navigateSub(subcategory) {
  state.currentSub = subcategory;
  await loadPrompts(state.currentCat, subcategory, 1);
  updateSubPill(document.querySelector(`.sub-nav button[data-sub="${subcategory || ''}"]`));
}

// ── Indicator animations ─────────────────────────────────
function updateNavIndicator(btn) {
  if (!btn) return;
  const nav = document.getElementById('primaryNav');
  const indicator = document.getElementById('navIndicator');
  const rect = btn.getBoundingClientRect();
  const navRect = nav.getBoundingClientRect();

  document.querySelectorAll('.primary-nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  indicator.style.left = `${rect.left - navRect.left}px`;
  indicator.style.width = `${rect.width}px`;
  indicator.style.transform = `translateY(-50%)`;
}

function updateSubPill(btn) {
  if (!btn) return;
  const pill = document.getElementById('subPill');
  const rect = btn.getBoundingClientRect();
  const wrapRect = document.querySelector('.sub-wrap').getBoundingClientRect();

  document.querySelectorAll('.sub-nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  pill.style.opacity = '1';
  pill.style.left = `${rect.left - wrapRect.left}px`;
  pill.style.top = `${rect.top - wrapRect.top}px`;
  pill.style.width = `${rect.width}px`;
  pill.style.height = `${rect.height}px`;
}

// ── Sync status ───────────────────────────────────────────
async function updateSyncStatus() {
  try {
    const status = await api('/admin/sync-status');
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncLabel');

    if (status.last_sync) {
      const sync = status.last_sync;
      if (sync.status === 'success') {
        dot.className = 'sync-dot synced';
        const ago = timeAgo(sync.completed_at * 1000);
        label.textContent = `同步于 ${ago}`;
        state.synced = true;
      } else if (sync.status === 'running') {
        dot.className = 'sync-dot syncing';
        label.textContent = '同步中...';
      } else {
        dot.className = 'sync-dot error';
        label.textContent = '同步失败';
      }
    }
  } catch (err) {
    console.warn('Sync status error:', err);
  }
}

async function triggerSync() {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  dot.className = 'sync-dot syncing';
  label.textContent = '同步中...';
  showToast('开始同步飞书知识库...');

  try {
    const result = await fetch(ADMIN + '/sync', { method: 'POST' }).then(r => r.json());
    if (result.success) {
      showToast(`同步完成: ${result.syncedCount} 条提示词`);
      // Reload data
      await init();
    } else {
      showToast('同步失败: ' + result.error);
      dot.className = 'sync-dot error';
    }
  } catch (err) {
    showToast('同步请求失败');
    dot.className = 'sync-dot error';
  }

  await updateSyncStatus();
}

// ── Search ────────────────────────────────────────────────
let searchTimeout;
function openSearch() {
  document.getElementById('searchOverlay').hidden = false;
  document.getElementById('searchInput').focus();
}
function closeSearch() {
  document.getElementById('searchOverlay').hidden = true;
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}

async function doSearch(query) {
  if (!query.trim()) {
    document.getElementById('searchResults').innerHTML = '';
    return;
  }
  try {
    const results = await api(`/api/search?q=${encodeURIComponent(query)}`);
    const container = document.getElementById('searchResults');
    container.innerHTML = '';

    if (results.length === 0) {
      container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">未找到匹配结果</div>`;
      return;
    }

    results.slice(0, 8).forEach(p => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <img class="search-result-thumb" src="${(p.cover_url || p.image_url || `https://picsum.photos/seed/${p.id}/100/100`)}" alt="" loading="lazy">
        <div class="search-result-text">
          <div class="search-result-title">${p.title}</div>
          <div class="search-result-cat">${p.category_name || ''} · ${p.wiki_doc_title || ''}</div>
          <div class="search-result-preview">${(p.prompt_text || '').slice(0, 60)}...</div>
        </div>
      `;
      item.addEventListener('click', () => {
        closeSearch();
        // Navigate to category view with this prompt
        navigateCategory(p.category_id);
        // Find and open the lightbox
        setTimeout(async () => {
          const idx = state.currentPrompts.findIndex(cp => cp.id === p.id);
          if (idx >= 0) openLightbox(idx);
        }, 500);
      });
      container.appendChild(item);
    });
  } catch (err) {
    console.warn('Search error:', err);
  }
}

// ── Footer ────────────────────────────────────────────────
function renderFooterCats(categories) {
  const el = document.getElementById('footerCats');
  categories.slice(0, 6).forEach(cat => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = cat.name;
    btn.addEventListener('click', () => navigateCategory(cat.id));
    li.appendChild(btn);
    el.appendChild(li);
  });
}

function renderFooterStats(stats) {
  const el = document.getElementById('footerStats');
  el.textContent = `共 ${stats.total} 条提示词 · ${stats.categories} 个分类`;
  document.getElementById('footerYear').textContent = new Date().getFullYear();
}

// ── Utilities ─────────────────────────────────────────────
function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

// ── Event listeners ───────────────────────────────────────
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev').addEventListener('click', () => {
  if (state.lightboxIndex > 0) openLightbox(state.lightboxIndex - 1);
});
document.getElementById('lightboxNext').addEventListener('click', () => {
  if (state.lightboxIndex < state.currentPrompts.length - 1) openLightbox(state.lightboxIndex + 1);
});
document.getElementById('lightboxCopy').addEventListener('click', () => {
  const p = state.currentPrompts[state.lightboxIndex];
  if (p) {
    copyToClipboard(p.prompt_text);
    showToast('提示词已复制');
  }
});

// Close lightbox on backdrop click
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === document.getElementById('lightbox') ||
      e.target === document.getElementById('lightboxStage') ||
      e.target.classList.contains('lightbox-stage')) {
    closeLightbox();
  }
});

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (document.getElementById('lightbox').dataset.open === 'true') {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') document.getElementById('lightboxPrev').click();
    if (e.key === 'ArrowRight') document.getElementById('lightboxNext').click();
  }
});

// Search
document.getElementById('searchBtn').addEventListener('click', openSearch);
document.getElementById('searchClose').addEventListener('click', closeSearch);
document.getElementById('searchOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('searchOverlay')) closeSearch();
});
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => doSearch(e.target.value), 300);
});

// Refresh / sync
document.getElementById('refreshBtn').addEventListener('click', triggerSync);
document.getElementById('adminSyncBtn')?.addEventListener('click', triggerSync);
document.getElementById('heroExploreBtn')?.addEventListener('click', () => {
  document.getElementById('homeSections')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Nav indicator on resize
window.addEventListener('resize', () => {
  const active = document.querySelector('.primary-nav button.active');
  if (active) updateNavIndicator(active);
});

// ── Boot ──────────────────────────────────────────────────
init();
