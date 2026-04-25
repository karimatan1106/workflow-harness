# Scope Definition: harness-first-pass-improvement

## User Intent
ハーネスの1発通過率を改善する。coordinator委譲テンプレートにフェーズ別必須出力ルール(decisions 5件以上等)を追加、Worker edit部分適用問題の回避ルール追加、baseline/RTM手順漏れ防止をフェーズテンプレートに組み込む。

## Scope Files
| File | Change | Est. Lines |
|------|--------|-----------|
| .claude/agents/coordinator.md | Phase Output Rulesセクション追加 | +12行 |
| .claude/agents/worker.md | Edit Completeness rule追加 | +3行 |
| workflow-harness/mcp-server/src/phases/defs-stage4.ts | baseline+RTM instructions追加 | +6行 |

## Out of Scope
- defs-stage0.ts〜defs-stage3.ts: リトライ未発生フェーズのテンプレート
- defs-stage5.ts: 既存baseline noteで十分
- workflow-delegation.md: coordinator.mdとの重複回避
- hearing-worker.md: 前タスクで対応済み

## Acceptance Criteria
| ID | Description |
|----|------------|
| AC-1 | coordinator.mdにフェーズ別必須出力ルール(Phase Output Rules)セクションが追加され、decisionsセクション5件以上等の定量ルールが明記されていること |
| AC-2 | worker.mdにEdit Completeness rule(部分適用禁止、all-or-nothing原則)が追加されていること |
| AC-3 | defs-stage4.tsのcode_reviewテンプレートにbaseline記録およびRTMステータス更新の手順指示が追加されていること |
| AC-4 | 全変更ファイルが200行以下であること |

## RTM
| ID | Requirement | Code Ref |
|----|------------|----------|
| F-001 | coordinator.mdにPhase Output Rulesセクション追加 | .claude/agents/coordinator.md |
| F-002 | worker.mdにEdit Completeness rule追加 | .claude/agents/worker.md |
| F-003 | defs-stage4.ts code_reviewテンプレートにbaseline/RTM手順追加 | workflow-harness/mcp-server/src/phases/defs-stage4.ts |

## Hearing Decisions
- coordinator.mdにインラインでフェーズ別出力ルール追加
- worker.mdにedit all-or-nothingルール追加
- defs-stage4.tsにbaseline/RTM手順追加
- 変更は3ファイル限定

## Size
small (3 files, ~21 lines added)

## decisions

- SD-001: スコープは3ファイル限定。coordinator.md, worker.md, defs-stage4.tsのみ変更対象とする。
- SD-002: defs-stage5.tsは既存baseline noteが存在するため変更不要と判断。
- SD-003: defs-stage0〜3.tsはリトライ未発生のため変更対象外とする。
- SD-004: workflow-delegation.mdはcoordinator.mdとの重複を避けるため変更対象外とする。
- SD-005: 変更総量は約21行追加。全ファイル200行制限に十分な余裕がある。

## artifacts

- docs/workflows/harness-first-pass-improvement/scope-definition.md: spec: 3ファイル変更スコープ定義。AC-1〜AC-4、F-001〜F-003登録済み。

## next

- criticalDecisions: SD-001(3ファイル限定スコープ)
- readFiles: .claude/agents/coordinator.md, .claude/agents/worker.md, workflow-harness/mcp-server/src/phases/defs-stage4.ts
- warnings: submoduleファイル(defs-stage4.ts)は別コミットが必要
