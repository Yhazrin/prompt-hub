import { CAT_COLORS, getCatColors, escapeHtml, truncate, highlightMatch, copyToClipboard, CHECK_SVG, COPY_SVG, animateCopyButton, showToast, timeAgo } from './utils.js';

// ── State ──────────────────────────────────────────────────
const state = {
  view: 'home',           // 'home' | 'category'
  currentCat: null,       // category id
  currentSub: null,       // subcategory
  categories: [],
  prompts: [],
  currentPrompts: [],     // prompts for current view
  lightboxIndex: 0,
  lightboxGalleryImages: [], // gallery images for current lightbox prompt
  galleryCache: {},           // promptId → [{url, id}]
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

// ── URL Hash Routing ──────────────────────────────────────
function getRoute() {
  const hash = location.hash || '#/';
  const parts = hash.replace('#/', '').split('/').filter(Boolean);
  if (parts[0] === 'cat' && parts[1]) {
    return { view: 'category', catId: decodeURIComponent(parts[1]), sub: parts[2] ? decodeURIComponent(parts[2]) : null };
  }
  if (parts[0] === 'prompt' && parts[1]) {
    return { view: 'prompt', promptId: decodeURIComponent(parts[1]) };
  }
  return { view: 'home' };
}

function setRoute(view, catId, sub, promptId) {
  let hash = '#/';
  if (view === 'category' && catId) {
    hash = '#/cat/' + encodeURIComponent(catId);
    if (sub) hash += '/' + encodeURIComponent(sub);
  }
  if (history.replaceState) {
    history.replaceState(null, '', hash);
  } else {
    location.hash = hash;
  }
}

async function handleRoute() {
  const route = getRoute();
  if (route.view === 'home') {
    navigateHome();
  } else if (route.view === 'category') {
    await navigateCategory(route.catId, route.sub);
  }
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
    renderFooterStats(stats);
    await updateSyncStatus();
    fetchGitHubStars();

    // Route-aware: navigate to hash or home
    const route = getRoute();
    if (route.view === 'category') {
      await navigateCategory(route.catId, route.sub);
    } else {
      await renderHomeView(cats);
    }
  } catch (err) {
    console.error('Init failed:', err);
    const homeSections = document.getElementById('homeSections');
    homeSections.innerHTML = '<div class="init-error"><p class="init-error-text">数据加载失败</p><p class="init-error-detail">' + escapeHtml(err.message) + '</p><button class="init-retry-btn" id="initRetryBtn">重新加载</button></div>';
    document.getElementById('initRetryBtn')?.addEventListener('click', () => {
      homeSections.innerHTML = '';
      init();
    });
  }
}

// ── Top Navigation ────────────────────────────────────────
function renderTopNav(categories) {
  const nav = document.getElementById('primaryNav');
  // Clear existing buttons but keep the indicator
  nav.querySelectorAll('button').forEach(b => b.remove());

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
      btn.innerHTML = '<span class="sub-name">' + escapeHtml(sub.subcategory) + '</span><span class="sub-count">' + sub.count + '</span>';
      btn.addEventListener('click', () => navigateSub(sub.subcategory));
      li.appendChild(btn);
      subNav.appendChild(li);
    });
  } catch (err) {
    console.warn('Failed to load subs:', err);
  }

  updateSubPill(document.querySelector('.sub-nav button.active') || allBtn);
}

// ── Home View
async function renderHomeView(categories) {
  const homeSections = document.getElementById('homeSections');
  homeSections.innerHTML = '';
  state.view = 'home';
  state.currentPrompts = [];
  document.getElementById('homeView').hidden = false;
  document.getElementById('categoryView').hidden = true;
  document.querySelector('.layout').dataset.view = 'home';

  // Stats strip
  const promptCount = categories.reduce(function(s, c) { return s + (c.prompt_count || 0); }, 0);
  const statsStrip = document.createElement('div');
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
  const pillsRow = document.createElement('div');
  pillsRow.className = 'cat-pills';
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-pill active';
  allBtn.textContent = '\u5168\u90e8';
  allBtn.dataset.cat = '';
  allBtn.addEventListener('click', function() { filterMosaic(''); });
  pillsRow.appendChild(allBtn);
  categories.forEach(function(cat) {
    const btn = document.createElement('button');
    btn.className = 'cat-pill';
    btn.textContent = cat.name;
    btn.dataset.cat = cat.id;
    const colors = getCatColors(cat.id);
    btn.style.setProperty('--pill-accent', colors.accent);
    btn.addEventListener('click', function() { filterMosaic(cat.id); });
    pillsRow.appendChild(btn);
  });
  homeSections.appendChild(pillsRow);

  // Mosaic grid
  const mosaicSection = document.createElement('div');
  mosaicSection.className = 'home-mosaic-section';
  const mosaicGrid = document.createElement('div');
  mosaicGrid.className = 'mosaic-grid';
  mosaicGrid.id = 'mosaicGrid';

  try {
    let allPrompts = [];
    let pp = 1; let totalPages = 1;
    do {
      const pd = await api('/api/prompts?page=' + pp + '&limit=50');
      allPrompts = allPrompts.concat(pd.prompts);
      totalPages = (pd.pagination && pd.pagination.pages) ? pd.pagination.pages : 1;
      pp++;
    } while (pp <= totalPages);

    state.currentPrompts = allPrompts;

    const catMap = {};
    categories.forEach(function(c) { catMap[c.id] = c.name; });

    // Create all cards
    allPrompts.forEach(function(p, i) {
      mosaicGrid.appendChild(createMosaicCard(p, i, catMap));
    });

    // Batch fetch all gallery images in one request
    const allIds = allPrompts.map(function(p) { return p.id; });
    fetchBatchGallery(allIds);
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
  const cards = document.querySelectorAll('.mosaic-card');
  let count = 0;
  let firstVisible = null;
  cards.forEach(function(card) {
    let match = !catId || card.dataset.cat === catId;
    if (match) {
      count++;
      if (!firstVisible) firstVisible = card;
      card.style.display = '';
      card.style.opacity = '1';
      card.style.transform = '';
    } else {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.96)';
      setTimeout(() => { if (card.style.opacity === '0') card.style.display = 'none'; }, 200);
    }
  });
  // Show count feedback
  const catName = catId ? (state.categories.find(c => c.id === catId)?.name || '') : '全部';
  showToast(catName + ': ' + count + ' 条', 'info');
  // Scroll to first visible card
  if (firstVisible) {
    setTimeout(() => firstVisible.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

function createMosaicCard(prompt, index, catMap) {
  const card = document.createElement('article');
  card.className = 'mosaic-card';
  card.dataset.index = index;
  card.dataset.cat = prompt.category_id || 'other';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  const colors = getCatColors(prompt.category_id);
  card.style.setProperty('--cat-accent', colors.accent);
  const ratio = prompt.ratio || '4 / 5';
  const imgSrc = (prompt.image_url || (prompt.cover_url ? 'https://yhazrin.xyz' + prompt.cover_url : null)) || null;
  const catName = catMap[prompt.category_id] || prompt.subcategory || '';
  const title = escapeHtml(prompt.title || '\u65e0\u6807\u9898');
  const isFav = prompt.favorite;
  const safeId = prompt.id.replace(/[^a-zA-Z0-9]/g, '_');

  let mediaHtml;
  if (imgSrc) {
    mediaHtml = '<img src="' + escapeHtml(imgSrc) + '" alt="' + title + '" loading="lazy" onerror="this.parentElement.classList.add(\x27img-error\x27)">' +
      '<span class="mc-cat-badge" style="background:' + colors.accent + '">' + escapeHtml(catName) + '</span>';
  } else {
    mediaHtml = '<div class="mc-placeholder" style="background:' + colors.bg + '">' +
      '<div class="mc-placeholder-inner">' +
      '<span class="mc-cat-bar" style="background:' + colors.accent + '"></span>' +
      '<p class="mc-text-preview">' + escapeHtml(truncate(prompt.prompt_text, 110)) + '</p>' +
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

  const favBtn = '<button class="mc-fav' + (isFav ? ' active' : '') + '" aria-label="\u6536\u85cf" data-id="' + safeId + '">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
    '</svg>' +
  '</button>';

  card.innerHTML = '<div class="mc-media" style="aspect-ratio:' + ratio.replace('/', ' / ') + '">' + mediaHtml + favBtn + '</div>' +
    '<div class="mc-body">' +
    '<h3 class="mc-title">' + title + '</h3>' +
    (!imgSrc ? '<span class="mc-cat-label" style="color:' + colors.label + '">' + escapeHtml(catName) + '</span>' : '') +
    '<div class="mc-meta">' +
    '<span class="mc-ratio"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-opacity=".4"/><rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="currentColor" fill-opacity=".25"/></svg>' + ratio + '</span>' +
    '</div></div>' +
    '<div class="mc-gallery-strip" id="mcgs-' + safeId + '"></div>';

  card.addEventListener('click', function(e) {
    if (e.target.closest('.mc-fav')) return;
    openLightbox(index);
  });
  card.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.target.closest('.mc-fav')) openLightbox(index); });

  const favEl = card.querySelector('.mc-fav');
  if (favEl) {
    favEl.addEventListener('click', function(ee) {
      ee.stopPropagation();
      toggleFav(prompt.id, favEl);
    });
  }

  return card;
}

// ── Mosaic Card Gallery Strip ─────────────────────────────
function renderCardGalleryStrip(promptId, images) {
  const stripId = 'mcgs-' + promptId.replace(/[^a-zA-Z0-9]/g, '_');
  const strip = document.getElementById(stripId);
  if (!strip || !images || images.length === 0) return;

  const show = images.slice(0, 4);
  const extra = images.length - show.length;

  strip.innerHTML = show.map(img =>
    '<div class="mc-gallery-thumb" data-gallery-url="' + escapeHtml(img.url) + '">' +
      '<img src="' + escapeHtml(img.url) + '" alt="" loading="lazy"/>' +
    '</div>'
  ).join('') + (extra > 0
    ? '<div class="mc-gallery-more">+' + extra + '</div>'
    : '');

  strip.querySelectorAll('.mc-gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', e => {
      e.stopPropagation();
      // Find the index of this prompt in currentPrompts
      const idx = state.currentPrompts.findIndex(p => p.id === promptId);
      if (idx >= 0) openLightbox(idx);
    });
  });
}

async function fetchCardGallery(promptId) {
  if (state.galleryCache[promptId]) return state.galleryCache[promptId];
  try {
    const images = await api('/api/prompts/' + promptId + '/gallery');
    state.galleryCache[promptId] = images;
    renderCardGalleryStrip(promptId, images);
  } catch (err) {
    state.galleryCache[promptId] = [];
  }
}

async function fetchBatchGallery(ids) {
  if (ids.length === 0) return;
  try {
    const batchSize = 200;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const result = await api('/api/gallery/batch?ids=' + batch.join(','));
      Object.entries(result).forEach(function([promptId, images]) {
        state.galleryCache[promptId] = images;
        renderCardGalleryStrip(promptId, images);
      });
    }
  } catch (err) {
    console.warn('Batch gallery fetch failed:', err);
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
  const colors = getCatColors(categoryId);
  const header = document.getElementById('categoryHeader');
  header.style.setProperty('--cat-accent', colors.accent);
  header.style.setProperty('--cat-bg', colors.bg);
  header.innerHTML = `
    <div class="cat-header-accent" style="background:${colors.accent}"></div>
    <h1>${escapeHtml(cat?.name || categoryId)}</h1>
    <p>${escapeHtml(cat?.description || '')} · 共 ${cat?.prompt_count || 0} 条提示词</p>
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

    const newIds = [];
    data.prompts.forEach(p => {
      state.currentPrompts.push(p);
      grid.appendChild(createCard(p, state.currentPrompts.length - 1));
      newIds.push(p.id);
    });
    fetchBatchGallery(newIds);

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
  const cardCopyOrigHtml = COPY_SVG + '复制提示词';
  copyBtn.innerHTML = cardCopyOrigHtml;
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    copyToClipboard(prompt.prompt_text);
    animateCopyButton(copyBtn, cardCopyOrigHtml);
    showToast('提示词已复制', 'success');
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
let lightboxTriggerEl = null;

async function openLightbox(index) {
  if (state.currentPrompts.length === 0) return;
  lightboxTriggerEl = document.activeElement;
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

  // Determine main image URL
  const mainUrl = prompt.cover_url || prompt.image_url || `https://picsum.photos/seed/${prompt.id}/800/600`;
  img.onload = () => {
    imgWrap.classList.remove('is-loading');
    img.classList.add('is-loaded');
  };
  img.src = mainUrl;

  // Fetch gallery images for the strip (left side) — reuse cache if available
  let galleryImages = state.galleryCache[prompt.id] || null;
  if (!galleryImages) {
    try {
      galleryImages = await api('/api/prompts/' + prompt.id + '/gallery');
      state.galleryCache[prompt.id] = galleryImages;
    } catch (err) {
      galleryImages = [];
    }
  }
  state.lightboxGalleryImages = galleryImages;

  // Build full image list: main cover first, then gallery
  const allImages = [{ url: mainUrl, isCover: true }].concat(
    galleryImages.map(g => ({ url: g.url, id: g.id, isCover: false }))
  );

  renderLightboxImageStrip(allImages, mainUrl);

  promptEl.textContent = prompt.prompt_text || prompt.title;
  counter.textContent = `${index + 1} / ${state.currentPrompts.length}`;

  // Source link
  if (prompt.source_url) {
    source.innerHTML = '<a href="' + escapeHtml(prompt.source_url) + '" target="_blank" rel="noopener" class="lightbox-source-link">' + escapeHtml(prompt.wiki_doc_title || '来源') + '</a>';
  } else {
    source.textContent = prompt.wiki_doc_title || '';
  }

  // Tags
  const tagsWrap = document.getElementById('lightboxTags');
  if (prompt.tags) {
    const tagList = prompt.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    tagsWrap.innerHTML = tagList.map(function(t) { return '<span class="lightbox-tag">' + escapeHtml(t) + '</span>'; }).join('');
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

  // Render gallery section (right side, uploads)
  renderGallery(prompt.id);
}

function renderLightboxImageStrip(allImages, activeUrl) {
  const strip = document.getElementById('lightboxImageStrip');
  if (!strip) return;

  // Only show strip if there are gallery images beyond the cover
  const galleryOnly = allImages.filter(img => !img.isCover);
  if (galleryOnly.length === 0) {
    strip.innerHTML = '';
    return;
  }

  strip.innerHTML = galleryOnly.map(img => {
    const active = img.url === activeUrl ? ' active' : '';
    return '<div class="strip-thumb' + active + '" data-url="' + escapeHtml(img.url) + '" title="查看此图">' +
      '<img src="' + escapeHtml(img.url) + '" alt="" loading="lazy"/>' +
    '</div>';
  }).join('');

  strip.querySelectorAll('.strip-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const url = thumb.dataset.url;
      swapLightboxImage(url);
      // Update active state
      strip.querySelectorAll('.strip-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
}

function swapLightboxImage(url) {
  const img = document.getElementById('lightboxImage');
  const imgWrap = document.getElementById('lightboxImageWrap');
  imgWrap.classList.add('is-loading');
  img.classList.remove('is-loaded');
  img.onload = () => {
    imgWrap.classList.remove('is-loading');
    img.classList.add('is-loaded');
  };
  img.src = url;
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.dataset.open = 'false';
  setTimeout(() => { lightbox.hidden = true; }, 300);
  document.body.classList.remove('lightbox-open');
  if (lightboxTriggerEl) { lightboxTriggerEl.focus(); lightboxTriggerEl = null; }
}

// ── Navigation ─────────────────────────────────────────────
function navigateHome() {
  state.view = 'home';
  state.currentCat = null;
  state.currentSub = null;
  document.getElementById('homeView').hidden = false;
  document.getElementById('categoryView').hidden = true;
  document.querySelector('.layout').dataset.view = 'home';
  setRoute('home');
  updateNavIndicator(document.querySelector('[data-cat=""]'));
}

async function navigateCategory(catId, sub) {
  await renderCategoryView(catId, sub || null);
  setRoute('category', catId, sub);
  updateNavIndicator(document.querySelector(`[data-cat="${catId}"]`));
}

async function navigateSub(subcategory) {
  state.currentSub = subcategory;
  await loadPrompts(state.currentCat, subcategory, 1);
  setRoute('category', state.currentCat, subcategory);
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

async function fetchGitHubStars() {
  try {
    const res = await fetch('https://api.github.com/repos/Yhazrin/prompt-hub');
    if (!res.ok) return;
    const data = await res.json();
    const el = document.getElementById('githubStars');
    if (el && data.stargazers_count !== undefined) {
      el.textContent = data.stargazers_count >= 1000
        ? (data.stargazers_count / 1000).toFixed(1) + 'k'
        : data.stargazers_count;
    }
  } catch (err) {
    console.warn('GitHub stars fetch error:', err);
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
      // Incremental refresh using changedIds
      await incrementalRefresh(result.changedIds || []);
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

async function incrementalRefresh(changedIds) {
  // Refresh categories and stats
  const [cats, stats] = await Promise.all([
    api('/api/categories'),
    api('/api/stats'),
  ]);
  state.categories = cats;
  state.totalPrompts = stats.total;
  renderTopNav(cats);
  renderFooterCats(cats);
  renderFooterStats(stats);

  if (changedIds.length === 0) {
    // No changes tracked, full re-render of current view
    if (state.view === 'home') await renderHomeView(cats);
    else await renderCategoryView(state.currentCat, state.currentSub);
    return;
  }

  // Fetch updated prompts
  const updated = await fetch(API + '/api/prompts/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: changedIds }),
  }).then(r => r.json());

  if (state.view === 'home') {
    // Update mosaic cards in place
    updated.forEach(p => {
      const idx = state.currentPrompts.findIndex(cp => cp.id === p.id);
      if (idx >= 0) {
        state.currentPrompts[idx] = p;
        const card = document.querySelector(`.mosaic-card[data-index="${idx}"]`);
        if (card) {
          const catMap = {};
          state.categories.forEach(c => { catMap[c.id] = c.name; });
          const newCard = createMosaicCard(p, idx, catMap);
          card.replaceWith(newCard);
        }
      }
    });
  } else {
    // Reload current category view
    await renderCategoryView(state.currentCat, state.currentSub);
  }
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
      container.innerHTML = `<div style="padding:20px;text-align:center;color:const(--muted)">未找到匹配结果</div>`;
      return;
    }

    results.slice(0, 8).forEach(p => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const colors = getCatColors(p.category_id);
      item.style.setProperty('--sr-accent', colors.accent);
      const srImgSrc = p.cover_url || p.image_url || `https://picsum.photos/seed/${p.id}/100/100`;
      const ago = p.updated_at ? timeAgo(p.updated_at) : '';
      const subInfo = p.subcategory && p.subcategory !== p.category_name ? ' · ' + escapeHtml(p.subcategory) : '';
      item.innerHTML = `
        <div class="search-result-color" style="background:${colors.accent}"></div>
        <img class="search-result-thumb" src="${escapeHtml(srImgSrc)}" alt="" loading="lazy">
        <div class="search-result-text">
          <div class="search-result-title">${highlightMatch(p.title, query)}</div>
          <div class="search-result-cat">${escapeHtml(p.category_name || '')}${subInfo}${ago ? ' · ' + escapeHtml(ago) : ''}</div>
          <div class="search-result-preview">${highlightMatch((p.prompt_text || '').slice(0, 80), query)}...</div>
        </div>
      `;
      item.addEventListener('click', async () => {
        closeSearch();
        await navigateCategory(p.category_id);
        const idx = state.currentPrompts.findIndex(cp => cp.id === p.id);
        if (idx >= 0) openLightbox(idx);
      });
      container.appendChild(item);
    });
  } catch (err) {
    console.warn('Search error:', err);
    container.innerHTML = `<div style="padding:20px;text-align:center;color:const(--muted)">搜索失败，请重试</div>`;
  }
}

// ── Footer ────────────────────────────────────────────────
function renderFooterCats(categories) {
  const el = document.getElementById('footerCats');
  el.innerHTML = '';
  const showAll = categories.length <= 8;
  const visible = showAll ? categories : categories.slice(0, 6);

  visible.forEach(cat => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = cat.name;
    btn.addEventListener('click', () => navigateCategory(cat.id));
    li.appendChild(btn);
    el.appendChild(li);
  });

  if (!showAll) {
    const moreLi = document.createElement('li');
    moreLi.className = 'footer-more-wrap';
    const moreBtn = document.createElement('button');
    moreBtn.className = 'footer-more-btn';
    moreBtn.textContent = `展开更多 (${categories.length - 6})`;
    moreBtn.addEventListener('click', () => {
      // Replace with all categories
      el.innerHTML = '';
      categories.forEach(cat => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.textContent = cat.name;
        btn.addEventListener('click', () => navigateCategory(cat.id));
        li.appendChild(btn);
        el.appendChild(li);
      });
    });
    moreLi.appendChild(moreBtn);
    el.appendChild(moreLi);
  }
}

function renderFooterStats(stats) {
  const el = document.getElementById('footerStats');
  el.textContent = `共 ${stats.total} 条提示词 · ${stats.categories} 个分类`;
  document.getElementById('footerYear').textContent = new Date().getFullYear();
}

// ── Utilities ─────────────────────────────────────────────
async function toggleFav(promptId, btn) {
  try {
    const result = await api('/api/prompts/' + promptId + '/favorite', { method: 'POST' });
    btn.classList.toggle('active', result.favorite);
    // Update in-memory prompt
    const prompt = state.currentPrompts.find(p => p.id === promptId);
    if (prompt) prompt.favorite = result.favorite;
    showToast(result.favorite ? '已添加收藏' : '已取消收藏');
  } catch (err) {
    showToast('操作失败', 'error');
  }
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
    animateCopyButton(btn, COPY_SVG + '复制提示词');
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
    // Focus trap: cycle Tab within lightbox
    if (e.key === 'Tab') {
      const focusable = document.getElementById('lightbox').querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
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

// ── Gallery ───────────────────────────────────────────────
async function renderGallery(promptId) {
  const grid = document.getElementById('galleryGrid');
  const uploadBtn = document.getElementById('galleryUploadBtn');
  const uploadInput = document.getElementById('galleryUploadInput');
  if (!grid) return;

  // Wire upload button → file input
  if (uploadBtn && uploadInput) {
    uploadBtn.onclick = () => uploadInput.click();
  }

  try {
    const images = await api('/api/prompts/' + promptId + '/gallery');
    renderGalleryGrid(grid, images, promptId);
  } catch (err) {
    grid.innerHTML = '<div class="gallery-empty">加载失败</div>';
  }
}

function renderGalleryGrid(grid, images, promptId) {
  if (!images || images.length === 0) {
    grid.innerHTML = '<div class="gallery-empty">还没有实战图片，成为第一个上传者！</div>';
    return;
  }
  grid.innerHTML = images.map(img => {
    const syncedBadge = img.synced
      ? '<div class="gallery-item-synced-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>'
      : '';
    return '<div class="gallery-item" data-id="' + escapeHtml(img.id) + '" data-url="' + escapeHtml(img.url) + '">' +
      '<img src="' + escapeHtml(img.url) + '" alt="实战图片" loading="lazy"/>' +
      syncedBadge +
      '<div class="gallery-item-overlay">' +
        (!img.synced
          ? '<button class="gallery-item-btn sync-btn" title="同步到飞书" data-action="sync"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>'
          : '') +
        '<button class="gallery-item-btn delete-btn" title="删除" data-action="delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>' +
      '</div>' +
    '</div>';
  }).join('');

  // Click on image → open in new tab
  grid.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      const id = item.dataset.id;
      const url = item.dataset.url;
      if (action === 'sync') {
        e.stopPropagation();
        syncGalleryImage(promptId, id, item);
      } else if (action === 'delete') {
        e.stopPropagation();
        deleteGalleryImage(promptId, id, item);
      } else {
        window.open(url, '_blank', 'noopener');
      }
    });
  });
}

async function syncGalleryImage(promptId, imageId, itemEl) {
  const btn = itemEl.querySelector('[data-action="sync"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 4v6h-6M1 20v-6h6"/></svg>'; }
  try {
    const result = await api('/api/prompts/' + promptId + '/gallery/' + imageId + '/sync', { method: 'POST' });
    showToast('已同步到飞书文档', 'success');
    // Refresh gallery to show synced badge
    await renderGallery(promptId);
  } catch (err) {
    showToast('同步失败: ' + (err.message || '未知错误'), 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'; }
  }
}

async function deleteGalleryImage(promptId, imageId, itemEl) {
  if (!confirm('确定删除这张图片？')) return;
  try {
    await api('/api/prompts/' + promptId + '/gallery/' + imageId, { method: 'DELETE' });
    itemEl.remove();
    showToast('已删除');
    // Re-render in case grid is now empty
    await renderGallery(promptId);
  } catch (err) {
    showToast('删除失败', 'error');
  }
}

// Upload input change handler — set up once
document.getElementById('galleryUploadInput')?.addEventListener('change', async function () {
  const files = this.files;
  if (!files || files.length === 0) return;
  this.value = ''; // reset so same file can be re-selected
  await uploadGalleryFiles(Array.from(files));
});

// ── Drag and Drop ────────────────────────────────────────
function setupGalleryDragDrop() {
  const grid = document.getElementById('galleryGrid');
  const gallery = document.querySelector('.lightbox-gallery');
  if (!grid || !gallery) return;

  // Prevent default drag behaviors on the gallery area
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    gallery.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
  });

  // Highlight on drag enter/over
  ['dragenter', 'dragover'].forEach(evt => {
    gallery.addEventListener(evt, () => grid.classList.add('drag-over'));
  });
  ['dragleave', 'drop'].forEach(evt => {
    gallery.addEventListener(evt, () => grid.classList.remove('drag-over'));
  });

  // Handle dropped files
  gallery.addEventListener('drop', e => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    uploadGalleryFiles(imageFiles);
  });
}

// Call once on init
setupGalleryDragDrop();

async function uploadGalleryFiles(files) {
  const prompt = state.currentPrompts[state.lightboxIndex];
  if (!prompt) return;

  const coverUrl = prompt.cover_url || prompt.image_url || '';
  const isMockCover = !coverUrl || coverUrl.includes('picsum.photos');

  const grid = document.getElementById('galleryGrid');
  const origHtml = grid.innerHTML;

  let uploadedCount = 0;
  let syncedThisSession = false;

  for (let i = 0; i < files.length; i++) {
    grid.innerHTML = '<div class="gallery-uploading"><svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 4v6h-6M1 20v-6h6"/></svg>' +
      (files.length > 1 ? ` 上传 ${i + 1}/${files.length}...` : '上传中...') + '</div>';

    const formData = new FormData();
    formData.append('image', files[i]);

    try {
      const result = await fetch('/api/prompts/' + prompt.id + '/gallery', {
        method: 'POST',
        body: formData,
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      });

      uploadedCount++;
      const newImg = result.image;

      // Auto-sync FIRST uploaded image if cover is mock (and not yet synced this session)
      if (isMockCover && newImg && prompt.wiki_obj_token && !syncedThisSession) {
        syncedThisSession = true;
        showToast('当前为 mock 封面，开始同步到飞书文档...', 'info');
        try {
          await api('/api/prompts/' + prompt.id + '/gallery/' + newImg.id + '/sync', { method: 'POST' });
          showToast('已同步到飞书文档', 'success');
        } catch (err) {
          showToast('同步到飞书失败，可稍后手动重试', 'error');
        }
      }
    } catch (err) {
      showToast('上传失败: ' + (err.message || ''), 'error');
    }
  }

  if (uploadedCount > 0) {
    showToast(uploadedCount === 1 ? '上传成功' : `成功上传 ${uploadedCount} 张图片`, 'success');
  }
  await renderGallery(prompt.id);
}

// Nav indicator on resize (debounced)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const active = document.querySelector('.primary-nav button.active');
    if (active) updateNavIndicator(active);
  }, 100);
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

// ── Hash routing ──────────────────────────────────────────
window.addEventListener('hashchange', handleRoute);

// ── Boot ──────────────────────────────────────────────────
init();
