# Scope Definition: harness-report-fb-fixes

scope: 4件のFB修正(FB-1+5, FB-2, FB-4, FB-6)
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/hearing.md

## Impact Analysis

### FB-1+5: readonlyフェーズでWrite/Edit禁止 (delegate-coordinator.ts)

- target: workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts (L120-125)
- related: workflow-harness/mcp-server/src/tools/handlers/coordinator-prompt.ts (buildAllowedTools)
- current: planOnlyモード時のみWrite/Editを除外(L121-124)。bashCategoriesがreadonlyのみのフェーズ(hearing, scope_definition, research等)では未除外。
- change: phaseGuide.bashCategoriesがreadonlyのみ含む場合、allowedToolsからWrite/Editを除外するロジックをplanOnlyチェックと統合する。
- impact: coordinator-prompt.tsのbuildAllowedTools()が返すツールリストには現状Write/Editが含まれない。除外はdelegate-coordinator.ts側で行うため、coordinator-prompt.tsの変更は不要。
- risk: 低。readonlyフェーズでのWrite/Edit除外は安全方向の変更。

### FB-2: テストケース構造行パターン追加 (dod-helpers.ts)

- target: workflow-harness/mcp-server/src/gates/dod-helpers.ts (isStructuralLine, L17-36)
- current: isStructuralLine()は見出し、区切り線、コードフェンス、テーブル、太字ラベル、短いラベル行、Mermaid構文、HTMLタグ、シェルコマンドを検出。テストケースID行(TC-001:等)は未対応。
- change: L33付近にテストケースIDパターン(/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[::]/)を追加。
- impact: checkDuplicateLines()(L100-113)がisStructuralLine()を使用して構造行をスキップする。パターン追加により、テストケースID行が構造行として認識され重複検出から除外される。
- risk: 低。新パターンは既存パターンと独立。既存の構造行判定に影響しない。

### FB-4: RTM ID重複時サイレント上書き (manager-write.ts)

- target: workflow-harness/mcp-server/src/state/manager-write.ts (applyAddRTM, L126-130)
- current: applyAddRTM()は無条件にstate.rtmEntries.push(entry)を実行。同一IDで複数回呼ばれると重複エントリが発生する。
- change: findIndexで既存IDを検索し、存在すればspliceで置換、なければpush。
- impact: applyUpdateRTMStatus()(L148-157)はfilterで同一IDの全エントリを更新するため重複があると全て更新される。修正後は最大1エントリのみとなり、filterの動作は変わらない。refreshCheckpointTraceability()のrtmEntries同期にも影響なし。
- risk: 低。既存のpush動作をupsert動作に変更。破壊的変更なし。

### FB-6: goBack時artifactHashesクリア (manager-lifecycle.ts)

- target: workflow-harness/mcp-server/src/state/manager-lifecycle.ts (goBack, L111-133)
- current: goBack()はcompletedPhasesを切り詰め、retryCountを空オブジェクトにクリアする(L126)。artifactHashesはクリアされない。
- change: L126のretryCountクリア直後にstate.artifactHashes = {}を追加。
- impact: signAndPersist()(manager-write.ts L94-98)のnormalizeForSigning()が空のartifactHashesをdeleteするため、HMAC署名への影響はない。resetTask()(L135-156)は既にsubPhaseStatusをクリアしているが、artifactHashesは未クリアのため同様の修正が必要か検討したが、resetTaskはcompletedPhasesも全クリアするため成果物再検証の問題は発生しない。goBackのみ修正で十分。
- risk: 低。空オブジェクト代入のみ。既存のnormalizeForSigningで正規化される。

## Acceptance Criteria

- AC-1: readonlyフェーズ(hearing, scope_definition, research等)でcoordinatorにWrite/Editが許可されないこと
- AC-2: isStructuralLine()がテストケースID行(TC-001:等)を構造行として認識し、checkDuplicateLines()で重複誤検出されないこと
- AC-3: applyAddRTM()が同一IDのRTMエントリ重複時に既存エントリを上書き(replace)し、重複エントリが生じないこと
- AC-4: goBack()実行時にstate.artifactHashesが空オブジェクトにクリアされること
- AC-5: 既存テストスイート(825+パス)が全てパスし、各修正に対応するユニットテストが追加されていること

## RTM (Requirements Traceability Matrix)

- F-001: readonlyフェーズでcoordinatorのallowedToolsからWrite/Editを除外する -> delegate-coordinator.ts -> AC-1
- F-002: isStructuralLine()にテストケースID行パターンを追加する -> dod-helpers.ts -> AC-2
- F-003: applyAddRTM()で既存IDをfindIndex+spliceで置換し、なければpushする -> manager-write.ts -> AC-3
- F-004: goBack()でstate.artifactHashes = {}を追加する -> manager-lifecycle.ts -> AC-4

## Test Strategy

### Unit Tests (per fix)

- FB-1+5: buildAllowedTools結果を検証。readonlyフェーズ(hearing等)でWrite/Editが除外されることを確認。planOnly=trueとreadonly bashCategoriesの両ケースをテスト。
- FB-2: isStructuralLine()にTC-001:, - TC-002:, FEAT-123:等を渡して全てtrueを返すことを確認。既存パターン(見出し、テーブル等)がtrueを返すことの回帰確認。
- FB-4: applyAddRTM()を同一IDで2回呼び、rtmEntries配列に1エントリのみ存在し、最新の値が反映されていることを確認。
- FB-6: goBack()実行後、state.artifactHashesが空オブジェクトであることを確認。retryCountも同様にクリアされていることの回帰確認。

### Regression

- 既存テストスイート全パス確認(vitest run)
- TypeScriptビルド成功確認(tsc --noEmit)

## decisions

- SD-001: FB-1+5の修正箇所はdelegate-coordinator.tsのみ。coordinator-prompt.tsのbuildAllowedTools()は変更不要(元々Write/Editを含まない)。
- SD-002: FB-2のパターンは/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[::]/ を使用。AC-N, F-NNN, TC-NNN等の一般的なID形式をカバー。
- SD-003: FB-4はfindIndex+splice方式。Mapへの構造変更は影響範囲が大きいため見送り。
- SD-004: FB-6はgoBack()のみ修正。resetTask()はcompletedPhases全クリアにより成果物ハッシュ不整合が発生しないため対象外。
- SD-005: 4件全て同一implementationフェーズで修正。各修正は独立しており並列作業可能。

## artifacts

- docs/workflows/harness-report-fb-fixes/scope-definition.md (this file)
- docs/workflows/harness-report-fb-fixes/hearing.md (input)

## next

researchフェーズで各修正箇所の既存テストファイルを特定し、テスト追加/更新の計画を具体化する。

## Out of Scope

- FB-3 (size判定): 設計判断として現状維持(hearing.mdで除外確定)
- coordinator-prompt.tsのbuildAllowedTools()変更: Write/Editは元々coordinatorBaseに含まれないため不要
- resetTask()のartifactHashesクリア: completedPhases全クリアにより不要
