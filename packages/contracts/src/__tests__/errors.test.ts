/**
 * Error Codes Tests
 * 错误码测试
 */

import {
  UserErrorCode,
  UserErrorTypes,
  UserErrorHttpStatus,
  CommonErrorCode,
  CommonErrorTypes,
  CommonErrorHttpStatus,
} from '../errors/domains';

import { AllErrorTypes, getErrorType, getHttpStatus } from '../errors/codes';

type ErrorDomain = {
  name: string;
  errorCode: Record<string, string>;
  errorTypes: Record<string, string>;
  httpStatus: Record<string, number>;
};

describe('Error Codes', () => {
  describe('Domain Error Codes', () => {
    const domains: ErrorDomain[] = [
      {
        name: 'User',
        errorCode: UserErrorCode,
        errorTypes: UserErrorTypes,
        httpStatus: UserErrorHttpStatus,
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
          const codes = Object.values(errorCode);
          codes.forEach((code) => {
            expect(errorTypes[code]).toBeDefined();
            expect(typeof errorTypes[code]).toBe('string');
          });
        });

        it('should have matching HTTP status for all error codes', () => {
          const codes = Object.values(errorCode);
          codes.forEach((code) => {
            expect(httpStatus[code]).toBeDefined();
            expect(typeof httpStatus[code]).toBe('number');
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
      const totalCodes = [UserErrorTypes, CommonErrorTypes].reduce(
        (sum, types) => sum + Object.keys(types).length,
        0,
      );

      expect(Object.keys(AllErrorTypes).length).toBe(totalCodes);
    });
  });

  describe('getErrorType', () => {
    it('should return correct error type for valid code', () => {
      expect(getErrorType(UserErrorCode.UserNotFound)).toBe('userNotFound');
      expect(getErrorType(CommonErrorCode.SessionExpired)).toBe('sessionExpired');
    });

    it('should return undefined for invalid code', () => {
      expect(getErrorType(999999 as any)).toBeUndefined();
    });
  });

  describe('getHttpStatus', () => {
    it('should return correct HTTP status for valid code', () => {
      expect(getHttpStatus(UserErrorCode.UserNotFound)).toBe(401);
      expect(getHttpStatus(CommonErrorCode.UnAuthorized)).toBe(401);
      expect(getHttpStatus(CommonErrorCode.InternalServerError)).toBe(500);
    });

    it('should return 500 for invalid code', () => {
      expect(getHttpStatus(999999 as any)).toBe(500);
    });
  });
});
