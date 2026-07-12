import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

const ARCHIVE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function assertArchiveId(value: string, label: string): string {
  if (!ARCHIVE_ID_PATTERN.test(value) || value === '.' || value === '..') {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return value;
}

export function archiveIndexDirectory(root: string, tenantId: string): string {
  return path.join(root, 'archives', assertArchiveId(tenantId, 'archive tenant ID'));
}

export function archiveIndexFile(root: string, tenantId: string, archiveId: string): string {
  return path.join(
    archiveIndexDirectory(root, tenantId),
    `${assertArchiveId(archiveId, 'archive ID')}.json`,
  );
}
