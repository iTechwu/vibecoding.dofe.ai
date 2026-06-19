import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  OnModuleInit,
} from '@nestjs/common';

/** app filter */
import { APP_FILTER, ModuleRef } from '@nestjs/core';
import { HttpExceptionFilter, setTransactionMetricsService } from '@dofe/infra-common';

/** request middleware */
import RequestMiddleware from '@dofe/infra-common/middleware/request.middleware';
import { DbMetricsService } from '@dofe/infra-prisma';
import { createAppModuleImports } from './bootstrap/app-module-imports.bootstrap';

@Module({
  imports: createAppModuleImports(),
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    setTransactionMetricsService(() => {
      try {
        return this.moduleRef.get(DbMetricsService, { strict: false });
      } catch {
        return undefined;
      }
    });
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
