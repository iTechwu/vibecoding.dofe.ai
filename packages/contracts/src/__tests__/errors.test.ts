/**
 * Error Codes Tests
 * 错误码测试
 */

import {
  TeamErrorCode,
  TeamErrorTypes,
  TeamErrorHttpStatus,
  UserErrorCode,
  UserErrorTypes,
  UserErrorHttpStatus,
  SpaceErrorCode,
  SpaceErrorTypes,
  SpaceErrorHttpStatus,
  FolderErrorCode,
  FolderErrorTypes,
  FolderErrorHttpStatus,
  FileErrorCode,
  FileErrorTypes,
  FileErrorHttpStatus,
  CommentErrorCode,
  CommentErrorTypes,
  CommentErrorHttpStatus,
  PaymentErrorCode,
  PaymentErrorTypes,
  PaymentErrorHttpStatus,
  CommonErrorCode,
  CommonErrorTypes,
  CommonErrorHttpStatus,
} from '../errors/domains';

import { AllErrorTypes, getErrorType, getHttpStatus } from '../errors/codes';

describe('Error Codes', () => {
  describe('Domain Error Codes', () => {
    const domains = [
      {
        name: 'Team',
        errorCode: TeamErrorCode,
        errorTypes: TeamErrorTypes,
        httpStatus: TeamErrorHttpStatus,
      },
      {
        name: 'User',
        errorCode: UserErrorCode,
        errorTypes: UserErrorTypes,
        httpStatus: UserErrorHttpStatus,
      },
      {
        name: 'Space',
        errorCode: SpaceErrorCode,
        errorTypes: SpaceErrorTypes,
        httpStatus: SpaceErrorHttpStatus,
      },
      {
        name: 'Folder',
        errorCode: FolderErrorCode,
        errorTypes: FolderErrorTypes,
        httpStatus: FolderErrorHttpStatus,
      },
      {
        name: 'File',
        errorCode: FileErrorCode,
        errorTypes: FileErrorTypes,
        httpStatus: FileErrorHttpStatus,
      },
      {
        name: 'Comment',
        errorCode: CommentErrorCode,
        errorTypes: CommentErrorTypes,
        httpStatus: CommentErrorHttpStatus,
      },
      {
        name: 'Payment',
        errorCode: PaymentErrorCode,
        errorTypes: PaymentErrorTypes,
        httpStatus: PaymentErrorHttpStatus,
      },
      {
        name: 'Common',
        errorCode: CommonErrorCode,
        errorTypes: CommonErrorTypes,
        httpStatus: CommonErrorHttpStatus,
      },
    ];

    domains.forEach(({ name, errorCode, errorTypes, httpStatus }) => {
      describe(`${name} Error Codes`, () => {
        it('should have matching error types for all error codes', () => {
          const codes = Object.values(errorCode).filter(
            (v) => typeof v === 'number',
          );
          codes.forEach((code) => {
            expect(errorTypes[code as number]).toBeDefined();
            expect(typeof errorTypes[code as number]).toBe('string');
          });
        });

        it('should have matching HTTP status for all error codes', () => {
          const codes = Object.values(errorCode).filter(
            (v) => typeof v === 'number',
          );
          codes.forEach((code) => {
            expect(httpStatus[code as keyof typeof httpStatus]).toBeDefined();
            expect(typeof httpStatus[code as keyof typeof httpStatus]).toBe(
              'number',
            );
          });
        });

        it('should have unique error type strings', () => {
          const types = Object.values(errorTypes);
          const uniqueTypes = new Set(types);
          expect(types.length).toBe(uniqueTypes.size);
        });
      });
    });
  });

  describe('AllErrorTypes', () => {
    it('should contain all error codes from all domains', () => {
      const totalCodes = [
        TeamErrorTypes,
        UserErrorTypes,
        SpaceErrorTypes,
        FolderErrorTypes,
        FileErrorTypes,
        CommentErrorTypes,
        PaymentErrorTypes,
        CommonErrorTypes,
      ].reduce((sum, types) => sum + Object.keys(types).length, 0);

      expect(Object.keys(AllErrorTypes).length).toBe(totalCodes);
    });
  });

  describe('getErrorType', () => {
    it('should return correct error type for valid code', () => {
      expect(getErrorType(TeamErrorCode.TeamNotFound)).toBe('teamNotFound');
      expect(getErrorType(UserErrorCode.UserNotFound)).toBe('userNotFound');
      expect(getErrorType(SpaceErrorCode.SpaceIsNotExist)).toBe(
        'spaceIsNotExist',
      );
    });

    it('should return undefined for invalid code', () => {
      expect(getErrorType(999999 as any)).toBeUndefined();
    });
  });

  describe('getHttpStatus', () => {
    it('should return correct HTTP status for valid code', () => {
      expect(getHttpStatus(TeamErrorCode.TeamNotFound)).toBe(200);
      expect(getHttpStatus(CommonErrorCode.UnAuthorized)).toBe(401);
      expect(getHttpStatus(CommonErrorCode.InternalServerError)).toBe(500);
    });

    it('should return 500 for invalid code', () => {
      expect(getHttpStatus(999999 as any)).toBe(500);
    });
  });
});
