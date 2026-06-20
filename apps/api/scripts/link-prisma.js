const fs = require('fs');
const path = require('path');

const apiRoot = path.resolve(__dirname, '..');
const generatedClient = path.join(apiRoot, 'generated', 'prisma-client');
const indexJsPath = path.join(generatedClient, 'index.js');
const indexDtsPath = path.join(generatedClient, 'index.d.ts');

if (!fs.existsSync(generatedClient)) {
  console.log('link-prisma: generated/prisma-client not found, skipping');
  process.exit(0);
}

function patchIndexJs() {
  if (!fs.existsSync(indexJsPath)) return false;

  const marker = 'SSO_FILE_ENUM_COMPAT_SHIM';
  const source = fs.readFileSync(indexJsPath, 'utf8');
  if (source.includes(marker)) return false;

  const shim = `
// ${marker}: local FileSource schema was removed; SSO owns file metadata.
const FileBucketVendorCompat = {
  oss: 'oss',
  us3: 'us3',
  qiniu: 'qiniu',
  s3: 's3',
  gcs: 'gcs',
  tos: 'tos',
  tencent: 'tencent',
  ksyun: 'ksyun',
};
const FileEnvTypeCompat = {
  dev: 'dev',
  test: 'test',
  prod: 'prod',
  produs: 'produs',
  prodap: 'prodap',
};
exports.FileBucketVendor = exports.$Enums.FileBucketVendor = FileBucketVendorCompat;
exports.FileEnvType = exports.$Enums.FileEnvType = FileEnvTypeCompat;
`;

  const needle = 'exports.Prisma.ModelName = {';
  const index = source.indexOf(needle);
  const patched = index === -1
    ? `${source}\n${shim}`
    : `${source.slice(0, index)}${shim}\n${source.slice(index)}`;

  fs.writeFileSync(indexJsPath, patched);
  return true;
}

function patchIndexDts() {
  if (!fs.existsSync(indexDtsPath)) return false;

  const marker = 'SSO_FILE_ENUM_COMPAT_SHIM';
  const source = fs.readFileSync(indexDtsPath, 'utf8');
  if (source.includes(marker)) return false;

  const shim = `
// ${marker}: compatibility exports for infra file DTO initialization.
export const FileBucketVendor: {
  oss: 'oss',
  us3: 'us3',
  qiniu: 'qiniu',
  s3: 's3',
  gcs: 'gcs',
  tos: 'tos',
  tencent: 'tencent',
  ksyun: 'ksyun',
}
export type FileBucketVendor = (typeof FileBucketVendor)[keyof typeof FileBucketVendor]
export const FileEnvType: {
  dev: 'dev',
  test: 'test',
  prod: 'prod',
  produs: 'produs',
  prodap: 'prodap',
}
export type FileEnvType = (typeof FileEnvType)[keyof typeof FileEnvType]
`;

  fs.writeFileSync(indexDtsPath, `${source}\n${shim}`);
  return true;
}

const changed = [patchIndexJs(), patchIndexDts()].some(Boolean);
console.log(
  changed
    ? 'link-prisma: patched generated Prisma client SSO file enum compatibility exports'
    : 'link-prisma: generated Prisma client compatibility exports already present',
);
