import * as winston from 'winston';
import {
  redactSecretUrls,
  redactSecretUrlsDeep,
  redactSecretUrlsInText,
} from './log-redaction.util';

describe('redactSecretUrlsInText', () => {
  it('masks credentials in amqp/redis/postgres URLs while keeping host/port/path', () => {
    expect(redactSecretUrlsInText('amqp://dofe:password@127.0.0.1:5672/vibecoding_dofe')).toBe(
      'amqp://***@127.0.0.1:5672/vibecoding_dofe',
    );
    expect(redactSecretUrlsInText('redis://:secret@127.0.0.1:6379')).toBe(
      'redis://***@127.0.0.1:6379',
    );
    expect(redactSecretUrlsInText('postgres://user:pass@db:5432/app')).toBe(
      'postgres://***@db:5432/app',
    );
  });

  it('leaves credential-less URLs untouched', () => {
    expect(redactSecretUrlsInText('https://api.example.com/path')).toBe(
      'https://api.example.com/path',
    );
    expect(redactSecretUrlsInText('http://127.0.0.1:13100/auth/oidc/callback')).toBe(
      'http://127.0.0.1:13100/auth/oidc/callback',
    );
  });

  it('redacts every occurrence in a longer log line', () => {
    const redacted = redactSecretUrlsInText(
      'connecting amqp://dofe:password@broker:5672 then redis://:s@cache:6379',
    );
    expect(redacted).toBe('connecting amqp://***@broker:5672 then redis://***@cache:6379');
    expect(redacted).not.toContain('password');
  });
});

describe('redactSecretUrlsDeep', () => {
  it('redacts strings nested inside error-like meta', () => {
    expect(
      redactSecretUrlsDeep({
        error: { message: 'connect ECONNREFUSED amqp://u:p@host:5672' },
      }),
    ).toEqual({ error: { message: 'connect ECONNREFUSED amqp://***@host:5672' } });
  });

  it('returns primitives and credential-free structures unchanged by reference', () => {
    const original = { ok: true, name: 'RabbitMQ', url: 'https://host/path' };
    expect(redactSecretUrlsDeep(original)).toBe(original);
    expect(redactSecretUrlsDeep(42)).toBe(42);
    expect(redactSecretUrlsDeep(null)).toBeNull();
  });
});

describe('redactSecretUrls winston format', () => {
  it('masks credentials in the winston info message and meta in place', () => {
    const info = {
      level: 'info',
      message: 'connecting amqp://dofe:password@127.0.0.1:5672',
      connectionUrl: 'redis://:secret@127.0.0.1:6379',
    } as unknown as winston.Logform.TransformableInfo;

    const result = redactSecretUrls().transform(info);

    expect((result as { message: string }).message).toBe('connecting amqp://***@127.0.0.1:5672');
    expect((result as { connectionUrl: string }).connectionUrl).toBe('redis://***@127.0.0.1:6379');
  });

  it('does not alter credential-free log entries', () => {
    const info = {
      level: 'info',
      message: 'Loops workspace profile not readable; using default.',
    } as unknown as winston.Logform.TransformableInfo;

    const result = redactSecretUrls().transform(info);
    expect((result as { message: string }).message).toBe(
      'Loops workspace profile not readable; using default.',
    );
  });

  it('composes with the app winston config so credentials never reach a transport', () => {
    const format = winston.format.combine(
      redactSecretUrls(),
      winston.format.printf((entry) => `[${entry.level}] ${entry.message}`),
    );
    const info = {
      level: 'warn',
      message: 'RabbitMQ connection error amqp://dofe:password@broker:5672',
    } as unknown as winston.Logform.TransformableInfo;

    const result = format.transform(info) as winston.Logform.TransformableInfo & {
      [Symbol.for('message')]: string;
    };
    expect(result[Symbol.for('message')]).toBe(
      '[warn] RabbitMQ connection error amqp://***@broker:5672',
    );
  });
});
