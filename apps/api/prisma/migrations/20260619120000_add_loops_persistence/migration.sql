-- CreateTable
CREATE TABLE "loop_issue" (
    "id" VARCHAR(80) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "priority" VARCHAR(10) NOT NULL,
    "source_channel" VARCHAR(40) NOT NULL,
    "source_kind" VARCHAR(40) NOT NULL DEFAULT 'web_form',
    "submitter_provider" VARCHAR(40) NOT NULL DEFAULT 'dev',
    "submitter_id" VARCHAR(120) NOT NULL,
    "submitter_name" VARCHAR(120) NOT NULL,
    "target_repo" TEXT NOT NULL,
    "acceptance_criteria" JSONB NOT NULL,
    "raw_payload_ref" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loop_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loop_issue_intake" (
    "id" VARCHAR(100) NOT NULL,
    "issue_id" VARCHAR(80) NOT NULL,
    "source_channel" VARCHAR(40) NOT NULL,
    "source_kind" VARCHAR(40) NOT NULL,
    "submitter_provider" VARCHAR(40) NOT NULL,
    "submitter_id" VARCHAR(120) NOT NULL,
    "submitter_name" VARCHAR(120) NOT NULL,
    "message" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "raw_payload_ref" TEXT NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loop_issue_intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loop_state" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" VARCHAR(80) NOT NULL,
    "phase" VARCHAR(60) NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "spec_version" VARCHAR(20) NOT NULL DEFAULT 'v0',
    "shards_total" INTEGER NOT NULL DEFAULT 0,
    "shards_done" INTEGER NOT NULL DEFAULT 0,
    "shards_in_progress" INTEGER NOT NULL DEFAULT 0,
    "reloop_count" INTEGER NOT NULL DEFAULT 0,
    "cost_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_calls" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "global_verdict" VARCHAR(40),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loop_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loop_issue_status_updated_at_idx" ON "loop_issue"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "loop_issue_submitter_id_created_at_idx" ON "loop_issue"("submitter_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loop_issue_created_at_idx" ON "loop_issue"("created_at" DESC);

-- CreateIndex
CREATE INDEX "loop_issue_intake_issue_id_idx" ON "loop_issue_intake"("issue_id");

-- CreateIndex
CREATE INDEX "loop_issue_intake_created_at_idx" ON "loop_issue_intake"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "loop_state_issue_id_key" ON "loop_state"("issue_id");

-- CreateIndex
CREATE INDEX "loop_state_phase_updated_at_idx" ON "loop_state"("phase", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "loop_issue_intake" ADD CONSTRAINT "loop_issue_intake_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "loop_issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loop_state" ADD CONSTRAINT "loop_state_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "loop_issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
