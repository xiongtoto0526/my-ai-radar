require('dotenv').config();

const { getRuntimeConfig, validateRequiredEnv } = require('./config');
const { readHistory, writeHistory, mergeHistory, createFingerprint } = require('./historyStore');
const { scrapeSites } = require('./scraper');
const { processSource, deduplicateItems } = require('./processor');
const { formatRadarMessage, sendWechatNotification } = require('./notifier');

async function run() {
  const config = getRuntimeConfig();
  validateRequiredEnv(config);

  const history = await readHistory(config.historyFilePath);
  const historyFingerprints = history.items.map((item) => item.fingerprint).filter(Boolean);
  const scrapedResults = await scrapeSites(config.targetSites, config);
  const collectedItems = [];

  for (const source of scrapedResults) {
    if (source.error) {
      console.error(`[scraper] ${source.name} failed: ${source.error}`);
      continue;
    }

    try {
      const items = await processSource(source, config, historyFingerprints);
      collectedItems.push(...items);
      console.log(`[processor] ${source.name}: extracted ${items.length} item(s)`);
    } catch (error) {
      console.error(`[processor] ${source.name} failed: ${error.message}`);
    }
  }

  const deduplicatedItems = deduplicateItems(collectedItems, historyFingerprints);
  const message = formatRadarMessage(deduplicatedItems);

  await sendWechatNotification(config.wechatWebhook, message);
  console.log(`[notifier] sent ${deduplicatedItems.length} item(s) to WeChat`);

  const historyToPersist = mergeHistory(history, deduplicatedItems.map((item) => ({
    ...item,
    fingerprint: createFingerprint(item)
  })), config.maxHistoryItems);

  await writeHistory(config.historyFilePath, historyToPersist);
}

run().catch((error) => {
  console.error(`[fatal] ${error.message}`);
  process.exitCode = 1;
});
