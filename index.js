// Bootstrap the TypeScript API entrypoint for hosts that start the package
// with plain `node`.
process.loadEnvFile?.('.env.local');
process.loadEnvFile?.('.env');

require('tsx/cjs');
require('./src/api.ts').startServer();
