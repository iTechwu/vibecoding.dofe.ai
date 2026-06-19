/**
 * Validate Utility Unit Tests
 *
 * Tests for validation utility functions.
 */
import validateUtil from '../validate.util';

describe('validateUtil', () => {
  describe('isBlank', () => {
    it('should return true for null', () => {
      expect(validateUtil.isBlank(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(validateUtil.isBlank(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(validateUtil.isBlank('')).toBe(true);
    });

    it('should return true for whitespace-only string', () => {
      expect(validateUtil.isBlank('   ')).toBe(true);
      expect(validateUtil.isBlank('\t\n')).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(validateUtil.isBlank('hello')).toBe(false);
      expect(validateUtil.isBlank(' hello ')).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(validateUtil.isBlank([])).toBe(true);
    });

    it('should return false for non-empty array', () => {
      expect(validateUtil.isBlank([1, 2, 3])).toBe(false);
      expect(validateUtil.isBlank(['a'])).toBe(false);
    });

    it('should return true for empty object', () => {
      expect(validateUtil.isBlank({})).toBe(true);
    });

    it('should return false for non-empty object', () => {
      expect(validateUtil.isBlank({ key: 'value' })).toBe(false);
    });

    it('should return true for zero', () => {
      expect(validateUtil.isBlank(0)).toBe(true);
    });

    it('should return false for non-zero numbers', () => {
      expect(validateUtil.isBlank(1)).toBe(false);
      expect(validateUtil.isBlank(-1)).toBe(false);
      expect(validateUtil.isBlank(0.5)).toBe(false);
    });

    it('should return false for boolean values', () => {
      expect(validateUtil.isBlank(true)).toBe(false);
      expect(validateUtil.isBlank(false)).toBe(false);
    });
  });

  describe('isNotBlank', () => {
    it('should return opposite of isBlank', () => {
      expect(validateUtil.isNotBlank(null)).toBe(false);
      expect(validateUtil.isNotBlank('hello')).toBe(true);
      expect(validateUtil.isNotBlank([])).toBe(false);
      expect(validateUtil.isNotBlank([1])).toBe(true);
      expect(validateUtil.isNotBlank({})).toBe(false);
      expect(validateUtil.isNotBlank({ a: 1 })).toBe(true);
    });
  });

  describe('diffStr', () => {
    it('should return characters in str2 not in str1', () => {
      expect(validateUtil.diffStr('abc', 'abcd')).toBe('d');
      expect(validateUtil.diffStr('abc', 'def')).toBe('def');
    });

    it('should return empty string if all chars are in str1', () => {
      expect(validateUtil.diffStr('abc', 'abc')).toBe('');
      expect(validateUtil.diffStr('abcd', 'abc')).toBe('');
    });

    it('should handle empty strings', () => {
      expect(validateUtil.diffStr('', 'abc')).toBe('abc');
      expect(validateUtil.diffStr('abc', '')).toBe('');
    });

    it('should handle repeated characters', () => {
      expect(validateUtil.diffStr('abc', 'aabbcc')).toBe('');
      expect(validateUtil.diffStr('ab', 'aabbcc')).toBe('cc');
    });
  });

  describe('getRandomInt', () => {
    it('should return integer within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = validateUtil.getRandomInt(1, 10);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should work with same min and max', () => {
      const result = validateUtil.getRandomInt(5, 5);
      expect(result).toBe(5);
    });

    it('should work with negative numbers', () => {
      for (let i = 0; i < 100; i++) {
        const result = validateUtil.getRandomInt(-10, -1);
        expect(result).toBeGreaterThanOrEqual(-10);
        expect(result).toBeLessThanOrEqual(-1);
      }
    });

    it('should work with range crossing zero', () => {
      for (let i = 0; i < 100; i++) {
        const result = validateUtil.getRandomInt(-5, 5);
        expect(result).toBeGreaterThanOrEqual(-5);
        expect(result).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('isXinPianChangEmail', () => {
    it('should return true for xinpianchang.com emails', () => {
      expect(validateUtil.isXinPianChangEmail('user@xinpianchang.com')).toBe(true);
      expect(validateUtil.isXinPianChangEmail('test.user@xinpianchang.com')).toBe(true);
    });

    it('should return false for other emails', () => {
      expect(validateUtil.isXinPianChangEmail('user@gmail.com')).toBe(false);
      expect(validateUtil.isXinPianChangEmail('user@xinpianchang.cn')).toBe(false);
      expect(validateUtil.isXinPianChangEmail('xinpianchang.com@other.com')).toBe(false);
    });
  });
});
