import axios from 'axios';

const WIKI_SPACE_ID = process.env.FEISHU_WIKI_SPACE_ID || '7636413876925385947';
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

let accessToken = null;
let tokenExpiry = 0;

export async function getAppAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }
  try {
    const resp = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET },
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (resp.data.code !== 0) throw new Error(`Auth failed: ${resp.data.msg}`);
    accessToken = resp.data.tenant_access_token;
    tokenExpiry = Date.now() + (resp.data.expire - 60) * 1000;
    return accessToken;
  } catch (err) {
    console.warn('Feishu auth error:', err.message);
    return null;
  }
}

async function feishuGet(path, params = {}) {
  const tk = await getAppAccessToken();
  if (!tk) throw new Error('No access token');
  const resp = await axios.get(`https://open.feishu.cn/open-apis${path}`, {
    headers: { Authorization: `Bearer ${tk}` },
    params,
  });
  if (resp.data.code !== 0) throw new Error(`Feishu ${path}: ${resp.data.msg}`);
  return resp.data.data;
}

// Map category folder name to a slug-style ID
const CATEGORY_SLUG_MAP = {
  'Meme 提示词': 'meme',
  '汉字意象徽记': 'hanzi',
  '趣味图形标志': 'playful',
  '插画': 'illustration',
  '旅行': 'travel',
  '教学科普': 'edu',
  '海报': 'poster',
  '科技风格': 'tech',
  '建筑渲染': 'arch',
  'Logo 设计': 'logo',
  '特效': 'effect',
  '卡哇伊风格': 'kawaii',
  '抽象趣味': 'abstract',
  '落地页': 'landing',
};

export function categoryNameToId(name) {
  if (!name) return 'other';
  if (CATEGORY_SLUG_MAP[name]) return CATEGORY_SLUG_MAP[name];
  // fallback: slugify
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'other';
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'other';
}

// Fetch all wiki nodes with parent-child hierarchy
export async function fetchWikiNodes() {
  try {
    const allNodes = [];
    let pageToken = '';
    do {
      const params = { page_size: 50 };
      if (pageToken) params.page_token = pageToken;
      const data = await feishuGet(`/wiki/v2/spaces/${WIKI_SPACE_ID}/nodes`, params);
      const items = data?.items || [];
      const roots = items.filter(n => !n.parent_node_token);
      allNodes.push(...roots);
      pageToken = data?.page_token || '';
    } while (pageToken);

    for (const root of allNodes) {
      if (!root.node_token) continue;
      try {
        let childPage = '';
        do {
          const cparams = { page_size: 50, parent_node_token: root.node_token };
          if (childPage) cparams.page_token = childPage;
          const childData = await feishuGet(`/wiki/v2/spaces/${WIKI_SPACE_ID}/nodes`, cparams);
          const children = childData?.items || [];
          allNodes.push(...children);
          childPage = childData?.page_token || '';
        } while (childPage);
      } catch (err) {
        console.warn(`Failed children of ${root.title}:`, err.message);
      }
    }
    return allNodes;
  } catch (err) {
    console.warn('fetchWikiNodes error:', err.message);
    return [];
  }
}

// Fetch document raw content
export async function fetchDocRawContent(objToken) {
  try {
    const data = await feishuGet(`/docx/v1/documents/${objToken}/raw_content`, {});
    return { document: { markdown: data?.content || '' } };
  } catch (err) {
    console.warn(`fetchDocRawContent error for ${objToken}:`, err.message);
    return null;
  }
}

// Parse image tokens from markdown
function extractImageTokens(markdown) {
  const tokens = [];
  const regex = /<image\s+token="([^"]+)"/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    tokens.push(match[1]);
  }
  return tokens;
}

function getImageUrl(token) {
  if (!token) return null;
  return `https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/v2/cover/${token}/?height=800`;
}

// Extract cover URL from markdown header.
// Supports: cover: https://...  or cover:https://...
// Looks only in the first 600 chars (the header/metadata area).
function extractCoverUrl(markdown, imageTokens) {
  const header = markdown.slice(0, 600);
  // Match cover: followed by URL
  const match = header.match(/^cover:\s*(https?:\/\/[^\s]+)/im);
  if (match) {
    const url = match[1].trim();
    // If it's a feishu image token (img_xxx), convert to CDN URL
    if (url.startsWith('img_')) {
      return getImageUrl(url);
    }
    return url;
  }
  // Fallback: use the first image token as cover
  if (imageTokens.length > 0) {
    return getImageUrl(imageTokens[0]);
  }
  return null;
}

export function parseDocMarkdownToPrompts(markdown, docTitle, wikiNodeToken, objToken) {
  const prompts = [];
  const imageTokens = extractImageTokens(markdown);
  const sections = splitByPromptSections(markdown);
  const coverUrl = extractCoverUrl(markdown, imageTokens);

  sections.forEach((section, idx) => {
    const promptText = extractPromptText(section.markdown);
    if (!promptText || promptText.length < 30) return;
    if (promptText.trim().startsWith('|') || promptText.trim().startsWith('-')) return;

    const title = extractSectionTitle(section.markdown, docTitle, idx);
    const ratio = extractRatio(section.markdown) || '4 / 5';
    const imageToken = imageTokens[idx] || imageTokens[0] || null;

    prompts.push({
      id: `${objToken}_${idx}`,
      title,
      prompt_text: promptText.trim(),
      image_url: imageToken ? getImageUrl(imageToken) : null,
      image_token: imageToken,
      cover_url: coverUrl,
      ratio,
      category_id: 'other',
      subcategory: docTitle,
      wiki_node_token: wikiNodeToken,
      wiki_obj_token: objToken,
      wiki_doc_title: docTitle,
      source_url: extractSource(markdown),
      tags: extractTags(markdown),
      sync_status: 'synced',
    });
  });

  return prompts;
}

function splitByPromptSections(markdown) {
  const sections = [];
  const regex = /(?:^|\n)(#{1,3})?\s*(提示词原文|Prompt\s*\d+)/gim;
  const matches = [...markdown.matchAll(regex)];
  matches.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = matches[i + 1] ? matches[i + 1].index : markdown.length;
    sections.push({ markdown: markdown.slice(start, end).trim(), header: m[2] });
  });
  if (sections.length === 0) sections.push({ markdown, header: 'main' });
  return sections;
}

function extractPromptText(markdown) {
  let text = markdown
    .replace(/<clark-table[\s\S]*?<\/clark-table>/gi, '')
    .replace(/<grid[\s\S]*?<\/grid>/gi, '')
    .replace(/<image\s+[^>]*>/gi, '')
    .replace(/^\|.+\|\s*$/gm, '')
    .replace(/^#{1,6}\s+[^\n]*\n*/gm, '')
    .replace(/^提示词原文\s*$/gim, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`{3}[\w]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/^[\s]*[-–:]\s+.+$/gm, '')
    .replace(/^来源[：:].*$/gim, '')
    .replace(/^类型[：:].*$/gim, '')
    .replace(/^备注[：:].*$/gim, '')
    .replace(/^录入时间[：:].*$/gim, '')
    .replace(/^拆解表格.*$/gim, '')
    .replace(/^要素[：:].*$/gim, '')
    .replace(/^[\u4e00-\u9fa5]{1,6}[：:][^\n]*/gim, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

function extractSectionTitle(markdown, docTitle, idx) {
  const headingMatch = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim().replace(/\s*\(\d+\)$/, '');
  const promptMatch = markdown.match(/Prompt\s*\d+\s*[-–]\s*(.+)/i);
  if (promptMatch) return promptMatch[1].trim().replace(/\s*\(\d+\)$/, '');
  const lines = markdown.split('\n').filter(l => l.trim() && !l.startsWith('#') && l.trim().length > 5);
  if (lines.length > 0) {
    const title = lines[0].replace(/^[-\s]+/, '').trim().replace(/^\|.+\|/, '').trim();
    if (title.length > 5 && title.length < 100) return title.replace(/\s*\(\d+\)$/, '');
  }
  return docTitle;
}

function extractSource(markdown) {
  const srcMatch = markdown.match(/来源[：:]\s*(https?:\/\/[^\s\n]+)/);
  return srcMatch ? srcMatch[1].trim() : '';
}

function extractRatio(markdown) {
  if (markdown.includes('16:9')) return '16 / 9';
  if (markdown.includes('9:16')) return '9 / 16';
  if (markdown.includes('3:4')) return '3 / 4';
  if (markdown.includes('4:3')) return '4 / 3';
  if (markdown.includes('1:1')) return '1 / 1';
  return '4 / 5';
}

function extractTags(markdown) {
  const tags = [];
  const styleMatch = markdown.match(/风格要点[\s\S]*?(?=\n##|\n#|$)/i);
  if (styleMatch) {
    styleMatch[0].replace(/风格要点[：:]\s*/i, ' ').split(/[,，、]/).forEach(t => {
      const tag = t.trim().replace(/^[·\-\s]+/, '').replace(/[·\-\s]+$/, '');
      if (tag.length > 1 && tag.length < 20) tags.push(tag);
    });
  }
  return tags.slice(0, 5).join(',');
}
