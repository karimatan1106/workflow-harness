---
name: harness-api-standards
description: OpenAPI-based API design standards with Zod, Hono, versioning, and response formats.
tags: [api-design, openapi, zod, hono, enterprise]
---

# API Design Standards (OpenAPI-Based)

Enterprise APIs must follow OpenAPI specs for quality assurance.

## Technology Stack

| Item | Library |
|------|---------|
| Schema Definition | Zod |
| OpenAPI Generation | @hono/zod-openapi |
| Documentation UI | Swagger UI / Scalar |
| Client Generation | openapi-typescript |

## Directory Structure

```
src/backend/presentation/
├── routes/{feature}/{feature}.route.ts    # Route definition
├── routes/{feature}/{feature}.schema.ts   # Zod schemas + OpenAPI
└── openapi/
    ├── index.ts                           # OpenAPI app setup
    └── schemas/
        ├── error.schema.ts
        ├── pagination.schema.ts
        └── common.schema.ts
```

## Implementation Patterns

### Schema Definition (Zod + OpenAPI)

```typescript
import { z } from '@hono/zod-openapi';

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100).openapi({ example: '山田太郎' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
}).openapi('CreateUserRequest');
```

### Route Definition (OpenAPI-Integrated)

```typescript
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono();

const createUserRoute = createRoute({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  request: { body: { content: { 'application/json': { schema: CreateUserSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: UserSchema } } },
    400: { description: 'Validation Error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

app.openapi(createUserRoute, async (c) => {
  const body = c.req.valid('json');
  return c.json(user, 201);
});
```

### OpenAPI Doc Generation

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';

const app = new OpenAPIHono();
app.route('/api/v1', usersRoute);
app.doc('/api/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3000', description: 'Dev' }],
});
app.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }));
```

## API Versioning

**Rules:**
- Path prefix: `/api/v1/users` (current), `/api/v2/users` (breaking changes)
- Minor versions maintain backward compatibility
- Major versions only for breaking changes
- Support old versions minimum 6 months

## Response Formats

### Success
```json
{ "data": {...}, "meta": {"requestId": "req_abc", "timestamp": "2026-01-31T12:00:00Z"} }
```

### Pagination
```json
{ "data": [...], "pagination": {"page": 1, "perPage": 20, "total": 100, "totalPages": 5} }
```

### Error
```json
{ "error": {"code": "VALIDATION_ERROR", "message": "...", "details": [...]}, "meta": {...} }
```

## Error Code Table

| Code | HTTP Status | Description |
|------|------------|-------------|
| VALIDATION_ERROR | 400 | Validation failure |
| UNAUTHORIZED | 401 | Auth error |
| FORBIDDEN | 403 | Permission error |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate/conflict |
| RATE_LIMITED | 429 | Rate limit exceeded |
| INTERNAL_ERROR | 500 | Server error |

## Frontend Type Generation

```bash
# Generate types from OpenAPI spec
pnpm dlx openapi-typescript http://localhost:3000/api/openapi.json -o src/frontend/lib/api/types.ts

# Use in client
import createClient from 'openapi-fetch';
export const api = createClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL });
```

## CI/CD Integration

```yaml
- name: Validate OpenAPI spec
  run: pnpm dlx @redocly/cli lint src/backend/docs/openapi.json

- name: Check breaking changes
  run: pnpm dlx oasdiff breaking base.json new.json
```

## Workflow Phase Mapping

| Phase | OpenAPI Task |
|-------|--------------|
| planning | API design, endpoint definition |
| implementation | Schema definition, route implementation |
| testing | OpenAPI spec validation |
| docs_update | Generate/update openapi.json |
