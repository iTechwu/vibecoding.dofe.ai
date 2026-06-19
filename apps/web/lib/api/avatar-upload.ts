/**
 * Avatar Upload - 头像上传功能
 * 使用 uploader/token/public API 上传头像到 OSS
 */

import { uploaderClient } from '../api/contracts/client';
import { encryptParams } from '@repo/utils/encrypt';
import type { TokenResponse } from '@repo/contracts';

interface UploadAvatarResult {
  fileId: string;
  url: string;
}

/**
 * 上传头像到 OSS
 * @param file 头像文件
 * @param onProgress 进度回调
 * @returns { fileId, url }
 */
export async function uploadAvatar(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadAvatarResult> {
  const filename = file.name;

  // 生成 signature（public token 只需要 filename）
  const signature = encryptParams(filename);

  // 获取 private upload token
  const tokenResponse = await uploaderClient.getPrivateToken({
    body: {
      signature,
      filename,
      fsize: file.size,
      bucket: 'dofe-image',
      vendor: 'oss',
    },
  });

  if (tokenResponse.status !== 200) {
    throw new Error('获取上传 Token 失败');
  }

  const tokenData: TokenResponse = tokenResponse.body.data;
  if (!tokenData?.token || !tokenData?.key || !tokenData?.fileId) {
    throw new Error('无法获取上传 Token、Key 或 FileId');
  }

  onProgress?.(10);

  // 上传文件到 OSS
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 90) + 10; // 10-100%
        onProgress?.(percentage);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200 || xhr.status === 204) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`上传失败: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('上传失败: 网络错误'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('上传已取消'));
    });

    xhr.open('PUT', tokenData.token || '');
    xhr.setRequestHeader(
      'Content-Type',
      file.type || 'application/octet-stream',
    );
    xhr.send(file);
  });

  // 优先使用 API 返回的 url，如果没有则手动构建
  const avatarUrl =
    tokenData.url ||
    `https://files.dofe.cn/images/oss/${tokenData.key}/~tplv-fv5ms769k2-preview-v2:183:103:360:360.webp`;

  return {
    fileId: tokenData.fileId,
    url: avatarUrl,
  };
}
