-- SSO owns tenant/team identity. These are nullable verified foreign-key
-- snapshots so historical Loop records remain explicitly unscoped until a
-- separately audited backfill can prove their SSO ownership.
ALTER TABLE "loop_issue"
  ADD COLUMN "tenant_id" VARCHAR(64),
  ADD COLUMN "team_id" VARCHAR(64);

CREATE INDEX "loop_issue_tenant_id_updated_at_idx"
  ON "loop_issue"("tenant_id", "updated_at" DESC);

CREATE INDEX "loop_issue_team_id_updated_at_idx"
  ON "loop_issue"("team_id", "updated_at" DESC);
