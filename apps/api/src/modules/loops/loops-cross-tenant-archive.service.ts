import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { createHash, randomUUID } from 'crypto';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsService } from './loops.service';

// ---------------------------------------------------------------------------
// Minimal interface for file storage operations needed by the archive service.
// The concrete binding is wired in LoopsModule via a factory that picks up
// the object-storage provider from the SSO infra layer when it's available in
// the NestJS DI container, and falls back to undefined otherwise.
// ---------------------------------------------------------------------------
export interface ArchiveFileStorage {
  getDefaultBucket(isPublic?: boolean): Promise<string>;
  getPrivateDownloadUrl(
    vendor: string,
    bucket: string,
    key: string,
    opts?: { expire: number },
  ): Promise<string>;
  fileDataUploader(vendor: string, bucket: string, key: string, b64: string): Promise<void>;
}

export const ARCHIVE_FILE_STORAGE = 'ARCHIVE_FILE_STORAGE';

/**
 * R35: Cross-tenant archive service.
 *
 * Architecture:
 * - Object storage via the injected ARCHIVE_FILE_STORAGE token
 *   (backed by the SSO-side object-storage provider when available)
 * - Multi-tenant scoping via SSO identity (tenantId is the partition key)
 * - Key pattern: `loops/archives/{tenantId}/{date}/{archiveId}.json`
 * - Local index: `.loops/archives/{tenantId}/index.json`
 *
 * Archive lifecycle:
 *   1. Collect `.loops` artifacts for a tenant
 *   2. Generate archive manifest (JSON with file listing + checksums)
 *   3. Upload to object storage via ARCHIVE_FILE_STORAGE
 *   4. Store archive metadata in local index
 *   5. Return presigned download URL for immediate access
 */
@Injectable()
export class LoopsCrossTenantArchiveService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly store: LoopsFileStoreService,
    private readonly loopsService: LoopsService,
    @Optional() @Inject(ARCHIVE_FILE_STORAGE) private readonly fileStorage?: ArchiveFileStorage,
  ) {}

  // =========================================================================
  // Archive Creation
  // =========================================================================

  async archiveTenant(
    tenantId: string,
    options?: { includeClosed?: boolean; period?: '7d' | '30d' | '90d' | 'all' },
  ): Promise<{
    archiveId: string;
    tenantId: string;
    fileCount: number;
    totalSizeBytes: number;
    storageKey: string;
    downloadUrl?: string;
    archivedAt: string;
  }> {
    const archiveId = `archive-${randomUUID().slice(0, 8)}`;
    const archivedAt = new Date().toISOString();
    const dateStr = archivedAt.slice(0, 10);

    // 1. Collect artifacts
    const artifacts = await this.collectTenantArtifacts(tenantId, options);
    if (artifacts.length === 0) {
      throw new Error(`No artifacts found for tenant ${tenantId}`);
    }

    // 2. Generate manifest with checksums
    const manifest = this.buildArchiveManifest(tenantId, archiveId, artifacts, archivedAt);

    // 3. Upload manifest to object storage
    const storageKey = `loops/archives/${tenantId}/${dateStr}/${archiveId}.json`;
    let downloadUrl: string | undefined;

    if (this.fileStorage) {
      try {
        const vendor = (process.env['FILE_STORAGE_VENDOR'] as string | undefined) ?? 'oss';
        const bucket = await this.fileStorage.getDefaultBucket(true);

        const manifestJson = JSON.stringify(manifest, null, 2);
        await this.fileStorage.fileDataUploader(
          vendor,
          bucket,
          storageKey,
          Buffer.from(manifestJson).toString('base64'),
        );

        downloadUrl = await this.fileStorage.getPrivateDownloadUrl(vendor, bucket, storageKey, {
          expire: 7 * 24 * 3600,
        });

        this.logger.info(
          `[CrossTenantArchive] Uploaded archive ${archiveId} for tenant ${tenantId}`,
          { archiveId, tenantId, storageKey, fileCount: artifacts.length },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[CrossTenantArchive] Upload failed: ${message}`, {
          archiveId,
          tenantId,
          error: message,
        });
      }
    }

    // 4. Store archive metadata locally
    this.store.writeArchiveIndex(tenantId, {
      archiveId,
      tenantId,
      storageKey,
      downloadUrl,
      fileCount: artifacts.length,
      totalSizeBytes: manifest.totalSizeBytes as number,
      archivedAt,
    });

    return {
      archiveId,
      tenantId,
      fileCount: artifacts.length,
      totalSizeBytes: manifest.totalSizeBytes as number,
      storageKey,
      downloadUrl,
      archivedAt,
    };
  }

  async listArchives(tenantId: string): Promise<
    Array<{
      archiveId: string;
      tenantId: string;
      storageKey: string;
      downloadUrl?: string;
      fileCount: number;
      totalSizeBytes: number;
      archivedAt: string;
    }>
  > {
    return this.store.listArchiveIndex(tenantId);
  }

  async getArchive(
    tenantId: string,
    archiveId: string,
  ): Promise<{
    archiveId: string;
    tenantId: string;
    storageKey: string;
    downloadUrl?: string;
    fileCount: number;
    totalSizeBytes: number;
    archivedAt: string;
  } | null> {
    return this.store.readArchiveIndex(tenantId, archiveId) ?? null;
  }

  async refreshDownloadUrl(tenantId: string, archiveId: string): Promise<string | null> {
    const archive = await this.getArchive(tenantId, archiveId);
    if (!archive || !this.fileStorage) return null;

    try {
      const vendor = (process.env['FILE_STORAGE_VENDOR'] as string | undefined) ?? 'oss';
      const bucket = await this.fileStorage.getDefaultBucket(true);
      const url = await this.fileStorage.getPrivateDownloadUrl(vendor, bucket, archive.storageKey, {
        expire: 7 * 24 * 3600,
      });
      this.store.writeArchiveIndex(tenantId, { ...archive, downloadUrl: url });
      return url;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // Artifact Collection
  // =========================================================================

  private async collectTenantArtifacts(
    tenantId: string,
    options?: { includeClosed?: boolean; period?: '7d' | '30d' | '90d' | 'all' },
  ): Promise<Array<{ path: string; sizeBytes: number; sha256: string }>> {
    const artifacts: Array<{ path: string; sizeBytes: number; sha256: string }> = [];

    try {
      const list = await this.loopsService.list({ limit: 500, page: 1 });
      const includeClosed = options?.includeClosed ?? false;

      for (const item of list.list) {
        if (!includeClosed && item.issue.status === 'CLOSED') continue;
        try {
          const detail = await this.loopsService.getIssue(item.issue.id);
          const detailJson = JSON.stringify({
            issue: detail.issue,
            state: detail.state,
            shardCount: detail.shards?.length,
            testRecordCount: detail.testRecords?.length,
            reviewRecordCount: detail.reviewRecords?.length,
            implRecordCount: detail.implementationRecords?.length,
          });
          artifacts.push({
            path: `.loops/issues/${item.issue.id}/detail.json`,
            sizeBytes: Buffer.byteLength(detailJson),
            sha256: this.sha256(detailJson),
          });
        } catch {
          /* skip unreadable issues */
        }
      }

      // Eval aggregation
      const evalAgg = await this.loopsService.getCrossTenantEvalAggregation({
        tenantId,
        period: 'all',
        limit: 100,
        page: 1,
      });
      if (evalAgg.aggregations.length > 0) {
        const evalJson = JSON.stringify(evalAgg.aggregations);
        artifacts.push({
          path: `.loops/eval/aggregation-${tenantId}.json`,
          sizeBytes: Buffer.byteLength(evalJson),
          sha256: this.sha256(evalJson),
        });
      }
    } catch (error) {
      this.logger.warn(`[CrossTenantArchive] Partial collection for ${tenantId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return artifacts;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private buildArchiveManifest(
    tenantId: string,
    archiveId: string,
    artifacts: Array<{ path: string; sizeBytes: number; sha256: string }>,
    archivedAt: string,
  ): Record<string, unknown> {
    const totalSizeBytes = artifacts.reduce((s, a) => s + a.sizeBytes, 0);
    return {
      archiveId,
      tenantId,
      version: '1.0',
      archivedAt,
      totalSizeBytes,
      fileCount: artifacts.length,
      files: artifacts.map((a) => ({ path: a.path, sizeBytes: a.sizeBytes, sha256: a.sha256 })),
      checksum: this.sha256(JSON.stringify(artifacts)),
    };
  }

  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
