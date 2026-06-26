/**
 * Injection token for the Loops persistence layer (DB index + `.loops` dual-write).
 *
 * Kept in a standalone module with no `@app/db` / Prisma imports so `LoopsService`
 * can depend on the persistence contract via a **type-only** import + this token,
 * without statically importing the concrete `LoopsPersistenceService`. That keeps
 * standalone consumers (e.g. `scripts/loops-cli.ts`, run under plain `ts-node`
 * which does not resolve the `@app/db` tsconfig path alias) free of DB
 * dependencies; the concrete service is only loaded when the NestJS module wires
 * the token via `useExisting: LoopsPersistenceService`.
 */
export const LOOPS_PERSISTENCE = Symbol('LOOPS_PERSISTENCE');
