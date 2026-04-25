phase: planning
task: harness-report-fb-fixes
status: complete
inputArtifact: docs/workflows/harness-report-fb-fixes/requirements.md

architectureDecisions[4]{id,decision,alternatives,rationale}:
  AD-1, "readonlyフェーズ判定をplanOnlyフィルタと同じfilter chainで実装", "専用のbuildAllowedTools分岐を追加", "既存パターンとの一貫性を保ち変更箇所を最小化"
  AD-2, "isStructuralLine()に正規表現1行追加で対応", "checkDuplicateLines側でホワイトリスト除外", "構造行の定義を一元管理する既存設計に従う"
  AD-3, "applyAddRTM()内でfindIndex+spliceによるupsert実装", "rtmEntriesをMapに変更", "既存配列インターフェースを維持し影響範囲を限定"
  AD-4, "goBack()でartifactHashes={}の全クリアを採用", "targetPhase以降のハッシュのみ選択削除", "ハッシュキーにフェーズ名が含まれる保証がなく安全側を選択"

implementationSteps[8]{id,description,files,dependsOn}:
  PL-01, "delegate-coordinator.tsのallowedTools算出にreadonly判定を追加。bashCategories.length===1 && bashCategories[0]==='readonly'の場合Write/Editをフィルタ", "workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts", none
  PL-02, "dod-helpers.tsのisStructuralLine()にテストケースIDパターン追加。/^(?:[-*]\\s+)?[A-Z]{1,5}-\\d{1,4}[:：]/の正規表現を短ラベル行パターン(L26)の直前に挿入", "workflow-harness/mcp-server/src/gates/dod-helpers.ts", none
  PL-03, "manager-write.tsのapplyAddRTM()をupsert動作に変更。findIndexで既存ID検索し存在すればsplice置換/なければpush", "workflow-harness/mcp-server/src/state/manager-write.ts", none
  PL-04, "manager-lifecycle.tsのgoBack()にstate.artifactHashes={}を追加。L126のretryCount={}の直後に配置", "workflow-harness/mcp-server/src/state/manager-lifecycle.ts", none
  PL-05, "dod-extended.test.tsにisStructuralLine()のテストケースIDパターンテストを追加", "workflow-harness/mcp-server/src/__tests__/dod-extended.test.ts", PL-02
  PL-06, "manager-lifecycle-reset.test.tsにgoBack時artifactHashesクリアテストを追加", "workflow-harness/mcp-server/src/__tests__/manager-lifecycle-reset.test.ts", PL-04
  PL-07, "manager-write.test.ts(新規)にapplyAddRTM upsertテストを追加。新規ID追加と既存ID上書きの2ケース", "workflow-harness/mcp-server/src/__tests__/manager-write-rtm.test.ts", PL-03
  PL-08, "delegate-coordinator-readonly.test.ts(新規)にreadonlyフェーズのWrite/Editフィルタテストを追加", "workflow-harness/mcp-server/src/__tests__/delegate-coordinator-readonly.test.ts", PL-01

codeDiffs[4]{id,file,before,after}:
  CD-1, "delegate-coordinator.ts L120-125", "const allowedTools = planOnly ? baseAllowedTools.split(',').filter(t => !['Write', 'Edit'].includes(t)).join(',') : baseAllowedTools;", "const isReadonlyPhase = phaseGuide.bashCategories.length === 1 && phaseGuide.bashCategories[0] === 'readonly'; const allowedTools = (planOnly || isReadonlyPhase) ? baseAllowedTools.split(',').filter(t => !['Write', 'Edit'].includes(t)).join(',') : baseAllowedTools;"
  CD-2, "dod-helpers.ts L26(短ラベル行の直前に挿入)", "(該当行なし)", "if (/^(?:[-*]\\s+)?[A-Z]{1,5}-\\d{1,4}[:：]/.test(trimmed)) return true;"
  CD-3, "manager-write.ts L126-129 applyAddRTM()", "state.rtmEntries.push(entry);", "const existingIdx = state.rtmEntries.findIndex(e => e.id === entry.id); if (existingIdx >= 0) { state.rtmEntries.splice(existingIdx, 1, entry); } else { state.rtmEntries.push(entry); }"
  CD-4, "manager-lifecycle.ts L126 goBack()内retryCount={}の直後", "(該当行なし)", "state.artifactHashes = {};"

testFiles[4]{id,path,cases}:
  TF-1, "workflow-harness/mcp-server/src/__tests__/delegate-coordinator-readonly.test.ts", "readonlyフェーズでWrite/Edit除外確認 + 非readonlyフェーズで除外されない確認"
  TF-2, "workflow-harness/mcp-server/src/__tests__/dod-extended.test.ts(既存に追加)", "TC-001:/AC-1:/F-001:/- TC-AC1-01:がtrue + 通常テキストがfalse"
  TF-3, "workflow-harness/mcp-server/src/__tests__/manager-write-rtm.test.ts", "新規ID push確認 + 既存ID splice上書き確認 + 上書き後配列長不変確認"
  TF-4, "workflow-harness/mcp-server/src/__tests__/manager-lifecycle-reset.test.ts(既存に追加)", "goBack後artifactHashes空オブジェクト確認"

rtmEntries[4]{id,requirement,status}:
  F-001, "readonlyフェーズでcoordinatorのallowedToolsからWrite/Editを除外する", pending
  F-002, "isStructuralLine()にテストケースID行パターンを追加する", pending
  F-003, "applyAddRTM()で既存IDをfindIndex+spliceで置換しなければpushする", pending
  F-004, "goBack()でstate.artifactHashes={}を追加する", pending

## decisions

- PL-001: FB-1+5はplanOnlyフィルタと同一パターン(allowedTools.filter)で実装し、コードの一貫性を維持する
- PL-002: FB-2の正規表現は[A-Z]{1,5}-\d{1,4}で汎用IDパターンをカバーする
- PL-003: FB-4はfindIndex+splice方式でupsertを実装する。Map構造への変更は影響範囲が大きいため見送る
- PL-004: FB-6はartifactHashes全クリア({})を採用。部分クリアはキー形式の保証がないため安全側を選択
- PL-005: テストは各修正に対応するユニットテストを既存テストファイルに追加する方針
- PL-006: 4件の修正は相互独立のため1つのimplementationフェーズで一括実装する

## artifacts

- docs/workflows/harness-report-fb-fixes/planning.md (this file)
- docs/workflows/harness-report-fb-fixes/requirements.md (input)
- docs/workflows/harness-report-fb-fixes/threat-model.md (input)

## next

design_reviewフェーズでAC-1~AC-5とF-001~F-005の設計整合性を検証する。
