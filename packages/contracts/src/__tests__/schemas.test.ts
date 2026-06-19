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
      // Verify some key Prisma enum schemas are exported
      expect(schemas.TeamMemberRoleSchema).toBeDefined();
      expect(schemas.TeamPermissionOpsSchema).toBeDefined();
    });

    it('should export domain schemas', () => {
      // Team schemas
      expect(schemas.TeamMemberSchema).toBeDefined();
      expect(schemas.TeamSchema).toBeDefined();

      // Space schemas
      expect(schemas.SpaceRoleSchema).toBeDefined();
      expect(schemas.FileSystemTypeSchema).toBeDefined();

      // User schemas
      expect(schemas.UserCheckResponseSchema).toBeDefined();

      // Comment schemas
      expect(schemas.CommentStatusSchema).toBeDefined();
      expect(schemas.CommentUserSchema).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    describe('Team Schemas', () => {
      it('should validate TeamMemberRole', () => {
        // Use actual Prisma enum values
        const validRoles = ['owner', 'admin', 'editMember', 'viewMember', 'guest', 'noViewMember'];
        validRoles.forEach((role) => {
          const result = schemas.TeamMemberRoleSchema.safeParse(role);
          expect(result.success).toBe(true);
        });

        const invalidResult = schemas.TeamMemberRoleSchema.safeParse('invalid');
        expect(invalidResult.success).toBe(false);
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
          teamId: null,
        });
        expect(validResult.success).toBe(true);

        const invalidResult = schemas.UserCheckResponseSchema.safeParse({
          userId: invalidUuid,
          teamId: null,
        });
        expect(invalidResult.success).toBe(false);
      });
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer types from schemas', () => {
      // This is a compile-time check - if it compiles, types are correct
      type TeamMemberRole = z.infer<typeof schemas.TeamMemberRoleSchema>;
      const role: TeamMemberRole = 'owner';
      expect(role).toBe('owner');

      type UserCheckResponse = z.infer<typeof schemas.UserCheckResponseSchema>;
      const response: UserCheckResponse = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        teamId: null,
      };
      expect(response.userId).toBeDefined();
    });
  });
});
