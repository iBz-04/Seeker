// Bootstrap the TypeScript API entrypoint for hosts that start the package
// with plain `node`.
require('tsx/cjs');
require('./src/api.ts').startServer();
