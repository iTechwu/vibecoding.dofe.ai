/**
 * User Error Codes (2xx prefix)
 * 用户相关错误码
 *
 * @deprecated Since 2025-06-25. Import directly from @dofe/infra-contracts/error-codes.
 *   All new code should use:
 *   import { UserErrorCode, UserErrorTypes, UserErrorHttpStatus } from '@dofe/infra-contracts/error-codes';
 */

// Re-export everything from the authoritative source
export {
  UserErrorCode,
  UserErrorTypes,
  UserErrorHttpStatus,
} from '@dofe/infra-contracts/error-codes';

export type { UserErrorCode as UserErrorCodeType } from '@dofe/infra-contracts/error-codes';
