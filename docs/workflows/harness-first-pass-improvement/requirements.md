# Requirements: harness-first-pass-improvement

taskId: ce320677-d107-4cc9-ad90-978291c61666
phase: requirements
size: large
intent: ハーネスの1発通過率を改善する。coordinator委譲テンプレートにフェーズ別必須出力ルール(decisions 5件以上等)を追加、Worker edit部分適用問題の回避ルール追加、baseline/RTM手順漏れ防止をフェーズテンプレートに組み込む。

## acceptanceCriteria

- AC-1: coordinator.mdにフェーズ別必須出力ルール(Phase Output Rules)セクションが追加され、decisionsセクション5件以上等の定量ルールが明記されていること
- AC-2: worker.mdにEdit Completeness rule(部分適用禁止、all-or-nothing原則)が追加されていること
- AC-3: defs-stage4.tsのimplementation/code_reviewテンプレートにbaseline記録およびRTMステータス更新の手順指示が追加されていること
- AC-4: 全変更ファイルが200行以下であること
- AC-5: 既存テスト(843件)が変更後も全てパスすること

## decisions

- REQ-001: coordinator.mdのPhase Output Rulesは独立セクションとして末尾に追加。既存のRole/Context Handoff/Result Formatセクションは変更しない
- REQ-002: Phase Output Rulesの定量ルールはdecisions 5件以上、artifacts 1件以上、next 1件以上を必須とする。DoDゲートで検証可能な数値基準
- REQ-003: worker.mdのEdit Completeness ruleはEdit Modesセクション内に追加。部分適用(一部のEditだけ実行)を禁止し、全Edit成功またはロールバックのall-or-nothing原則を明記
- REQ-004: defs-stage4.tsのimplementationテンプレートに「実装完了後にharness_capture_baselineでベースライン記録」の手順を追加。テスト通過後の即座記録を指示
- REQ-005: defs-stage4.tsのcode_reviewテンプレートに「レビュー完了後にharness_update_rtm_statusで全F-NNNをtestedに更新」の手順を追加
- REQ-006: defs-stage4.tsは現在186行。テンプレート文字列への追加は各テンプレートに2-3行程度とし、200行以下を維持する
- REQ-007: coordinator.mdは現在38行。Phase Output Rulesセクション追加後も60行以内に収める
- REQ-008: worker.mdは現在57行。Edit Completeness rule追加後も75行以内に収める

## artifacts

| ファイル | 変更種別 | 説明 |
|---------|---------|------|
| .claude/agents/coordinator.md | 編集 | Phase Output Rulesセクション追加 |
| .claude/agents/worker.md | 編集 | Edit Completeness rule追加 |
| workflow-harness/mcp-server/src/phases/defs-stage4.ts | 編集 | implementation/code_reviewテンプレートにbaseline/RTM手順追加 |

## RTM

| ID | 説明 | AC |
|----|------|-----|
| F-001 | coordinator.mdにPhase Output Rulesセクション追加 | AC-1 |
| F-002 | worker.mdにEdit Completeness rule追加 | AC-2 |
| F-003 | defs-stage4.tsテンプレートにbaseline/RTM手順追加 | AC-3 |
| F-004 | 全ファイル200行以下 | AC-4, AC-5 |

## notInScope

- defs-stage0〜3, defs-stage5のテンプレート変更
- workflow-delegation.mdの変更
- hearing-worker.mdの変更(前タスクで対応済み)
- DoD検証ロジック(dod-*.ts)の変更
- definitions-shared.tsの変更

## openQuestions

なし

## next

- planningフェーズで3ファイルの具体的な差分を設計
- 各ファイルの行数上限を事前検証し、200行以下を確認
