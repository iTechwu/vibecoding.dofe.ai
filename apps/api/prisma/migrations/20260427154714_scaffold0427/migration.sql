-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "sex_type" AS ENUM ('UNKNOWN', 'MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "file_bucket_vendor" AS ENUM ('oss', 'us3', 'qiniu', 's3', 'gcs', 'tos', 'tencent', 'ksyun');

-- CreateEnum
CREATE TYPE "file_env_type" AS ENUM ('dev', 'test', 'prod', 'produs', 'prodap');

-- CreateTable
CREATE TABLE "u_user_info" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nickname" VARCHAR(255) NOT NULL DEFAULT '',
    "code" VARCHAR(255),
    "avatar_file_id" UUID,
    "sex" "sex_type" NOT NULL DEFAULT 'UNKNOWN',
    "locale" VARCHAR(20),
    "is_anonymity" BOOLEAN NOT NULL DEFAULT false,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "device_id" VARCHAR(255),
    "wechat_openid" VARCHAR(255),
    "wechat_union_id" VARCHAR(255),
    "google_sub" VARCHAR(255),
    "discord_id" VARCHAR(255),
    "mobile" VARCHAR(40),
    "email" VARCHAR(255),

    CONSTRAINT "u_user_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "u_wechat_auth" (
    "openid" VARCHAR(255) NOT NULL,
    "session_key" TEXT,
    "refresh_token" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6)
);

-- CreateTable
CREATE TABLE "u_google_auth" (
    "sub" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "verified_email" BOOLEAN NOT NULL DEFAULT true,
    "at_hash" VARCHAR(255),
    "name" VARCHAR(255),
    "picture" TEXT,
    "given_name" VARCHAR(255),
    "family_name" VARCHAR(255),
    "exp" INTEGER NOT NULL,
    "iat" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6)
);

-- CreateTable
CREATE TABLE "u_discord_auth" (
    "discord_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "verified_email" BOOLEAN NOT NULL DEFAULT true,
    "name" VARCHAR(255),
    "access_token" TEXT,
    "refresh_token" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6)
);

-- CreateTable
CREATE TABLE "u_mobile_auth" (
    "mobile" VARCHAR(40) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6)
);

-- CreateTable
CREATE TABLE "u_email_auth" (
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6)
);

-- CreateTable
CREATE TABLE "f_file_source" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "is_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "bucket" VARCHAR(255) NOT NULL,
    "key" UUID NOT NULL,
    "hash" VARCHAR(255),
    "thumb_img" VARCHAR(255),
    "fsize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mime_type" VARCHAR(255) NOT NULL DEFAULT '',
    "type" INTEGER NOT NULL DEFAULT 0,
    "end_user" VARCHAR(255),
    "status" INTEGER NOT NULL DEFAULT 0,
    "sha256" VARCHAR(255),
    "parts" INTEGER[],
    "ext" VARCHAR(255) NOT NULL DEFAULT '',
    "expire_at" TIMESTAMPTZ(6),
    "transition_to_ia_at" TIMESTAMPTZ(6),
    "transition_to_archive_at" TIMESTAMPTZ(6),
    "transition_to_deep_archive_at" TIMESTAMPTZ(6),
    "transition_to_archive_ir_at" TIMESTAMPTZ(6),
    "env" "file_env_type" NOT NULL DEFAULT 'prod',
    "vendor" "file_bucket_vendor" NOT NULL DEFAULT 'us3',
    "region" TEXT NOT NULL DEFAULT 'cn-beijing',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "f_file_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_code" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "continent" VARCHAR(10) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "country_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_code_key" ON "u_user_info"("code");

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_device_id_key" ON "u_user_info"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_wechat_openid_key" ON "u_user_info"("wechat_openid");

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_wechat_union_id_key" ON "u_user_info"("wechat_union_id");

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_google_sub_key" ON "u_user_info"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_discord_id_key" ON "u_user_info"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_mobile_key" ON "u_user_info"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "u_user_info_email_key" ON "u_user_info"("email");

-- CreateIndex
CREATE INDEX "u_user_info_code_idx" ON "u_user_info"("code");

-- CreateIndex
CREATE INDEX "u_user_info_is_deleted_is_admin_idx" ON "u_user_info"("is_deleted", "is_admin");

-- CreateIndex
CREATE INDEX "u_user_info_created_at_idx" ON "u_user_info"("created_at" DESC);

-- CreateIndex
CREATE INDEX "u_user_info_nickname_idx" ON "u_user_info"("nickname");

-- CreateIndex
CREATE INDEX "u_user_info_avatar_file_id_idx" ON "u_user_info"("avatar_file_id");

-- CreateIndex
CREATE INDEX "u_user_info_device_id_idx" ON "u_user_info"("device_id");

-- CreateIndex
CREATE INDEX "u_user_info_wechat_openid_idx" ON "u_user_info"("wechat_openid");

-- CreateIndex
CREATE INDEX "u_user_info_google_sub_idx" ON "u_user_info"("google_sub");

-- CreateIndex
CREATE INDEX "u_user_info_discord_id_idx" ON "u_user_info"("discord_id");

-- CreateIndex
CREATE INDEX "u_user_info_mobile_idx" ON "u_user_info"("mobile");

-- CreateIndex
CREATE INDEX "u_user_info_email_idx" ON "u_user_info"("email");

-- CreateIndex
CREATE UNIQUE INDEX "u_wechat_auth_openid_key" ON "u_wechat_auth"("openid");

-- CreateIndex
CREATE INDEX "u_wechat_auth_openid_idx" ON "u_wechat_auth"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "u_google_auth_sub_key" ON "u_google_auth"("sub");

-- CreateIndex
CREATE INDEX "u_google_auth_sub_idx" ON "u_google_auth"("sub");

-- CreateIndex
CREATE INDEX "u_google_auth_email_idx" ON "u_google_auth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "u_discord_auth_discord_id_key" ON "u_discord_auth"("discord_id");

-- CreateIndex
CREATE INDEX "u_discord_auth_discord_id_idx" ON "u_discord_auth"("discord_id");

-- CreateIndex
CREATE INDEX "u_discord_auth_email_idx" ON "u_discord_auth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "u_mobile_auth_mobile_key" ON "u_mobile_auth"("mobile");

-- CreateIndex
CREATE INDEX "u_mobile_auth_mobile_idx" ON "u_mobile_auth"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "u_email_auth_email_key" ON "u_email_auth"("email");

-- CreateIndex
CREATE INDEX "u_email_auth_email_idx" ON "u_email_auth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "f_file_source_key_key" ON "f_file_source"("key");

-- CreateIndex
CREATE INDEX "f_file_source_fsize_sha256_idx" ON "f_file_source"("fsize", "sha256");

-- CreateIndex
CREATE INDEX "f_file_source_is_deleted_idx" ON "f_file_source"("is_deleted");

-- CreateIndex
CREATE INDEX "f_file_source_is_uploaded_idx" ON "f_file_source"("is_uploaded");

-- CreateIndex
CREATE INDEX "f_file_source_bucket_idx" ON "f_file_source"("bucket");

-- CreateIndex
CREATE INDEX "f_file_source_key_idx" ON "f_file_source"("key");

-- CreateIndex
CREATE INDEX "country_code_continent_idx" ON "country_code"("continent");

-- CreateIndex
CREATE INDEX "country_code_code_idx" ON "country_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "country_code_continent_code_key" ON "country_code"("continent", "code");

-- AddForeignKey
ALTER TABLE "u_user_info" ADD CONSTRAINT "u_user_info_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "f_file_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "u_wechat_auth" ADD CONSTRAINT "u_wechat_auth_openid_fkey" FOREIGN KEY ("openid") REFERENCES "u_user_info"("wechat_openid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "u_google_auth" ADD CONSTRAINT "u_google_auth_sub_fkey" FOREIGN KEY ("sub") REFERENCES "u_user_info"("google_sub") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "u_discord_auth" ADD CONSTRAINT "u_discord_auth_discord_id_fkey" FOREIGN KEY ("discord_id") REFERENCES "u_user_info"("discord_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "u_mobile_auth" ADD CONSTRAINT "u_mobile_auth_mobile_fkey" FOREIGN KEY ("mobile") REFERENCES "u_user_info"("mobile") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "u_email_auth" ADD CONSTRAINT "u_email_auth_email_fkey" FOREIGN KEY ("email") REFERENCES "u_user_info"("email") ON DELETE CASCADE ON UPDATE CASCADE;
