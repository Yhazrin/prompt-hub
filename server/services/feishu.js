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

// Fetch all wiki nodes from the space
export async function fetchWikiNodes() {
  try {
    const nodes = [];
    let pageToken = '';
    do {
      const data = await feishuGet(`/wiki/v2/spaces/${WIKI_SPACE_ID}/nodes`, {
        page_size: 50,
        ...(pageToken ? { page_token: pageToken } : {}),
      });
      nodes.push(...(data.items || []));
      pageToken = data.page_token;
    } while (pageToken);
    return nodes;
  } catch (err) {
    console.warn('fetchWikiNodes error:', err.message);
    return [];
  }
}

// Fetch document content as markdown
export async function fetchDocMarkdown(objToken) {
  try {
    const data = await feishuGet(`/docx/v1/documents/${objToken}`, {});
    return data;
  } catch (err) {
    console.warn(`fetchDocMarkdown error for ${objToken}:`, err.message);
    return null;
  }
}

// Get image download URL from token
export function getImageUrl(token) {
  if (!token) return null;
  return `https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/v2/cover/${token}/?height=800`;
}

// ── Markdown Parser ────────────────────────────────────────
export function parseDocMarkdownToPrompts(markdown, docTitle, wikiNodeToken, objToken) {
  const prompts = [];

  // Extract image tokens
  const imageTokens = [];
  const imgRegex = /<image\s+token="([^"]+)"/g;
  let match;
  while ((match = imgRegex.exec(markdown)) !== null) {
    imageTokens.push(match[1]);
  }

  // Split by prompt sections - look for ## 提示词原文 or ### Prompt N
  const sections = splitByPromptSections(markdown);

  sections.forEach((section, idx) => {
    const promptText = extractPromptText(section.markdown);
    if (!promptText || promptText.length < 10) return;

    const title = extractSectionTitle(section.markdown, docTitle, idx);
    const category = extractCategory(markdown) || guessCategory(docTitle);
    const ratio = extractRatio(section.markdown) || '4 / 5';
    const imageToken = imageTokens[idx] || imageTokens[0] || null;

    prompts.push({
      id: `${objToken}_${idx}`,
      title: title,
      prompt_text: promptText.trim(),
      image_url: imageToken ? getImageUrl(imageToken) : null,
      image_token: imageToken,
      ratio: ratio,
      category_id: category,
      subcategory: extractSubcategory(markdown) || docTitle,
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
  // Split on ## 提示词原文 or ### Prompt N
  const regex = /(?:^|\n)(#{1,3})\s*(提示词原文|Prompt\s*\d+)/gim;
  const parts = markdown.split(regex);

  // parts: [before, header, matchedWord, after, header, matchedWord, after, ...]
  // We want to extract the text after each matched header
  let currentPos = 0;
  const matches = [...markdown.matchAll(regex)];

  matches.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = matches[i + 1] ? matches[i + 1].index : markdown.length;
    const sectionMarkdown = markdown.slice(start, end).trim();
    sections.push({ markdown: sectionMarkdown, header: m[2] });
  });

  // If no sections found, treat whole thing as one section
  if (sections.length === 0) {
    sections.push({ markdown: markdown, header: 'main' });
  }

  return sections;
}

function extractPromptText(markdown) {
  // Remove headers, types, sources, notes
  let text = markdown
    .replace(/^#{1,6}\s+[^\n]*\n*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`{3}[\w]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/\|.+\|/g, '')
    .replace(/^[\s]*[-–]\s+.+$/gm, '')
    .replace(/^来源[：:].*$/gim, '')
    .replace(/^类型[：:].*$/gim, '')
    .replace(/^备注[：:].*$/gim, '')
    .replace(/^录入时间[：:].*$/gim, '')
    .replace(/^拆解表格.*$/gim, '')
    .replace(/<clark-table[^>]*>[\s\S]*?<\/clark-table>/g, '')
    .replace(/<grid[^>]*>[\s\S]*?<\/grid>/g, '')
    .replace(/<image\s+[^>]*>/g, '')
    .replace(/<[a-z][^>]*>[\s\S]*?<\/[a-z]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function extractSectionTitle(markdown, docTitle, idx) {
  // Try to find a heading within the section
  const headingMatch = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  // Look for "Prompt N -" pattern
  const promptMatch = markdown.match(/Prompt\s*\d+\s*[-–]\s*(.+)/i);
  if (promptMatch) return promptMatch[1].trim();

  // Fallback: first non-empty line as title
  const lines = markdown.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length > 0) {
    const title = lines[0].replace(/^[-\s]+/, '').trim();
    if (title.length > 5 && title.length < 100) return title;
  }

  return `${docTitle} (${idx + 1})`;
}

function extractCategory(markdown) {
  const catMatch = markdown.match(/类型[：:]\s*图片提示词\s*\/\s*([^\n]+)/);
  if (catMatch) {
    const cat = catMatch[1].trim();
    return guessCategory(cat);
  }
  return null;
}

function extractSubcategory(markdown) {
  const subMatch = markdown.match(/类型[：:]\s*图片提示词\s*\/\s*([^\n]+)/);
  if (subMatch) return subMatch[1].trim();
  return null;
}

function extractSource(markdown) {
  const srcMatch = markdown.match(/来源[：:]\s*(https?:\/\/[^\s\n]+)/);
  if (srcMatch) return srcMatch[1].trim();
  return '';
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
  // Extract style keywords
  const styleMatch = markdown.match(/风格要点[\s\S]*?(?=\n##|\n#|$)/i);
  if (styleMatch) {
    const tagText = styleMatch[0].replace(/风格要点[：:]\s*/i, '');
    tagText.split(/[,，、]/).forEach(t => {
      const tag = t.trim().replace(/^[·\-\s]+/, '').replace(/[·\-\s]+$/, '');
      if (tag.length > 1 && tag.length < 20) tags.push(tag);
    });
  }
  return tags.slice(0, 5).join(',');
}

export function guessCategory(keyword) {
  const k = (keyword || '').toLowerCase();
  if (k.includes('meme') || k.includes('海报') && k.includes('meme')) return 'meme';
  if (k.includes('汉字') || k.includes('hanzi')) return 'hanzi';
  if (k.includes('playful') || k.includes('趣味') && k.includes('logo')) return 'playful';
  if (k.includes('插画') || k.includes('illustration') || k.includes('risograph')) return 'illustration';
  if (k.includes('旅行') || k.includes('写真') || k.includes('travel')) return 'travel';
  if (k.includes('教学') || k.includes('科普') || k.includes('知识卡')) return 'edu';
  if (k.includes('海报') || k.includes('poster')) return 'poster';
  if (k.includes('科技') || k.includes('tech') || k.includes('未来')) return 'tech';
  if (k.includes('建筑') || k.includes('白模') || k.includes('arch')) return 'arch';
  if (k.includes('logo') || k.includes('编排') || k.includes('字标')) return 'logo';
  if (k.includes('特效') || k.includes('穿越') || k.includes('破屏')) return 'effect';
  return 'other';
}
