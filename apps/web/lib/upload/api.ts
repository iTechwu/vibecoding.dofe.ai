/**
 * Upload API — DEPRECATED
 *
 * 文件上传已统一到 sso.dofe.ai。
 * 请使用 @dofe/file-sdk-web 的 FileUploader 替代所有上传逻辑。
 *
 * @deprecated 使用 @dofe/file-sdk-web:
 *   import { FileUploader } from '@dofe/file-sdk-web';
 *   const uploader = new FileUploader({ apiBase: '/api/proxy/sso' });
 *   await uploader.upload(file, { scope: 'general' });
 *   // 或分片上传:
 *   await uploader.uploadMultipart(file, { scope: 'general', partSize: 5*1024*1024 });
 *
 * 详见: sso.dofe.ai/docs/0614/07-实施记录.md
 */

import { UploadError, UploadErrorCode } from './errors';

const DEPRECATION_MSG =
  'upload/api 已废弃。请迁移到 @dofe/file-sdk-web。详见 sso.dofe.ai/docs/0614/';

export interface GetUploadTokenParams {
  filename: string;
  signature: string;
  fsize: number;
  thumbImg?: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
}

export type UploadTokenData = Record<string, unknown>;

export async function getUploadTokenPrivate(
  _params: GetUploadTokenParams,
): Promise<UploadTokenData> {
  throw new UploadError(UploadErrorCode.GET_UPLOAD_TOKEN_FAILED, DEPRECATION_MSG);
}

export interface InitMultipartUploadParams {
  signature: string;
  filename: string;
  fsize: number;
  sha256?: string;
  metadata?: Record<string, unknown>;
}

export type InitMultipartUploadData = Record<string, unknown>;

export async function initMultipartUpload(
  _params: InitMultipartUploadParams,
): Promise<InitMultipartUploadData> {
  throw new UploadError(UploadErrorCode.INIT_MULTIPART_FAILED, DEPRECATION_MSG);
}

export interface GetChunkUploadTokenParams {
  signature: string;
  filename: string;
  uploadId: string;
  partNumber: number;
  fsize: number;
  key: string;
}

export interface ChunkUploadTokenData {
  token: string;
}

export async function getChunkUploadToken(
  _params: GetChunkUploadTokenParams,
): Promise<ChunkUploadTokenData> {
  throw new UploadError(UploadErrorCode.GET_CHUNK_TOKEN_FAILED, DEPRECATION_MSG);
}

export interface CompleteUploadParams {
  signature: string;
  fileId: string;
}
export type CompleteUploadData = Record<string, unknown>;

export async function completeUpload(_params: CompleteUploadParams): Promise<CompleteUploadData> {
  throw new UploadError(UploadErrorCode.COMPLETE_UPLOAD_FAILED, DEPRECATION_MSG);
}

export interface AbortUploadParams {
  signature: string;
  fileId: string;
}

export async function abortUpload(_params: AbortUploadParams): Promise<void> {
  throw new UploadError(UploadErrorCode.ABORT_UPLOAD_FAILED, DEPRECATION_MSG);
}

// Keep UploadMetadata type definition (previously from uploader contract)
export type UploadMetadata = Record<string, unknown>;
