const { getRuntimeConfig, validateRequiredEnv } = require('./config');
const { readHistory, writeHistory, mergeHistory, createFingerprint } = require('./historyStore');
const { scrapeSites } = require('./scraper');
const { processSource, deduplicateItems } = require('./processor');
const { formatRadarMessage, sendWechatNotification } = require('./notifier');

async function runRadar(options = {}) {
  const config = getRuntimeConfig();
  validateRequiredEnv(config);

  const shouldNotify = options.notify !== false;
  const history = await readHistory(config.historyFilePath);
  const historyFingerprints = history.items.map((item) => item.fingerprint).filter(Boolean);
  const scrapedResults = await scrapeSites(config.targetSites, config);
  const collectedItems = [];
  const sourceSummaries = [];

  for (const source of scrapedResults) {
    if (source.error) {
      console.error(`[scraper] ${source.name} failed: ${source.error}`);
      sourceSummaries.push({
        name: source.name,
        status: 'scrape_failed',
        error: source.error,
        extractedCount: 0
      });
      continue;
    }

    try {
      const items = await processSource(source, config, historyFingerprints);
      collectedItems.push(...items);
      sourceSummaries.push({
        name: source.name,
        status: 'ok',
        error: null,
        extractedCount: items.length
      });
      console.log(`[processor] ${source.name}: extracted ${items.length} item(s)`);

      for (const item of items) {
        const publishedAtLabel = item.publishedAt || 'unknown';
        console.log(`[item] ${source.name}: ${item.name} | publishedAt=${publishedAtLabel} | url=${item.sourceUrl}`);
      }
    } catch (error) {
      console.error(`[processor] ${source.name} failed: ${error.message}`);
      sourceSummaries.push({
        name: source.name,
        status: 'process_failed',
        error: error.message,
        extractedCount: 0
      });
    }
  }

  const deduplicatedItems = deduplicateItems(collectedItems, historyFingerprints);
  console.log(`[dedupe] ${collectedItems.length} item(s) before dedupe, ${deduplicatedItems.length} item(s) after dedupe`);
  const message = formatRadarMessage(deduplicatedItems);

  if (shouldNotify) {
    await sendWechatNotification(config.wechatWebhook, message);
    console.log(`[notifier] sent ${deduplicatedItems.length} item(s) to WeChat`);
  }

  const historyToPersist = mergeHistory(history, deduplicatedItems.map((item) => ({
    ...item,
    fingerprint: createFingerprint(item)
  })), config.maxHistoryItems);

  await writeHistory(config.historyFilePath, historyToPersist);

  return {
    triggeredAt: new Date().toISOString(),
    notified: shouldNotify,
    sourceSummaries,
    totalExtracted: collectedItems.length,
    totalDeduplicated: deduplicatedItems.length,
    items: deduplicatedItems,
    historyUpdatedAt: historyToPersist.updatedAt,
    message
  };
}

module.exports = {
  runRadar
};