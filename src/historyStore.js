const fs = require('fs/promises');

async function readHistory(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    return {
      updatedAt: parsed.updatedAt || null,
      items: Array.isArray(parsed.items) ? parsed.items : []
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        updatedAt: null,
        items: []
      };
    }

    throw error;
  }
}

function createFingerprint(item) {
  return `${item.name || ''}|${item.publishedAt || ''}|${item.sourceUrl || ''}`.trim().toLowerCase();
}

function mergeHistory(history, items, maxHistoryItems) {
  const now = new Date().toISOString();
  const existingFingerprints = new Set(history.items.map((item) => item.fingerprint));
  const mergedItems = [...history.items];

  for (const item of items) {
    const fingerprint = createFingerprint(item);

    if (!fingerprint || existingFingerprints.has(fingerprint)) {
      continue;
    }

    existingFingerprints.add(fingerprint);
    mergedItems.unshift({
      fingerprint,
      name: item.name,
      publishedAt: item.publishedAt || '',
      sourceUrl: item.sourceUrl,
      createdAt: now
    });
  }

  return {
    updatedAt: now,
    items: mergedItems.slice(0, maxHistoryItems)
  };
}

async function writeHistory(filePath, history) {
  await fs.writeFile(filePath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

module.exports = {
  createFingerprint,
  mergeHistory,
  readHistory,
  writeHistory
};
