#!/usr/bin/env node
/**
 * Prisma CRUD Module Generator
 *
 * 在 prisma generate / build 后自动为 schema 中的 model 生成：
 * - get(where) -> findFirst
 * - getById(id) -> findUnique
 * - getByXxx(xxx) -> 对每个 @unique 单字段生成 findUnique
 * - getOrThrow(where) -> findUnique or throw NotFoundException
 * - list, count, create, update, delete
 * - softDelete(where) -> 仅对有 isDeleted 的 model 生成
 * - createMany(data[]) / updateMany(where, data) -> 批量操作
 * - upsert(args) -> 条件创建或更新
 *
 * 自动触发时机（勿删）：
 *   - pnpm db:generate → prisma generate && node scripts/generate-db-crud.js
 *   - pnpm build      → prisma format && prisma generate && node scripts/generate-db-crud.js && nest build
 *
 * EXCLUDE_MODELS：不生成、保留手写逻辑的 model。需要手写/特殊逻辑的 model 在此加入，
 *   对应目录（如 user-info、country-code）不会被本脚本覆盖。
 *
 * 使用：node scripts/generate-db-crud.js [--force]
 *       --force: 覆盖已存在的生成文件（默认跳过）
 * 输出：generated/db/modules/<kebab-model>/*.ts（仅覆盖由本脚本生成的模块）
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.resolve(__dirname, '../prisma/schema.prisma');
const MODULES_DIR = path.resolve(__dirname, '../generated/db/modules');
const DB_INDEX_PATH = path.resolve(__dirname, '../generated/db/index.ts');

// 不生成、保留手写逻辑的 model（可在此增加）
const EXCLUDE_MODELS = new Set([
  'Message',
  'MessageRecipient',
  'UserInfo',
  'CountryCode',
]);

function pascalToKebab(str) {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

function pascalToCamel(str) {
  return str[0].toLowerCase() + str.slice(1);
}

/**
 * 解析 Prisma schema，提取 model 列表及其 id、unique、isDeleted
 * 需要两次遍历：第一次收集所有 model 名称，第二次解析字段和关系
 */
function parseSchema(content) {
  const models = [];
  const lines = content.split('\n');
  const modelNames = new Set();

  // 第一次遍历：收集所有 model 名称
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const modelStart = t.match(/^model\s+(\w+)\s*\{/);
    if (modelStart) {
      modelNames.add(modelStart[1]);
    }
  }

  // 第二次遍历：解析 model 详情
  let current = null;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    const modelStart = t.match(/^model\s+(\w+)\s*\{/);
    if (modelStart) {
      current = {
        name: modelStart[1],
        idField: null,
        uniqueFields: [],
        compositeUniques: [],
        hasIsDeleted: false,
        hasCreatedAt: false,
        hasRelations: false,
      };
      braceDepth = 1;
      continue;
    }

    if (!current) continue;

    if (t.includes('{')) braceDepth += (t.match(/\{/g) || []).length;
    if (t.includes('}')) {
      braceDepth -= (t.match(/\}/g) || []).length;
      if (braceDepth === 0) {
        // 无 @id 时，若存在单字段 @unique，则用其作为 getById 的键
        if (!current.idField && current.uniqueFields.length >= 1) {
          current.idField = current.uniqueFields[0];
        }
        models.push(current);
        current = null;
      }
      continue;
    }

    if (braceDepth !== 1) continue;

    // @@unique([a, b])
    const composite = t.match(/^@@unique\s*\(\s*\[\s*([^\]]+)\s*\]/);
    if (composite) {
      const fields = composite[1].split(',').map((s) => s.trim());
      if (fields.length > 0) current.compositeUniques.push(fields);
      continue;
    }

    if (t.startsWith('@@')) continue;

    // 字段: name Type @id? @unique? @relation?
    const fieldMatch = t.match(/^(\w+)\s+([^\s]+)/);
    if (!fieldMatch) continue;

    const fieldName = fieldMatch[1];
    let fieldType = fieldMatch[2];

    if (t.includes('@id')) current.idField = fieldName;
    if (t.includes('@unique') && !t.includes('@id')) {
      if (!current.uniqueFields.includes(fieldName))
        current.uniqueFields.push(fieldName);
    }
    if (fieldName === 'isDeleted') current.hasIsDeleted = true;
    if (fieldName === 'createdAt') current.hasCreatedAt = true;

    // 检测关系字段：
    // 1. 包含 @relation 注解
    // 2. 字段类型是另一个 model 的名称（包括数组形式 Xxx[] 和可选形式 Xxx?）
    if (t.includes('@relation')) {
      current.hasRelations = true;
    } else {
      // 提取类型名（去除 [] 和 ? 后缀）
      const baseType = fieldType.replace(/[\[\]?]/g, '');
      if (modelNames.has(baseType)) {
        current.hasRelations = true;
      }
    }
  }

  return models;
}

/**
 * 生成 Service 文件内容
 */
function generateService(model) {
  const { name, idField, uniqueFields, hasIsDeleted, hasCreatedAt, hasRelations } = model;
  const clientName = pascalToCamel(name);

  const whereInput = `Prisma.${name}WhereInput`;
  const whereUniqueInput = `Prisma.${name}WhereUniqueInput`;
  const orderByType = `Prisma.${name}OrderByWithRelationInput`;
  const selectType = `Prisma.${name}Select`;
  const createInput = `Prisma.${name}CreateInput`;
  const createManyInput = `Prisma.${name}CreateManyInput`;
  const updateInput = `Prisma.${name}UpdateInput`;
  const upsertArgs = `Prisma.${name}UpsertArgs`;
  const additionalType = hasRelations
    ? `{ select?: ${selectType}; include?: Prisma.${name}Include }`
    : `{ select?: ${selectType} }`;

  const softWhere = hasIsDeleted ? '{ ...where, isDeleted: false }' : 'where';

  let getByMethods = '';
  for (const f of uniqueFields) {
    if (f === idField) continue;
    const fn = 'getBy' + f.charAt(0).toUpperCase() + f.slice(1);
    getByMethods += `
  @HandlePrismaError(DbOperationType.QUERY)
  async ${fn}(value: string, additional?: ${additionalType}): Promise<${name} | null> {
    return this.getReadClient().${clientName}.findUnique({
      where: { ${f}: value${hasIsDeleted ? ', isDeleted: false' : ''} },
      ...additional,
    });
  }
`;
  }

  return `import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, ${name} } from '@prisma/client';

@Injectable()
export class ${name}Service extends TransactionalServiceBase {

  constructor(
    prisma: PrismaService,
  ) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: ${whereInput},
    additional?: ${additionalType},
  ): Promise<${name} | null> {
    return this.getReadClient().${clientName}.findFirst({
      where: ${softWhere},
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: ${additionalType},
  ): Promise<${name} | null> {
    return this.getReadClient().${clientName}.findUnique({
      where: { ${idField}: id${hasIsDeleted ? ', isDeleted: false' : ''} },
      ...additional,
    });
  }
${getByMethods}
  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: ${whereInput},
    pagination?: {
      orderBy?: ${orderByType}|${orderByType}[];
      limit?: number;
      page?: number;
    },
    additional?: ${additionalType},
  ): Promise<{ list: ${name}[]; total: number; page: number; limit: number }> {
    const {
      orderBy = ${hasCreatedAt ? "{ createdAt: 'desc' }" : "{ id: 'desc' }"},
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().${clientName}.findMany({
        where: ${hasIsDeleted ? '{ ...where, isDeleted: false }' : 'where'},
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().${clientName}.count({
        where: ${hasIsDeleted ? '{ ...where, isDeleted: false }' : 'where'},
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: ${whereInput}): Promise<number> {
    return this.getReadClient().${clientName}.count({
      where: ${hasIsDeleted ? 'where ? { ...where, isDeleted: false } : { isDeleted: false }' : 'where ?? {}'},
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: ${createInput},
    additional?: ${additionalType},
  ): Promise<${name}> {
    return this.getWriteClient().${clientName}.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: ${whereUniqueInput},
    data: ${updateInput},
    additional?: ${additionalType},
  ): Promise<${name}> {
    return this.getWriteClient().${clientName}.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: ${whereUniqueInput}): Promise<${name}> {
    return this.getWriteClient().${clientName}.delete({ where });
  }
${hasIsDeleted ? `
  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: ${whereUniqueInput}): Promise<${name}> {
    return this.getWriteClient().${clientName}.update({
      where,
      data: { isDeleted: true },
    });
  }
` : ''}
  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(
    data: ${createManyInput}[],
  ): Promise<{ count: number }> {
    return this.getWriteClient().${clientName}.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: ${whereInput},
    data: ${updateInput},
  ): Promise<{ count: number }> {
    return this.getWriteClient().${clientName}.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(
    args: ${upsertArgs},
  ): Promise<${name}> {
    return this.getWriteClient().${clientName}.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: ${whereUniqueInput},
    additional?: ${additionalType},
  ): Promise<${name}> {
    const record = await this.getReadClient().${clientName}.findUnique({
      where: { ...where${hasIsDeleted ? ', isDeleted: false' : ''} },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('${name} not found');
    }
    return record;
  }
}
`;
}

/**
 * 生成 Module 文件内容
 */
function generateModule(model) {
  const { name } = model;
  return `import { Module } from '@nestjs/common';
import { ${name}Service } from './${pascalToKebab(name)}.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [${name}Service],
  exports: [${name}Service],
})
export class ${name}Module {}
`;
}

/**
 * 生成 index.ts
 */
function generateIndex(model) {
  const kebab = pascalToKebab(model.name);
  return `export * from './${kebab}.service';
export * from './${kebab}.module';
`;
}

function main() {
  const args = process.argv.slice(2);
  const forceRegenerate = args.includes('--force');

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.warn('generate-db-crud: schema not found at', SCHEMA_PATH);
    process.exit(0);
    return;
  }

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const models = parseSchema(schemaContent);

  // Ensure generated/db directory exists
  const dbDir = path.resolve(__dirname, '../generated/db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(MODULES_DIR)) fs.mkdirSync(MODULES_DIR, { recursive: true });

  const generatedKebabs = [];
  for (const model of models) {
    if (EXCLUDE_MODELS.has(model.name)) continue;
    if (!model.idField) {
      console.warn(
        'generate-db-crud: skip',
        model.name,
        '(no @id and no single @unique)',
      );
      continue;
    }

    const kebab = pascalToKebab(model.name);
    const dir = path.join(MODULES_DIR, kebab);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const servicePath = path.join(dir, `${kebab}.service.ts`);
    const modulePath = path.join(dir, `${kebab}.module.ts`);
    const indexPath = path.join(dir, 'index.ts');

    // 如果 service 文件已存在，跳过该模块（保留手动添加的函数）
    // 使用 --force 参数可覆盖已存在的文件
    if (fs.existsSync(servicePath) && !forceRegenerate) {
      console.log(
        'generate-db-crud: skip',
        kebab,
        '(service file already exists, preserving manual changes)',
      );
      // 仍然需要将其添加到 generatedKebabs 以确保 index.ts 中有导出
      generatedKebabs.push(kebab);
      continue;
    }

    fs.writeFileSync(servicePath, generateService(model), 'utf8');
    fs.writeFileSync(modulePath, generateModule(model), 'utf8');
    fs.writeFileSync(indexPath, generateIndex(model), 'utf8');
    generatedKebabs.push(kebab);
    console.log('generate-db-crud: wrote', kebab);
  }

  if (generatedKebabs.length) {
    console.log('generate-db-crud: done,', generatedKebabs.length, 'modules');
    ensureExportsInIndex(generatedKebabs);
  }
}

function ensureExportsInIndex(generatedKebabs) {
  const dbDir = path.dirname(DB_INDEX_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  let content = '';
  if (fs.existsSync(DB_INDEX_PATH)) {
    content = fs.readFileSync(DB_INDEX_PATH, 'utf8');
  }

  // Preserve existing module exports (including hand-written ones like `loops`),
  // merge in the newly generated kebabs, dedup (first-seen wins) and rewrite the
  // index as a clean list. This is idempotent and prevents duplicate `export *`
  // lines from repeated generator runs (a prior bug under pnpm/manual edits).
  const existing = (content.match(/from\s+['"]\.\/modules\/([^'"]+)['"]/g) || []).map(
    (m) => (m.match(/modules\/([^'"]+)/) || [])[1],
  );
  const ordered = [...existing];
  for (const k of generatedKebabs) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  const seen = new Set();
  const deduped = ordered.filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const out = deduped.map((k) => `export * from './modules/${k}';`).join('\n') + '\n';
  if (out === content) return;
  fs.writeFileSync(DB_INDEX_PATH, out, 'utf8');
  console.log('generate-db-crud: index exports:', deduped.join(', '));
}

main();
