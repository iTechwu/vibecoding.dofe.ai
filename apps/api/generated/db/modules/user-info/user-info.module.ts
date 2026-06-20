import { Module } from '@nestjs/common';
import { UserInfoService } from './user-info.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [UserInfoService],
  exports: [UserInfoService],
})
export class UserInfoModule {}
