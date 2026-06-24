/**
 * @repo/contracts - Base types and utilities
 *
 * Re-exports from @dofe/infra-contracts-base with project-specific extensions.
 * This keeps base contract helpers aligned across DoFe projects while allowing
 * project-level pagination metadata extensions.
 */

import { z } from 'zod';

export {
  HTTP_CODE,
  API_VERSION,
  API_VERSION_HEADER,
  API_VERSION_DEFAULT,
  CONTRACT_METADATA,
  type ApiVersion,
  type ContractMetadata,
  type VersionedContract,
  withVersion,
  getContractVersion,
  getContractMetadata,
  hasContractVersion,
  ApiResponseSchema,
  RestResponseSchema,
  createApiResponse,
  type ApiResponse,
  EmptyQuerySchema,
  IdSchema,
  SuccessResponseSchema,
  type SuccessResponse,
  ErrorResponseSchema,
  type ErrorResponse,
  EnhancedErrorResponseSchema,
  type EnhancedErrorResponse,
  createApiContract,
} from '@dofe/infra-contracts-base';

import {
  PaginationQuerySchema as BasePaginationQuerySchema,
  PaginatedResponseSchema as BasePaginatedResponseSchema,
} from '@dofe/infra-contracts-base';

/**
 * Pagination query schema with project-specific sort fields.
 * Extends the base schema with vibecoding.dofe.ai sort enum values.
 */
export const PaginationQuerySchema = BasePaginationQuerySchema.extend({
  sort: z.enum(['createdAt', 'name', 'fsize', 'disable', 'frameTime', 'expireAt']).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginatedResponseSchema = BasePaginatedResponseSchema;

/**
 * Extended paginated response schema with optional metadata fields.
 */
export const ExtendedPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    list: z.array(itemSchema),
    total: z.number(),
    page: z.number().optional(),
    limit: z.number().optional(),
    /** 总大小（字节），用于文件列表 */
    totalSize: z.number().optional(),
    /** 权限列表 */
    permission: z.array(z.string()).optional(),
    /** 角色标识 */
    role: z.string().optional(),
    /** 服务器当前时间 */
    nowTime: z.coerce.date().optional(),
  });

export type PaginatedResponse<T> = {
  list: T[];
  total: number;
  page: number;
  limit: number;
};

export type ExtendedPaginatedResponse<T> = {
  list: T[];
  total: number;
  page?: number;
  limit?: number;
  /** 总大小（字节），用于文件列表 */
  totalSize?: number;
  /** 权限列表 */
  permission?: string[];
  /** 角色标识 */
  role?: string;
  /** 服务器当前时间 */
  nowTime?: Date;
};

export { z };
