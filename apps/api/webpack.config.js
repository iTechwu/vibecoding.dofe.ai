// NestJS webpack config for monorepo (pnpm)
// - Replaces ts-loader with SWC for ALL .ts files (avoids ts-loader OOM with TS6)
// - Adds resolve aliases from tsconfig.json to match path mappings
// - Bundles @dofe/infra-*, @repo/*, and @app/* packages (use app-level aliases and TS source)
// - Handles pnpm's nested node_modules structure for reliable externals
// - Type checking is done separately via ForkTsCheckerWebpackPlugin or `tsc --noEmit`
const path = require('path');
const fs = require('fs');
const nodeExternals = require('webpack-node-externals');

const apiRoot = __dirname;
const rootDir = path.resolve(apiRoot, '..', '..');

// For pnpm, check both app-level and root-level node_modules
const modulesDirs = [
  path.resolve(apiRoot, 'node_modules'),
  path.resolve(rootDir, 'node_modules'),
];

function buildAliasesFromTsconfig() {
  const tsconfigPath = path.join(apiRoot, 'tsconfig.json');
  const raw = fs.readFileSync(tsconfigPath, 'utf8');
  const cleaned = raw.replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/gm, '$1');
  const tsconfig = JSON.parse(cleaned);
  const paths = tsconfig.compilerOptions.paths || {};
  const aliases = {};

  for (const [pattern, targets] of Object.entries(paths)) {
    if (pattern === '*' || pattern === '@app/db/*') continue;

    const aliasKey = pattern.replace(/\/\*$/, '');
    const target = targets[0].replace(/\/\*$/, '');

    // "@dofe/infra-clients/*" → "dist/internal/*" → stripped alias
    // "@dofe/infra-clients" → "dist/internal/" which has no index.js,
    // shadowing the package's real entry point (dist/index.js).
    // Let TsconfigPathsPlugin handle this instead.
    if (pattern === '@dofe/infra-clients/*') continue;

    if (target.startsWith('.') || target.startsWith('node_modules/')) {
      aliases[aliasKey] = path.resolve(apiRoot, target);
    }
  }

  return aliases;
}

module.exports = function (options, webpack) {
  // Remove ForkTsCheckerWebpackPlugin — it OOMs with TS6 and type checking
  // is better done separately via `tsc --noEmit` (pnpm type-check).
  const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
  const plugins = (options.plugins || []).filter((plugin) => {
    return !(plugin instanceof ForkTsCheckerWebpackPlugin);
  });
  const tsconfigAliases = buildAliasesFromTsconfig();
  const prismaEnumShim = `
try {
  const prismaClient = require('@prisma/client');
  prismaClient.FileBucketVendor ??= {
    oss: 'oss',
    us3: 'us3',
    qiniu: 'qiniu',
    s3: 's3',
    gcs: 'gcs',
    tos: 'tos',
    tencent: 'tencent',
    ksyun: 'ksyun',
  };
  prismaClient.FileEnvType ??= {
    dev: 'dev',
    test: 'test',
    prod: 'prod',
    produs: 'produs',
    prodap: 'prodap',
  };
} catch {}
`;

  // Check if node_modules directories exist
  const existingModulesDirs = modulesDirs.filter((dir) => fs.existsSync(dir));
  if (existingModulesDirs.length === 0) {
    console.warn(
      '[webpack] Warning: No node_modules found in ' + modulesDirs.join(' or ') +
      '. Run `pnpm install` first. Falling back to default externals.',
    );
  }

  const bundleAllowlist = [/^@dofe\/infra-/, /^@repo\//, /^@app\//, /^@prisma\/client$/];

  // Native modules that must always be externalized (use .node binary prebuilds).
  // nodeExternals and pnpmExternals normally catch these, but in pnpm's nested
  // structure they can sometimes fall through and be bundled — which breaks
  // node-gyp-build's prebuild resolution at runtime.
  const nativeModules = [/^bcrypt$/, /^node-gyp-build$/];
  const nativeExternals = function ({ request }, callback) {
    if (nativeModules.some((pattern) => pattern.test(request))) {
      return callback(null, 'commonjs ' + request);
    }
    return callback();
  };

  // Create externals for each modulesDir (handles pnpm's structure)
  const externalsFns = existingModulesDirs.map((dir) =>
    nodeExternals({
      modulesDir: dir,
      allowlist: bundleAllowlist,
    })
  );

  // Custom externals function to handle pnpm's nested .pnpm node_modules
  // This catches transitive dependencies like 'httpx' that are nested inside .pnpm/*/node_modules
  const pnpmExternals = function ({ request }, callback) {
    // Skip bundled packages
    if (bundleAllowlist.some((pattern) => pattern.test(request))) {
      return callback();
    }
    // Skip relative imports
    if (request.startsWith('.') || request.startsWith('/')) {
      return callback();
    }
    // Try to resolve the module from any node_modules location
    try {
      // Use require.resolve to check if module exists in the resolution chain
      require.resolve(request, { paths: [apiRoot, rootDir] });
      // Module can be resolved, externalize it
      return callback(null, 'commonjs ' + request);
    } catch (e) {
      // Module cannot be resolved, let webpack try to bundle it
      return callback();
    }
  };

  // Replace ts-loader with SWC loader for ALL .ts files.
  // ts-loader runs out of memory with TypeScript 6.x; SWC handles it fine.
  const swcLoaderPath = path.join(apiRoot, 'loaders', 'swc-loader.js');
  const rules = (options.module.rules || []).map((rule) => {
    if (rule && rule.test && typeof rule.test.test === 'function') {
      // Replace ts-loader rules with SWC loader
      if (rule.test.test('file.ts') || rule.test.test('file.tsx')) {
        return {
          test: /\.(tsx?|js)$/,
          exclude: /generated[/\\]prisma-client[/\\]/,
          use: [{ loader: swcLoaderPath }],
        };
      }
    }
    return rule;
  });

  return {
    ...options,
    // Combine nodeExternals for direct dependencies and pnpmExternals for transitive ones
    externals: [nativeExternals, ...externalsFns, pnpmExternals],
    module: {
      ...options.module,
      rules,
    },
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve.alias,
        ...tsconfigAliases,
        // @dofe/infra-* 0.1.22 exports default uses array format
        // (['./dist/*.js','./dist/*/index.js','./dist/*']) which webpack
        // enhanced-resolve does not fully support for directory subpaths.
        // Map directory imports directly to bypass the exports field.
        '@dofe/infra-common/config': path.join(
          modulesDirs[0],
          '@dofe/infra-common/dist/config',
        ),
        '@dofe/infra-common/ts-rest': path.join(
          modulesDirs[0],
          '@dofe/infra-common/dist/ts-rest',
        ),
        '@dofe/infra-clients/crypt': path.join(
          modulesDirs[0],
          '@dofe/infra-clients/dist/internal/crypt',
        ),
        '@dofe/infra-clients/file-storage': path.join(
          modulesDirs[0],
          '@dofe/infra-clients/dist/internal/file-storage',
        ),
        '@dofe/infra-clients/sms': path.join(
          modulesDirs[0],
          '@dofe/infra-clients/dist/internal/sms',
        ),
      },
      symlinks: false,
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: prismaEnumShim,
        raw: true,
        entryOnly: true,
      }),
      ...plugins,
    ],
    // Suppress "failed to read input source map" warnings from generated Prisma files
    stats: {
      ...options.stats,
      warningsFilter: /failed to read input source map/,
    },
  };
};
