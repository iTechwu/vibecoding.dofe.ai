/**
 * i18n 类型定义
 * 为翻译键提供类型安全
 *
 * 使用方式：
 * import type { TranslationKeys } from '@/i18n/types';
 * const key: TranslationKeys = 'common.actions.save';
 */

import type zhCN from '../locales/zh-CN/common.json';
import type zhCNNavigation from '../locales/zh-CN/navigation.json';
import type zhCNForms from '../locales/zh-CN/forms.json';
import type zhCNErrors from '../locales/zh-CN/errors.json';
import type zhCNValidation from '../locales/zh-CN/validation.json';
import type zhCNChat from '../locales/zh-CN/chat.json';
import type zhCNRecruitment from '../locales/zh-CN/recruitment.json';
import type zhCNAssessment from '../locales/zh-CN/assessment.json';
import type zhCNCreative from '../locales/zh-CN/creative.json';
import type zhCNSettings from '../locales/zh-CN/settings.json';
import type zhCNSubscription from '../locales/zh-CN/subscription.json';
import type zhCNRecommendation from '../locales/zh-CN/recommendation.json';
import type zhCNMemory from '../locales/zh-CN/memory.json';

/**
 * 所有翻译消息的类型定义
 */
export interface AppMessages {
  common: typeof zhCN;
  navigation: typeof zhCNNavigation;
  forms: typeof zhCNForms;
  errors: typeof zhCNErrors;
  validation: typeof zhCNValidation;
  chat: typeof zhCNChat;
  recruitment: typeof zhCNRecruitment;
  assessment: typeof zhCNAssessment;
  creative: typeof zhCNCreative;
  settings: typeof zhCNSettings;
  subscription: typeof zhCNSubscription;
  recommendation: typeof zhCNRecommendation;
  memory: typeof zhCNMemory;
}

/**
 * 声明 next-intl 的类型
 * 这样 useTranslations() 就能获得类型提示
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace IntlMessages {
    interface Messages extends AppMessages {}
  }
}

export {};
