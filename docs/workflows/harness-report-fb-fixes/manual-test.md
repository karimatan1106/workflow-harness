# Manual Test Results: harness-report-fb-fixes

phase: manual_test
task: harness-report-fb-fixes
date: 2026-03-30
tester: coordinator

## Test Cases

### MT-1: FB-1+5 readonlyフェーズWrite/Edit制限

target: coordinator-prompt.ts (buildAllowedTools関数)
method: coordinator-prompt.tsのbuildAllowedTools関数を目視確認
evidence: L29-34にreadonlyフェーズ判定ロジックが存在。bashCategoriesが['readonly']の場合、merged SetからWrite/Editをdeleteする。coordinatorBaseにWrite/Editは含まれないため、phaseToolsから追加された場合のみ影響。
判定: PASS (buildAllowedToolsにreadonly bashCategories判定が存在し、Write/Editをfilterする)

### MT-2: FB-2 isStructuralLineテストケースIDパターン

target: dod-helpers.ts (isStructuralLine関数)
method: dod-helpers.tsのisStructuralLine関数を目視確認
evidence: L19に正規表現 /^(?:[-*]\s+)?[A-Z]{1,5}-[A-Z0-9]{1,5}(?:-\d{1,4})?[:：]/ が追加されている。AC-1:, MT-01:, F-001:, RTM-A1: 等のテストケースID形式にマッチし、構造行として認識される。重複行検出でスキップされるためcontent_validation通過に寄与。
判定: PASS (正規表現パターンがテストケースID形式を網羅的にカバーしている)

### MT-3: FB-4 applyAddRTM upsert

target: manager-write.ts (applyAddRTM関数)
method: manager-write.tsのapplyAddRTM関数を目視確認
evidence: L127-132にupsertロジック実装。findIndex(e => e.id === entry.id)で既存エントリを検索し、idx >= 0ならsplice(idx, 1, entry)で置換、それ以外はpush(entry)で追加。同一IDのRTMエントリが重複しない。refreshCheckpointTraceabilityも呼ばれ整合性を維持。
判定: PASS (findIndex→splice/push分岐によるupsertが正しく実装されている)

### MT-4: FB-6 goBack artifactHashesクリア

target: manager-lifecycle.ts (goBack関数)
method: manager-lifecycle.tsのgoBack関数を目視確認
evidence: L126-127にretryCount={}とartifactHashes={}が連続して設定されている。goBack時に前フェーズのartifactHashesが残留するとartifact_drift検出で偽陽性が発生する問題を防止。retryCountクリア直後の適切な位置に配置。
判定: PASS (L127にstate.artifactHashes={}がretryCountクリア直後に追加済み)

### MT-5: 全ファイル200行以下確認

target: 4ファイル全体
method: 行数カウント
evidence:
- coordinator-prompt.ts: 96行
- dod-helpers.ts: 154行
- manager-write.ts: 163行
- manager-lifecycle.ts: 158行

全ファイルが200行制限を遵守している。
判定: PASS (4ファイル全て200行以下、最大163行)

## Decisions

- MT-D1: readonlyフェーズのWrite/Edit除外はSet.deleteパターンで実装されており、coordinatorBaseに含まれないツールも安全に処理される
- MT-D2: isStructuralLineの正規表現は5文字以下の大文字プレフィックスを許容し、AC/MT/FB/RTM/F等の全IDプレフィックスをカバー
- MT-D3: applyAddRTMのupsertはfindIndex+spliceパターンで、配列の順序を保持しつつ既存エントリを置換する
- MT-D4: artifactHashesクリアはgoBack専用。resetTaskにはartifactHashesクリアがないが、completedPhases=[]で全フェーズリセットされるため問題なし
- MT-D5: 4ファイル全て200行制限内。manager-write.ts(163行)が最大だが余裕がある

## Summary

total: 5
passed: 5
failed: 0
blocked: 0
result: ALL PASS

## artifacts

- docs/workflows/harness-report-fb-fixes/manual-test.md (this file)

## next

docs_updateフェーズでADRを作成し、コミットフェーズへ進む。
