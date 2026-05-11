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
    showToast('数据加载失败，请刷新页面', 'error');
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
      btn.dataset.sub = sub.subcategory;
      btn.innerHTML = '<span class="sub-name">' + sub.subcategory + '</span><span class="sub-count">' + sub.count + '</span>';
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
const CAT_COLORS = {
  illustration: { bg: '#f5ede4', accent: '#c4956a', label: '#8b5e3c' },
  poster:       { bg: '#f0e8f5', accent: '#9b6fc4', label: '#6b3fa0' },
  arch:          { bg: '#e8f0f5', accent: '#5a9bbf', label: '#2d6a8a' },
  meme:          { bg: '#f5f0e8', accent: '#c4a06a', label: '#8b6a2c' },
  hanzi:        { bg: '#f5ede8', accent: '#c4785a', label: '#8b3c1c' },
  playful:      { bg: '#f5f8e8', accent: '#8bc45a', label: '#4a7a1c' },
  travel:       { bg: '#e8f5f0', accent: '#5ac4a0', label: '#2a7a5a' },
  edu:          { bg: '#e8f5f5', accent: '#5ac4c4', label: '#2a7a7a' },
  tech:         { bg: '#e8f0f8', accent: '#7a5ac4', label: '#4a2a8b' },
  logo:         { bg: '#f0f5e8', accent: '#8ba05a', label: '#5a702a' },
  effect:       { bg: '#f5e8e8', accent: '#c45a7a', label: '#8b2a4a' },
  kawaii:       { bg: '#f8e8f5', accent: '#c47abf', label: '#8b4a7a' },
  abstract:     { bg: '#f0e8f0', accent: '#9b5ac4', label: '#6b2a8b' },
  landing:      { bg: '#e8f0f0', accent: '#5a8bc4', label: '#2a5a8b' },
  other:        { bg: '#f0f0f0', accent: '#8a8a8a', label: '#4a4a4a' },
};

function getCatColors(catId) {
  return CAT_COLORS[catId] || CAT_COLORS.other;
}

function truncate(text, maxLen) {
  maxLen = maxLen || 120;
  if (!text) return '';
  var clean = text.replace(/[#*`_~]/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).replace(/\s+\S*$/, '') + '\u2026';
}

async function renderHomeView(categories) {
  var homeSections = document.getElementById('homeSections');
  homeSections.innerHTML = '';
  state.view = 'home';
  state.currentPrompts = [];
  document.getElementById('homeView').hidden = false;
  document.getElementById('categoryView').hidden = true;
  document.querySelector('.layout').dataset.view = 'home';

  // Stats strip
  var promptCount = categories.reduce(function(s, c) { return s + (c.prompt_count || 0); }, 0);
  var statsStrip = document.createElement('div');
  statsStrip.className = 'home-stats';
  statsStrip.innerHTML = '<div class="stats-inner">' +
    '<span class="stat-item"><svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span class="stat-num">' + promptCount + '</span><span class="stat-label">\u6761\u63d0\u793a\u8bcd</span></span>' +
    '<span class="stat-sep" aria-hidden="true">\u00b7</span>' +
    '<span class="stat-item"><svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span class="stat-num">' + categories.length + '</span><span class="stat-label">\u4e2a\u5206\u7c7b</span></span>' +
    '<span class="stat-sep" aria-hidden="true">\u00b7</span>' +
    '<span class="stat-item hint"><svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 15l-2 5L9 9l11 4-5 2z"/><path d="M14.828 14.828L21 21"/></svg><span class="stat-label">\u70b9\u51fb\u5361\u7247\u67e5\u770b\u63d0\u793a\u8bcd \u00b7 \u6309 <kbd>/</kbd> \u641c\u7d22</span></span>' +
    '</div>';
  homeSections.appendChild(statsStrip);

  // Category pills
  var pillsRow = document.createElement('div');
  pillsRow.className = 'cat-pills';
  var allBtn = document.createElement('button');
  allBtn.className = 'cat-pill active';
  allBtn.textContent = '\u5168\u90e8';
  allBtn.dataset.cat = '';
  allBtn.addEventListener('click', function() { filterMosaic(''); });
  pillsRow.appendChild(allBtn);
  categories.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className = 'cat-pill';
    btn.textContent = cat.name;
    btn.dataset.cat = cat.id;
    var colors = getCatColors(cat.id);
    btn.style.setProperty('--pill-accent', colors.accent);
    btn.addEventListener('click', function() { filterMosaic(cat.id); });
    pillsRow.appendChild(btn);
  });
  homeSections.appendChild(pillsRow);

  // Mosaic grid
  var mosaicSection = document.createElement('div');
  mosaicSection.className = 'home-mosaic-section';
  var mosaicGrid = document.createElement('div');
  mosaicGrid.className = 'mosaic-grid';
  mosaicGrid.id = 'mosaicGrid';

  try {
    var allPrompts = [];
    var pp = 1, totalPages = 1;
    do {
      var pd = await api('/api/prompts?page=' + pp + '&limit=50');
      allPrompts = allPrompts.concat(pd.prompts);
      totalPages = (pd.pagination && pd.pagination.pages) ? pd.pagination.pages : 1;
      pp++;
    } while (pp <= totalPages);

    state.currentPrompts = allPrompts;

    var catMap = {};
    categories.forEach(function(c) { catMap[c.id] = c.name; });

    allPrompts.forEach(function(p, i) {
      mosaicGrid.appendChild(createMosaicCard(p, i, catMap));
    });
  } catch(e) {
    console.warn('Mosaic load failed:', e);
  }

  mosaicSection.appendChild(mosaicGrid);
  homeSections.appendChild(mosaicSection);
}

function filterMosaic(catId) {
  document.querySelectorAll('.cat-pill').forEach(function(p) {
    p.classList.toggle('active', p.dataset.cat === (catId || ''));
  });
  var cards = document.querySelectorAll('.mosaic-card');
  cards.forEach(function(card) {
    var match = !catId || card.dataset.cat === catId;
    card.style.display = match ? '' : 'none';
  });
}

function createMosaicCard(prompt, index, catMap) {
  var card = document.createElement('article');
  card.className = 'mosaic-card';
  card.dataset.index = index;
  card.dataset.cat = prompt.category_id || 'other';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  var colors = getCatColors(prompt.category_id);
  card.style.setProperty('--cat-accent', colors.accent);
  var ratio = prompt.ratio || '4 / 5';
  var imgSrc = (prompt.image_url || (prompt.cover_url ? 'https://yhazrin.xyz' + prompt.cover_url : null)) || null;
  var catName = catMap[prompt.category_id] || prompt.subcategory || '';
  var title = prompt.title || '\u65e0\u6807\u9898';
  var isFav = prompt.favorite;

  var mediaHtml;
  if (imgSrc) {
    mediaHtml = '<img src="' + imgSrc + '" alt="' + title + '" loading="lazy" onerror="this.parentElement.classList.add(\x27img-error\x27)">' +
      '<span class="mc-cat-badge" style="background:' + colors.accent + '">' + catName + '</span>';
  } else {
    mediaHtml = '<div class="mc-placeholder" style="background:' + colors.bg + '">' +
      '<div class="mc-placeholder-inner">' +
      '<span class="mc-cat-bar" style="background:' + colors.accent + '"></span>' +
      '<p class="mc-text-preview">' + truncate(prompt.prompt_text, 110) + '</p>' +
      '</div>' +
      '<div class="mc-text-badge">' +
        '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">' +
          '<rect x="1" y="2.5" width="9" height="6" rx="1.5" stroke="currentColor" stroke-width="1.1"/>' +
          '<path d="M3 5h5M3 7h3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
        '</svg>' +
        '\u6587\u5b57\u63d0\u793a\u8bcd' +
      '</div>' +
    '</div>';
  }

  var favBtn = '<button class="mc-fav' + (isFav ? ' active' : '') + '" aria-label="\u6536\u85cf" data-id="' + prompt.id + '">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
    '</svg>' +
  '</button>';

  card.innerHTML = '<div class="mc-media" style="aspect-ratio:' + ratio.replace('/', ' / ') + '">' + mediaHtml + favBtn + '</div>' +
    '<div class="mc-body">' +
    '<h3 class="mc-title">' + title + '</h3>' +
    (!imgSrc ? '<span class="mc-cat-label" style="color:' + colors.label + '">' + catName + '</span>' : '') +
    '<div class="mc-meta">' +
    '<span class="mc-ratio"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-opacity=".4"/><rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="currentColor" fill-opacity=".25"/></svg>' + ratio + '</span>' +
    '</div></div>';

  card.addEventListener('click', function(e) {
    if (e.target.closest('.mc-fav')) return;
    openLightbox(index);
  });
  card.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.target.closest('.mc-fav')) openLightbox(index); });

  var favEl = card.querySelector('.mc-fav');
  if (favEl) {
    favEl.addEventListener('click', function(ee) {
      ee.stopPropagation();
      toggleFav(prompt.id, favEl);
    });
  }

  return card;
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
  const colors = getCatColors(categoryId);
  const header = document.getElementById('categoryHeader');
  header.style.setProperty('--cat-accent', colors.accent);
  header.style.setProperty('--cat-bg', colors.bg);
  header.innerHTML = `
    <div class="cat-header-accent" style="background:${colors.accent}"></div>
    <h1>${cat?.name || categoryId}</h1>
    <p>${cat?.description || ''} · 共 ${cat?.prompt_count || 0} 条提示词</p>
  `;

  await renderSubNav(categoryId);
  await loadPrompts(categoryId, subcategory, 1);
}

async function loadPrompts(categoryId, subcategory, page) {
  const grid = document.getElementById('grid');
  if (page === 1) {
    grid.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const skel = document.createElement('div');
      skel.className = 'card skeleton-card';
      skel.innerHTML = '<div class="skeleton-media"></div><div class="skeleton-body"><div class="skeleton-line skeleton-line-title"></div><div class="skeleton-line skeleton-line-short"></div></div>';
      grid.appendChild(skel);
    }
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
  copyBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制提示词';
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    copyToClipboard(prompt.prompt_text);
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>已复制';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制提示词';
    }, 1500);
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

  // Source link
  if (prompt.source_url) {
    source.innerHTML = '<a href="' + prompt.source_url + '" target="_blank" rel="noopener" class="lightbox-source-link">' + (prompt.wiki_doc_title || '来源') + '</a>';
  } else {
    source.textContent = prompt.wiki_doc_title || '';
  }

  // Tags
  var tagsWrap = document.getElementById('lightboxTags');
  if (prompt.tags) {
    var tagList = prompt.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    tagsWrap.innerHTML = tagList.map(function(t) { return '<span class="lightbox-tag">' + t + '</span>'; }).join('');
    tagsWrap.style.display = '';
  } else {
    tagsWrap.innerHTML = '';
    tagsWrap.style.display = 'none';
  }

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
  showToast('开始同步飞书知识库...', 'info');

  try {
    const result = await fetch(ADMIN + '/sync', { method: 'POST' }).then(r => r.json());
    if (result.success) {
      showToast(`同步完成: ${result.syncedCount} 条提示词`, 'success');
      // Reload data
      await init();
    } else {
      showToast('同步失败: ' + result.error, 'error');
      dot.className = 'sync-dot error';
    }
  } catch (err) {
    showToast('同步请求失败', 'error');
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
  const container = document.getElementById('searchResults');
  // Show skeleton loading
  container.innerHTML = Array(4).fill(0).map(() =>
    `<div class="search-skeleton">
      <div class="search-skeleton-thumb"></div>
      <div class="search-skeleton-lines">
        <div class="search-skeleton-line title"></div>
        <div class="search-skeleton-line cat"></div>
        <div class="search-skeleton-line preview"></div>
      </div>
    </div>`
  ).join('');
  try {
    const results = await api(`/api/search?q=${encodeURIComponent(query)}`);
    container.innerHTML = '';

    if (results.length === 0) {
      container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">未找到匹配结果</div>`;
      return;
    }

    results.slice(0, 8).forEach(p => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const colors = getCatColors(p.category_id);
      item.style.setProperty('--sr-accent', colors.accent);
      item.innerHTML = `
        <div class="search-result-color" style="background:${colors.accent}"></div>
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
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">搜索失败，请重试</div>`;
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

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (type !== 'info' ? ' toast-' + type : '');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function toggleFav(promptId, btn) {
  btn.classList.toggle('active');
  const isActive = btn.classList.contains('active');
  showToast(isActive ? '已添加收藏' : '已取消收藏');
}
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (type !== 'info' ? ' toast-' + type : '');
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
    const btn = document.getElementById('lightboxCopy');
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>已复制!';
    btn.style.borderColor = 'var(--success)';
    btn.style.background = 'var(--success)';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.borderColor = '';
      btn.style.background = '';
      btn.style.color = '';
    }, 1500);
    showToast('提示词已复制', 'success');
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

// Scroll to top
const scrollTopBtn = document.getElementById('scrollTop');
window.addEventListener('scroll', () => {
  scrollTopBtn.hidden = window.scrollY < 400;
}, { passive: true });
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Keyboard shortcut: / to open search
document.addEventListener('keydown', e => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    e.preventDefault();
    openSearch();
  }
});

// ── Boot ──────────────────────────────────────────────────
init();
