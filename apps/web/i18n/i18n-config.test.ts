import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales, namespaces } from './config';

type MessageValue =
  | string
  | number
  | boolean
  | null
  | MessageValue[]
  | { [key: string]: MessageValue };

const localeRoot = path.resolve(__dirname, '../locales');

function readMessages(locale: string, namespace: string): MessageValue {
  return JSON.parse(
    fs.readFileSync(path.join(localeRoot, locale, `${namespace}.json`), 'utf8'),
  ) as MessageValue;
}

function flattenTypes(value: MessageValue, prefix = ''): Record<string, string> {
  if (Array.isArray(value)) {
    return { [prefix]: 'array' };
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, string>>(
      (acc, [key, child]) => ({
        ...acc,
        ...flattenTypes(child, prefix ? `${prefix}.${key}` : key),
      }),
      prefix ? { [prefix]: 'object' } : {},
    );
  }

  return { [prefix]: typeof value };
}

function getMessage(messages: MessageValue, keyPath: string): MessageValue | undefined {
  return keyPath.split('.').reduce<MessageValue | undefined>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return current[segment];
  }, messages);
}

describe('i18n configuration', () => {
  it('has one JSON message file for every configured locale and namespace', () => {
    for (const locale of locales) {
      for (const namespace of namespaces) {
        expect(
          fs.existsSync(path.join(localeRoot, locale, `${namespace}.json`)),
          `${locale}/${namespace}.json should exist`,
        ).toBe(true);
      }
    }
  });

  it('keeps English and Chinese message key structures in sync', () => {
    for (const namespace of namespaces) {
      const enTypes = flattenTypes(readMessages('en', namespace));
      const zhTypes = flattenTypes(readMessages('zh-CN', namespace));

      expect(Object.keys(zhTypes).sort(), `${namespace} zh-CN keys`).toEqual(
        Object.keys(enTypes).sort(),
      );

      for (const key of Object.keys(enTypes)) {
        expect(zhTypes[key], `${namespace}.${key} type`).toBe(enTypes[key]);
      }
    }
  });

  it('resolves navigation keys used by shared layout components in every locale', () => {
    const requiredNavigationKeys = [
      'groupMain',
      'groupSettings',
      'menu.dashboard',
      'menu.search',
      'menu.account',
      'menu.logout',
      'a11y.switchLanguage',
    ];

    for (const locale of locales) {
      const navigation = readMessages(locale, 'navigation');

      for (const key of requiredNavigationKeys) {
        expect(getMessage(navigation, key), `${locale}/navigation.${key}`).toBeTypeOf('string');
      }
    }
  });
});
