import { z } from 'zod';

/**
 * Setting-related Zod schemas
 */

// Send verify email request
export const SendVerifyEmailRequestSchema = z.object({
  email: z.string().email(),
});

// Setting account request
export const SettingAccountRequestSchema = z.object({
  nickname: z.string().min(1),
  code: z.string().min(1).optional(),
  email: z.string().email().optional(),
  emailCode: z.string().optional(),
  mobile: z.string().optional(),
  mobileCode: z.string().optional(),
});

// Brand schema
export const BrandSchema = z.object({
  id: z.string().uuid(),
  appearance: z.number().optional().nullable(),
  domain: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  wallpaperDomain: z.string().optional().nullable(),
  wallpaper: z.string().optional().nullable(),
});

// Brand setting request
export const BrandSettingRequestSchema = z.object({
  appearance: z.number().optional(),
  domain: z.string().optional(),
  logo: z.string().optional(),
  wallpaperDomain: z.string().optional(),
  wallpaper: z.string().optional(),
});

// Usage response schema
export const UsageResponseSchema = z.object({
  storageUsed: z.number().optional(),
  storageLimit: z.number().optional(),
  aiCreditsUsed: z.number().optional(),
  aiCreditsLimit: z.number().optional(),
});

// Email verify request (for binding)
export const EmailVerifyRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

// Mobile verify request (for binding)
export const MobileBindRequestSchema = z.object({
  mobile: z.string().regex(/^1[3-9]\d{9}$/),
  code: z.string().min(1),
});

// Update avatar request
export const UpdateAvatarRequestSchema = z.object({
  avatarFileId: z.string().uuid(),
});

// Inferred types
export type SendVerifyEmailRequest = z.infer<typeof SendVerifyEmailRequestSchema>;
export type SettingAccountRequest = z.infer<typeof SettingAccountRequestSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type BrandSettingRequest = z.infer<typeof BrandSettingRequestSchema>;
export type UsageResponse = z.infer<typeof UsageResponseSchema>;
export type EmailVerifyRequest = z.infer<typeof EmailVerifyRequestSchema>;
export type MobileBindRequest = z.infer<typeof MobileBindRequestSchema>;
export type UpdateAvatarRequest = z.infer<typeof UpdateAvatarRequestSchema>;
