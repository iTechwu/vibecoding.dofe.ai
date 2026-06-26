/**
 * File upload — via @dofe/file-sdk-web → sso.dofe.ai
 *
 * Public API preserved for backward compatibility with existing consumers.
 */
import { FileUploader } from '@dofe/file-sdk-web';
import { UploadError, UploadErrorCode } from './errors';
import type { UploadMetadata } from './api';

const uploader = new FileUploader({
  apiBase: '/api/proxy/sso',
});

type UploadOptionsWithSignal = Parameters<FileUploader['upload']>[1] & {
  signal: AbortSignal;
};

/** Track active uploads for cancellation */
const activeUploads = new Map<string, AbortController>();

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  partNumber?: number;
}

export interface UploadResult {
  id: string;
  fileId: string;
  key: string;
  url: string;
  cdnUrl: string | null;
  bucket: string;
}

export interface UploadCallbacks {
  onStart?: (fileId: string, uploadId?: string) => void;
  onCalculating?: (progress: number) => void;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

export interface UploadParams {
  file: File;
  callbacks?: UploadCallbacks;
  metadata?: UploadMetadata;
}

export async function uploadFile(params: UploadParams): Promise<UploadResult> {
  const { file, callbacks, metadata } = params;

  callbacks?.onCalculating?.(0);

  // Create an AbortController for this upload
  const controller = new AbortController();
  const uploadKey = file.name;
  activeUploads.set(uploadKey, controller);

  try {
    const uploadOptions: UploadOptionsWithSignal = {
      scope: 'general',
      metadata,
      signal: controller.signal,
      onProgress: ({ percent, loaded, total }) => {
        callbacks?.onProgress?.({ percentage: percent, loaded, total });
      },
    };

    const result = await uploader.upload(file, uploadOptions);

    callbacks?.onCalculating?.(100);
    callbacks?.onStart?.(result.fileId);

    const uploadResult: UploadResult = {
      id: result.fileId,
      fileId: result.fileId,
      key: result.key,
      url: result.url,
      cdnUrl: result.cdnUrl,
      bucket: result.bucket,
    };

    callbacks?.onComplete?.(uploadResult);
    return uploadResult;
  } catch (error) {
    const uploadError =
      error instanceof UploadError ? error : new UploadError(UploadErrorCode.UPLOAD_FAILED);
    callbacks?.onError?.(uploadError);
    throw uploadError;
  } finally {
    activeUploads.delete(uploadKey);
  }
}

export async function cancelUpload(filename: string, _fileId: string): Promise<void> {
  const controller = activeUploads.get(filename);
  if (controller) {
    controller.abort();
    activeUploads.delete(filename);
  }
}
