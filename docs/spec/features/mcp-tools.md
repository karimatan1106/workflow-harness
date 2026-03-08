# MCP Tools Specification (FR-4, AC-4)

baseCommit: c01d689

21 MCPツールの全仕様。定義はdefs-a.ts(11)+defs-b.ts(10)、ディスパッチはhandler.ts:19-54のswitch文。

## Tool Categories

### Lifecycle (3 tools)

| Tool | Handler | Source | Required Params |
|------|---------|--------|----------------|
| harness_start | handleHarnessStart | `handlers/lifecycle.ts:21-42` | taskName, userIntent |
| harness_status | handleHarnessStatus | `handlers/lifecycle.ts:44-64` | (none; taskId optional) |
| harness_next | handleHarnessNext | `handlers/lifecycle.ts:66-123` | taskId, sessionToken |

- **start**: タスク作成+sessionToken(64hex)発行+gitダーティ警告。userIntent>=20文字 (`defs-a.ts:14`)
- **status**: taskId省略時=全タスク一覧。verbose=true時=全フィールド返却
- **next**: DoD検証+フェーズ遷移。forceTransition=true時DoD省略。retryCount渡しでリトライ制御

### Approval & Navigation (4 tools)

| Tool | Handler | Source | Required Params |
|------|---------|--------|----------------|
| harness_approve | handleHarnessApprove | `handlers/approval.ts:16-74` | taskId, type, sessionToken |
| harness_set_scope | handleHarnessSetScope | `handlers/scope-nav.ts:15-31` | taskId, sessionToken |
| harness_complete_sub | handleHarnessCompleteSub | `handlers/scope-nav.ts:33-78` | taskId, subPhase, sessionToken |
| harness_back | handleHarnessBack | `handlers/scope-nav.ts:80-94` | taskId, targetPhase, sessionToken |
| harness_reset | handleHarnessReset | `handlers/scope-nav.ts:96-108` | taskId, sessionToken |

- **approve**: 5種承認ゲート通過。IA-1(openQuestions)+IA-2(AC>=3)検証+ART-1ハッシュ記録
- **set_scope**: addMode=true時マージ、false時上書き。files/dirs/glob対応
- **complete_sub**: 並列サブフェーズ完了+DoD検証。失敗時PHA-1ロールバック
- **back**: 指定フェーズへロールバック+retryCountリセット
- **reset**: scope_definitionへ全リセット

### Recording (7 tools)

| Tool | Handler | Source | Required Params |
|------|---------|--------|----------------|
| harness_record_proof | handleHarnessRecordProof | `handlers/recording.ts:11-22` | taskId, level, check, result, evidence, sessionToken |
| harness_add_ac | handleHarnessAddAc | `handlers/recording.ts:24-40` | taskId, id, description, sessionToken |
| harness_add_rtm | handleHarnessAddRtm | `handlers/recording.ts:42-58` | taskId, id, requirement, sessionToken |
| harness_record_feedback | handleHarnessRecordFeedback | `handlers/recording.ts:60-73` | taskId, feedback, sessionToken |
| harness_capture_baseline | handleHarnessCaptureBaseline | `handlers/recording.ts:75-90` | taskId, totalTests, passedTests, failedTests, sessionToken |
| harness_record_test_result | handleHarnessRecordTestResult | `handlers/recording.ts:92-107` | taskId, exitCode, output, sessionToken |
| harness_record_test | handleHarnessRecordTest | `handlers/recording.ts:109-121` | taskId, testFile, sessionToken |

- **record_proof**: L1-L4証拠をproofLog配列に追記。phase自動付与
- **add_ac**: AC-N形式ID+description。status=open初期値
- **add_rtm**: F-NNN形式ID。designRef/codeRef/testRefはオプション。status=pending初期値
- **record_test_result**: exitCode+output(>=50文字,最大5000文字truncate: `manager.ts:118`)
- **capture_baseline**: totalTests/passedTests/failedTests記録。regression_testのDoD前提条件

### Query & Update (7 tools)

| Tool | Handler | Source | Required Params |
|------|---------|--------|----------------|
| harness_get_test_info | handleHarnessGetTestInfo | `handlers/query.ts:15-21` | taskId |
| harness_record_known_bug | handleHarnessRecordKnownBug | `handlers/query.ts:23-36` | taskId, testName, description, severity, sessionToken |
| harness_get_known_bugs | handleHarnessGetKnownBugs | `handlers/query.ts:38-43` | taskId |
| harness_get_subphase_template | handleHarnessGetSubphaseTemplate | `handlers/query.ts:45-65` | phase |
| harness_pre_validate | handleHarnessPreValidate | `handlers/query.ts:67-85` | taskId, sessionToken |
| harness_update_ac_status | handleHarnessUpdateAcStatus | `handlers/query.ts:87-103` | taskId, id, status, sessionToken |
| harness_update_rtm_status | handleHarnessUpdateRtmStatus | `handlers/query.ts:105+` | taskId, id, status, sessionToken |

- **get_test_info**: testFiles配列+baseline取得。sessionToken不要
- **record_known_bug**: severity=low/medium/high/critical。targetPhase/issueUrlオプション
- **get_subphase_template**: buildSubagentPrompt経由でフェーズテンプレート取得。taskIdオプション
- **pre_validate**: DoDドライラン。遷移せずチェック結果のみ返却
- **update_ac_status**: open/met/not_met。testCaseIdオプション
- **update_rtm_status**: pending/implemented/tested/verified。codeRef/testRefオプション

## Tool Definitions

- Part A (11 tools): `defs-a.ts:6-164` - start,status,next,approve,set_scope,complete_sub,back,reset,record_proof,add_ac,add_rtm
- Part B (10 tools): `defs-b.ts:6-158` - record_feedback,capture_baseline,record_test_result,record_test,get_test_info,record_known_bug,get_known_bugs,get_subphase_template,pre_validate,update_ac_status,update_rtm_status
- Aggregation: `handler.ts:17` (`TOOL_DEFINITIONS = [...TOOL_DEFS_A, ...TOOL_DEFS_B]`)

## Session Validation (HMAC-SHA256)

Source: `handler-shared.ts:34-39` (`validateSession`)

1. token存在+string型チェック
2. `token === state.sessionToken` 一致検証
3. 不一致時エラー返却

**二層ルール**:
- Layer 1: 全MCPツール呼出時にsessionToken必須(start/status/get_test_info/get_known_bugs/get_subphase_templateは除外)
- Layer 2: testing/regression_testサブエージェントのみsessionTokenを渡す

**HMAC署名** (`utils/hmac.ts:1-85`):
- Algorithm: HMAC-SHA256
- Key: `randomBytes(32).toString('hex')` = 64 hex chars
- Key rotation: current+previous鍵で検証 (`verifyStateWithRotation`)
- State signing: canonical JSON (sorted keys) -> HMAC-SHA256
- sessionToken: `randomBytes(32).toString('hex')` = 64 hex chars
- taskId: `crypto.randomUUID()`

## Skill File Routing

Source: `handler-shared.ts:42-73` (`SKILL_FILE_ROUTING`)

30フェーズ -> スキルファイル名配列のハードコードマッピング。最大4ファイル/フェーズ。

`buildPhaseGuide` (`handler-shared.ts:75-97`) がフェーズ設定を統合返却:
- model / bashCategories / allowedExtensions / requiredSections / minLines / skillFiles

## Retry System

Source: `retry.ts:1-153`

### Error Classification (EAC-1)

| Class | Pattern | Source |
|-------|---------|--------|
| FileNotFound | file missing, not found, missing input | `retry.ts:24` |
| SyntaxError | forbidden, bracket placeholder, duplicate, TOON parse, Markdown headers | `retry.ts:25` |
| LogicError | section density, content lines, missing required, AC-N, NOT_IN_SCOPE, RTM, baseline | `retry.ts:26` |
| Unknown | (fallback) | `retry.ts:27` |

### Error-to-Improvement Mapping

15パターンのエラー -> 改善指示マッピング (`retry.ts:34-128`):
禁止語/密度不足/重複行/必須セクション欠損/行数不足/プレースホルダー/ファイル欠損/TOONパースエラー/exit code/RTMステータス/AC未達/AC件数不足/NOT_IN_SCOPE欠損/OPEN_QUESTIONS欠損/baseline未記録

### Model Escalation

| Condition | Action | Source |
|-----------|--------|--------|
| retry>=2 && model=haiku | suggest sonnet | `retry.ts:137` |
| retry>=3 | force sonnet | `retry.ts:139` |

### Retry Limits

- maxRetries=5 (RLM-1): `lifecycle.ts:77-80`
- 同一エラー3回=VDB-1警告: `lifecycle.ts:100-102`
- Prompt: phase名+taskName+失敗理由(コードブロック参照のみ)+改善要求 (`retry.ts:145-149`)

## Dispatcher

Source: `handler.ts:19-54`

```
handleToolCall(name, args, stateManager) -> switch(name) 21分岐
  catch -> respondError('Internal error in tool ...')
```

Response format: `{ content: [{ type: 'text', text: JSON.stringify(obj) }] }`
- Success: `respond(obj)` (`handler-shared.ts:11-13`)
- Error: `respondError(message)` (`handler-shared.ts:15-17`)
