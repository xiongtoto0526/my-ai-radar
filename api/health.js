const { handleHealth } = require('../src/httpHandlers');

module.exports = async function healthHandler(request, response) {
  handleHealth(response);
};