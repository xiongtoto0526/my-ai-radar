const DEFAULT_TARGET_SITES = [
  {
    name: 'GitHub Copilot Changelog',
    url: 'https://github.blog/changelog/label/copilot',
    extractStrategy: 'latest-release'
  },
  {
    name: 'Cursor Changelog',
    url: 'https://cursor.com/changelog',
    extractStrategy: 'latest-release'
  },
  {
    name: 'Gemini API Changelog',
    url: 'https://ai.google.dev/gemini-api/docs/changelog',
    extractStrategy: 'latest-release'
  }
];

const HISTORY_COLLECTION_NAME = 'history_items';

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/$/, '');
}

function getDefaultModel(baseUrl) {
  if (baseUrl && baseUrl.includes('openrouter.ai')) {
    return 'openrouter/free';
  }

  return 'gpt-4o-mini';
}

function getDefaultFallbackModels(baseUrl) {
  return [];
}

function parseFallbackModels(rawValue, baseUrl) {
  if (!rawValue) {
    return getDefaultFallbackModels(baseUrl);
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTargetSites(rawValue) {
  if (!rawValue) {
    return DEFAULT_TARGET_SITES;
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((url, index) => ({
      name: getTargetSiteName(url, index),
      url,
      extractStrategy: getTargetSiteStrategy(url)
    }));
}

function getTargetSiteStrategy(url) {
  try {
    const parsedUrl = new URL(url);

    if (
      (parsedUrl.hostname === 'github.blog' && parsedUrl.pathname.includes('/changelog/label/copilot')) ||
      (parsedUrl.hostname === 'cursor.com' && parsedUrl.pathname.includes('/changelog')) ||
      (parsedUrl.hostname === 'ai.google.dev' && parsedUrl.pathname.includes('/gemini-api/docs/changelog'))
    ) {
      return 'latest-release';
    }

    return 'radar-list';
  } catch {
    return 'radar-list';
  }
}

function getTargetSiteName(url, index) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === 'github.blog' && parsedUrl.pathname.includes('/changelog/label/copilot')) {
      return 'GitHub Copilot Changelog';
    }

    if (parsedUrl.hostname === 'cursor.com' && parsedUrl.pathname.includes('/changelog')) {
      return 'Cursor Changelog';
    }

    if (parsedUrl.hostname === 'ai.google.dev' && parsedUrl.pathname.includes('/gemini-api/docs/changelog')) {
      return 'Gemini API Changelog';
    }

    return parsedUrl.hostname.replace(/^www\./, '');
  } catch {
    return `Source ${index + 1}`;
  }
}

function getRuntimeConfig() {
  const llmApiKey = process.env.LLM_API_KEY;
  const llmBaseUrl = process.env.LLM_BASE_URL;
  const mongodbUri = process.env.MONGODB_URI;
  const wechatWebhook = process.env.WECHAT_WEBHOOK;
  const normalizedBaseUrl = llmBaseUrl ? normalizeBaseUrl(llmBaseUrl) : '';

  return {
    apiKey: process.env.RADAR_API_KEY,
    apiPort: Number(process.env.PORT || process.env.RADAR_API_PORT || 3000),
    llmApiKey,
    llmBaseUrl: normalizedBaseUrl,
    llmModel: process.env.LLM_MODEL || getDefaultModel(normalizedBaseUrl),
    llmModelFallbacks: parseFallbackModels(process.env.LLM_MODEL_FALLBACKS, normalizedBaseUrl),
    mongodbCollectionName: HISTORY_COLLECTION_NAME,
    mongodbDbName: process.env.MONGODB_DB_NAME || 'my_ai_radar',
    mongodbUri,
    wechatWebhook,
    targetSites: parseTargetSites(process.env.RADAR_TARGET_URLS),
    maxContentChars: 10000,
    maxHistoryItems: 500,
    requestTimeoutMs: 30000,
    llmRequestTimeoutMs: Number(process.env.LLM_REQUEST_TIMEOUT_MS || 45000)
  };
}

function validateRequiredEnv(config) {
  const missingKeys = [];

  if (!config.llmApiKey) {
    missingKeys.push('LLM_API_KEY');
  }

  if (!config.llmBaseUrl) {
    missingKeys.push('LLM_BASE_URL');
  }

  if (!config.mongodbUri) {
    missingKeys.push('MONGODB_URI');
  }

  if (!config.wechatWebhook) {
    missingKeys.push('WECHAT_WEBHOOK');
  }

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }
}

function validateApiServerEnv(config) {
  validateRequiredEnv(config);

  if (!config.apiKey) {
    throw new Error('Missing required environment variables: RADAR_API_KEY');
  }

  if (!Number.isInteger(config.apiPort) || config.apiPort <= 0) {
    throw new Error('RADAR_API_PORT or PORT must be a valid positive integer');
  }
}

module.exports = {
  DEFAULT_TARGET_SITES,
  getRuntimeConfig,
  getDefaultModel,
  getDefaultFallbackModels,
  validateApiServerEnv,
  validateRequiredEnv
};
