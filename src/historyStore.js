const { MongoClient } = require('mongodb');

let clientPromise;
let indexesReadyPromise;

function getMongoClient(mongodbUri) {
  if (!clientPromise) {
    const client = new MongoClient(mongodbUri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

async function getHistoryCollection(config) {
  const client = await getMongoClient(config.mongodbUri);
  const collection = client
    .db(config.mongodbDbName)
    .collection(config.mongodbCollectionName);

  if (!indexesReadyPromise) {
    indexesReadyPromise = Promise.all([
      collection.createIndex({ fingerprint: 1 }, { unique: true }),
      collection.createIndex({ createdAt: -1 })
    ]);
  }

  await indexesReadyPromise;
  return collection;
}

async function readHistory(config) {
  const collection = await getHistoryCollection(config);
  const items = await collection
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(config.maxHistoryItems)
    .toArray();

  return {
    updatedAt: items[0]?.createdAt || null,
    items
  };
}

function createFingerprint(item) {
  return `${item.name || ''}|${item.publishedAt || ''}|${item.sourceUrl || ''}`.trim().toLowerCase();
}

async function appendHistory(config, items) {
  if (!items.length) {
    return readHistory(config);
  }

  const collection = await getHistoryCollection(config);
  const now = new Date().toISOString();

  for (const item of items) {
    const fingerprint = createFingerprint(item);

    if (!fingerprint) {
      continue;
    }

    await collection.updateOne(
      { fingerprint },
      {
        $setOnInsert: {
          fingerprint,
          name: item.name,
          publishedAt: item.publishedAt || '',
          sourceUrl: item.sourceUrl,
          createdAt: now
        }
      },
      { upsert: true }
    );
  }

  const overflowItems = await collection
    .find({}, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .skip(config.maxHistoryItems)
    .toArray();

  if (overflowItems.length) {
    await collection.deleteMany({
      _id: {
        $in: overflowItems.map((item) => item._id)
      }
    });
  }

  return readHistory(config);
}

module.exports = {
  appendHistory,
  createFingerprint,
  readHistory
};
