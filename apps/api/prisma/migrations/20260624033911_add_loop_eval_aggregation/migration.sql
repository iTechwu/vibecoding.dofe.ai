-- CreateTable
CREATE TABLE "loop_second_opinion_record" (
    "id" VARCHAR(120) NOT NULL,
    "issue_id" VARCHAR(80) NOT NULL,
    "runner" VARCHAR(60) NOT NULL DEFAULT 'claude-code',
    "status" VARCHAR(40) NOT NULL DEFAULT 'pending',
    "summary" TEXT,
    "primary_findings" JSONB NOT NULL DEFAULT '[]',
    "secondary_findings" JSONB NOT NULL DEFAULT '[]',
    "comparison" JSONB,
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "resolutions" JSONB NOT NULL DEFAULT '[]',
    "fingerprint_hash" VARCHAR(128),
    "reference_path" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loop_second_opinion_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loop_learning_record" (
    "id" VARCHAR(120) NOT NULL,
    "issue_id" VARCHAR(80) NOT NULL,
    "workspace_id" VARCHAR(120) NOT NULL,
    "repo" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "fingerprint" VARCHAR(128),
    "similar_learning_ids" JSONB NOT NULL DEFAULT '[]',
    "lifecycle" VARCHAR(40) NOT NULL DEFAULT 'active',
    "source" VARCHAR(60) NOT NULL DEFAULT 'loop-finalize',
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "reuse_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ(6),
    "superseded_by_id" VARCHAR(120),
    "merge_decision" VARCHAR(40),
    "merge_decided_by" VARCHAR(120),
    "merge_decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deprecated_at" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loop_learning_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loop_eval_aggregation" (
    "id" VARCHAR(36) NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "workspace_id" VARCHAR(64) NOT NULL,
    "suite_id" VARCHAR(64) NOT NULL,
    "blueprint_id" VARCHAR(64),
    "total_checks" INTEGER NOT NULL,
    "passed_checks" INTEGER NOT NULL,
    "failed_checks" INTEGER NOT NULL,
    "blocked_checks" INTEGER NOT NULL,
    "pass_rate" DOUBLE PRECISION NOT NULL,
    "average_score" DOUBLE PRECISION NOT NULL,
    "loop_count" INTEGER NOT NULL,
    "trend_delta" DOUBLE PRECISION,
    "period" VARCHAR(10) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loop_eval_aggregation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loop_second_opinion_record_issue_id_idx" ON "loop_second_opinion_record"("issue_id");

-- CreateIndex
CREATE INDEX "loop_second_opinion_record_status_created_at_idx" ON "loop_second_opinion_record"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loop_second_opinion_record_fingerprint_hash_idx" ON "loop_second_opinion_record"("fingerprint_hash");

-- CreateIndex
CREATE INDEX "loop_learning_record_workspace_id_lifecycle_updated_at_idx" ON "loop_learning_record"("workspace_id", "lifecycle", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "loop_learning_record_repo_kind_lifecycle_idx" ON "loop_learning_record"("repo", "kind", "lifecycle");

-- CreateIndex
CREATE INDEX "loop_learning_record_fingerprint_idx" ON "loop_learning_record"("fingerprint");

-- CreateIndex
CREATE INDEX "loop_learning_record_lifecycle_confidence_idx" ON "loop_learning_record"("lifecycle", "confidence" DESC);

-- CreateIndex
CREATE INDEX "loop_learning_record_created_at_idx" ON "loop_learning_record"("created_at" DESC);

-- CreateIndex
CREATE INDEX "loop_eval_aggregation_tenant_id_suite_id_captured_at_idx" ON "loop_eval_aggregation"("tenant_id", "suite_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "loop_eval_aggregation_workspace_id_captured_at_idx" ON "loop_eval_aggregation"("workspace_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "loop_eval_aggregation_blueprint_id_captured_at_idx" ON "loop_eval_aggregation"("blueprint_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "loop_eval_aggregation_period_captured_at_idx" ON "loop_eval_aggregation"("period", "captured_at" DESC);
