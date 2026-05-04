---
name: workflow-operations
description: Test output placement, MCP server cache management, and package installation rules.
---
> `.claude/rules/core-constraints.md`(コア制約)、`workflow-rules.md` Sec6(Bashカテゴリ) が権威仕様。本ファイルは具体的な配置ルールと手順のみ。

## 1. Test Output Placement

Backend は Rust crate として運用する。crate ごとに `crates/<name>/` 配下へ配置する。

| File Type | Backend (Rust crate) | Frontend |
|-----------|----------------------|----------|
| Test input/output | `src/backend/crates/<name>/tests/fixtures/{input,output}/` | `src/frontend/test/fixtures/` |
| Screenshots | `src/backend/crates/<name>/tests/screenshots/` | `src/frontend/test/screenshots/` |
| Unit tests | `src/backend/crates/<name>/src/<module>.rs` 内 `#[cfg(test)] mod tests` | `src/frontend/**/*.test.tsx` |
| Integration tests | `src/backend/crates/<name>/tests/integration/*.rs` | `src/frontend/test/integration/` |
| Regression tests | `src/backend/crates/<name>/tests/regression/*.rs` | `src/frontend/test/regression/` |
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
| Backend | `src/backend/` | `cd src/backend && cargo add <crate>` (workspace root or 該当 crate root) |
| E2E | `e2e/` | `cd e2e && npm install playwright` |
| Rust | crate root (`Cargo.toml` 直下) | `cargo add <crate>` |

**禁止**: root `npm install/init`, root `yarn add`, root `cargo add`. root に `package.json` / `node_modules` / 直下 `Cargo.toml`(workspace 用以外)作成禁止。

## 4. Dev Runtime (Rust Backend)

開発時のホットリロード戦略は **階層 2(ファイル変更 → 自動再ビルド + tokio-listenfd ソケット継承)** を default とする。

### Recommended setup

```bash
# install
cargo install cargo-watch
cargo install systemfd

# Cargo.toml に依存追加
cargo add tokio-listenfd

# 起動
systemfd --no-pid -s http::3000 -- cargo watch -x 'run -p presentation'
```

### Trade-off (vs Node.js HMR)

- **iteration time**: 2〜15 秒(Rust コンパイル含む)、Node の <1 秒には届かない
- **state preservation**: in-memory state(セッション / cache / pool)はプロセス再起動で失う、tokio-listenfd でソケットのみ継承
- **HMR の真の hot swap**: Rust backend には存在しない(Dioxus/Leptos UI のみ)
- **対価**: コンパイル時の type/borrow/lifetime 検証で runtime バグ密度が大幅に下がる、production 性能・メモリ効率が桁違い

### When dev iteration が必要なケース

- 大型 workspace で iteration が辛い場合: `cargo check`(LLVM 走らせない型チェックのみ)を主用、tests は変更ある crate のみ実行(`cargo test -p <crate>`)
- workspace で crate を細分化(domain/application/infrastructure/presentation 物理分離が既に効く)
- linker を `mold` or `lld` に切り替えて link 時間短縮

### When 階層 1 で十分な場合

- 小型 prototype: `cargo watch -x run` のみ(systemfd 不要、ポート再 bind 許容)
- bench / experiment: 状態継続不要なため 階層 1 で十分
