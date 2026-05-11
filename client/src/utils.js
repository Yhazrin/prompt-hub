// ── Utility functions ──────────────────────────────────────

export const CAT_COLORS = {
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

export function getCatColors(catId) {
  return CAT_COLORS[catId] || CAT_COLORS.other;
}

export function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function truncate(text, maxLen) {
  maxLen = maxLen || 120;
  if (!text) return '';
  const clean = text.replace(/[#*`_~]/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

export function highlightMatch(text, query) {
  if (!query || !text) return escapeHtml(text || '');
  const escaped = escapeHtml(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp('(' + q + ')', 'gi'), '<mark class="sr-highlight">$1</mark>');
}

export function copyToClipboard(text) {
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

export const CHECK_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
export const COPY_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

export function animateCopyButton(btn, origHtml) {
  btn.classList.add('copied');
  btn.innerHTML = CHECK_SVG + '已复制';
  btn.style.borderColor = 'var(--success)';
  btn.style.background = 'var(--success)';
  btn.style.color = '#fff';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = origHtml;
    btn.style.borderColor = '';
    btn.style.background = '';
    btn.style.color = '';
  }, 1500);
}

export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (type !== 'info' ? ' toast-' + type : '');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

export function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}
