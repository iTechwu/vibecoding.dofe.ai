import { Module } from '@nestjs/common';
import { PrismaModule } from '@dofe/infra-prisma';
import { LoopsDbService } from './loops-db.service';

@Module({
  imports: [PrismaModule],
  providers: [LoopsDbService],
  exports: [LoopsDbService],
})
export class LoopsDbModule {}
