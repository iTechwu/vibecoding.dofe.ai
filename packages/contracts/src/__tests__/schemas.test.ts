/**
 * Schema Validation Tests
 * Schema 验证测试
 */

import { z } from 'zod';

// Import all schemas to verify exports
import * as schemas from '../schemas';

describe('Schemas', () => {
  describe('Schema Exports', () => {
    it('should export Prisma enums', () => {
      expect(schemas.SexTypeSchema).toBeDefined();
      expect(schemas.FileBucketVendorSchema).toBeDefined();
      expect(schemas.FileEnvTypeSchema).toBeDefined();
    });

    it('should export domain schemas', () => {
      expect(schemas.UserCheckResponseSchema).toBeDefined();
      expect(schemas.TaskListResponseSchema).toBeDefined();
      expect(schemas.TaskListQuerySchema).toBeDefined();
      expect(schemas.LoopListResponseSchema).toBeDefined();
      expect(schemas.MessageListResponseSchema).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    describe('Prisma enum schemas', () => {
      it('should validate generated enum values', () => {
        expect(schemas.SexTypeSchema.safeParse('UNKNOWN').success).toBe(true);
        expect(schemas.FileBucketVendorSchema.safeParse('gcs').success).toBe(true);
        expect(schemas.FileEnvTypeSchema.safeParse('prod').success).toBe(true);

        expect(schemas.SexTypeSchema.safeParse('invalid').success).toBe(false);
      });
    });

    describe('UUID Validation', () => {
      it('should validate UUID format in schemas that require it', () => {
        // Test with a valid UUID
        const validUuid = '550e8400-e29b-41d4-a716-446655440000';
        const invalidUuid = 'not-a-uuid';

        // UserCheckResponseSchema requires userId as UUID
        const validResult = schemas.UserCheckResponseSchema.safeParse({
          userId: validUuid,
        });
        expect(validResult.success).toBe(true);

        const invalidResult = schemas.UserCheckResponseSchema.safeParse({
          userId: invalidUuid,
        });
        expect(invalidResult.success).toBe(false);
      });
    });

    describe('Paginated list schemas', () => {
      it('should validate the standardized task list response shape', () => {
        const result = schemas.TaskListResponseSchema.safeParse({
          list: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              status: 'completed',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer types from schemas', () => {
      // This is a compile-time check - if it compiles, types are correct
      type SexType = z.infer<typeof schemas.SexTypeSchema>;
      const sex: SexType = 'UNKNOWN';
      expect(sex).toBe('UNKNOWN');

      type UserCheckResponse = z.infer<typeof schemas.UserCheckResponseSchema>;
      const response: UserCheckResponse = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
      };
      expect(response.userId).toBeDefined();
    });
  });
});
