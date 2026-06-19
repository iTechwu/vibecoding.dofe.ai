import { z } from 'zod';

/**
 * Sign/Auth API Schemas
 * 登录认证相关的 Zod Schema 定义
 */

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Email 登录请求
 */
export const EmailLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type EmailLogin = z.infer<typeof EmailLoginSchema>;

/**
 * 手机号密码登录请求
 */
export const MobilePasswordLoginSchema = z.object({
  mobile: z.string().regex(/^1[3-9]\d{9}$/, 'Please enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type MobilePasswordLogin = z.infer<typeof MobilePasswordLoginSchema>;

/**
 * 手机号验证码登录请求
 */
export const MobileCodeLoginSchema = z.object({
  mobile: z.string().regex(/^1[3-9]\d{9}$/, 'Please enter a valid phone number'),
  code: z.string().min(4, 'Please enter the verification code'),
});
export type MobileCodeLogin = z.infer<typeof MobileCodeLoginSchema>;

/**
 * Email 注册请求
 */
export const EmailRegisterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});
export type EmailRegister = z.infer<typeof EmailRegisterSchema>;

/**
 * 手机号注册请求
 */
export const MobileRegisterSchema = z.object({
  mobile: z.string().regex(/^1[3-9]\d{9}$/, 'Please enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
  code: z.string().min(4, 'Please enter the verification code'),
});
export type MobileRegister = z.infer<typeof MobileRegisterSchema>;

/**
 * Email 验证请求
 */
export const EmailVerifySchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  code: z.string().min(4, 'Please enter the verification code'),
});
export type EmailVerify = z.infer<typeof EmailVerifySchema>;

/**
 * 手机号验证请求
 */
export const MobileVerifySchema = z.object({
  mobile: z.string().regex(/^1[3-9]\d{9}$/, 'Please enter a valid phone number'),
  code: z.string().min(4, 'Please enter the verification code'),
});
export type MobileVerify = z.infer<typeof MobileVerifySchema>;

/**
 * 发送验证码请求
 */
export const SendCodeSchema = z.object({
  mobile: z.string().regex(/^1[3-9]\d{9}$/, 'Please enter a valid phone number'),
});
export type SendCode = z.infer<typeof SendCodeSchema>;

/**
 * 发送邮箱验证码请求
 */
export const SendEmailCodeSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
export type SendEmailCode = z.infer<typeof SendEmailCodeSchema>;

/**
 * 刷新 Token 请求
 */
export const RefreshTokenSchema = z.object({
  refresh: z.string().min(1, 'Refresh token is required'),
});
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const PlanSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  duration: z.number(),
});
export type Plan = z.infer<typeof PlanSchema>;

/**
 * 用户基本信息
 */
export const UserInfoSchema = z.object({
  id: z.string(),
  isAnonymity: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  code: z.string().nullable(),
  nickname: z.string().nullable(),
  headerImg: z.string().nullable(),
  sex: z.string().nullable(),
  /** 手机号（已脱敏） */
  mobile: z.string().nullable().optional(),
  /** 邮箱（已脱敏） */
  email: z.string().nullable().optional(),
});
export type UserInfo = z.infer<typeof UserInfoSchema>;

/**
 * 登录成功响应
 */
export const LoginSuccessSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  expire: z.number(),
  accessExpire: z.number(),
  isAnonymity: z.boolean().optional(),
  user: UserInfoSchema,
});
export type LoginSuccess = z.infer<typeof LoginSuccessSchema>;

/**
 * 注册成功响应 - Email
 */
export const EmailAccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  validator: z.boolean(),
});
export type EmailAccount = z.infer<typeof EmailAccountSchema>;

/**
 * 注册成功响应 - Mobile
 */
export const MobileAccountSchema = z.object({
  id: z.string(),
  mobile: z.string(),
  validator: z.boolean(),
});
export type MobileAccount = z.infer<typeof MobileAccountSchema>;

/**
 * 登出成功响应
 */
export const SignOutSuccessSchema = z.object({
  success: z.boolean(),
});
export type SignOutSuccess = z.infer<typeof SignOutSuccessSchema>;
