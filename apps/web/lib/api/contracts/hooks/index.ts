'use client';

// User hooks
export { userKeys, useUserInfo, useUserCheck, useUserContact } from './user';

// Message hooks
export { messageKeys, useMessages, useUnreadMessageCount, useSetMessagesRead } from './message';

// Analytics hooks
export { analyticsKeys, useTrackEvent, useTrackEventBatch } from './analytics';

// Task hooks
export { taskKeys, useCheckTask, useTaskList, useCheckTasks } from './task';

// System hooks
export { systemKeys, usePermissionConfig, useServiceReady, useServiceHealth } from './system';

// Notification hooks (scaffold reference)
export { notificationKeys } from './notification';

// Setting hooks
export {
  settingKeys,
  useSaveAccount,
  useUpdateAvatar,
  useSendVerifyEmail,
  useBindEmail,
  useBindPhone,
} from './setting';

// Loops hooks
export {
  loopsKeys,
  useLoopsList,
  useLoopsDoctor,
  useLoopsCost,
  useLoopsMetrics,
  useLoopsAgentRuntime,
  useLoopsCapabilities,
  useLoopsLogs,
  useLoopsNotifications,
  useLoopIssue,
  useCreateLoopIssue,
  useResumeLoops,
  useGenerateLoopSpec,
  useReviewLoopSpec,
  useDecomposeLoop,
  useRunLoopShardTests,
  useRecordLoopShardImplementation,
  useReviewLoopShard,
  useRunLoop,
  useAdvanceLoop,
  useReviewLoopGlobal,
  useReloopIssue,
  useFinalizeLoop,
  useInterveneLoop,
  useRunLoopBrowserQa,
  useRunLoopSecondOpinion,
  useGovernLoopDelivery,
  useLoopsWorkspaces,
  useGovernLoopLearning,
  useRunLoopLearningAutoMergeWorker,
  useUpsertLoopsWorkspace,
  useDetectLoopsRuntime,
  usePullLoopsImage,
  useRetryLoopsAgentRuntime,
  useCreateSimpleLoopIssue,
} from './loops';
