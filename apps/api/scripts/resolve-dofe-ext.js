/**
 * Node.js preload script: patches module resolution for @dofe/infra-* packages
 * to handle extensionless subpath requires in Node.js 25.
 *
 * Node.js 25's exports field resolution with wildcard patterns like "./dist/*"
 * doesn't auto-append .js extensions or resolve directory index.js.
 * This script bypasses the exports field and resolves subpath requires directly
 * to their actual file locations.
 */
const Module = require('module');
const path = require('path');
const fs = require('fs');

const originalResolveFilename = Module._resolveFilename;
const distDirCache = new Map();

function getDistDir(packageName, parent, isMain, options) {
  if (distDirCache.has(packageName)) return distDirCache.get(packageName);

  let pkgDir;
  try {
    const mainPath = originalResolveFilename.call(Module, packageName, parent, isMain, options);
    pkgDir = mainPath.replace(/\/dist\/.*$/, '');
  } catch {
    return null;
  }

  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return null;

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const exportsMap = pkgJson.exports || {};

  for (const [key, val] of Object.entries(exportsMap)) {
    if (!key.includes('*')) continue;

    const target = Array.isArray(val.default) ? val.default[val.default.length - 1] : val.default;
    if (typeof target !== 'string') continue;

    const dir = target.replace(/\/\*$/, '');
    const distDir = path.join(pkgDir, dir);
    if (fs.existsSync(distDir)) {
      distDirCache.set(packageName, distDir);
      return distDir;
    }
  }

  const fallbackDir = path.join(pkgDir, 'dist');
  distDirCache.set(packageName, fallbackDir);
  return fallbackDir;
}

Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request !== 'string' || !request.startsWith('@dofe/infra-')) {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  }

  const parts = request.split('/');
  const packageName = parts.slice(0, 2).join('/');
  const subpath = parts.slice(2).join('/');

  if (!subpath) {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  }

  const distDir = getDistDir(packageName, parent, isMain, options);
  if (!distDir) {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  }

  const cleanSubpath = subpath.endsWith('.js') ? subpath.slice(0, -3) : subpath;
  const candidates = [
    path.join(distDir, cleanSubpath + '.js'),
    path.join(distDir, cleanSubpath, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
