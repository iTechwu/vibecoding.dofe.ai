/**
 * Loops Store barrel — `@app/services/loops-store`.
 *
 * 结构优化 Step 1：文件真相源 + DB persistence + 路径策略 + 通知发送（暂置）。
 */
export * from './loops-path-policy.util';
export * from './loops-workspace-root.util';
export * from './loops-runtime-config.util';
export * from './loops-learning-memory.util';
export { LoopsStoreModule } from './loops-store.module';
export { LoopsFileStoreService } from './loops-file-store.service';
export { LoopsPersistenceService } from './loops-persistence.service';
export { LOOPS_PERSISTENCE } from './loops-persistence.token';
export { LoopsNotificationSender } from './loops-notification-sender.service';
