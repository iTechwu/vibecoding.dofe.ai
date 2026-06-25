/**
 * Common/System Error Codes (9xx prefix)
 * 通用/系统相关错误码
 *
 * @deprecated Since 2025-06-25. Import directly from @dofe/infra-contracts/error-codes.
 *   All new code should use:
 *   import { CommonErrorCode, CommonErrorTypes, CommonErrorHttpStatus } from '@dofe/infra-contracts/error-codes';
 */

// Re-export everything from the authoritative source
export {
  CommonErrorCode,
  CommonErrorTypes,
  CommonErrorHttpStatus,
} from '@dofe/infra-contracts/error-codes';

export type { CommonErrorCode as CommonErrorCodeType } from '@dofe/infra-contracts/error-codes';
