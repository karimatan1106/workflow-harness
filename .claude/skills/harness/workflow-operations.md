---
name: workflow-operations
description: Test output placement, MCP server cache management, and package installation rules.
---

# Workflow Operations Skill

## Test Output and Temporary File Placement Rules

Test files must be placed in structured directories, never in the project root.

### Placement Rules

| File Type | Backend | Frontend |
|-----------|---------|----------|
| Test input files | `src/backend/tests/fixtures/input/` | `src/frontend/test/fixtures/` |
| Test output | `src/backend/tests/fixtures/output/` | `src/frontend/test/output/` |
| Screenshots | `src/backend/tests/screenshots/` | `src/frontend/test/screenshots/` |
| Unit tests | `src/backend/tests/unit/` | `src/frontend/**/*.test.tsx` |
| Integration tests | `src/backend/tests/integration/` | `src/frontend/test/integration/` |
| Regression tests | `src/backend/tests/regression/` | `src/frontend/test/regression/` |
| E2E tests | `e2e/` | `e2e/` |
| Temp files | `.tmp/` | `.tmp/` |

### Prohibited Root Placements

- `tests/` directory (root-level)
- `test_*.ts`, `test_*.js` scripts
- `*.pptx`, `*.pdf`, `*.png` outputs
- `screenshot*.png` files
- `*_output.*`, `*_result.*` files

### Correct Command Examples

```bash
# Good: appropriate directories
node src/backend/tests/integration/test_conversion.ts
vitest src/backend/tests/
cd src/backend && vitest tests/
```

### Cleanup

Delete after testing:
- `.tmp/` directory contents
- `tests/fixtures/output/` unnecessary outputs

---

## MCP Server Module Caching

Node.js caches modules in memory; restart is required for code changes to take effect.

### Operation Rules

1. Modifying `dist/*.js` has NO effect on running MCP server
2. MCP server restart is mandatory for code changes
3. First: fix artifact content to meet validation requirements
4. Only fix validator code if bug is clearly confirmed, then restart
5. Error handling order:
   - Step 1: Fix artifact content to pass validation
   - Step 2: Only fix validator if bug is confirmed
   - Step 3: Always restart MCP server after code fix
   - Note: Skipping restart causes validation to continue failing

### Mandatory Restart Conditions

**Core files requiring restart:**
- `artifact-validator.ts` — validation logic (changes affect cache immediately)
- `definitions.ts` — phase definitions, model config, prompt templates
- `state-manager.ts` — task state management (HMAC integrity involved)

**Restart Steps (4-step procedure):**
1. `cd workflow-plugin/mcp-server && npm run build` to transpile
2. Verify dist/*.js timestamp updated
3. Restart MCP server (Claude Desktop button or process kill)
4. Run `workflow_status` to confirm phase, resume from same phase

**Without restart:**
- Old binary stays in memory via Node.js module cache
- Validation failures continue indefinitely
- parallel_verification phase fails for all subphases

---

## Package Installation Rules

Dependencies must install in subdirectories, never in project root.

### Installation Locations

| Type | Location | Command |
|------|----------|---------|
| Frontend | `src/frontend/` | `cd src/frontend && npm install xxx` |
| Backend | `src/backend/` | `cd src/backend && pnpm add xxx` |
| E2E | `e2e/` | `cd e2e && npm install playwright` |

### Prohibited Root Commands

- `npm install <package>`
- `npm init`
- `pnpm add <package>` (outside venv)
- `yarn add <package>`

### Correct Installation Examples

```bash
# Good: subdirectory installation
cd src/frontend && npm install axios
cd src/backend && pnpm add -r package.json
cd e2e && npm install playwright
```

### File Placement

| File | Location |
|------|----------|
| `package.json` | `src/frontend/`, `e2e/` |
| `pnpm-lock.yaml` | `src/backend/` |
| `tsconfig.json` | `src/backend/` |

Never create `package.json` or `node_modules` in project root.
