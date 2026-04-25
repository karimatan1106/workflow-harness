# Documentation Update Analysis: harness-report-fb-fixes

phase: docs_update
date: 2026-03-30
task: harness-report-fb-fixes
input: docs/workflows/harness-report-fb-fixes/acceptance-report.md

## Executive Summary

4件のハーネスレポート修正（FB-1+5, FB-2, FB-4, FB-6）はいずれも内部ロジック修正であり、ユーザー向けドキュメント変更を要しません。

## Scope of Modifications

### FB-1+5: readonlyフェーズのWrite/Edit除外
- 変更箇所: workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts
- 内容: phaseGuideのbashCategoriesが'readonly'のみの場合、coordinatorのallowedToolsからWrite/Editを除外
- ユーザー影響: なし（内部Coordinator制御ロジック）
- API仕様変更: なし
- UI表示変更: なし

### FB-2: テストケース構造行パターン追加
- 変更箇所: workflow-harness/mcp-server/src/gates/dod-helpers.ts
- 内容: isStructuralLine()に正規表現パターン /^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[:：]/ を追加
- ユーザー影響: なし（DoD内部検証ロジック改善）
- API仕様変更: なし
- UI表示変更: なし（テスト項目ID行の重複誤検出が減少）

### FB-4: applyAddRTM()のupsert化
- 変更箇所: workflow-harness/mcp-server/src/state/manager-write.ts
- 内容: RTMエントリ追加時、既存IDは上書き、新規IDはpush
- ユーザー影響: なし（RTM管理内部ロジック最適化）
- API仕様変更: なし。harness_add_rtm MCPツールの入出力は変わらず
- UI表示変更: なし（RTM重複エントリ排除で内部一貫性向上）

### FB-6: goBack時のartifactHashesクリア
- 変更箇所: workflow-harness/mcp-server/src/state/manager-lifecycle.ts
- 内容: goBack()でstate.artifactHashes = {}を追加
- ユーザー影響: なし（内部状態管理改善）
- API仕様変更: なし。harness_back MCPツールの入出力は変わらず
- UI表示変更: なし（成果物ハッシュ不整合排除で検証精度向上）

## decisions

- DOC-001: FB-1+5, FB-2, FB-4, FB-6は全て内部実装修正。ユーザー向けAPI仕様ドキュメント変更不要。
- DOC-002: workflow-phases.md, workflow-execution.md, workflow-api-standards.md への変更不要。修正対象のいずれもAPI/実行フロー/フェーズ定義に影響しない。
- DOC-003: MCP tool specifications (mcp-contract.md等) への変更不要。harness_add_rtm, harness_backの入出力インターフェースは不変。内部状態管理は外部インターフェースに影響しない。
- DOC-004: phase-dod.md (DoD定義) への変更不要。DoD検証ルール自体は不変、内部のisStructuralLine()実装が改善されるのみ。テスト項目ID行の認識精度向上により、DoD検証がより正確に動作。
- DOC-005: README.md等の概要文書への変更不要。4件の修正は内部品質向上であり、ユーザーが認識すべき新機能/破壊的変更ではない。
- DOC-006: ADR-013作成が必要。4件の修正の設計判断を記録するため、ADR-013-harness-report-fb-fixes.mdを作成し、修正理由・影響分析・検証方法を文書化。
- DOC-007: FB-1+5（readonlyフェーズのWrite/Edit除外）は、planOnlyフィルタとの一貫性を保ちながら、readonly bashCategoriesフェーズでの誤操作を防止する安全性向上。設計思想の完全実装。
- DOC-008: FB-2（テストケース構造行パターン）は、DoD検証の精度を向上させ、テストケースID行（TC-NNN:等）の重複誤検出を排除する品質改善。
- DOC-009: FB-4（RTM upsert化）は、同一IDの重複エントリを防ぎ、リトライフローで常に最新値を採用する堅牢性向上。影響範囲を限定しながら重複蓄積問題を解決。
- DOC-010: FB-6（goBack時のartifactHashesクリア）は、ロールバック後の成果物ハッシュ不整合を防ぎ、artifact_driftチェックの正確性を向上させる信頼性改善。

## artifacts

- docs/workflows/harness-report-fb-fixes/docs-update.md (this file)
- docs/workflows/harness-report-fb-fixes/acceptance-report.md (input)
- docs/adr/ADR-013-harness-report-fb-fixes.md (to be created)

## next

ADR-013-harness-report-fb-fixes.mdを作成し、設計判断を文書化。completionフェーズへ進行。
