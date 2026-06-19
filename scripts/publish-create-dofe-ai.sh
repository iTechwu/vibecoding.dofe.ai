#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_DIR="$REPO_ROOT/packages/create-dofe-ai"

BUMP="${1:-patch}"

case "$BUMP" in
  major|minor|patch) ;;
  *)
    echo "Usage: $0 [major|minor|patch]"
    echo "Default: patch"
    exit 1
    ;;
esac

echo "==> Logging into npm..."
npm login

echo "==> Exporting scaffold template..."
cd "$REPO_ROOT"
pnpm run export-scaffold

echo "==> Bumping version ($BUMP)..."
cd "$PKG_DIR"
npm version "$BUMP" --no-git-tag-version

NEW_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "==> New version: $NEW_VERSION"

echo "==> Publishing create-dofe-ai@$NEW_VERSION..."
npm publish

echo "==> Done: create-dofe-ai@$NEW_VERSION published"
