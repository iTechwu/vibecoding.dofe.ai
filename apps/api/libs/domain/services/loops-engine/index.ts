/**
 * Loops Engine barrel — `@app/services/loops-engine`.
 *
 * 结构优化 Step 3 + nextstep Step N1：loop 状态机纯推导原语 + spec/decompose 推进流
 * + advance 递归调度。
 */
export { LoopsEngineModule } from './loops-engine.module';
export {
  LoopsEngineService,
  type LoopsEngineAdvancePort,
  type LoopsEngineShardRunnerPort,
  type LoopsEngineFinalizePort,
  type LoopsEngineGlobalReviewPort,
} from './loops-engine.service';
