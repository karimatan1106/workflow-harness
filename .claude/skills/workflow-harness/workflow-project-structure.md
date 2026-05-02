---
name: harness-project-structure
description: Enterprise project structure for frontend (Feature-First + CDD) and backend (Clean Architecture + DDD).
---

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

## Backend (Rust + Cargo workspace + Clean Architecture + DDD)

```
src/backend/
├── Cargo.toml              # workspace root: [workspace] members = ["crates/*"]
├── Cargo.lock              # commit (binary workspace)
├── crates/
│   ├── domain/             # ★ Business logic core (no external deps)
│   │   ├── Cargo.toml      # [dependencies] のみ最小限(serde 等)
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── entities/   # entity structs + impl
│   │       ├── value_objects/
│   │       ├── aggregates/
│   │       ├── events/     # domain events
│   │       ├── repositories/  # repository traits (Ports)
│   │       └── services/   # domain services
│   ├── application/        # Use cases
│   │   ├── Cargo.toml      # [dependencies] domain のみ
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── use_cases/
│   │       ├── commands/   # CQRS write
│   │       ├── queries/    # CQRS read
│   │       └── dtos/
│   ├── infrastructure/     # Technical adapters
│   │   ├── Cargo.toml      # [dependencies] domain + sqlx + refinery 等
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── database/   # sqlx + repository impls
│   │       ├── migrations/ # refinery .rs migrations(V001__init.rs 形式)
│   │       ├── external/
│   │       ├── messaging/
│   │       ├── cache/
│   │       └── config/
│   └── presentation/       # API layer (axum routes)
│       ├── Cargo.toml      # [dependencies] application + axum + utoipa + tokio
│       └── src/
│           ├── lib.rs
│           ├── main.rs     # binary entry
│           ├── routes/
│           ├── middleware/
│           └── schemas/    # utoipa derive structs
└── tests/                  # workspace integration tests (各 crate にも tests/ あり)
```

**Dependency Flow**: `presentation → application → domain ← infrastructure`. Cargo `[dependencies]` で機械的に強制(domain crate は他 crate 依存ゼロ)。

**Why Cargo workspace**: module visibility のみでは依存方向逆流を CI で検知できない。物理 crate 分離で依存方向を Cargo レベルで強制し、L1-L4 決定的ゲート(LLM 判断不要)思想と一致。

## Rust Crate (Library/Binary)

```
crate-root/
├── Cargo.toml          # crate metadata + dependencies
├── Cargo.lock          # dependency lock (commit for binary, gitignore for library)
├── src/
│   ├── lib.rs          # library root (when crate is a lib)
│   ├── main.rs         # binary entry (when crate is a bin)
│   └── <module>.rs     # modules with #[cfg(test)] mod tests
├── tests/
│   ├── integration_test.rs  # integration tests (each file = test binary)
│   └── fixtures/       # test fixtures
├── benches/            # cargo bench (optional)
└── examples/           # cargo run --example (optional)
```

- Unit tests live alongside source as `#[cfg(test)] mod tests { ... }`
- Integration tests live in `tests/` directory (each file becomes a separate test binary)
- Fixtures live in `tests/fixtures/`

## Docs-to-Source Mapping

| Docs | Frontend | Backend |
|------|----------|---------|
| `docs/spec/features/{name}.md` | `features/{name}/` | `crates/application/src/use_cases/{name}/` |
| `docs/spec/components/{name}.md` | `components/ui/{name}/` | — |
| `docs/spec/screens/{name}.md` | `app/(routes)/{name}/` | — |
| `docs/spec/api/{name}.md` | `features/{name}/api/` | `crates/presentation/src/routes/{name}/` |
| `docs/spec/events/{name}.md` | — | `crates/domain/src/events/` |
| `docs/spec/database/{name}.md` | — | `crates/infrastructure/src/database/` |
| `docs/architecture/integrations/{name}.md` | — | `crates/infrastructure/src/external/` |
| `docs/architecture/batch/{name}.md` | — | `crates/infrastructure/src/batch/` |

## Phase-Specific Considerations

| Phase | Frontend | Backend |
|-------|----------|---------|
| requirements | Feature module identification | Domain boundaries, glossary |
| planning | features/ structure decision | Layer architecture, aggregates |
| ui_design | components/ + Storybook def | — |
| state_machine | State management design | Entity state transitions |
| test_impl | Stories + tests (CDD Red) | Use-case tests |
| implementation | Components (CDD Green) | Domain/app layer |

Simplify for prototypes/PoC, simple CRUD, small tools.
