import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RESOURCE_OWNER_KEY,
  ResourceOwnerCheck,
} from '../decorators/resource-owner.decorator';

/**
 * 资源所有者守卫
 *
 * ⚠️ WARNING: This guard is currently a STUB implementation.
 * It will ALWAYS return true until proper resource ownership verification is implemented.
 *
 * TODO: Implement actual resource ownership verification based on ResourceOwnerCheck config:
 * - For 'fileSystem': Check if user owns the file/folder via f_file_source/f_folder table
 * - For other resource types: Add corresponding ownership checks
 *
 * Implementation pattern:
 * 1. Extract resource ID from request (params/query/body based on paramSource)
 * 2. Query the resource table to get ownerUserId
 * 3. Compare ownerUserId with request.userId
 * 4. Optionally check if user is systemAdmin if allowSystemAdmin is true
 */
@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  private readonly logger = new Logger(ResourceOwnerGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const check = this.reflector.get<ResourceOwnerCheck>(
      RESOURCE_OWNER_KEY,
      context.getHandler(),
    );

    // No decorator applied, allow access
    if (!check) return true;

    // ⚠️ STUB: Log warning that ownership check is not implemented
    const request = context.switchToHttp().getRequest();
    this.logger.warn(
      `ResourceOwnerGuard is a STUB - ownership check NOT IMPLEMENTED for ${check.resourceType}. ` +
        `User ${request.userId} accessing resource ${check.resourceIdField}. ` +
        `This endpoint is effectively unprotected!`,
    );

    // TODO: implement resource ownership verification
    return true;
  }
}
