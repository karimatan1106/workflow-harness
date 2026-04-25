# UI Design — fix-hook-layer-detection

## Applicability

本タスクは `workflow-harness/hooks/tool-gate.js::detectLayer()` の layer 判定ロジック修正であり、ユーザーに露出する UI 要素は存在しない。hook は PreToolUse で起動される node プロセスであり、出力は stdout JSON (`{decision, reason}`) のみで Claude Code 本体が消費する。UI design の対象となる画面・コンポーネント・インタラクションは none。

## Surface Inventory

- ユーザー直接操作対象: なし
- 開発者向け CLI: なし (hook は自動起動)
- ログ出力: `.agent/hook-errors.log` (stderr のみ、構造化ログ)
- 設定ファイル: 環境変数 `HARNESS_LAYER` のみ (debug override 用途、運用では設定しない)

## Accessibility

対象 UI なしのため WCAG 準拠評価は不要。ログファイルは開発者向けで scope 外。

## Visual Hierarchy

対象なし。hook は silent execution が正常状態で、block 時のみ stderr に JSON で理由を返す。

## Responsive Behavior

対象なし。hook はターミナル/IDE の幅に依存しない単発 subprocess として動作する。

## Interaction Flow

hook の起動〜停止までユーザー介入なし。Claude Code 本体が PreToolUse 契約に従い stdin を渡し stdout/exit code で block 判定を受ける。

## decisions

- D-001: UI design の対象成果物を作成しない。理由: 本修正はバックエンド hook のみの変更で、画面や対話フローが存在しないため
- D-002: 開発者向け debug 情報 (`.agent/hook-errors.log`) は従来通り保持する。理由: 修正範囲と独立しており、変更する合理性がないため
- D-003: `HARNESS_LAYER` env 変数はドキュメントで運用制約 (debug のみ、通常未設定) を明示する。理由: 誤用による意図しない layer 強制を防ぐため
- D-004: hook の block 理由 (`reason` フィールド) の文言は本修正では変えない。理由: 既存の i18n/エラーログ解析に影響するため、別タスクで統一的に扱うべき性質のもの
- D-005: UI 関連の regression test は対象外とする。理由: そもそも UI 成果物を変更していないため回帰確認のスコープに含めない

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/ui-design.md (本ファイル — UI 非該当の根拠記録)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md (AC と RTM の参照、UI AC が存在しないことを確認)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/scope-definition.md (scope in/out に UI が含まれないことを記録)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (改修対象、UI コードではなく hook subprocess)
- C:/ツール/Workflow/.agent/hook-errors.log (既存ログ、変更対象外)

## next

- design phase: 関数レベルの入出力契約を文書化 (UI ではなく API 契約に相当)
- test_design phase: ユニットテストの列挙 (UI テストなし)
- test_impl phase: vitest でユニットテスト実装
- implementation phase: ホットパッチ確認
- documentation phase: ADR-030 に UI 非該当の根拠を 1 行で要約
