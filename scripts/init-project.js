#!/usr/bin/env node

/**
 * Interactive Project Initialization Script
 * Customizes the scaffold with project-specific settings
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) =>
    console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// Project configuration
// 注意：API 端口在 apps/api/config.local.yaml 的 app.port 配置；Web 端口由 Next.js 自动配置，此处不配置
const config = {
  projectName: '',
  projectDescription: '',
  authorName: '',
  authorEmail: '',
  databaseUrl: '',
  readDatabaseUrl: '',
  redisUrl: '',
  rabbitmqUrl: '',
  baseHost: '127.0.0.1',
};

async function main() {
  console.clear();
  log.header('╔════════════════════════════════════════════════════════════╗');
  log.header('║         DofeAI Monorepo Project Initialization            ║');
  log.header('╚════════════════════════════════════════════════════════════╝');

  log.info('This wizard will help you customize your project.\n');

  try {
    // Collect project information
    config.projectName = await question(
      `${colors.cyan}Project name${colors.reset} (e.g., my-awesome-app): `,
    );
    config.projectName = config.projectName.trim() || 'my-project';

    config.projectDescription = await question(
      `${colors.cyan}Project description${colors.reset}: `,
    );
    config.projectDescription =
      config.projectDescription.trim() || 'A DofeAI monorepo project';

    config.authorName = await question(
      `${colors.cyan}Author name${colors.reset}: `,
    );
    config.authorName = config.authorName.trim() || 'Your Name';

    config.authorEmail = await question(
      `${colors.cyan}Author email${colors.reset}: `,
    );
    config.authorEmail = config.authorEmail.trim() || 'your.email@example.com';

    log.header('\n📦 Configuration');

    config.databaseUrl = await question(
      `${colors.cyan}Database URL${colors.reset} [postgresql://user:password@localhost:5432/dbname]: `,
    );
    config.databaseUrl =
      config.databaseUrl.trim() ||
      'postgresql://user:password@localhost:5432/dbname';

    config.readDatabaseUrl = await question(
      `${colors.cyan}Read Database URL${colors.reset} [same as Database URL]: `,
    );
    config.readDatabaseUrl =
      config.readDatabaseUrl.trim() || config.databaseUrl;

    config.redisUrl = await question(
      `${colors.cyan}Redis URL${colors.reset} [redis://localhost:6379]: `,
    );
    config.redisUrl = config.redisUrl.trim() || 'redis://localhost:6379';

    config.rabbitmqUrl = await question(
      `${colors.cyan}RabbitMQ URL${colors.reset} [amqp://localhost:5672]: `,
    );
    config.rabbitmqUrl = config.rabbitmqUrl.trim() || 'amqp://localhost:5672';

    config.baseHost = await question(
      `${colors.cyan}Base Host${colors.reset} [127.0.0.1]: `,
    );
    config.baseHost = config.baseHost.trim() || '127.0.0.1';

    rl.close();

    // Display configuration summary
    log.header('\n📋 Configuration Summary');
    console.log(
      `  Project Name:    ${colors.green}${config.projectName}${colors.reset}`,
    );
    console.log(`  Description:     ${config.projectDescription}`);
    console.log(
      `  Author:          ${config.authorName} <${config.authorEmail}>`,
    );
    console.log(`  Base Host:       ${config.baseHost}`);
    console.log(`  Database:        ${config.databaseUrl}`);
    console.log(`  Read DB:         ${config.readDatabaseUrl}`);
    console.log(`  Redis:           ${config.redisUrl}`);
    console.log(`  RabbitMQ:        ${config.rabbitmqUrl}`);

    // Apply configuration
    log.header('\n🔧 Applying Configuration');
    await applyConfiguration();

    // Success message
    log.header('\n✨ Project Initialized Successfully!');
    log.info('Next steps:');
    console.log(
      `  1. ${colors.cyan}pnpm install${colors.reset}          - Install dependencies`,
    );
    console.log(
      `  2. ${colors.cyan}pnpm db:generate${colors.reset}      - Generate Prisma client`,
    );
    console.log(
      `  3. ${colors.cyan}pnpm db:migrate:dev${colors.reset}   - Run database migrations`,
    );
    console.log(
      `  4. ${colors.cyan}pnpm dev${colors.reset}              - Start development servers`,
    );
    console.log('');
  } catch (error) {
    log.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

async function applyConfiguration() {
  const rootDir = process.cwd();

  // Update root package.json
  log.info('Updating root package.json...');
  updatePackageJson(path.join(rootDir, 'package.json'), {
    name: config.projectName,
    description: config.projectDescription,
    author: `${config.authorName} <${config.authorEmail}>`,
  });
  log.success('Root package.json updated');

  // Update apps/web/package.json
  log.info('Updating web package.json...');
  updatePackageJson(path.join(rootDir, 'apps/web/package.json'), {
    name: `@repo/web`,
  });
  log.success('Web package.json updated');

  // Update apps/api/package.json
  log.info('Updating API package.json...');
  updatePackageJson(path.join(rootDir, 'apps/api/package.json'), {
    name: `@repo/api`,
  });
  log.success('API package.json updated');

  // Create .env files from .env.example
  log.info('Creating environment files from .env.example...');
  createEnvFromExample(rootDir, config);
  log.success('Environment files created');

  // Update README
  log.info('Updating README...');
  updateReadme(path.join(rootDir, 'README.md'));
  log.success('README updated');
}

function updatePackageJson(filePath, updates) {
  if (!fs.existsSync(filePath)) {
    log.warning(`File not found: ${filePath}`);
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  Object.assign(packageJson, updates);
  fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
}

/**
 * 解析 .env.example 文件，提取 KEY=VALUE 行（含注释、空行）
 */
function parseEnvExample(content) {
  const lines = [];
  const vars = new Map();
  for (const line of content.split(/\n/)) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) {
      lines.push({ type: 'raw', value: trimmed });
    } else {
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        lines.push({ type: 'var', key, raw: trimmed });
        vars.set(key, value);
      } else {
        lines.push({ type: 'raw', value: trimmed });
      }
    }
  }
  return { lines, vars };
}

/**
 * 根据 apps/api/.env.example 和 apps/web/.env.example 生成 .env 文件
 */
function createEnvFromExample(rootDir, config) {
  const apiExamplePath = path.join(rootDir, 'apps/api/.env.example');
  const webExamplePath = path.join(rootDir, 'apps/web/.env.example');

  // 变量替换映射（apps/api），参考 apps/api/.env.example
  const apiReplacements = {
    BASE_HOST: config.baseHost,
    DATABASE_URL: config.databaseUrl,
    READ_DATABASE_URL: config.readDatabaseUrl,
    REDIS_URL: config.redisUrl,
    RABBITMQ_URL: config.rabbitmqUrl,
  };

  if (fs.existsSync(apiExamplePath)) {
    const content = fs.readFileSync(apiExamplePath, 'utf8');
    const { lines, vars } = parseEnvExample(content);
    const outLines = [];
    for (const item of lines) {
      if (item.type === 'raw') {
        outLines.push(item.value);
      } else {
        let val = apiReplacements[item.key];
        if (val === undefined && item.key === 'RABBITMQ_EVENTS_URL') {
          const orig = vars.get(item.key) || '';
          val = orig.replace(/\$\{BASE_HOST\}/g, config.baseHost);
        } else if (val === undefined) {
          val = null;
        }
        const final =
          val !== null && val !== undefined ? `${item.key}=${val}` : item.raw;
        outLines.push(final);
      }
    }
    fs.writeFileSync(path.join(rootDir, 'apps/api/.env'), outLines.join('\n') + '\n');
  } else {
    createEnvFile(path.join(rootDir, 'apps/api/.env'), {
      NODE_ENV: 'development',
      DATABASE_URL: config.databaseUrl,
      REDIS_URL: config.redisUrl,
      RABBITMQ_URL: config.rabbitmqUrl,
    });
  }

  // 生成 keys/config.json（核心密钥：JWT/Crypto/Encryption/Admin）
  const keysDir = path.join(rootDir, 'apps/api/keys');
  const keysPath = path.join(keysDir, 'config.json');
  const existingKeys = fs.existsSync(keysPath)
    ? JSON.parse(fs.readFileSync(keysPath, 'utf8'))
    : {};

  // 仅在字段不存在时填充新生成的值
  if (!existingKeys.jwt) {
    existingKeys.jwt = { secret: generateRandomSecret(), expireIn: 3600 };
  }
  if (!existingKeys.crypto) {
    existingKeys.crypto = {
      key: generateRandomSecret().slice(0, 32),
      iv: generateRandomSecret().slice(0, 16),
    };
  }
  if (!existingKeys.encryption) {
    existingKeys.encryption = { key: generateRandomSecret().slice(0, 32) };
  }
  if (!existingKeys.admin) {
    existingKeys.admin = { registerSecret: generateRandomSecret() };
  }

  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  fs.writeFileSync(keysPath, JSON.stringify(existingKeys, null, 2) + '\n');
  log.success('keys/config.json generated with core secrets');

  const webReplacements = {};

  if (fs.existsSync(webExamplePath)) {
    const content = fs.readFileSync(webExamplePath, 'utf8');
    const { lines } = parseEnvExample(content);
    const outLines = [];
    for (const item of lines) {
      if (item.type === 'raw') {
        outLines.push(item.value);
      } else {
        const val = webReplacements[item.key] ?? null;
        const final = val !== null ? `${item.key}=${val}` : item.raw;
        outLines.push(final);
      }
    }
    fs.writeFileSync(
      path.join(rootDir, 'apps/web/.env.local'),
      outLines.join('\n') + '\n',
    );
  } else {
    createEnvFile(path.join(rootDir, 'apps/web/.env.local'), {});
  }
}

function createEnvFile(filePath, variables) {
  const content =
    Object.entries(variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n';
  fs.writeFileSync(filePath, content);
}

function updateReadme(filePath) {
  if (!fs.existsSync(filePath)) {
    log.warning(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(
    /# DofeAI Monorepo Scaffold[^\n]*/,
    `# ${config.projectName}`,
  );
  content = content.replace(
    /A comprehensive production-ready monorepo scaffold with complete implementations\./,
    config.projectDescription,
  );
  fs.writeFileSync(filePath, content);
}

function generateRandomSecret() {
  return require('crypto').randomBytes(32).toString('hex');
}

// Run the script
main().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
