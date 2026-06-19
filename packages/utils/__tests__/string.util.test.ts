/**
 * String Utility Unit Tests
 *
 * Tests for string utility functions.
 */
import stringUtil from '../string.util';

describe('stringUtil', () => {
  describe('isUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(stringUtil.isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(stringUtil.isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(stringUtil.isUUID('not-a-uuid')).toBe(false);
      expect(stringUtil.isUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(stringUtil.isUUID('')).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(stringUtil.isUUID(null)).toBe(false);
      expect(stringUtil.isUUID(undefined)).toBe(false);
      expect(stringUtil.isUUID(123)).toBe(false);
      expect(stringUtil.isUUID({})).toBe(false);
    });
  });

  describe('stringGen', () => {
    it('should generate string of specified length', () => {
      expect(stringUtil.stringGen(6).length).toBe(6);
      expect(stringUtil.stringGen(10).length).toBe(10);
      expect(stringUtil.stringGen(1).length).toBe(1);
    });

    it('should use default length of 6', () => {
      expect(stringUtil.stringGen().length).toBe(6);
    });

    it('should only contain lowercase letters and numbers', () => {
      const result = stringUtil.stringGen(100);
      expect(result).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate different strings on each call', () => {
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(stringUtil.stringGen(10));
      }
      // Should have multiple unique strings (very unlikely to have duplicates)
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('formatCode', () => {
    it('should replace O and o with 0', () => {
      expect(stringUtil.formatCode('ABCDO')).toBe('ABCD0');
      expect(stringUtil.formatCode('abcdo')).toBe('abcd0');
      expect(stringUtil.formatCode('OoOo')).toBe('0000');
    });

    it('should replace I and l with 1', () => {
      expect(stringUtil.formatCode('ABCDI')).toBe('ABCD1');
      expect(stringUtil.formatCode('abcdl')).toBe('abcd1');
      expect(stringUtil.formatCode('IlIl')).toBe('1111');
    });

    it('should replace multiple characters', () => {
      expect(stringUtil.formatCode('OIl')).toBe('011');
      // Note: lowercase 'i' is NOT replaced, only uppercase 'I' and lowercase 'l'
      expect(stringUtil.formatCode('CODE_Oil')).toBe('C0DE_0i1');
      expect(stringUtil.formatCode('CODE_OIl')).toBe('C0DE_011');
    });

    it('should not change other characters', () => {
      expect(stringUtil.formatCode('ABCD1234')).toBe('ABCD1234');
      expect(stringUtil.formatCode('')).toBe('');
    });
  });

  describe('generateCode', () => {
    it('should generate code of specified length', () => {
      expect(stringUtil.generateCode(6).length).toBe(6);
      expect(stringUtil.generateCode(10).length).toBe(10);
    });

    it('should not contain ambiguous characters (I, O, l)', () => {
      for (let i = 0; i < 100; i++) {
        const code = stringUtil.generateCode(20);
        expect(code).not.toMatch(/[IOl]/);
      }
    });

    it('should contain alphanumeric characters', () => {
      const code = stringUtil.generateCode(100);
      expect(code).toMatch(/^[A-HJ-NP-Za-km-z0-9]+$/);
    });
  });

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(stringUtil.toCamelCase('hello_world')).toBe('helloWorld');
      expect(stringUtil.toCamelCase('my_variable_name')).toBe('myVariableName');
    });

    it('should handle multiple underscores', () => {
      expect(stringUtil.toCamelCase('hello__world')).toBe('helloWorld');
    });

    it('should handle already camelCase strings', () => {
      expect(stringUtil.toCamelCase('helloWorld')).toBe('helloWorld');
    });

    it('should handle empty string', () => {
      expect(stringUtil.toCamelCase('')).toBe('');
    });

    it('should handle string with no underscores', () => {
      expect(stringUtil.toCamelCase('hello')).toBe('hello');
    });
  });

  describe('escapeMongoRegexSpecialChars', () => {
    it('should escape special regex characters', () => {
      expect(stringUtil.escapeMongoRegexSpecialChars('.')).toBe('\\.');
      expect(stringUtil.escapeMongoRegexSpecialChars('^')).toBe('\\^');
      expect(stringUtil.escapeMongoRegexSpecialChars('$')).toBe('\\$');
      expect(stringUtil.escapeMongoRegexSpecialChars('*')).toBe('\\*');
      expect(stringUtil.escapeMongoRegexSpecialChars('+')).toBe('\\+');
      expect(stringUtil.escapeMongoRegexSpecialChars('?')).toBe('\\?');
      expect(stringUtil.escapeMongoRegexSpecialChars('(')).toBe('\\(');
      expect(stringUtil.escapeMongoRegexSpecialChars(')')).toBe('\\)');
      expect(stringUtil.escapeMongoRegexSpecialChars('[')).toBe('\\[');
      expect(stringUtil.escapeMongoRegexSpecialChars(']')).toBe('\\]');
      expect(stringUtil.escapeMongoRegexSpecialChars('{')).toBe('\\{');
      expect(stringUtil.escapeMongoRegexSpecialChars('|')).toBe('\\|');
      expect(stringUtil.escapeMongoRegexSpecialChars('\\')).toBe('\\\\');
    });

    it('should escape multiple special characters', () => {
      expect(stringUtil.escapeMongoRegexSpecialChars('test.*')).toBe('test\\.\\*');
      expect(stringUtil.escapeMongoRegexSpecialChars('(a|b)')).toBe('\\(a\\|b\\)');
    });

    it('should not escape regular characters', () => {
      expect(stringUtil.escapeMongoRegexSpecialChars('hello')).toBe('hello');
      expect(stringUtil.escapeMongoRegexSpecialChars('123')).toBe('123');
    });
  });

  describe('splitString', () => {
    it('should split string by default separator /', () => {
      expect(stringUtil.splitString('/a/b/c')).toEqual(['a', 'b', 'c']);
      expect(stringUtil.splitString('a/b/c')).toEqual(['a', 'b', 'c']);
    });

    it('should filter out empty parts', () => {
      expect(stringUtil.splitString('//a//b//')).toEqual(['a', 'b']);
    });

    it('should trim whitespace', () => {
      expect(stringUtil.splitString('  /a/b/c  ')).toEqual(['a', 'b', 'c']);
    });

    it('should use custom separator', () => {
      expect(stringUtil.splitString('a-b-c', '-')).toEqual(['a', 'b', 'c']);
    });

    it('should slice from index when provided', () => {
      expect(stringUtil.splitString('/a/b/c/d', '/', 2)).toEqual(['c', 'd']);
      expect(stringUtil.splitString('/a/b', '/', 5)).toEqual([]);
    });
  });

  describe('trimSlashes', () => {
    it('should remove leading slashes', () => {
      expect(stringUtil.trimSlashes('/path')).toBe('path');
      expect(stringUtil.trimSlashes('///path')).toBe('path');
    });

    it('should remove trailing slashes', () => {
      expect(stringUtil.trimSlashes('path/')).toBe('path');
      expect(stringUtil.trimSlashes('path///')).toBe('path');
    });

    it('should remove both leading and trailing slashes', () => {
      expect(stringUtil.trimSlashes('/path/')).toBe('path');
      expect(stringUtil.trimSlashes('///path///')).toBe('path');
    });

    it('should not remove slashes in the middle', () => {
      expect(stringUtil.trimSlashes('/a/b/c/')).toBe('a/b/c');
    });

    it('should handle empty string', () => {
      expect(stringUtil.trimSlashes('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(stringUtil.trimSlashes(null as any)).toBe('');
      expect(stringUtil.trimSlashes(undefined as any)).toBe('');
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask middle 4 digits of phone number', () => {
      expect(stringUtil.maskPhoneNumber('13812345678')).toBe('138****5678');
      expect(stringUtil.maskPhoneNumber('15987654321')).toBe('159****4321');
    });

    it('should throw error for invalid phone number length', () => {
      expect(() => stringUtil.maskPhoneNumber('1234567890')).toThrow();
      expect(() => stringUtil.maskPhoneNumber('123456789012')).toThrow();
    });
  });

  describe('generateSessionId', () => {
    it('should generate session ID with timestamp and user_id', () => {
      const userId = 'user123';
      const sessionId = stringUtil.generateSessionId(userId);

      // Should contain the user_id at the end
      expect(sessionId.endsWith(userId)).toBe(true);

      // Should have timestamp (14 chars) + random (8 chars) + userId
      expect(sessionId.length).toBe(14 + 8 + userId.length);
    });

    it('should generate unique session IDs', () => {
      const sessionIds = new Set();
      for (let i = 0; i < 10; i++) {
        sessionIds.add(stringUtil.generateSessionId('user123'));
      }
      // All should be unique
      expect(sessionIds.size).toBe(10);
    });
  });
});
