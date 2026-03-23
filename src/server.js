require('dotenv').config();

const http = require('http');
const { URL } = require('url');

const { getRuntimeConfig, validateApiServerEnv } = require('./config');
const { handleHealth, handleHistory, handleRun, sendJson } = require('./httpHandlers');

function createServer() {
  const runtimeConfig = getRuntimeConfig();
  validateApiServerEnv(runtimeConfig);

  return http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      handleHealth(response);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/history') {
      await handleHistory(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/run') {
      await handleRun(request, response);
      return;
    }

    sendJson(response, 404, {
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