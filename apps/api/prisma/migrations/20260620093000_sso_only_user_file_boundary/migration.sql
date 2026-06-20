-- Align local schema with the SSO-only boundary.
-- User/auth/session/file metadata are owned by sso.dofe.ai.

ALTER TABLE "u_user_info" DROP CONSTRAINT IF EXISTS "u_user_info_avatar_file_id_fkey";

DROP TABLE IF EXISTS "u_wechat_auth" CASCADE;
DROP TABLE IF EXISTS "u_google_auth" CASCADE;
DROP TABLE IF EXISTS "u_discord_auth" CASCADE;
DROP TABLE IF EXISTS "u_mobile_auth" CASCADE;
DROP TABLE IF EXISTS "u_email_auth" CASCADE;
DROP TABLE IF EXISTS "f_file_source" CASCADE;

DROP INDEX IF EXISTS "u_user_info_device_id_key";
DROP INDEX IF EXISTS "u_user_info_wechat_openid_key";
DROP INDEX IF EXISTS "u_user_info_wechat_union_id_key";
DROP INDEX IF EXISTS "u_user_info_google_sub_key";
DROP INDEX IF EXISTS "u_user_info_discord_id_key";
DROP INDEX IF EXISTS "u_user_info_mobile_key";
DROP INDEX IF EXISTS "u_user_info_email_key";
DROP INDEX IF EXISTS "u_user_info_device_id_idx";
DROP INDEX IF EXISTS "u_user_info_wechat_openid_idx";
DROP INDEX IF EXISTS "u_user_info_google_sub_idx";
DROP INDEX IF EXISTS "u_user_info_discord_id_idx";
DROP INDEX IF EXISTS "u_user_info_mobile_idx";
DROP INDEX IF EXISTS "u_user_info_email_idx";

ALTER TABLE "u_user_info" ADD COLUMN IF NOT EXISTS "sso_sub" VARCHAR(255);
ALTER TABLE "u_user_info" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "u_user_info" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "u_user_info" DROP COLUMN IF EXISTS "is_anonymity";
ALTER TABLE "u_user_info" DROP COLUMN IF EXISTS "device_id";
ALTER TABLE "u_user_info" DROP COLUMN IF EXISTS "wechat_openid";
ALTER TABLE "u_user_info" DROP COLUMN IF EXISTS "wechat_union_id";
ALTER TABLE "u_user_info" DROP COLUMN IF EXISTS "google_sub";
ALTER TABLE "u_user_info" DROP COLUMN IF EXISTS "discord_id";

CREATE UNIQUE INDEX IF NOT EXISTS "u_user_info_sso_sub_key" ON "u_user_info"("sso_sub");
CREATE INDEX IF NOT EXISTS "u_user_info_sso_sub_idx" ON "u_user_info"("sso_sub");

DROP TYPE IF EXISTS "file_bucket_vendor";
DROP TYPE IF EXISTS "file_env_type";
