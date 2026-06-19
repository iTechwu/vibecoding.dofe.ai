import type { Config } from 'jest';

const prefix = '<rootDir>/';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { diagnostics: false }],
  },
  moduleNameMapper: {
    // src module paths
    '^src/(.*)$': `${prefix}src/$1`,
    // @/ infra aliases
    '^@/common/(.*)$': `${prefix}node_modules/@dofe/infra-common/src/$1`,
    '^@/config/(.*)$': `${prefix}node_modules/@dofe/infra-common/src/config/$1`,
    '^@/filter/(.*)$': `${prefix}node_modules/@dofe/infra-common/src/filter/$1`,
    '^@/decorators/(.*)$': `${prefix}node_modules/@dofe/infra-common/src/decorators/$1`,
    '^@/interceptor/(.*)$': `${prefix}node_modules/@dofe/infra-common/src/interceptor/$1`,
    '^@/middleware/(.*)$': `${prefix}node_modules/@dofe/infra-common/src/middleware/$1`,
    '^@/prisma/(.*)$': `${prefix}node_modules/@dofe/infra-prisma/src/prisma/$1`,
    '^@/prisma-read/(.*)$': `${prefix}node_modules/@dofe/infra-prisma/src/prisma-read/$1`,
    '^@/prisma-write/(.*)$': `${prefix}node_modules/@dofe/infra-prisma/src/prisma-write/$1`,
    '^@/utils/(.*)$': `${prefix}node_modules/@dofe/infra-utils/src/$1`,
    // @app/ domain aliases
    '^@app/db$': `${prefix}generated/db`,
    '^@app/db/(.*)$': `${prefix}generated/db/modules/$1`,
    '^@app/auth$': `${prefix}libs/domain/auth/src`,
    '^@app/auth/(.*)$': `${prefix}libs/domain/auth/src/$1`,
    '^@app/services/(.*)$': `${prefix}libs/domain/services/$1`,
    // @app/ infra aliases
    '^@app/shared-db$': `${prefix}node_modules/@dofe/infra-shared-db/src`,
    '^@app/shared-db/(.*)$': `${prefix}node_modules/@dofe/infra-shared-db/src/$1`,
    '^@app/i18n$': `${prefix}node_modules/@dofe/infra-i18n/src`,
    '^@app/i18n/(.*)$': `${prefix}node_modules/@dofe/infra-i18n/src/$1`,
    '^@app/jwt$': `${prefix}node_modules/@dofe/infra-jwt/src`,
    '^@app/jwt/(.*)$': `${prefix}node_modules/@dofe/infra-jwt/src/$1`,
    '^@app/prisma$': `${prefix}node_modules/@dofe/infra-prisma/src/prisma`,
    '^@app/prisma/(.*)$': `${prefix}node_modules/@dofe/infra-prisma/src/$1`,
    '^@app/redis$': `${prefix}node_modules/@dofe/infra-redis/src`,
    '^@app/redis/(.*)$': `${prefix}node_modules/@dofe/infra-redis/src/$1`,
    '^@app/rabbitmq$': `${prefix}node_modules/@dofe/infra-rabbitmq/src`,
    '^@app/rabbitmq/(.*)$': `${prefix}node_modules/@dofe/infra-rabbitmq/src/$1`,
    '^@app/clients/internal/(.*)$': `${prefix}node_modules/@dofe/infra-clients/src/internal/$1`,
    '^@app/clients/plugin$': `${prefix}node_modules/@dofe/infra-clients/src/plugin`,
    '^@app/clients/plugin/(.*)$': `${prefix}node_modules/@dofe/infra-clients/src/plugin/$1`,
    '^@app/shared-services/(.*)$': `${prefix}node_modules/@dofe/infra-shared-services/src/$1`,
    // @prisma/client
    '^@prisma/client$': `${prefix}generated/prisma-client`,
    '^@prisma/client/(.*)$': `${prefix}generated/prisma-client/$1`,
    // @repo/ shared packages (source-referencing, no dist)
    '^@repo/constants$': `${prefix}../../packages/constants/src`,
    '^@repo/contracts$': `${prefix}../../packages/contracts/src`,
    '^@repo/contracts/(.*)$': `${prefix}../../packages/contracts/src/$1`,
    '^@repo/utils$': `${prefix}../../packages/utils/src`,
    '^@repo/utils/validate$': `${prefix}../../packages/utils/validate.util.ts`,
    '^@repo/utils/serialize$': `${prefix}../../packages/utils/serialize.util.ts`,
    '^@repo/utils/array$': `${prefix}../../packages/utils/array.util.ts`,
    '^@repo/utils/bigint$': `${prefix}../../packages/utils/bigint.util.ts`,
    '^@repo/utils/json$': `${prefix}../../packages/utils/json.util.ts`,
    '^@repo/utils/object$': `${prefix}../../packages/utils/object.util.ts`,
    '^@repo/utils/string$': `${prefix}../../packages/utils/string.util.ts`,
    '^@repo/utils/timer$': `${prefix}../../packages/utils/timer.util.ts`,
    '^@repo/utils/urlencode$': `${prefix}../../packages/utils/urlencode.util.ts`,
    '^@repo/utils/bcrypt$': `${prefix}../../packages/utils/bcrypt.util.ts`,
    '^@repo/utils/(.*)$': `${prefix}../../packages/utils/$1`,
  },
};

export default config;
