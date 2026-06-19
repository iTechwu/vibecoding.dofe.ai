import * as path from 'path';
import type { AppConfig, ZoneConfig } from '@dofe/infra-common';

export interface I18nBootstrapOptions {
  appConfig: AppConfig;
  baseZone?: string;
  projectRoot?: string;
  cwd?: string;
}

export interface I18nRootOptions {
  fallbackLanguage: string;
  loaderOptions: {
    path: string;
    watch: boolean;
  };
}

export function resolveProjectRoot(projectRoot?: string, cwd: string = process.cwd()): string {
  if (projectRoot?.includes('$(pwd)')) {
    return projectRoot.replace('$(pwd)', cwd);
  }
  return projectRoot || cwd;
}

export function resolveAppZone(appConfig: AppConfig, baseZone: string = 'cn'): ZoneConfig {
  const zone = appConfig.zones.find((config: ZoneConfig) => config.zone === baseZone);
  if (!zone) {
    throw new Error('Zone not found');
  }
  return zone;
}

export function createI18nRootOptions({
  appConfig,
  baseZone = process.env.BASE_ZONE || 'cn',
  projectRoot = process.env.PROJECT_ROOT,
  cwd = process.cwd(),
}: I18nBootstrapOptions): I18nRootOptions {
  const zone = resolveAppZone(appConfig, baseZone);
  const resolvedProjectRoot = resolveProjectRoot(projectRoot, cwd);

  return {
    fallbackLanguage: zone.locale,
    loaderOptions: {
      path: path.join(resolvedProjectRoot, 'node_modules', '@dofe', 'infra-i18n', 'dist'),
      watch: true,
    },
  };
}
