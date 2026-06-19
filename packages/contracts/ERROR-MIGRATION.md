# Error System Migration Guide

## Overview

This guide helps migrate from the old error handling system to the new typed error system in `@repo/contracts`.

## Key Changes

### Before (Old System)
```typescript
// Backend: apps/api/libs/common/enums/code.enum.ts
import { ApiErrorCode, ErrorMessageEnums } from '@/enums/code.enum';
import { ApiException } from '@/filter/exception/api.exception';

// Throwing errors
throw new ApiException(ErrorMessageEnums.TeamNotFound);
```

### After (New System)
```typescript
// Backend: Import from @repo/contracts
import { TeamErrorCode, apiError } from '@repo/contracts/errors';
import { ApiExceptionV2 } from '@/filter/exception/api-exception-v2';

// Method 1: Using apiError helper
throw apiError(TeamErrorCode.TeamNotFound);

// Method 2: Using ApiExceptionV2 directly
throw ApiExceptionV2.fromCode(TeamErrorCode.TeamNotFound, { teamId: '123' });
```

## Migration Steps

### Step 1: Update Imports

Replace old imports with new ones:

```typescript
// Old
import { ApiErrorCode, ErrorMessageEnums } from '@/enums/code.enum';

// New
import { TeamErrorCode, UserErrorCode, SpaceErrorCode } from '@repo/contracts/errors';
// Or import specific domain
import { TeamErrorCode } from '@repo/contracts/errors/domains/team.errors';
```

### Step 2: Update Exception Throwing

Replace `ApiException` with `ApiExceptionV2`:

```typescript
// Old
throw new ApiException(ErrorMessageEnums.TeamNotFound);
throw new ApiException(ErrorMessageEnums.TeamNotFound, { teamId });

// New
import { apiError } from '@repo/contracts/errors';
throw apiError(TeamErrorCode.TeamNotFound);
throw apiError(TeamErrorCode.TeamNotFound, { teamId });
```

### Step 3: Update i18n Messages

Move error messages from `test.message.*` to `errors.{domain}.*`:

```json
// Old: apps/api/libs/i18n/en/test.json
{
  "message": {
    "TeamNotFound": "Team not found"
  }
}

// New: apps/api/libs/i18n/en/errors.json
{
  "team": {
    "teamNotFound": "Team not found"
  }
}
```

### Step 4: Update API Contracts (Optional)

Add typed error responses to contracts:

```typescript
import { TeamErrorCode } from '../errors/domains/team.errors';
import { createTypedErrorResponse } from '../errors/error-response';

export const teamContract = c.router({
  getInfo: {
    method: 'GET',
    path: '/:teamId',
    responses: {
      200: ApiResponseSchema(TeamInfoSchema),
      400: createTypedErrorResponse([
        TeamErrorCode.TeamNotFound,
        TeamErrorCode.TeamMemberViewNoPermission,
      ] as const),
    },
  },
});
```

## Error Code Organization

Error codes are now organized by domain:

| Domain | Prefix | File |
|--------|--------|------|
| Team | 1xx | `team.errors.ts` |
| User | 2xx | `user.errors.ts` |
| Space | 3xx | `space.errors.ts` |
| Folder | 4xx | `folder.errors.ts` |
| File | 5xx | `file.errors.ts` |
| Comment | 56x-57x | `comment.errors.ts` |
| Payment | 7xx | `payment.errors.ts` |
| Common | 9xx | `common.errors.ts` |

## Backward Compatibility

The old system is still supported for gradual migration:

- `ErrorMessageEnums` is auto-generated from `@repo/contracts`
- `ApiException` continues to work alongside `ApiExceptionV2`
- Both i18n namespaces are checked (new first, then old)

## Frontend Usage

```typescript
import {
  TeamErrorCode,
  handleApiError,
  createErrorHandler
} from '@repo/contracts/errors';

// Handle errors with typed handlers
const errorHandler = createErrorHandler({
  [TeamErrorCode.TeamNotFound]: {
    message: 'Team not found',
    action: () => router.push('/teams'),
  },
  [TeamErrorCode.TeamOpNoPermission]: {
    message: 'No permission',
  },
});

// In API call
try {
  await api.team.getInfo({ teamId });
} catch (error) {
  const result = handleApiError(error.code);
  toast.error(result.message);
  result.action?.();
}
```

## Best Practices

1. **Use domain-specific error codes** - Import from the specific domain file
2. **Include error data** - Pass relevant data to `apiError()` for debugging
3. **Add typed responses** - Document expected errors in API contracts
4. **Use new i18n namespace** - Use `errors.{domain}.{key}` for new messages
5. **Gradual migration** - Migrate one module at a time

## Troubleshooting

### Error: "Unknown error code"
- Ensure the error code is exported from `@repo/contracts/errors`
- Check that `@repo/contracts` is built: `pnpm --filter @repo/contracts build`

### Error: "i18n key not found"
- Check that the error message exists in `errors.json`
- Ensure the domain and key match: `errors.team.teamNotFound`

### TypeScript errors
- Run `pnpm build` to regenerate types
- Check that imports use correct paths
