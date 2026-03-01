---
name: harness-project-structure
description: Enterprise project structure for frontend (Feature-First + CDD) and backend (Clean Architecture + DDD).
---

# Enterprise Project Structure

## Project Root

```
project/
├── src/
│   ├── frontend/         # React/Next.js + Storybook
│   └── backend/          # TypeScript/Hono + Clean Architecture
├── docs/                 # Documentation
├── packages/             # Shared packages (types)
├── e2e/                  # E2E tests
├── docker-compose.yml
└── README.md
```

## Frontend (Feature-First + CDD)

```
src/frontend/
├── .storybook/           # Storybook config
├── app/                  # Next.js App Router
│   ├── (routes)/         # Route groups (auth, public)
│   └── providers.tsx
├── features/             # ★ Main: Feature modules
│   └── {feature}/        # co-location: components + hooks + api + stores + types
├── components/ui/        # Design system components (with .stories + .test)
├── hooks/                # Global hooks
├── lib/                  # Utilities, api-client
├── styles/               # Global CSS
├── types/                # Global type definitions
├── test/                 # Test fixtures
└── package.json
```

**Co-location**: Component + Story + Test + CSS in same directory.

## Backend (Clean Architecture + DDD)

```
src/backend/
├── domain/               # ★ Business logic core
│   ├── entities/         # Domain entities
│   ├── value-objects/
│   ├── aggregates/
│   ├── events/
│   ├── repositories/     # Ports (interfaces)
│   └── services/
├── application/          # Use cases
│   ├── use-cases/
│   ├── commands/         # CQRS write
│   ├── queries/          # CQRS read
│   └── dtos/
├── infrastructure/       # Technical adapters
│   ├── database/         # Prisma + repository impls
│   ├── external/         # Third-party integrations
│   ├── messaging/
│   ├── cache/
│   └── config/
├── presentation/         # API layer (Hono routes)
│   ├── routes/
│   ├── middleware/
│   └── schemas/          # Zod schemas
├── batch/                # Batch jobs
├── shared/               # Constants, utils, exceptions
└── tests/                # Integration tests
```

## Dependency Flow (Backend)

```
Presentation → Application → Domain ← Infrastructure
```

- Domain is pure (no external dependencies)
- Infrastructure implements Domain ports (dependency inversion)

## Docs-to-Source Mapping

| Docs | Frontend | Backend |
|------|----------|---------|
| `docs/spec/features/{name}.md` | `src/frontend/features/{name}/` | `src/backend/application/use-cases/{name}/` |
| `docs/spec/components/{name}.md` | `src/frontend/components/ui/{name}/` | — |
| `docs/spec/screens/{name}.md` | `src/frontend/app/(routes)/{name}/` | — |
| `docs/spec/api/{name}.md` | `src/frontend/features/{name}/api/` | `src/backend/presentation/routes/{name}/` |
| `docs/spec/events/{name}.md` | — | `src/backend/domain/events/` |
| `docs/spec/database/{name}.md` | — | `src/backend/infrastructure/database/` |
| `docs/architecture/integrations/{name}.md` | — | `src/backend/infrastructure/external/` |
| `docs/architecture/batch/{name}.md` | — | `src/backend/batch/` |

## Phase-Specific Considerations

| Phase | Frontend | Backend |
|-------|----------|---------|
| requirements | Feature module identification | Domain boundaries, glossary |
| planning | features/ structure decision | Layer architecture, aggregates |
| ui_design | components/ + Storybook def | — |
| state_machine | State management design | Entity state transitions |
| test_impl | Stories + tests (CDD Red) | Use-case tests |
| implementation | Components (CDD Green) | Domain/app layer |

## Applicability

**Use this structure for:**
- Multi-team development
- Long-term maintenance
- Complex business logic

**Simplify for:**
- Prototypes/PoC
- Simple CRUD apps
- Small tools
