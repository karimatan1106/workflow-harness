# Docs Update: harness-first-pass-improvement

taskId: ce320677-d107-4cc9-ad90-978291c61666
phase: docs_update

## Documentation Impact Assessment

### 変更ファイルと影響範囲
| File | Change | Documentation Impact |
|------|--------|---------------------|
| .claude/agents/coordinator.md | Phase Output Rulesセクション追加 | ファイル自体がドキュメント。追加セクションは自己記述的 |
| .claude/agents/worker.md | Edit Completenessセクション追加 | ファイル自体がドキュメント。追加セクションは自己記述的 |
| defs-stage4.ts | テンプレート内テキスト変更なし | テンプレート内の手順テキストは自己記述的 |

### 外部ドキュメントへの影響
- README.md: 影響なし。エンドユーザー向け機能変更ではないため
- CLAUDE.md: 影響なし。ワークフロー起動ルールに変更なし
- docs/adr/: 影響なし。新しいアーキテクチャ決定を導入していないため
- .claude/rules/: 影響なし。既存ルールの変更なし
- workflow-harness/CLAUDE.md: 影響なし。ハーネスの動作仕様変更なし

### ADR必要性判断
本タスクはcoordinator/workerのエージェント定義にルールテキストを追加するのみ。設計思想の変更ではなく、既存の「L1-L4決定的ゲート」方針に沿ったテキスト補強であるため、新規ADRは不要。

## Updated Files Summary

### coordinator.md (自己記述的ドキュメント)
追加内容: Phase Output Rulesセクション
- decisions定量ルール (5件以上)
- artifacts列挙義務
- ファイル命名規則 (ハイフン区切り)
- フェーズ固有の必須セクション (acDesignMapping, acAchievementStatus)
- nextセクション空欄禁止

### worker.md (自己記述的ドキュメント)
追加内容: Edit Completenessセクション
- 全件適用義務 (部分適用禁止)
- 8箇所以上でWrite推奨
- 件数一致確認報告

### defs-stage4.ts (テンプレート内手順テキスト)
変更内容: implementationとcode_reviewテンプレートにbaseline/RTM手順追加
- 変更はpremature commit (25db124)で既に適用済み

## decisions

- DU-001: 外部ドキュメント(README, CLAUDE.md, ADR)への更新は不要と判定。変更がエージェント定義ファイル内のテキスト追加に限定されるため
- DU-002: 新規ADRは不要と判定。設計思想の変更ではなく、既存方針(L1-L4ゲート)に沿ったルール補強であるため
- DU-003: coordinator.md/worker.mdは自己記述的ドキュメントであり、追加セクション自体がドキュメントとして機能する
- DU-004: .claude/rules/配下のルールファイルは変更不要。Phase Output Rulesはcoordinator定義に直接配置する設計判断(REQ-001)に基づく
- DU-005: workflow-harness/CLAUDE.mdのHow参照先(スキルファイル)に変更なし。新しいスキルファイルの追加もなし

## artifacts

- docs/workflows/harness-first-pass-improvement/docs-update.md: spec: ドキュメント影響評価完了、外部更新不要

## next

- commitフェーズで変更をコミットおよびプッシュ
