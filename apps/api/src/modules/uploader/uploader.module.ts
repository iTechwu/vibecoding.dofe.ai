import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploaderController } from './uploader.controller';
import { UploaderModule as UploaderServiceModule } from '@dofe/infra-shared-services';
import { FileStorageServiceModule } from '@dofe/infra-shared-services';
import { FileSourceModule } from '@app/db';

@Module({
  imports: [
    ConfigModule,
    UploaderServiceModule,
    FileStorageServiceModule,
    FileSourceModule,
  ],
  controllers: [UploaderController],
})
export class UploaderModule {}
