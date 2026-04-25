phase: test_design
task: harness-report-fb-fixes
status: complete
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/requirements.md, docs/workflows/harness-report-fb-fixes/design-review.md

## acTcMapping

| AC | TC IDs | Description |
|---|---|---|
| AC-1 | TC-AC1-01, TC-AC1-02, TC-AC1-03 | readonlyフェーズWrite/Edit除外 |
| AC-2 | TC-AC2-01, TC-AC2-02, TC-AC2-03, TC-AC2-04 | テストケースID構造行判定 |
| AC-3 | TC-AC3-01, TC-AC3-02, TC-AC3-03 | RTM upsert動作 |
| AC-4 | TC-AC4-01, TC-AC4-02, TC-AC4-03 | goBack artifactHashesクリア |
| AC-5 | TC-AC5-01 | リグレッションなし |

## testCases

### AC-1: readonlyフェーズWrite/Edit制限 (F-001)

テストファイル: delegate-coordinator-readonly.test.ts

- TC-AC1-01: bashCategories=['readonly']のphaseGuideでcoordinator起動時、allowedToolsにWrite/Editが含まれないこと (readonly単独フェーズのフィルタ確認)
- TC-AC1-02: bashCategories=['readonly','testing']のphaseGuideでcoordinator起動時、allowedToolsにWrite/Editが含まれること (複合カテゴリではフィルタ非適用確認)
- TC-AC1-03: planOnly=trueかつbashCategories=['readonly']の条件でcoordinator起動時、Write/Editが除外され正常動作すること (二重条件の冪等性確認)

### AC-2: テストケースID構造行パターン (F-002)

テストファイル: dod-extended.test.ts (既存ファイルに追加)

- TC-AC2-01: "TC-001: テスト名"をisStructuralLine()に渡すとtrueを返すこと (プレフィックスなしの標準ID形式)
- TC-AC2-02: "- TC-AC1-01: テスト名"をisStructuralLine()に渡すとtrueを返すこと (リストマーカー付きID形式)
- TC-AC2-03: "FEAT-123: 機能名"をisStructuralLine()に渡すとtrueを返すこと (5文字プレフィックスの上限境界値)
- TC-AC2-04: "通常のテキスト行"をisStructuralLine()に渡すとfalseを返すこと (非構造行の既存動作維持)

### AC-3: RTM upsert動作 (F-003)

テストファイル: manager-write-rtm.test.ts (新規)

- TC-AC3-01: rtmEntriesが空の状態でapplyAddRTM({id:'F-010',...})を呼ぶと、配列にpushされ長さが1になること (新規ID追加パス)
- TC-AC3-02: rtmEntriesにid='F-001'のエントリがある状態でapplyAddRTM({id:'F-001',requirement:'更新値'})を呼ぶと、既存エントリが上書きされ配列長が変わらないこと (既存ID上書きパス)
- TC-AC3-03: TC-AC3-02の上書き後、applyUpdateRTMStatus('F-001','done')を呼ぶとstatusが正常に更新されること (upsert後の後続操作整合性)

### AC-4: goBack artifactHashesクリア (F-004)

テストファイル: manager-lifecycle-reset.test.ts (既存ファイルに追加)

- TC-AC4-01: artifactHashes={phase1:'hash1'}の状態でgoBack()を実行し、state.artifactHashesが空オブジェクト{}であること (全クリア動作確認)
- TC-AC4-02: retryCount={phase1:2}の状態でgoBack()を実行し、state.retryCountが空オブジェクト{}であること (既存retryCountクリアの回帰確認)
- TC-AC4-03: completedPhases=['a','b','c']の状態でgoBack('b')を実行し、completedPhasesが['a']にスライスされること (既存completedPhasesスライスの回帰確認)

### AC-5: リグレッション確認

- TC-AC5-01: vitest run --reporter=verbose で既存テストスイート全件がパスすること (全体リグレッション確認)

## testStrategy

- 単体テスト: 各FR(F-001~F-004)に対応するユニットテストで機能を検証する
- 回帰テスト: 既存テストスイート(vitest)の全パスで回帰を確認する
- 型検査: tsc --noEmitで型安全性を検証する
- 脅威対応: DR-002で指摘されたupsertログ(console.warn)の出力もTC-AC3-02内で検証する

## decisions

- TD-001: テストケースIDはTC-ACN-NN形式で統一し、AC番号との対応を明示する
- TD-002: AC-1のテストはphaseGuideオブジェクトのモックで実施。実際のdelegate呼び出しは結合テスト範囲とする
- TD-003: AC-2のテストは正規表現の境界値(1文字プレフィックス、5文字プレフィックス)を含める
- TD-004: AC-3のテストは上書き後の後続操作(applyUpdateRTMStatus)まで検証し、upsert整合性を担保する
- TD-005: AC-4の回帰テストはretryCountとcompletedPhasesの2項目を含め、goBack()の既存動作保全を確認する
- TD-006: AC-5はvitest単体実行で検証し、ビルドエラーはtsc --noEmitで別途確認する

## artifacts

- docs/workflows/harness-report-fb-fixes/test-design.md (this file)
- docs/workflows/harness-report-fb-fixes/requirements.md (input)
- docs/workflows/harness-report-fb-fixes/design-review.md (input)

## next

implementationフェーズでPL-01~PL-08を実装し、本テスト設計のTC-AC1-01~TC-AC5-01を実行して全パスを確認する。
