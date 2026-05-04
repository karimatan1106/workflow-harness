# ADR-032: Backend 規約レイヤを Rust 単一言語に統一

## Status
Status: Accepted

## Context

ハーネスは ADR-006 で「Rust 言語前提を hook/registry/skill の 3 点に閉じ込める」方針を確立した。PR #1(commit 969ce18)で実行レイヤ(`hooks/phase-config.js` の PHASE_EXT/BASH_COMMANDS、`mcp-server/src/phases/registry.ts` の allowedExtensions、`defs-stage4.ts` の build_check ランタイム検知)を Rust 対応にしたが、規約レイヤ(skill md 4 本)は依然として TypeScript/Hono/Zod/Prisma 前提のまま残存していた。

二重前提は LLM coordinator/worker subagent への教示文として混乱を招く。同じハーネスが「Rust ファイルを書ける環境」を提供しながら「TS Backend を書け」と教える矛盾状態。

本 ADR は ADR-006 の延長線として、規約レイヤから TS Backend を除去し Rust 一本化する判断を記録する。Frontend(TypeScript/Next.js)は据え置き。

## Decision

Backend 規約を以下のスタックで統一する:

- HTTP framework: **axum**(tokio runtime 固定、async-std 等は規約外)
- Schema/OpenAPI: **utoipa** + **validator** + **serde**(Zod 相当の derive 宣言性)
- DB query: **sqlx**(compile-time SQL 検証)
- DB migration: **refinery + .rs migrations**(完全 Rust 化、type-safe)
- Workspace structure: **Cargo workspace 多 crate**(`crates/domain` `crates/application` `crates/infrastructure` `crates/presentation` の 4 メンバ物理分離、Cargo `[dependencies]` で依存方向を機械的に強制)
- Dev runtime: **cargo-watch + tokio-listenfd**(階層 2: ファイル変更 → 自動再ビルド + ソケット継承)
- Test: **cargo test** 標準、parametrized が必要な場合に **rstest** opt-in

修正対象 skill ファイル(4 本):
- `.claude/skills/workflow-harness/workflow-project-structure.md`(Backend section)
- `.claude/skills/workflow-harness/workflow-api-standards.md`(全面書換)
- `.claude/skills/workflow-harness/workflow-operations.md`(Backend section + Dev Runtime セクション追加)
- `.claude/skills/workflow-harness/SKILL.md`(File Index 説明行)

## Consequences

### Positive

- ハーネスが生成する Backend 雛形は Rust の type safety + memory safety を享受
- Cargo workspace で Clean Architecture 依存方向を機械的に強制(LLM 判断不要、L1-L4 決定的ゲート思想と一致)
- 規約レイヤと実行レイヤが Rust で揃い、二重前提解消
- 言語追加時の改修手順が ADR-006 と本 ADR で確定済(3 点に閉じ込め + skill 一本化)

### Negative / Trade-offs

- **Breaking change**: 既存 TS Backend 雛形を持つ下流リポジトリへの後方互換は持たない。harness 更新後は skill ガイダンスと現状コードが乖離する
- Dev iteration 速度は Node より遅い(2-15 秒 vs <1 秒、Rust コンパイル時間)、cargo-watch + tokio-listenfd で緩和するが Node の HMR には届かない
- 学習コスト: borrow checker / lifetime / async ecosystem 等、Node より高い

### Migration Path

下流リポジトリが本変更に追従する場合の手順:

1. CHANGELOG / release note で破壊的変更を確認
2. Backend を新 Rust 規約で書き直し or 旧 skill バージョンに pin
3. CI を `cargo build` + `cargo test` に切替

## Out of Scope

本 ADR が扱わない項目(別 ADR / 別タスクで対応):

- Rust workspace の多 crate 構成(workspace members)を超えた**多 workspace 構成**
- `rust-toolchain.toml` 自動生成
- `cargo bench` / `cargo doc` / `cargo publish` の skill 統合
- Frontend の WASM 化(Yew/Leptos/Dioxus)— Frontend は TS/Next.js 据え置き
- 言語追加(Go / Java / Python 等)— 新言語は ADR-006 の延長線として個別 ADR で扱う

## References

- ADR-004: ドキュメント 3 層分離(Why / What / How)
- ADR-005: Why/What/How 定義基準 — LLM 目線
- ADR-006: 言語前提を hook/registry/skill の 3 点に閉じ込める(本 ADR の上位 Why)
- harness-rust-support タスク(PR #1, commit 969ce18): 実行レイヤの Rust 対応
- harness-rust-backend-default タスク(本 ADR): 規約レイヤの Rust 一本化
