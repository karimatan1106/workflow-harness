# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — Backend default = Rust (Breaking Change)

### Changed (BREAKING)
- **Backend default を Rust に統一** — workflow-project-structure.md / workflow-api-standards.md / workflow-operations.md / SKILL.md を Cargo workspace + axum + utoipa + validator + serde + sqlx + refinery + tokio スタックで全面書換
- 既存 TypeScript Backend(Hono/Zod/Prisma) の skill 記述は削除
- Cargo workspace 4 メンバ(crates/domain/application/infrastructure/presentation)で Clean Architecture 依存方向を機械強制
- DB migration は refinery + .rs migrations(SQL DDL ではなく Rust コードで記述)
- Dev runtime: cargo-watch + tokio-listenfd(階層 2)を default 推奨

### Added
- docs/adr/ADR-032-rust-backend-default.md — Why 層、ADR-006 の延長線として Backend 規約レイヤを Rust に統一する判断記録
- mcp-server/src/__tests__/skill-rust-backend-structure.test.ts(5 TC、AC-1/AC-3 検証)
- mcp-server/src/__tests__/skill-rust-backend-api.test.ts(4 TC、AC-2/AC-4 検証)
- mcp-server/src/__tests__/adr-032-existence.test.ts(5 TC、AC-5/AC-6/AC-7 検証)

### Migration Path
既存 TypeScript Backend を持つ下流リポジトリへの後方互換は持たない。harness 更新後は skill ガイダンスと現状コードが乖離する。下流の選択肢:
1. Backend を新 Rust 規約で書き直し
2. 旧 skill バージョンに pin(harness を本タスク以前にチェックアウト)
3. CI を `cargo build` + `cargo test` に切替

詳細は ADR-032 参照。

---

## [Previous Releases]

### Version History
このプロジェクトは継続的にワークフロー機能を改善しており、以下のマイナー改善が過去に実装されています（詳細は Git commit log を参照してください）：
- 4フェーズ承認要件の導入（requirements, design_review, test_design, code_review）
- TDD サイクルと CDD サイクルの統合
- リグレッションテスト・脅威モデリング機能の強化
- バリデーター・プリンター機能の高度化

---

## Notes

- 全変更内容は `git log` で確認できます
- タスク毎の詳細なワークフロー履歴は `docs/workflows/` ディレクトリ配下に保存されます（.gitignore による）
- 製品仕様の永続ドキュメントは `docs/spec/`, `docs/architecture/`, `docs/security/`, `docs/testing/` 配下に管理されます
