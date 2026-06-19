const fs = require('fs');
const path = require('path');

const apiRoot = path.resolve(__dirname, '..');
const generatedClient = path.join(apiRoot, 'generated', 'prisma-client');

if (!fs.existsSync(generatedClient)) {
  console.log('link-prisma: generated/prisma-client not found, skipping');
  process.exit(0);
}

// Since @prisma/client is now bundled via webpack (bundleAllowlist),
// no symlink is needed for the NestJS build. This script is kept as
// a no-op for compatibility with the postinstall hook.
console.log('link-prisma: @prisma/client is bundled by webpack, no symlink needed');
