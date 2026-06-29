import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('favicon route', () => {
  it('redirects the browser default favicon request to the existing logo asset', () => {
    const response = GET(new Request('http://127.0.0.1:3003/favicon.ico') as never);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3003/logo.svg');
  });
});
