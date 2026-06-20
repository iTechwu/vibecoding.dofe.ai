const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
dotenvExpand.expand(dotenv.config());

const prismaClient = require('@prisma/client') as {
  FileBucketVendor?: Record<string, string>;
  FileEnvType?: Record<string, string>;
};

// Compatibility shim for shared @dofe/infra packages that still reference the
// removed local file-storage Prisma enums at module initialization time.
prismaClient.FileBucketVendor ??= {
  oss: 'oss',
  us3: 'us3',
  qiniu: 'qiniu',
  s3: 's3',
  gcs: 'gcs',
  tos: 'tos',
  tencent: 'tencent',
  ksyun: 'ksyun',
};
prismaClient.FileEnvType ??= {
  dev: 'dev',
  test: 'test',
  prod: 'prod',
  produs: 'produs',
  prodap: 'prodap',
};

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, INestApplication, VersioningType } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  getConfig,
  TransformInterceptor,
  VersionGuard,
  VersionHeaderInterceptor,
} from '@dofe/infra-common';
import { initAllConfig } from '@dofe/infra-common/config/configuration';
import { environmentUtil, ipUtil, loadEnvUtil } from '@dofe/infra-utils';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

import * as rateLimit from '@fastify/rate-limit';
import * as fastifyHelmet from '@fastify/helmet';
import * as compress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifySSE from 'fastify-sse-v2';
import fastifyMultipart from '@fastify/multipart';

import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyPluginCallback, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { RedisService } from '@dofe/infra-redis';

// 添加全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 可选择性地退出应用程序
  // process.exit(1)
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

type RegisterableFastifyPlugin =
  | FastifyPluginCallback<Record<string, unknown>>
  | FastifyPluginAsync<Record<string, unknown>>;
type RateLimitContext = { max: number; ttl: number };
type FastifyCorsOptions = Parameters<NestFastifyApplication['enableCors']>[0];

function asFastifyPlugin(plugin: unknown): RegisterableFastifyPlugin {
  return plugin as RegisterableFastifyPlugin;
}

function requestField(request: FastifyRequest, field: string): unknown {
  return (request as FastifyRequest & Record<string, unknown>)[field];
}

/**
 * 将 keys/config.json 中的核心密钥同步到 process.env
 * 确保 ConfigService.getOrThrow('JWT_SECRET') 等调用可以正常工作
 * 直接读取原始 JSON 文件，不依赖 infra-common 的 Zod schema（避免 dist 未重建导致字段被 strip）
 */
function syncKeysToEnv(): void {
  const projectRoot = process.env.PROJECT_ROOT?.replace('$(pwd)', process.cwd()) || process.cwd();
  const keysPath = path.join(projectRoot, 'keys', 'config.json');
  if (!existsSync(keysPath)) return;

  try {
    const keys = JSON.parse(readFileSync(keysPath, 'utf8'));
    // keys/config.json 优先于 .env，直接覆盖
    if (keys.jwt?.secret) {
      process.env.JWT_SECRET = keys.jwt.secret;
    }
    if (keys.jwt?.expireIn) {
      process.env.JWT_EXPIRE_IN = String(keys.jwt.expireIn);
    }
    if (keys.crypto?.key) {
      process.env.CRYPTO_KEY = keys.crypto.key;
    }
    if (keys.crypto?.iv) {
      process.env.CRYPTO_IV = keys.crypto.iv;
    }
    if (keys.encryption?.key) {
      process.env.ENCRYPTION_KEY = keys.encryption.key;
    }
  } catch {
    // keys/config.json 不存在或格式错误时静默忽略
  }
}

async function bootstrap() {
  // 加载环境变量
  loadEnvUtil.loadEnv([
    '.env', // 确保在最后加载，以便其他文件可以覆盖它
    `.env.${environmentUtil.getEnv()}`,
  ]);

  // 优先从 keys/config.json 同步密钥到 process.env
  // 必须在 initConfig() 之前执行，因为 initConfig() 会读取 process.env 合并到 yaml config
  syncKeysToEnv();

  // 初始化配置（env + yaml + keys + feature validation）
  try {
    await initAllConfig();
  } catch {
    // initAllConfig 可能因 dist 未更新而不可用，回退到旧模式
    const { initConfig, initKeysConfig } = require('@dofe/infra-common/config/configuration');
    await initConfig();
    initKeysConfig();
    // 确保密钥已同步（initAllConfig 失败时 syncKeysToEnv 可能未生效）
    syncKeysToEnv();
  }

  const config = getConfig()!;

  const adapter = new FastifyAdapter();
  // 安全防护
  adapter.register(asFastifyPlugin(fastifyHelmet));
  // , {
  //     contentSecurityPolicy: false,
  //     crossOriginResourcePolicy: false,
  // })
  // 压缩请求
  adapter.register(asFastifyPlugin(compress), {
    global: true,
    encodings: ['gzip', 'deflate'],
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    rawBody: true,
    logger: ['error', 'warn', 'verbose', 'debug'],
  });
  await app.register(asFastifyPlugin(fastifySSE));
  // 注册 multipart 插件用于文件上传
  await app.register(asFastifyPlugin(fastifyMultipart), {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB 最大文件大小
    },
  });

  const redisService = app.get(RedisService);

  // 入口限流: 多维度限流保护
  // 优先级: userId > apiKey > tenantId > IP
  app.register(asFastifyPlugin(rateLimit), {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) => {
      // 多维度 Key 生成: 优先使用用户身份，降级到 IP
      const user = requestField(req, 'user') as { id?: string } | undefined;
      const userId = user?.id || requestField(req, 'userId');
      const apiKey = req.headers['x-api-key'];
      const tenantId = requestField(req, 'teamId') || requestField(req, 'tenantId');
      const ip = ipUtil.extractIp(req);

      if (userId) return `user:${String(userId)}`;
      if (apiKey) return `apiKey:${apiKey}`;
      if (tenantId) return `tenant:${String(tenantId)}`;
      return `ip:${ip}`;
    },
    redis: redisService.redis,
    allowList: (req: FastifyRequest) => {
      // 白名单路由不受限流
      const excludedRoutes = ['/health', '/metrics', '/docs', '/api/apis'];
      // 检查精确匹配或前缀匹配
      const isExcluded = excludedRoutes.some((route) => req.url.startsWith(route));

      // 特殊处理：匹配流式语音识别的音频上传路由
      // 格式：/api/streaming-asr/sessions/{sessionId}/audio
      if (!isExcluded) {
        const streamingAsrAudioPattern = /^\/api\/streaming-asr\/sessions\/[^/]+\/audio/;
        if (streamingAsrAudioPattern.test(req.url)) {
          return true;
        }
        const streamingAsrHeartbeatPattern = /^\/api\/streaming-asr\/sessions\/[^/]+\/heartbeat/;
        if (streamingAsrHeartbeatPattern.test(req.url)) {
          return true;
        }
      }

      return isExcluded;
    },
    errorResponseBuilder: (req: FastifyRequest, context: RateLimitContext) => ({
      code: 925429,
      msg: '请求过于频繁，请稍后再试',
      error: {
        limit: context.max,
        remaining: 0,
        resetTime: Math.ceil(Date.now() / 1000 + context.ttl / 1000),
        retryAfter: Math.ceil(context.ttl / 1000),
      },
      traceId: String(requestField(req, 'traceId') || ''),
    }),
  });
  // 不需要对cookie进行校验
  await app.register(asFastifyPlugin(fastifyCookie));

  // 如果需要校验则
  // await app.register(fastifyCookie, {
  //     secret: 'my-secret', // 用于cookie签名的密钥
  // })
  // Pre-compile CORS regex once at bootstrap (env config does not change at runtime)
  const { corsDomains } = environmentUtil.generateEnvironmentUrls({
    domain: config.app.domain,
    subDomain: config.app.subDomain,
    apiSubDomain: config.app.apiSubDomain,
  });
  const isDevEnv = environmentUtil.isDev();
  const corsRegex = new RegExp(
    `^https?://(.*\\.)?${corsDomains.join('|').replace(/\*/g, '.*')}${isDevEnv ? '(:[0-9]+)?$' : '$'}`,
  );

  // 跨域配置
  const corsOptions: FastifyCorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      if (
        !origin ||
        corsRegex.test(origin) ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    // origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  };
  app.enableCors(corsOptions);

  // 设置全局前缀（排除监控端点）
  app.setGlobalPrefix('', {
    exclude: ['/metrics', '/health', '/health/ready'],
  });

  // 启用 API 版本控制 (Header 模式，保持路由结构不变)
  // 规则：
  // 1. 只允许 Header 版本控制，禁止 URI 版本
  // 2. 禁止 fallback 到默认版本
  // 3. 版本中立的路由（VERSION_NEUTRAL）接受任何版本或无版本
  // 4. 非版本中立的路由必须提供正确的版本 header
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'x-api-version',
    // 注意：不设置 defaultVersion，强制要求版本化的路由必须提供版本 header
    // VERSION_NEUTRAL 的路由会接受任何请求
  });

  // 配置Socket.IO适配器
  const ioAdapter = new IoAdapter(app);
  app.useWebSocketAdapter(ioAdapter);

  // 启动swagger
  await setupSwagger(app);
  // 使用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剥离非白名单属性
      forbidNonWhitelisted: true, // 非白名单属性时报错
      transform: true, // 自动将输入数据转换为 DTO 类型
      transformOptions: {
        enableImplicitConversion: true, // 隐式转换（如 string -> number）
      },
    }),
  );

  // 版本控制: Guard 校验前端版本，Interceptor 添加响应头
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new VersionGuard(reflector));
  app.useGlobalInterceptors(new VersionHeaderInterceptor(), new TransformInterceptor());

  const appLogger = app.get(WINSTON_MODULE_PROVIDER) as Logger;

  // 添加优雅关闭的处理
  const server = await app.listen(config.app.port ?? 13100, '0.0.0.0').then((server) => {
    appLogger.info(`Server running at http://127.0.0.1:${config.app.port}`);
    appLogger.info(`Swagger: http://127.0.0.1:${config.app.port}/docs`);
    appLogger.info(`RapiDoc: http://127.0.0.1:${config.app.port}/api/apis`);
    return server;
  });

  // 处理进程退出信号
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      appLogger.info(`Received ${signal}. Gracefully shutting down...`);
      try {
        await app.close();
        appLogger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        appLogger.error('Error during shutdown', error);
        process.exit(1);
      }
    });
  });

  return server;
}

async function setupSwagger(app: INestApplication) {
  if (environmentUtil.isProduction() && process.env.SWAGGER_ENABLE !== 'true') {
    return;
  }
  const config = getConfig()!;
  const options = new DocumentBuilder()
    .setTitle('DofeAI API')
    .setDescription('DofeAI API 接口文档')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: 'Please enter JWT token in the format *** Bearer {token} ***',
      },
      'jwtAuth',
    )
    .addServer(`http://127.0.0.1:${config.app.port}`)
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);
}

bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});
