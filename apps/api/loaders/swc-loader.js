const swc = require('@swc/core');

module.exports = function (source) {
  const callback = this.async();
  const filePath = this.resourcePath;

  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

  swc.transform(source, {
    filename: filePath,
    sourceFileName: filePath,
    jsc: {
      parser: isTypeScript
        ? {
            syntax: 'typescript',
            decorators: true,
            dynamicImport: true,
          }
        : {
            syntax: 'ecmascript',
            decorators: true,
            dynamicImport: true,
          },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
      },
      target: 'es2022',
      externalHelpers: false,
    },
    module: {
      type: 'commonjs',
      strict: false,
      strictMode: true,
      lazy: false,
    },
    sourceMaps: true,
    isModule: 'unknown',
    swcrc: false,
  })
    .then((result) => {
      callback(null, result.code, result.map);
    })
    .catch((err) => {
      callback(new Error(`SWC transform failed for ${filePath}: ${err.message}`));
    });
};
