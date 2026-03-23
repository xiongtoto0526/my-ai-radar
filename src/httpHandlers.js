require('dotenv').config();

const { getRuntimeConfig, validateApiServerEnv, validateHistoryApiEnv } = require('./config');
const { runRadar } = require('./radarRunner');
const { readHistory } = require('./historyStore');

let isRunning = false;

function getApiKeyFromRequest(request) {
  const headerApiKey = request.headers['x-api-key'];
  if (headerApiKey) {
    return String(headerApiKey).trim();
  }

  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return '';
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch ? bearerMatch[1].trim() : '';
}

async function readRequestBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === 'string') {
    return request.body.trim() ? JSON.parse(request.body) : {};
  }

  if (Buffer.isBuffer(request.body)) {
    const rawBody = request.body.toString('utf8').trim();
    return rawBody ? JSON.parse(rawBody) : {};
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

function sendJson(response, statusCode, payload) {
  if (typeof response.status === 'function' && typeof response.json === 'function') {
    response.status(statusCode).json(payload);
    return;
  }

  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function handleHealth(response) {
  sendJson(response, 200, {
    ok: true,
    running: isRunning,
    service: 'my-ai-radar'
  });
}

function parseHistoryLimit(request) {
  const requestUrl = request.url || '';
  const baseUrl = `http://${request.headers.host || 'localhost'}`;
  const url = new URL(requestUrl, baseUrl);
  const rawLimit = url.searchParams.get('limit');

  if (!rawLimit) {
    return 20;
  }

  const parsedLimit = Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return null;
  }

  return Math.min(parsedLimit, 100);
}

function ensureAuthorized(request, response, runtimeConfig) {
  const requestApiKey = getApiKeyFromRequest(request);
  if (!requestApiKey || requestApiKey !== runtimeConfig.apiKey) {
    sendJson(response, 401, {
      error: 'Unauthorized'
    });
    return false;
  }

  return true;
}

async function handleHistory(request, response) {
  try {
    const runtimeConfig = getRuntimeConfig();
    validateHistoryApiEnv(runtimeConfig);

    if (!ensureAuthorized(request, response, runtimeConfig)) {
      return;
    }

    const limit = parseHistoryLimit(request);
    if (!limit) {
      sendJson(response, 400, {
        error: 'Invalid limit query parameter'
      });
      return;
    }

    const history = await readHistory(runtimeConfig);

    sendJson(response, 200, {
      updatedAt: history.updatedAt,
      total: history.items.length,
      items: history.items.slice(0, limit)
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message
    });
  }
}

async function handleRun(request, response) {
  const runtimeConfig = getRuntimeConfig();
  validateApiServerEnv(runtimeConfig);

  if (!ensureAuthorized(request, response, runtimeConfig)) {
    return;
  }

  if (isRunning) {
    sendJson(response, 409, {
      error: 'Radar task is already running'
    });
    return;
  }

  let requestBody = {};
  try {
    requestBody = await readRequestBody(request);
  } catch {
    sendJson(response, 400, {
      error: 'Invalid JSON body'
    });
    return;
  }

  isRunning = true;

  try {
    const result = await runRadar({
      notify: requestBody.notify !== false
    });

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message
    });
  } finally {
    isRunning = false;
  }
}

module.exports = {
  handleHealth,
  handleHistory,
  handleRun,
  readRequestBody,
  sendJson
};