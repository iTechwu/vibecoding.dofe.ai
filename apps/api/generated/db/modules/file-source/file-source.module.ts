import { Module } from '@nestjs/common';
import { FileSourceService } from './file-source.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [FileSourceService],
  exports: [FileSourceService],
})
export class FileSourceModule {}
