/**
 * Domain Error Exports
 * 按域导出错误码
 *
 * @deprecated Since 2025-06-25. All domain error codes (Common, User) are now re-exported
 *   from @dofe/infra-contracts/error-codes as the single source of truth.
 *   Import directly: import { CommonErrorCode, UserErrorCode } from '@dofe/infra-contracts/error-codes';
 *   This file is retained as a compatibility re-export.
 */

// Re-export from infra via the local compatibility files
export * from './user.errors';
export * from './common.errors';
