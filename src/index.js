require('dotenv').config();

const { runRadar } = require('./radarRunner');

runRadar().catch((error) => {
  console.error(`[fatal] ${error.message}`);
  process.exitCode = 1;
});
