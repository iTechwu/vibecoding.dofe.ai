/**
 * Avatar Upload — via @dofe/file-sdk-web → sso.dofe.ai
 */
import { FileUploader } from '@dofe/file-sdk-web';

const uploader = new FileUploader({
  apiBase: '/api/proxy/sso',
});

interface UploadAvatarResult {
  fileId: string;
  url: string;
}

export async function uploadAvatar(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadAvatarResult> {
  const { fileId, cdnUrl } = await uploader.upload(file, {
    scope: 'avatar',
    onProgress: ({ percent }) => onProgress?.(percent),
  });

  return {
    fileId,
    url: cdnUrl || '',
  };
}
