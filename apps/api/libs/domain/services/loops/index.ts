/**
 * Loops domain entry — `@app/services/loops`.
 *
 * Step 0：只导出装配 module。facade service（LoopsService 等价调用面）将在
 * Step 2 开始把 issue/engine 方法委托到子域 service 时加入并从此处导出。
 */
export { LoopsDomainModule } from './loops.module';
