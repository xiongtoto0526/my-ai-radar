require('dotenv').config();

const http = require('http');
const { URL } = require('url');

const { getRuntimeConfig, validateApiServerEnv } = require('./config');
const { runRadar } = require('./radarRunner');

let isRunning = false;

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

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

async function handleRunRequest(request, response, runtimeConfig) {
  const requestApiKey = getApiKeyFromRequest(request);
  if (!requestApiKey || requestApiKey !== runtimeConfig.apiKey) {
    writeJson(response, 401, {
      error: 'Unauthorized'
    });
    return;
  }

  if (isRunning) {
    writeJson(response, 409, {
      error: 'Radar task is already running'
    });
    return;
  }

  let requestBody = {};
  try {
    requestBody = await readRequestBody(request);
  } catch {
    writeJson(response, 400, {
      error: 'Invalid JSON body'
    });
    return;
  }

  isRunning = true;

  try {
    const result = await runRadar({
      notify: requestBody.notify !== false
    });

    writeJson(response, 200, result);
  } catch (error) {
    writeJson(response, 500, {
      error: error.message
    });
  } finally {
    isRunning = false;
  }
}

function createServer() {
  const runtimeConfig = getRuntimeConfig();
  validateApiServerEnv(runtimeConfig);

  return http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      writeJson(response, 200, {
        ok: true,
        running: isRunning,
        service: 'my-ai-radar'
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/run') {
      await handleRunRequest(request, response, runtimeConfig);
      return;
    }

    writeJson(response, 404, {
      error: 'Not Found'
    });
  });
}

function startServer() {
  const runtimeConfig = getRuntimeConfig();
  validateApiServerEnv(runtimeConfig);

  const server = createServer();
  server.listen(runtimeConfig.apiPort, () => {
    console.log(`[api] listening on port ${runtimeConfig.apiPort}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  startServer
};