/**
 * Validators Unit Tests
 *
 * Tests for validation schemas and utility functions.
 */
import {
  emailSchema,
  passwordSchema,
  strongPasswordSchema,
  usernameSchema,
  paginationSchema,
  idSchema,
  dateRangeSchema,
  loginSchema,
  registerSchema,
  checkPasswordStrength,
} from '../index';

describe('Email Schema', () => {
  it('should accept valid emails', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    expect(emailSchema.safeParse('user.name@domain.co.uk').success).toBe(true);
    expect(emailSchema.safeParse('user+tag@example.org').success).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(emailSchema.safeParse('invalid').success).toBe(false);
    expect(emailSchema.safeParse('test@').success).toBe(false);
    expect(emailSchema.safeParse('@example.com').success).toBe(false);
    expect(emailSchema.safeParse('test@.com').success).toBe(false);
  });
});

describe('Password Schema', () => {
  it('should accept valid passwords', () => {
    expect(passwordSchema.safeParse('password1').success).toBe(true);
    expect(passwordSchema.safeParse('Abcdefg1').success).toBe(true);
    expect(passwordSchema.safeParse('longpassword123').success).toBe(true);
  });

  it('should reject passwords shorter than 8 characters', () => {
    expect(passwordSchema.safeParse('pass1').success).toBe(false);
    expect(passwordSchema.safeParse('ab12345').success).toBe(false);
  });

  it('should reject passwords without letters', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
  });

  it('should reject passwords without numbers', () => {
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
  });
});

describe('Strong Password Schema', () => {
  it('should accept valid strong passwords', () => {
    expect(strongPasswordSchema.safeParse('Passw0rd!').success).toBe(true);
    expect(strongPasswordSchema.safeParse('MyStr0ng@Pass').success).toBe(true);
  });

  it('should reject passwords without lowercase', () => {
    expect(strongPasswordSchema.safeParse('PASSWORD1!').success).toBe(false);
  });

  it('should reject passwords without uppercase', () => {
    expect(strongPasswordSchema.safeParse('password1!').success).toBe(false);
  });

  it('should reject passwords without special characters', () => {
    expect(strongPasswordSchema.safeParse('Password1').success).toBe(false);
  });

  it('should reject passwords longer than 32 characters', () => {
    expect(
      strongPasswordSchema.safeParse('Aa1!'.repeat(10)).success
    ).toBe(false);
  });
});

describe('Username Schema', () => {
  it('should accept valid usernames', () => {
    expect(usernameSchema.safeParse('john_doe').success).toBe(true);
    expect(usernameSchema.safeParse('user-123').success).toBe(true);
    expect(usernameSchema.safeParse('JohnDoe').success).toBe(true);
  });

  it('should reject usernames shorter than 3 characters', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });

  it('should reject usernames longer than 30 characters', () => {
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });

  it('should reject usernames with special characters', () => {
    expect(usernameSchema.safeParse('user@name').success).toBe(false);
    expect(usernameSchema.safeParse('user name').success).toBe(false);
    expect(usernameSchema.safeParse('user.name').success).toBe(false);
  });
});

describe('Pagination Schema', () => {
  it('should use default values', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('should parse valid pagination params', () => {
    const result = paginationSchema.parse({ page: 2, pageSize: 50 });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });

  it('should coerce string values to numbers', () => {
    const result = paginationSchema.parse({ page: '3', pageSize: '25' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
  });

  it('should reject pageSize greater than 100', () => {
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('should reject non-positive values', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: -1 }).success).toBe(false);
  });
});

describe('ID Schema', () => {
  it('should accept valid UUIDs', () => {
    expect(
      idSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success
    ).toBe(true);
  });

  it('should accept positive integers', () => {
    expect(idSchema.safeParse(1).success).toBe(true);
    expect(idSchema.safeParse(123456).success).toBe(true);
  });

  it('should coerce string numbers to integers', () => {
    const result = idSchema.parse('42');
    expect(result).toBe(42);
  });

  it('should reject invalid UUIDs', () => {
    expect(idSchema.safeParse('invalid-uuid').success).toBe(false);
  });

  it('should reject non-positive integers', () => {
    expect(idSchema.safeParse(0).success).toBe(false);
    expect(idSchema.safeParse(-1).success).toBe(false);
  });
});

describe('Date Range Schema', () => {
  it('should accept valid date ranges', () => {
    const result = dateRangeSchema.safeParse({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('should accept same start and end date', () => {
    const result = dateRangeSchema.safeParse({
      startDate: '2024-06-15',
      endDate: '2024-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('should reject when start date is after end date', () => {
    const result = dateRangeSchema.safeParse({
      startDate: '2024-12-31',
      endDate: '2024-01-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('Login Schema', () => {
  it('should accept valid login credentials', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'any-password',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid',
      password: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('Register Schema', () => {
  it('should accept valid registration data', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should accept registration with optional username', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      username: 'john_doe',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'invalid',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject weak password', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'weak',
    });
    expect(result.success).toBe(false);
  });
});

describe('checkPasswordStrength', () => {
  describe('Weak passwords', () => {
    it('should classify short passwords as weak', () => {
      const result = checkPasswordStrength('abc');
      expect(result.level).toBe('weak');
      expect(result.score).toBeLessThanOrEqual(3);
    });

    it('should classify numeric-only passwords as weak', () => {
      const result = checkPasswordStrength('12345678');
      expect(result.level).toBe('weak');
      expect(result.suggestions).toContain('Add lowercase letters');
      expect(result.suggestions).toContain('Add uppercase letters');
      expect(result.suggestions).toContain('Add special characters (!@#$%^&*)');
    });
  });

  describe('Medium passwords', () => {
    it('should classify passwords with mixed case and numbers as medium', () => {
      const result = checkPasswordStrength('Password1');
      expect(result.level).toBe('medium');
    });
  });

  describe('Strong passwords', () => {
    it('should classify passwords with all character types as strong', () => {
      // Password must be >= 12 chars to get enough points for 'strong'
      const result = checkPasswordStrength('Password123!');
      expect(result.level).toBe('strong');
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('Very strong passwords', () => {
    it('should classify long passwords with all character types as very strong', () => {
      const result = checkPasswordStrength('MyVeryStr0ng!Pass');
      expect(result.level).toBe('very_strong');
      expect(result.score).toBe(7);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('Suggestions', () => {
    it('should suggest adding lowercase letters', () => {
      const result = checkPasswordStrength('ABCDEFGH1!');
      expect(result.suggestions).toContain('Add lowercase letters');
    });

    it('should suggest adding uppercase letters', () => {
      const result = checkPasswordStrength('abcdefgh1!');
      expect(result.suggestions).toContain('Add uppercase letters');
    });

    it('should suggest adding numbers', () => {
      const result = checkPasswordStrength('Abcdefgh!');
      expect(result.suggestions).toContain('Add numbers');
    });

    it('should suggest adding special characters', () => {
      const result = checkPasswordStrength('Abcdefgh1');
      expect(result.suggestions).toContain('Add special characters (!@#$%^&*)');
    });
  });

  describe('Score calculation', () => {
    it('should award points for length >= 8', () => {
      const short = checkPasswordStrength('Abc1!');
      const long = checkPasswordStrength('Abcdefgh1!');
      expect(long.score).toBeGreaterThan(short.score);
    });

    it('should award points for length >= 12', () => {
      const medium = checkPasswordStrength('Abcdefgh1!');
      const long = checkPasswordStrength('Abcdefghijkl1!');
      expect(long.score).toBeGreaterThan(medium.score);
    });

    it('should award points for length >= 16', () => {
      const medium = checkPasswordStrength('Abcdefghijkl1!');
      const long = checkPasswordStrength('Abcdefghijklmnop1!');
      expect(long.score).toBeGreaterThan(medium.score);
    });
  });
});
