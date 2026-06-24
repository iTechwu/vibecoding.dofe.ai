CREATE TABLE "loop_runtime_backend_policy" (
    "id" VARCHAR(120) NOT NULL,
    "fallback_policy" TEXT,
    "cost_policy" TEXT,
    "permission_profile" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loop_runtime_backend_policy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loop_runtime_backend_policy_updated_at_idx" ON "loop_runtime_backend_policy"("updated_at" DESC);
