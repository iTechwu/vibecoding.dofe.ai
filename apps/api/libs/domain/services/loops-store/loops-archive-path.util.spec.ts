import { archiveIndexDirectory, archiveIndexFile } from './loops-archive-path.util';

describe('Loops archive index paths', () => {
  it('keeps SSO-style identifiers inside the archive root', () => {
    expect(archiveIndexDirectory('/workspace/.loops', 'tenant_1-abc')).toBe(
      '/workspace/.loops/archives/tenant_1-abc',
    );
    expect(archiveIndexFile('/workspace/.loops', 'tenant_1-abc', 'archive-1')).toBe(
      '/workspace/.loops/archives/tenant_1-abc/archive-1.json',
    );
  });

  it.each(['', '.', '..', '../other', 'tenant/other', '/tmp/other', 'tenant%2Fother'])(
    'rejects an unsafe tenant identifier: %s',
    (tenantId) => {
      expect(() => archiveIndexDirectory('/workspace/.loops', tenantId)).toThrow(
        'archive tenant ID',
      );
    },
  );

  it.each(['../archive', 'archive/name', '/archive'])(
    'rejects an unsafe archive identifier: %s',
    (id) => {
      expect(() => archiveIndexFile('/workspace/.loops', 'tenant-1', id)).toThrow('archive ID');
    },
  );
});
