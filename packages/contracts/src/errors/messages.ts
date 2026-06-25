/**
 * Error Messages — merged from @dofe/infra-contracts (user/common/auth/tenant)
 * with vibecoding-specific domain extensions (space/folder/file/payment).
 *
 * Default English messages for all error types.
 * These are used as fallback when i18n is not available.
 */

import { ErrorMessages as InfraErrorMessages } from '@dofe/infra-contracts/error-codes';

/**
 * Error messages by domain and error type.
 * Infra provides user/common/auth/tenant; local extends with rich domain entries.
 */
export const ErrorMessages: Record<string, Record<string, string>> = {
  // Standard domains from infra (single source of truth)
  user: InfraErrorMessages.user,
  common: InfraErrorMessages.common,
  auth: InfraErrorMessages.auth,
  tenant: InfraErrorMessages.tenant,

  // Vibecoding-specific domain messages (not in infra, or richer than infra's stripped versions)
  space: {
    spaceConfigIsNotSet: 'Space config is not set',
    storageIsFull: 'Storage Full',
    trafficIsFull: 'Insufficient Transfer Capacity',
    spaceIsNotExists: 'Failed to get space status',
  },
  folder: {
    outOfFolderLimit: 'Maximum folder count reached',
    folderNameExists: 'Folder name already exists in the specified path',
    fileAndFolderNameExists: 'File and folder name already exist in the specified path',
  },
  file: {
    outOfFileLimit: 'Maximum file count reached',
    outOfFileSizeLimit: 'File too large',
    multipartUploadError: 'Multipart upload failed',
    getProviderUserError: 'Failed to get provider user information',
  },
  payment: {
    actionOrderFailed: 'Payment failed, please try again',
  },
};

/** Flattened error messages keyed by error type. */
export const AllErrorMessages: Record<string, string> = Object.entries(ErrorMessages).reduce(
  (acc, [, messages]) => {
    Object.entries(messages).forEach(([errorType, message]) => {
      acc[errorType] = message;
    });
    return acc;
  },
  {} as Record<string, string>,
);

/** Get the default English error message for a given error type. */
export function getErrorMessage(errorType: string): string {
  return AllErrorMessages[errorType] || errorType;
}
