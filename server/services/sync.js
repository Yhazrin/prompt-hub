import { upsertPrompt, addSyncLog, updateSyncLog, upsertCategory } from './database.js';
import {
  fetchWikiNodes,
  fetchDocBlocks,
  fetchDocRawContent,
  parseDocMarkdownToPrompts,
  categoryNameToId,
  buildImageUrlMap,
  buildSectionImageMap,
} from './feishu.js';

export async function syncAllFromWiki() {
  const logEntry = addSyncLog('full', 'running', 0, []);
  let syncedCount = 0;
  const errors = [];

  try {
    console.log('📡 Fetching wiki nodes...');
    const nodes = await fetchWikiNodes();
    console.log(`📋 Found ${nodes.length} wiki nodes`);

    // Step 1: Build category map from root-level nodes
    const categoryMap = {};
    for (const node of nodes) {
      if (!node.parent_node_token) {
        const name = node.title || '未分类';
        const id = categoryNameToId(name);
        categoryMap[node.node_token] = { name, id };
      }
    }

    // Step 2: Upsert categories dynamically from wiki
    let sortOrder = 1;
    for (const cat of Object.values(categoryMap)) {
      upsertCategory({ id: cat.id, name: cat.name, sort_order: sortOrder++ });
    }

    // Step 2.5: Remove categories that no longer exist in wiki
    const wikiCatIds = new Set(Object.values(categoryMap).map(c => c.id));
    const { getCategories } = await import('../services/database.js');
    const allCats = getCategories();
    for (const cat of allCats) {
      if (!wikiCatIds.has(cat.id)) {
        console.log(`🗑️ Removing category "${cat.name}" (${cat.id}) — no longer in wiki`);
        const { deleteCategory } = await import('../services/database.js');
        deleteCategory(cat.id);
      }
    }

    // Step 3: Process leaf nodes
    for (const node of nodes) {
      if (!node.obj_token || node.obj_type !== 'docx') continue;

      const catInfo = node.parent_node_token
        ? (categoryMap[node.parent_node_token] || null)
        : null;
      const categoryId = catInfo ? catInfo.id : 'other';
      const categoryName = catInfo ? catInfo.name : '未分类';

      try {
        // Fetch blocks AND markdown in parallel for this doc
        const [blocks, docInfo] = await Promise.all([
          fetchDocBlocks(node.obj_token),
          fetchDocRawContent(node.obj_token),
        ]);

        if (!docInfo?.document?.markdown) continue;

        const markdown = docInfo.document.markdown;

        // Download all images from this doc and build URL map
        console.log(`🖼️ Downloading ${blocks.filter(b => b.block_type === 27).length} images for "${node.title}"...`);
        const imageUrlMap = await buildImageUrlMap(blocks, node.obj_token);

        // Build section -> images mapping
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
          syncedCount++;
        }
      } catch (err) {
        errors.push(`${node.title}: ${err.message}`);
        console.warn(`⚠️ Error syncing "${node.title}":`, err.message);
      }
    }

    updateSyncLog(logEntry.id, 'success', syncedCount, errors);
    console.log(`✅ Sync complete: ${syncedCount} prompts synced`);
    return { syncedCount, errors };
  } catch (err) {
    updateSyncLog(logEntry.id, 'failed', syncedCount, [err.message]);
    console.error('❌ Sync failed:', err);
    throw err;
  }
}
