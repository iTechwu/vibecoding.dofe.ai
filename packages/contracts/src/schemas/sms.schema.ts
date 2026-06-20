import { z } from 'zod';

/**
 * SMS-related Zod schemas
 */

// Send SMS code request
export const SendSmsCodeRequestSchema = z.object({
  phoneNumbers: z.string().regex(/^1[3-9]\d{9}$/, 'Invalid phone number'),
});

// Check verify code request
export const CheckVerifyCodeRequestSchema = z.object({
  phoneNumber: z.string().regex(/^1[3-9]\d{9}$/, 'Invalid phone number'),
  code: z.string().regex(/^\d{4,6}$/, 'Code should be 4-6 digits'),
});

// Send SMS code response
export const SendSmsCodeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

// Check verify code response
export const CheckVerifyCodeResponseSchema = z.object({
  success: z.boolean(),
  result: z.string().optional(),
});
