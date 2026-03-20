---
name: workflow-operations
description: Test output placement, MCP server cache management, and package installation rules.
---
> CLAUDE.md Sec12(Bash/コアモジュール再起動) が権威仕様。本ファイルは具体的な配置ルールと手順のみ。

## 1. Test Output Placement

| File Type | Backend | Frontend |
|-----------|---------|----------|
| Test input/output | `src/backend/tests/fixtures/{input,output}/` | `src/frontend/test/fixtures/` |
| Screenshots | `src/backend/tests/screenshots/` | `src/frontend/test/screenshots/` |
| Unit tests | `src/backend/tests/unit/` | `src/frontend/**/*.test.tsx` |
| Integration tests | `src/backend/tests/integration/` | `src/frontend/test/integration/` |
| Regression tests | `src/backend/tests/regression/` | `src/frontend/test/regression/` |
| E2E / Temp | `e2e/` / `.tmp/` | `e2e/` / `.tmp/` |

**禁止**: root `tests/`, `test_*.ts`, `*.pptx/pdf/png` outputs, `screenshot*.png`, `*_output.*`

## 2. MCP Server Cache Management

Node.jsはモジュールをメモリキャッシュ。コード変更後は再起動必須。

**再起動手順**: `cd workflow-plugin/mcp-server && npm run build` → dist/*.jsタイムスタンプ確認 → MCP再起動 → `harness_status`で確認

**再起動必須ファイル**: artifact-validator.ts, definitions.ts, state-manager.ts
再起動なしでは旧バイナリが動き続けバリデーション失敗が永続する。

## 3. Package Installation

| Type | Location | Command |
|------|----------|---------|
| Frontend | `src/frontend/` | `cd src/frontend && npm install xxx` |
| Backend | `src/backend/` | `cd src/backend && pnpm add xxx` |
| E2E | `e2e/` | `cd e2e && npm install playwright` |

**禁止**: root `npm install/init`, `pnpm add`, `yarn add`. root に `package.json` / `node_modules` 作成禁止。
