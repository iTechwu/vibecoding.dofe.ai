import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '@app/services/loops-store';
import { LoopsEvidenceModule } from '@app/services/loops-evidence';
import { LoopsIssuesModule } from '@app/services/loops-issues';
import { LoopsAdminService } from './loops-admin.service';
import { LoopsArchiveCollectionService } from './loops-archive-collection.service';
import { LoopsCapabilityRegistry } from './loops-capability-registry';

/**
 * Loops Admin domain module — `@app/services/loops-admin`.
 *
 * Step 9: admin/control-plane capabilities. Archive control wrappers now live
 * in `LoopsAdminService`; archive collection reads now use a domain collection
 * service, with eval aggregation still optional behind a narrow port.
 */
@Module({
  imports: [LoopsStoreModule, LoopsIssuesModule, LoopsEvidenceModule],
  providers: [LoopsAdminService, LoopsArchiveCollectionService, LoopsCapabilityRegistry],
  exports: [LoopsAdminService, LoopsArchiveCollectionService, LoopsCapabilityRegistry],
})
export class LoopsAdminModule {}
