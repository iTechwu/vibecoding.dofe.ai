import { Injectable } from '@nestjs/common';
import { CommonErrorCode } from '@repo/contracts/errors';
import { apiError } from '@dofe/infra-common';

/**
 * 认证验证服务
 * MVP版本：简化版本，移除团队和空间相关验证
 */
@Injectable()
export class AuthValidationService {

  /**
   * MVP: 基础验证方法（预留接口）
   * 后续可扩展团队和空间验证
   */
  async validateAccess(
    userId: string,
    resourceId: string,
    throwError: boolean = true,
  ): Promise<boolean> {
    // MVP: 简单验证用户ID是否存在
    if (!userId) {
      if (throwError) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }
      return false;
    }
    return true;
  }
}
