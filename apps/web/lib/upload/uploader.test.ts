import { beforeEach, describe, expect, it, vi } from 'vitest';

let capturedSignal: AbortSignal | undefined;
let resolveUpload: ((value: unknown) => void) | undefined;
// Per-file capture for the multi-upload cancellation smoke.
const capturedSignals = new Map<string, AbortSignal | undefined>();
const pendingResolvers = new Map<string, (value: unknown) => void>();

vi.mock('@dofe/file-sdk-web', () => ({
  FileUploader: vi.fn(function FileUploaderMock() {
    return {
      upload: vi.fn((file: File, options: { signal?: AbortSignal }) => {
        capturedSignal = options.signal;
        capturedSignals.set(file.name, options.signal);
        return new Promise((resolve) => {
          resolveUpload = resolve;
          pendingResolvers.set(file.name, resolve);
        });
      }),
    };
  }),
}));

describe('uploadFile cancellation', () => {
  beforeEach(() => {
    capturedSignal = undefined;
    resolveUpload = undefined;
  });

  it('aborts the active upload signal when cancelUpload is called', async () => {
    const { cancelUpload, uploadFile } = await import('./uploader');
    const file = new File(['x'.repeat(1024 * 1024)], 'large-vibecoding.txt');

    const uploadPromise = uploadFile({ file }).catch(() => undefined);
    await vi.waitFor(() => expect(capturedSignal).toBeDefined());

    await cancelUpload(file.name);

    expect(capturedSignal?.aborted).toBe(true);

    resolveUpload?.({
      fileId: 'file-id',
      key: 'large-vibecoding.txt',
      url: '/large-vibecoding.txt',
      cdnUrl: null,
      bucket: 'general',
    });
    await uploadPromise;
  });
});

describe('uploadFile multi-upload cancellation (large-upload smoke)', () => {
  beforeEach(() => {
    capturedSignal = undefined;
    resolveUpload = undefined;
    capturedSignals.clear();
    pendingResolvers.clear();
  });

  it('aborts only the targeted upload when several large uploads are active', async () => {
    const { cancelUpload, uploadFile } = await import('./uploader');
    const fileA = new File(['x'.repeat(5 * 1024 * 1024)], 'large-multi-a.bin');
    const fileB = new File(['y'.repeat(8 * 1024 * 1024)], 'large-multi-b.bin');

    const promiseA = uploadFile({ file: fileA }).catch(() => undefined);
    const promiseB = uploadFile({ file: fileB }).catch(() => undefined);

    // Both uploads register their own AbortController/signal.
    await vi.waitFor(() => {
      expect(capturedSignals.get(fileA.name)).toBeDefined();
      expect(capturedSignals.get(fileB.name)).toBeDefined();
    });

    await cancelUpload(fileA.name);

    // Only the targeted upload is aborted; the sibling keeps running.
    expect(capturedSignals.get(fileA.name)?.aborted).toBe(true);
    expect(capturedSignals.get(fileB.name)?.aborted).toBe(false);

    // Settle both mock uploads so the suite can clean up.
    pendingResolvers.get(fileA.name)?.({
      fileId: 'file-id-a',
      key: fileA.name,
      url: `/${fileA.name}`,
      cdnUrl: null,
      bucket: 'general',
    });
    pendingResolvers.get(fileB.name)?.({
      fileId: 'file-id-b',
      key: fileB.name,
      url: `/${fileB.name}`,
      cdnUrl: null,
      bucket: 'general',
    });
    await Promise.all([promiseA, promiseB]);
  });
});
