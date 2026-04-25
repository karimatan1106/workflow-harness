# Scope Definition: prompt-format-hybrid-rule

## entry_points

- .claude/skills/workflow-harness/workflow-delegation.md (125 lines) - 4層テンプレート定義ファイル。ここにPrompt Format Rulesセクションを追加する。

## affected_files

| file | change | reason |
|------|--------|--------|
| .claude/skills/workflow-harness/workflow-delegation.md | edit | Prompt Format Rulesセクション追加（推定15-20行） |

## 影響範囲分析

- 変更ファイル: 1つのみ
- 依存ファイル: なし（delegation.mdは他ファイルから参照されるが、セクション追加は既存参照に影響しない）
- 200行制限: 現在125行 + 追加15-20行 = 140-145行（余裕あり）

## decisions

- スコープ限定: workflow-delegation.md 1ファイルのみ -- 形式ルールは委譲テンプレートの一部であり同ファイルに自然に収まる
- セクション配置: Common Constraintsの後に追加 -- テンプレート定義→パラメータ表→共通制約→形式ルールの論理的順序
- 行数見積: 15-20行追加で140-145行 -- 200行制限の72%で十分な余裕
- 他ファイル変更不要: tool-delegation.mdは既にdelegation.md参照あり -- 形式ルールは自動的にカバーされる
- smallタスク相当: 1ファイル15-20行追加 -- ただしlargeサイズで起動済みのため全フェーズ実行

## artifacts

| # | file | status |
|---|------|--------|
| 1 | docs/workflows/prompt-format-hybrid-rule/scope-definition.md | new |

## next

- research phase
