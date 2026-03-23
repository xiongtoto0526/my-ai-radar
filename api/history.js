const { handleHistory } = require('../src/httpHandlers');

module.exports = async function historyHandler(request, response) {
  await handleHistory(request, response);
};