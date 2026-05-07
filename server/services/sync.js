import { upsertPrompt, addSyncLog, updateSyncLog } from './database.js';
import { fetchWikiNodes, fetchDocMarkdown, parseDocMarkdownToPrompts } from './feishu.js';

export async function syncAllFromWiki() {
  const logEntry = addSyncLog('full', 'running', 0, []);
  let syncedCount = 0;
  const errors = [];

  try {
    console.log('📡 Fetching wiki nodes...');
    const nodes = await fetchWikiNodes();
    console.log(`📋 Found ${nodes.length} wiki nodes`);

    for (const node of nodes) {
      if (!node.obj_token || node.obj_type !== 'docx') continue;

      try {
        const docInfo = await fetchDocMarkdown(node.obj_token);
        if (!docInfo?.document?.markdown) continue;

        const markdown = docInfo.document.markdown;
        const prompts = parseDocMarkdownToPrompts(
          markdown,
          node.title || '未命名',
          node.node_token,
          node.obj_token
        );

        for (const prompt of prompts) {
          upsertPrompt({
            ...prompt,
            wiki_doc_title: node.title || prompt.wiki_doc_title,
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
