// Bootstrap the TypeScript API entrypoint for hosts that start the package
// with plain `node`.
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  process.loadEnvFile?.('.env.local');
}
if (fs.existsSync('.env')) {
  process.loadEnvFile?.('.env');
}

require('tsx/cjs');
require('./src/api.ts').startServer();
