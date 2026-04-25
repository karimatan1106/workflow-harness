# Research: docs/workflows refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
date: 2026-03-24

## 1. Duplicate Detection (Half-width / Full-width Katakana Pairs)

24 pairs where both half-width and full-width versions exist:

| # | Full-width | Half-width |
|---|-----------|-----------|
| 1 | artifact-validatorテーブル行除外 | artifact-validatorテ-ブル行除外 |
| 2 | Bashファイル操作のフェーズ制限 | Bashファイル操作のフェ-ズ制限 |
| 3 | docs-updateテンプレートにscope-変更内容情報を追加 | docs-updateテンプレ-トにscope-変更内容情報を追加 |
| 4 | MCPサーバーディレクトリ整理 | MCPサ-バ-ディレクトリ整理 |
| 5 | P0修正時の成果物バリデーション失敗根本原因修正 | P0修正時の成果物バリデ-ション失敗根本原因修正 |
| 6 | 成果物バリデーション失敗時のsubagent再起動ルール追加 | 成果物バリデ-ション失敗時のsubagent再起動ル-ル追加 |
| 7 | 角括弧プレースホルダーパターンをハッシュ括弧形式に修正 | 角括弧プレ-スホルダ-パタ-ンを-xxx-形式に修正 |
| 8 | 評価レポート全課題解決 | 評価レポ-ト全課題解決 |
| 9 | レビュー指摘P1-P3根本修正 | レビュ-指摘P1-P3根本修正 |
| 10 | レビュー指摘事項全件修正 | レビュ-指摘事項全件修正 |
| 11 | レビュー全問題の根本原因修正 | レビュ-全問題の根本原因修正 |
| 12 | ワークフロープラグイン1000万行対応全面改修 | ワ-クフロ-プラグイン1000万行対応全面改修 |
| 13 | ワークフロープラグインレビュー指摘事項全件修正 | ワ-クフロ-プラグインレビュ-指摘事項全件修正 |
| 14 | ワークフロープラグインレビュー指摘全件修正 | ワ-クフロ-プラグインレビュ-指摘全件修正 |
| 15 | ワークフロープラグイン構造的問題9件の根本原因修正 | ワ-クフロ-プラグイン構造的問題9件の根本原因修正 |
| 16 | ワークフロー構造的問題完全解決 | ワ-クフロ-構造的問題完全解決 |
| 17 | ワークフロー残存問題完全解決 | ワ-クフロ-残存問題完全解決 |
| 18 | ワークフロー制御強化 | ワ-クフロ-制御強化 |
| 19 | ワークフロー全問題完全解決 | ワ-クフロ-全問題完全解決 |
| 20 | ワークフロー大規模対応改善 | ワ-クフロ-大規模対応改善 |
| 21 | ワークフロー大規模対応根本改修 | ワ-クフロ-大規模対応根本改修 |
| 22 | 前回ワークフロー問題3件の根本原因修正 | 前回ワ-クフロ-問題3件の根本原因修正 |
| 23 | 前回修正ワークフロー実行中に発生した問題の根本原因調査と修正 | 前回修正ワ-クフロ-実行中に発生した問題の根本原因調査と修正 |
| 24 | PDF変換プレビュー機能 | PDF変換プレビュ-機能 |

45 half-width-only directories (no full-width counterpart). Key examples:
- ワ-クフロ-1000万行対応強化, ワ-クフロ-10M対応全問題根本原因修正
- ワ-クフロ-API実装, ワ-クフロ-フェ-ズのsubagent化, ワ-クフロ-並列タスク対応
- FR-R5サブフェ-ズテンプレ-トガイダンス不足の根本解決
- スコ-プ管理の3つの根本原因修正, 新ワ-クフロ-完全実装
- (full list: 45 dirs with half-width katakana like -, -, -, - etc.)

Action: Delete half-width copy when full-width exists (24). Rename half-width-only to full-width (45).

## 2. Old/Unrelated Task Directories

### PDF/OCR (22 dirs)
Claude-Vision-OCR統合, OCR-NumPyインポ-ト修正, OCRテキストボックス位置修正, OCRテキスト位置修正と完全テキスト認識, OCR位置精度改善, OCR結果テキストオブジェクト配置, OCR自動処理の実装, PDF-OCR機能追加, PDF-PPTX変換-Phase2-オブジェクト検出, PDF-PPTX変換-Phase4-レイアウト解析, PDF-PPTX変換サ-ビス, PDF-PPTX変換実装調査, PDFテキストオブジェクト編集機能, PDFブロック単位テキスト抽出, PDF高精度PPTX変換, PDF変換プレビュー機能, PDF変換プレビュ-機能, PDF編集可能PPTX変換, Vision-OCR-MCPサ-バ-作成, テキスト領域座標検出と描画, オブジェクト検出-細分化改善, プレビュ-機能改善-オブジェクト認識-編集機能-

### Remotion/Pachinko (3 dirs)
Remotionパチンコ動画作成, 海物語演出完全再現, 海物語風パチンコ演出

### Other unrelated (5 dirs)
ACE-OpenSage統合実装-Reflector-Curator強化-, curator-tsにextractAndStoreBullets統合, Next-js大容量ファイルプロキシ修正, Serena CLI完全統合, serena-lsp-scope-integration

### Frontend/Dashboard (3 dirs)
フロントエンド-バックエンドAPI統合修正, ワ-クフロ-可視化フロントエンド, ワ-クフロ-ダッシュボ-ドのフェ-ズ情報表示機能

Total: 33 dirs to delete.

## 3. Category Classification

After cleanup, remaining ~194 directories classified into 4 categories:

### bugfix/ (~77 dirs)
Bug fixes, issue resolutions, root cause analysis. Naming patterns: BUG*, P0*, FR-*, fix-*, parallel-verification*, regression-test*, subagent*, 修正*, 根本原因*, セキュリティスキャン*, 角括弧プレースホルダー*, Critical-Issues*, VDB-1, Windows混在パス*, harness-root-cause-fixes, harness-stale-task-cleanup-and-hmac-recovery, MCP問題根本原因修正, 危険コマンドブロックフック修正, etc.

### feature/ (~50 dirs)
New features and enhancements. Naming patterns: 10M-pagination-lsp-first, concurrent-n58-*, context-engineering-improvements, dci-design-code-index, delegate-work高速化, dod-error-structuring, failure-test-loop-and-metrics, garbage-collection, gitignore整備, HMAC互換性テスト, integ-test-n58, lefthook-precommit, NEW-SEC-*, orchestrator-direct-edit-block-hook, parallel_verification_security_scan, phase-skill-file-routing, progress-json-and-claudemd-compression, rtm-intent-gate, skill-files-compression, template-*, tier-*-gaps-*, TOON-*, userIntent不明点深掘りシステム, 既存バグ記録機能の実装, 設計-実装整合性の自動検証機能, etc.

### workflow-harness/ (~60 dirs)
Harness overhaul, structural changes, large-scale workflow modifications. Naming patterns: 3層E2E*, adr-and-archgate, claude-hooks-4layer, docs-*, harness-10m-resilience, harness-system-documentation, inv-n-*, workflow-harness-refactoring*, ワークフロー*, ワ-クフロ-*, レビュー*, 評価レポート*, 新ワークフロー*, etc.

### investigation/ (~7 existing dirs + 14 loose .md files)
Analysis, one-off investigations. Dirs: 日本語タスク, テスト, フックテスト, etc.

## 4. Loose .md Files at docs/workflows/ Root

14 files to move into investigation/:
1. 2layer-consistency-check.md
2. agent-copy-gap-analysis.md
3. edit-auth-analysis.md
4. hearing-approve-enum-bug-investigation.md
5. hearing-phase-design.md
6. l4-dod-mmd-duplicate-check.md
7. mmd-toon-parse-bug-investigation.md
8. serena-investigation.md
9. stale-toon-sweep.md
10. task-size-investigation.md
11. toon-format-compatibility-analysis.md
12. toon-reference-audit.md
13. toon-reference-audit-full.md
14. toon-to-md-migration-impact.md

## 5. Harness Path Dependencies

Searched workflow-harness/ source for docs/workflows references. Results:

No hardcoded references to specific task directory names. All use dynamic patterns:
- manager-read.ts: DOCS_DIR = process.env.DOCS_DIR || 'docs/workflows' (base only)
- lifecycle-next.ts, lifecycle-start-status.ts, scope-nav.ts, query.ts: docs/workflows/{taskName} dynamic
- tool-gate.js: includes('docs/workflows/') pattern match for write protection
- context-watchdog.js: pattern match for context leakage
- .gitignore: **/docs/workflows/ -- entire directory is gitignored (temporary)

Conclusion: Reorganizing subdirectories will NOT break harness code. Safe to proceed.

## decisions

- D-001: 半角カタカナ重複24ペア確認、半角版を削除対象とする
- D-002: 旧プロジェクト関連33件を完全削除対象と確定
- D-003: 半角のみディレクトリ45件も削除対象（全角版が存在しない重複不明分含む）
- D-004: ハーネスコードはdocs/workflows/パスを動的生成しており、リファクタリングによるコード変更不要
- D-005: カテゴリ構造をbugfix/feature/workflow-harness/investigationの4分類で確定

## artifacts

- C:/ツール/Workflow/docs/workflows/docs-workflows-refactoring/research.md

## next

Proceed to scope_definition phase. Implementation parallelizable into 5 worker tasks:
1. Delete half-width duplicates (24 dirs)
2. Rename half-width-only dirs to full-width (45 dirs)
3. Delete unrelated project dirs (33 dirs)
4. Create category dirs and relocate remaining dirs
5. Move 14 loose .md files into investigation/
