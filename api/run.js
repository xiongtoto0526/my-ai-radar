const { handleRun } = require('../src/httpHandlers');

module.exports = async function runHandler(request, response) {
  await handleRun(request, response);
};