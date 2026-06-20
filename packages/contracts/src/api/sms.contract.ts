import { initContract } from '@ts-rest/core';
import { ApiResponseSchema } from '../base';
import {
  SendSmsCodeRequestSchema,
  CheckVerifyCodeRequestSchema,
  SendSmsCodeResponseSchema,
  CheckVerifyCodeResponseSchema,
} from '../schemas/sms.schema';

const c = initContract();

/**
 * SMS API Contract
 */
export const smsContract = c.router(
  {
    // POST /sms/send/code - Send SMS code
    sendCode: {
      method: 'POST',
      path: '/send/code',
      body: SendSmsCodeRequestSchema,
      responses: {
        200: ApiResponseSchema(SendSmsCodeResponseSchema),
      },
      summary: 'Send SMS verification code',
    },

    // POST /sms/check/code - Check verify code
    checkCode: {
      method: 'POST',
      path: '/check/code',
      body: CheckVerifyCodeRequestSchema,
      responses: {
        200: ApiResponseSchema(CheckVerifyCodeResponseSchema),
      },
      summary: 'Check SMS verification code',
    },

    // SMS login/register endpoints are intentionally not exposed.
    // Authentication is owned by sso.dofe.ai via OIDC.
  },
  {
    pathPrefix: '/sms',
  },
);

export type SmsContract = typeof smsContract;
