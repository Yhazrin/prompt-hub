import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const WIKI_SPACE_ID = process.env.FEISHU_WIKI_SPACE_ID || '7636413876925385947';
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const IMAGE_DIR = process.env.IMAGE_DIR || '/opt/prompt-hub/images';

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

// Fetch document blocks (structured content including images)
export async function fetchDocBlocks(objToken) {
  try {
    const blocks = [];
    let pageToken = '';
    do {
      const params = { page_size: 50 };
      if (pageToken) params.page_token = pageToken;
      const data = await feishuGet(`/docx/v1/documents/${objToken}/blocks`, params);
      const items = data?.items || [];
      blocks.push(...items);
      pageToken = data?.page_token || '';
    } while (pageToken);
    return blocks;
  } catch (err) {
    console.warn(`fetchDocBlocks error for ${objToken}:`, err.message);
    return [];
  }
}

// Extract image blocks (block_type=27) from blocks array
export function extractImageBlocks(blocks) {
  return blocks
    .filter(b => b.block_type === 27 && b.image?.token)
    .map(b => ({
      block_id: b.block_id,
      token: b.image.token,
      width: b.image.width || 0,
      height: b.image.height || 0,
    }));
}

// Convert feishu image token to local CDN URL (doesn't download — download is done during sync)
export function getLocalImageUrl(token) {
  if (!token) return null;
  // The local URL path — nginx serves /images/ from /opt/prompt-hub/images/
  return `/images/${token}`;
}

// Download a feishu image token and save to local file
export async function downloadImage(token) {
  if (!token) return null;
  // Check if already downloaded
  const localPath = path.join(IMAGE_DIR, `${token}`);
  if (fs.existsSync(localPath)) {
    return `/images/${token}`;
  }

  const tk = await getAppAccessToken();
  if (!tk) return null;

  try {
    // Ensure directory exists
    if (!fs.existsSync(IMAGE_DIR)) {
      fs.mkdirSync(IMAGE_DIR, { recursive: true });
    }

    // Download from Feishu Drive media API
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${token}/download`,
      {
        headers: { Authorization: `Bearer ${tk}` },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    // Always save as JPEG for smaller file size (PNG from Feishu are often uncompressed)
    const filePath = path.join(IMAGE_DIR, `${token}.jpg`);
    try {
      await sharp(Buffer.from(response.data))
        .jpeg({ quality: 82, progressive: true })
        .toFile(filePath);
      const size = fs.statSync(filePath).size;
      console.log(`Downloaded+compressed image ${token} -> ${filePath} (${size} bytes)`);
    } catch (convErr) {
      // Fallback: save raw data if sharp fails
      fs.writeFileSync(filePath, Buffer.from(response.data));
      console.log(`Downloaded image ${token} (raw, ${Buffer.from(response.data).length} bytes)`);
    }
    return `/images/${token}.jpg`;
  } catch (err) {
    console.warn(`downloadImage ${token} failed:`, err.message);
    return null;
  }
}

// Build image URL map from blocks: { token -> localUrl }
// Downloads all images in parallel
export async function buildImageUrlMap(blocks, docObjToken) {
  const imageBlocks = extractImageBlocks(blocks);
  if (imageBlocks.length === 0) return {};

  const map = {};
  // Download all images concurrently (limit concurrency to avoid overwhelming the API)
  const batchSize = 3;
  for (let i = 0; i < imageBlocks.length; i += batchSize) {
    const batch = imageBlocks.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (img) => {
      try {
        const url = await downloadImage(img.token);
        return { token: img.token, url };
      } catch (err) {
        console.warn(`downloadImage ${img.token} error:`, err.message);
        return { token: img.token, url: null };
      }
    }));
    results.forEach(r => { if (r.url) map[r.token] = r.url; });
  }
  return map;
}

// Fetch document raw content (markdown)
export async function fetchDocRawContent(objToken) {
  try {
    const data = await feishuGet(`/docx/v1/documents/${objToken}/raw_content`, {});
    return { document: { markdown: data?.content || '' } };
  } catch (err) {
    console.warn(`fetchDocRawContent error for ${objToken}:`, err.message);
    return null;
  }
}

// Parse image tokens from markdown (legacy, for raw markdown format)
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
function extractCoverUrl(markdown, imageTokens) {
  const header = markdown.slice(0, 600);
  const match = header.match(/^cover:\s*(\S+)/im);
  if (match) {
    const val = match[1].trim();
    if (val.startsWith('img_')) return getImageUrl(val);
    if (val.startsWith('http')) return val;
    return null;
  }
  if (imageTokens.length > 0) return getImageUrl(imageTokens[0]);
  return null;
}

// Build section-to-image mapping based on block position in the document.
// Image blocks that appear between section headers belong to that section.
export function buildSectionImageMap(blocks, imageUrlMap) {
  const imageBlocks = extractImageBlocks(blocks);
  if (imageBlocks.length === 0) return [];

  // Find section boundaries (blocks with heading type)
  const sectionBoundaries = [];
  blocks.forEach((block, idx) => {
    const text = getBlockText(block);
    if (block.block_type === 3 || block.block_type === 4 || block.block_type === 5) {
      if (text.match(/提示词原文|Prompt\s*\d+/i)) {
        sectionBoundaries.push(idx);
      }
    }
  });
  sectionBoundaries.push(blocks.length);

  // Assign images to sections
  const sectionImages = [];
  imageBlocks.forEach((img) => {
    const imgIdx = blocks.findIndex(b => b.block_id === img.block_id);
    // Find which section this image belongs to
    let sectionIdx = 0;
    for (let i = 0; i < sectionBoundaries.length - 1; i++) {
      if (imgIdx >= sectionBoundaries[i] && imgIdx < sectionBoundaries[i + 1]) {
        sectionIdx = i;
        break;
      }
    }
    const url = imageUrlMap[img.token] || null;
    if (url) {
      if (!sectionImages[sectionIdx]) sectionImages[sectionIdx] = [];
      sectionImages[sectionIdx].push(url);
    }
  });

  return sectionImages; // sectionImages[sectionIdx] = [url1, url2, ...]
}

function getBlockText(block) {
  if (!block) return '';
  if (block.heading1?.elements) return block.heading1.elements.map(e => e.text_run?.content || '').join('');
  if (block.heading2?.elements) return block.heading2.elements.map(e => e.text_run?.content || '').join('');
  if (block.heading3?.elements) return block.heading3.elements.map(e => e.text_run?.content || '').join('');
  if (block.paragraph?.elements) return block.paragraph.elements.map(e => e.text_run?.content || '').join('');
  if (block.text?.elements) return block.text.elements.map(e => e.text_run?.content || '').join('');
  return '';
}

export function parseDocMarkdownToPrompts(markdown, docTitle, wikiNodeToken, objToken, imageUrlMap = {}, sectionImageMap = []) {
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

    // Determine image URL: section-specific > imageUrlMap > legacy token
    let imageUrl = null;
    if (sectionImageMap[idx]?.length > 0) {
      imageUrl = sectionImageMap[idx][0]; // first image in this section
    } else if (imageToken && imageUrlMap[imageToken]) {
      imageUrl = imageUrlMap[imageToken];
    } else if (imageToken) {
      imageUrl = getImageUrl(imageToken);
    }

    const promptData = {
      id: `${objToken}_${idx}`,
      title,
      prompt_text: promptText.trim(),
      image_token: imageToken || undefined,
      cover_url: coverUrl || undefined,
      ratio,
      category_id: 'other',
      subcategory: docTitle,
      wiki_node_token: wikiNodeToken,
      wiki_obj_token: objToken,
      wiki_doc_title: docTitle,
      source_url: extractSource(markdown),
      tags: extractTags(markdown),
      sync_status: 'synced',
    };
    if (imageUrl) promptData.image_url = imageUrl;
    prompts.push(promptData);
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
