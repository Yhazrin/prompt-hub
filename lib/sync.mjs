import crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  upsertPrompt,
  addSyncLog,
  updateSyncLog,
  upsertCategory,
  getCategories,
  deleteCategory,
  getPrompts,
} from './database.mjs';
import {
  fetchWikiNodes,
  fetchDocBlocks,
  fetchDocRawContent,
  parseDocMarkdownToPrompts,
  categoryNameToId,
  buildImageUrlMap,
  buildSectionImageMap,
} from './feishu.mjs';

// Global sync progress emitter — SSE endpoint subscribes to this
export const syncProgress = new EventEmitter();

let lastSyncTimestamp = 0;
// docId -> content hash, persisted across syncs in memory
const docHashMap = new Map();

function contentHash(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Simple promise pool — runs tasks with max concurrency
async function promisePool(tasks, concurrency = 5) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

export async function syncAllFromWiki() {
  const logEntry = addSyncLog('full', 'running', 0, []);
  const startTime = Date.now();
  let syncedCount = 0;
  let skippedCount = 0;
  let changedCount = 0;
  let imagesDownloaded = 0;
  const errors = [];
  const changedIds = [];

  const emit = (event, data) => {
    syncProgress.emit(event, { ...data, logId: logEntry.id });
  };

  try {
    emit('start', { phase: 'fetching_nodes' });
    console.log('📡 Fetching wiki nodes...');
    const nodes = await fetchWikiNodes();
    console.log(`📋 Found ${nodes.length} wiki nodes`);
    emit('nodes_fetched', { total: nodes.length });

    // Build category map from root nodes
    const categoryMap = {};
    for (const node of nodes) {
      if (!node.parent_node_token) {
        const name = node.title || '未分类';
        const id = categoryNameToId(name);
        categoryMap[node.node_token] = { name, id };
      }
    }

    // Upsert categories
    let sortOrder = 1;
    for (const cat of Object.values(categoryMap)) {
      upsertCategory({ id: cat.id, name: cat.name, sort_order: sortOrder++ });
    }

    // Remove categories no longer in wiki
    const wikiCatIds = new Set(Object.values(categoryMap).map(c => c.id));
    const allCats = getCategories();
    for (const cat of allCats) {
      if (!wikiCatIds.has(cat.id)) {
        console.log(`🗑️ Removing category "${cat.name}" (${cat.id}) — no longer in wiki`);
        deleteCategory(cat.id);
      }
    }

    // Filter to docx nodes only
    const docNodes = nodes.filter(n => n.obj_token && n.obj_type === 'docx');
    emit('processing', { total: docNodes.length, processed: 0 });

    // Process documents concurrently (max 5 at a time)
    const tasks = docNodes.map((node, nodeIdx) => async () => {
      const catInfo = node.parent_node_token
        ? (categoryMap[node.parent_node_token] || null)
        : null;
      const categoryId = catInfo ? catInfo.id : 'other';
      const categoryName = catInfo ? catInfo.name : '未分类';

      try {
        const [blocks, docInfo] = await Promise.all([
          fetchDocBlocks(node.obj_token),
          fetchDocRawContent(node.obj_token),
        ]);

        if (!docInfo?.document?.markdown) {
          skippedCount++;
          emit('doc_done', { idx: nodeIdx + 1, title: node.title, status: 'skipped', reason: 'no content' });
          return;
        }

        const markdown = docInfo.document.markdown;
        const hash = contentHash(markdown);

        // Check if document changed since last sync
        if (lastSyncTimestamp > 0 && docHashMap.get(node.obj_token) === hash) {
          skippedCount++;
          emit('doc_done', { idx: nodeIdx + 1, title: node.title, status: 'unchanged' });
          return;
        }

        docHashMap.set(node.obj_token, hash);

        const imageCount = blocks.filter(b => b.block_type === 27).length;
        if (imageCount > 0) {
          console.log(`🖼️ Downloading ${imageCount} images for "${node.title}"...`);
        }
        const imageUrlMap = await buildImageUrlMap(blocks, node.obj_token);
        imagesDownloaded += Object.keys(imageUrlMap).length;
        const sectionImageMap = buildSectionImageMap(blocks, imageUrlMap);

        const prompts = parseDocMarkdownToPrompts(
          markdown,
          node.title || '未命名',
          node.node_token,
          node.obj_token,
          imageUrlMap,
          sectionImageMap
        );

        for (const prompt of prompts) {
          upsertPrompt({
            ...prompt,
            wiki_doc_title: node.title || prompt.wiki_doc_title,
            category_id: categoryId,
            subcategory: categoryName,
          });
          if (prompt.id) changedIds.push(prompt.id);
          syncedCount++;
        }
        changedCount++;

        emit('doc_done', {
          idx: nodeIdx + 1,
          title: node.title,
          status: 'synced',
          prompts: prompts.length,
        });
      } catch (err) {
        errors.push(`${node.title}: ${err.message}`);
        console.warn(`⚠️ Error syncing "${node.title}":`, err.message);
        emit('doc_done', { idx: nodeIdx + 1, title: node.title, status: 'error', error: err.message });
      }
    });

    await promisePool(tasks, 5);

    const durationMs = Date.now() - startTime;
    lastSyncTimestamp = Date.now();

    updateSyncLog(logEntry.id, 'success', syncedCount, errors);
    emit('complete', {
      syncedCount,
      changedCount,
      skippedCount,
      imagesDownloaded,
      errors: errors.length,
      durationMs,
    });

    console.log(`✅ Sync complete: ${syncedCount} synced, ${skippedCount} skipped, ${changedCount} changed (${durationMs}ms)`);
    return { syncedCount, errors, changedIds };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    updateSyncLog(logEntry.id, 'failed', syncedCount, [err.message]);
    emit('error', { error: err.message, durationMs });
    console.error('❌ Sync failed:', err);
    throw err;
  }
}

export function getLastSyncTimestamp() {
  return lastSyncTimestamp;
}
