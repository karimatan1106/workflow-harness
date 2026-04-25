# Requirements: harness-report-fb-fixes

phase: requirements
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/impact-analysis.md
keywords: ハーネスレポート, FB-1+5, FB-2, FB-4, FB-6, 4件を修正する, readonlyフェーズWrite/Edit制限, テストケース構造行除外, RTM重複IDチェック
scope: ハーネスレポートFB-1+5, FB-2, FB-4, FB-6の4件を修正する。delegate-coordinator.tsのreadonlyフェーズWrite/Edit制限、dod-helpers.tsのテストケース構造行除外、manager-write.tsのRTM重複IDチェック、manager-lifecycle.tsのgoBack時artifactHashクリア。

## acceptanceCriteria

- AC-1: readonlyフェーズ(bashCategories=['readonly']のみ)でcoordinatorのdisallowedToolsにWrite,Editが追加される
- AC-2: isStructuralLine()がテストケースID行(TC-001:, - TC-AC1-01:等)をtrueと判定する
- AC-3: applyAddRTM()に既存IDと同一のエントリを渡すと上書き(upsert)される。新規IDはpushされる
- AC-4: goBack()実行後にstate.artifactHashesが空オブジェクトになる
- AC-5: 既存テストスイート全パス(リグレッションなし)

## RTM (Requirements Traceability Matrix)

| ID | Requirement | Design Ref | Code Ref | Test Ref | AC |
|---|---|---|---|---|---|
| F-001 | readonlyフェーズでcoordinatorのallowedToolsからWrite/Editを除外する | delegate-coordinator.ts L121-125 | delegate-coordinator.ts | ユニットテスト: readonlyフェーズでWrite/Edit除外確認 | AC-1 |
| F-002 | isStructuralLine()にテストケースID行パターンを追加する | dod-helpers.ts isStructuralLine L17-36 | dod-helpers.ts | ユニットテスト: TC-001:等がtrue判定確認 | AC-2 |
| F-003 | applyAddRTM()で既存IDをfindIndex+spliceで置換し、なければpushする | manager-write.ts applyAddRTM L126-130 | manager-write.ts | ユニットテスト: 同一ID上書き+新規ID追加確認 | AC-3 |
| F-004 | goBack()でstate.artifactHashes = {}を追加する | manager-lifecycle.ts goBack L126付近 | manager-lifecycle.ts | ユニットテスト: goBack後artifactHashes空確認 | AC-4 |

## Functional Requirements

### FR-1: readonlyフェーズのWrite/Edit制限 (F-001 -> AC-1)

delegate-coordinator.tsのcoordinator起動処理で、phaseGuide.bashCategoriesが'readonly'のみを含む場合、allowedToolsからWrite/Editを除外する。既存のplanOnlyフィルタパターンと統合し、論理OR条件で適用する。

検証条件:
- bashCategories=['readonly']のフェーズ(hearing, scope_definition, research, impact_analysis, requirements)でWrite/Editが除外される
- bashCategoriesに'readonly'以外も含むフェーズ(implementation等)ではWrite/Editが除外されない
- planOnly=trueとreadonly bashCategoriesの両方が成立する場合でも正常動作(冪等)

### FR-2: テストケースID構造行パターン (F-002 -> AC-2)

dod-helpers.tsのisStructuralLine()に正規表現パターン `/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[:：]/` を追加する。テストケースID行(TC-001:, AC-1:, F-001:等)を構造行として認識させ、checkDuplicateLines()の重複誤検出を防止する。

検証条件:
- "TC-001: テスト名" -> true
- "- TC-AC1-01: テスト名" -> true
- "FEAT-123: 機能名" -> true
- "通常のテキスト行" -> false (既存動作維持)
- 既存の構造行パターン(見出し、テーブル等)の判定が変わらないこと

### FR-3: RTM upsert動作 (F-003 -> AC-3)

manager-write.tsのapplyAddRTM()を、無条件pushからupsert動作に変更する。findIndexで既存IDを検索し、存在すればspliceで置換、なければpush。

検証条件:
- 新規ID追加: rtmEntries配列にpushされる
- 既存ID追加: 既存エントリが新しい値で上書きされ、配列長は変わらない
- 上書き後、applyUpdateRTMStatus()が正常動作すること

### FR-4: goBack時artifactHashesクリア (F-004 -> AC-4)

manager-lifecycle.tsのgoBack()で、retryCountクリア(L126)の直後にstate.artifactHashes = {}を追加する。

検証条件:
- goBack()実行後、state.artifactHashesが空オブジェクト{}である
- retryCountも従来通り空オブジェクトにクリアされる(回帰)
- normalizeForSigning()がartifactHashes={}を正しくdeleteする(HMAC署名影響なし)

### FR-5: リグレッションなし (AC-5)

全4件の修正後、既存テストスイートが全パスすること。TypeScriptビルド(tsc --noEmit)が成功すること。

## decisions

- REQ-001: AC定義はscope-definitionのACを精緻化して継承。hearingで確認済みのFB-3(size判定)は対象外を維持。
- REQ-002: 各FRにはunit testによる検証を必須とする。integration testは既存テストスイートのリグレッション確認で代替。
- REQ-003: F-001のreadonly判定条件はbashCategories配列が'readonly'のみを含むかで判定。bashCategoriesが空配列やプロパティ不在の場合はフィルタ対象外(安全側)。
- REQ-004: F-002の正規表現は[A-Z]{1,5}-\d{1,4}で一般的なID形式を網羅。6文字以上のプレフィックスや5桁以上の番号は対象外とする(実用上十分)。
- REQ-005: F-003のupsert方式はfindIndex+splice。Map構造への変更はrtmEntries配列を使用する既存コード全体への影響が大きいため採用しない。
- REQ-006: F-004の全クリア(artifactHashes={})を採用。部分クリア(targetPhase以降のみ)はハッシュキーにフェーズ名が含まれる保証がないため安全側の全クリアとする。
- REQ-007: 4件の修正は相互に独立しており、実装順序の制約なし。planning/implementationフェーズで並列作業可能。

## notInScope

- FB-3 (size判定): hearingフェーズで現状維持と判断済み。本タスクの修正対象外。
- coordinator-prompt.tsのbuildAllowedTools()変更: coordinatorBaseにWrite/Editが含まれないため変更不要。
- resetTask()のartifactHashesクリア: completedPhases全クリアにより成果物ハッシュ不整合が発生しないため対象外。
- Map構造への移行(F-003): rtmEntries配列の既存利用箇所への影響が大きいため見送り。
- 部分クリア方式(F-004): ハッシュキー形式の保証がないため採用しない。

## openQuestions

## artifacts

- docs/workflows/harness-report-fb-fixes/requirements.md (this file)
- docs/workflows/harness-report-fb-fixes/impact-analysis.md (input)

## next

planningフェーズで4件の修正の実装順序、具体的なコード差分、テストファイル構成を設計する。
