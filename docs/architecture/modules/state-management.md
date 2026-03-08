# State Management Module

baseCommit: c01d689 | FR-5 | AC-5

---

## 1. TaskState v4 Schema

TaskState v4は70フィールドを持つタスク状態インターフェース。`src/state/types.ts:52-121`で定義。

| グループ | フィールド | 型 |
|---------|----------|-----|
| Identity | taskId, taskName, version(=4) | string, string, literal 4 |
| Phase tracking | phase, completedPhases, skippedPhases, subPhaseStatus | PhaseName, PhaseName[], PhaseName[], Record<string, SubPhaseStatus> |
| Sizing | size, riskScore | TaskSize, RiskScore({total,factors}) |
| Intent | userIntent, openQuestions, notInScope | string, string[], string[] |
| Scope | scopeFiles, scopeDirs, scopeGlob, plannedFiles | string[], string[], string?, string[] |
| Traceability | acceptanceCriteria, rtmEntries, proofLog, invariants | AcceptanceCriterion[], RTMEntry[], ProofEntry[], Invariant[] |
| Checkpoint | checkpoint | Checkpoint({taskId,phase,completedPhases,timestamp,sha256,userIntent,scopeFiles,acceptanceCriteria,rtmEntries}) |
| Paths | docsDir, workflowDir | string, string |
| Extended | approvals, feedbackLog, baseline, testResults, resetHistory, testFiles, knownBugs | optional各種 |
| Sprint 1-2 | retryCount, artifactTimestamps, requirementCount, artifactHashes, parallelPhaseBackupLog | optional各種 |
| Security | sessionToken, stateIntegrity | string, string(HMAC-SHA256) |
| Metadata | createdAt, updatedAt, parentTaskId, childTaskIds | string, string, string?, string[]? |

関連型定義: `src/state/types-core.ts:1-168`(PhaseName, TaskSize, RiskScore, RTMEntry, AcceptanceCriterion, ProofEntry, Checkpoint, SubPhaseStatus, PhaseConfig)。`src/state/types-invariant.ts:1-23`(Invariant, InvariantStatus)。

---

## 2. Zod Validation

`src/state/types-core.ts:183-194`で定義。

```
TaskStateSchema = z.object({
  taskId:         z.string().uuid(),
  taskName:       z.string().min(1),
  version:        z.literal(4),
  phase:          PhaseNameSchema,       // z.enum(PHASE_NAMES)
  size:           TaskSizeSchema,        // z.enum(['small','medium','large'])
  userIntent:     z.string().min(20),
  sessionToken:   z.string().min(32),
  stateIntegrity: z.string(),
  createdAt:      z.string().datetime(),
  updatedAt:      z.string().datetime(),
}).passthrough()
```

`passthrough()`により未知フィールドを許容し、前方互換性を確保。

---

## 3. HMAC-SHA256 Signing

`src/utils/hmac.ts:1-85`。全6関数。

| 関数 | 行 | 役割 |
|-----|-----|------|
| loadHmacKeys | 26-40 | HmacKeys(current+previous+rotatedAt)をJSON読込。未存在時はrandomBytes(32)で生成 |
| ensureHmacKeys | 42-44 | current鍵を返却(起動時に呼出) |
| computeHmac | 46-48 | createHmac('sha256',key).update(data).digest('hex') |
| signState | 50-54 | stateIntegrityを除外→キーソート→canonical JSON→computeHmac |
| verifyState | 56-61 | 保存済みHMACと再計算HMACを比較 |
| verifyStateWithRotation | 68-77 | current鍵で検証→失敗時にprevious鍵で再検証(鍵ローテーション対応) |

鍵生成: `randomBytes(32).toString('hex')` = 64文字hex。鍵ファイル: `{STATE_DIR}/hmac-keys.json`。
セッショントークン: `generateSessionToken()` = `randomBytes(32).toString('hex')` (hmac.ts:79-81)。
タスクID: `generateTaskId()` = `randomUUID()` (hmac.ts:83-85)。

---

## 4. StateManager (27 methods)

`src/state/manager.ts:23-196`。薄いオーケストレータとしてmanager-read/manager-write/manager-invariantに委譲。

| メソッド | 行 | 操作 |
|---------|-----|------|
| constructor | 25 | ensureHmacKeys(STATE_DIR)で鍵取得 |
| createTask | 27-30 | createTaskState→persistState→ensureStateDirs→writeTaskIndex |
| loadTask | 32 | loadTaskFromDisk(HMAC検証付き) |
| advancePhase | 34-45 | getNextPhase→completedPhases追加→updateCheckpoint→signAndPersist→appendProgressLog |
| approveGate | 47-54 | approvals[type]={approvedAt}記録 |
| completeSubPhase | 56-72 | 依存チェック→subPhaseStatus更新(PCM-1重複完了防止) |
| goBack | 74-83 | completedPhasesをスライス→retryCountリセット |
| resetTask | 85-93 | 全状態リセット→resetHistory追記 |
| addAcceptanceCriterion | 95-97 | applyAddAC→signAndPersist |
| addRTMEntry | 98-100 | applyAddRTM→signAndPersist |
| recordFeedback | 102-107 | feedbackLog追記 |
| recordBaseline | 108-112 | baseline={capturedAt,totalTests,passedTests,failedTests}記録 |
| recordTestResult | 114-120 | testResults追記(output上限5000文字) |
| addProof | 122-127 | proofLog追記 |
| updateScope | 129-138 | addMode=true時はSet合併、false時は上書き |
| listTasks | 140 | listTasksFromDisk委譲 |
| recordTestFile | 142-148 | testFiles重複排除追加 |
| getTestInfo | 150-154 | testFiles+baseline返却 |
| updateAcceptanceCriterionStatus | 156-161 | applyUpdateACStatus→signAndPersist |
| updateRTMEntryStatus | 163-168 | applyUpdateRTMStatus→signAndPersist |
| recordKnownBug | 170-174 | knownBugs追記(severity型キャスト) |
| getKnownBugs | 175 | applyGetKnownBugs委譲 |
| incrementRetryCount | 176-179 | applyIncrementRetryCount→signAndPersist |
| getRetryCount | 180 | applyGetRetryCount委譲 |
| resetRetryCount | 181-184 | applyResetRetryCount→条件付きsignAndPersist |
| recordArtifactHash | 185-187 | applyRecordArtifactHash→signAndPersist |
| addInvariant | 188-191 | applyAddInvariant(重複ID拒否)→signAndPersist |
| updateInvariantStatus | 192-195 | applyUpdateInvariantStatus→signAndPersist |

---

## 5. Persistence: Read / Write Modules

**manager-read.ts** (`src/state/manager-read.ts:1-91`):
- `getStatePath(taskId,taskName)` :13-15 — `{STATE_DIR}/workflows/{taskId}_{taskName}/workflow-state.json`
- `loadTaskFromDisk(taskId)` :22-40 — ディレクトリスキャン→JSON.parse→`verifyStateWithRotation`でHMAC検証。検証失敗時はnull返却
- `listTasksFromDisk()` :42-63 — completedを除外した全タスク一覧。HMAC検証済みのみ返却
- `buildTaskIndex(STATE_DIR)` :65-91 — 全タスク(completed含む)のサマリ配列を構築

**manager-write.ts** (`src/state/manager-write.ts:1-121`):
- `persistState(state)` :22-27 — JSON.stringify→writeFileSync(再帰的ディレクトリ作成)
- `createTaskState(taskName,userIntent,hmacKey,files,dirs)` :42-61 — 全フィールド初期化→Checkpoint生成→HMAC署名
- `signAndPersist(state,hmacKey)` :63-66 — signState→persistState
- `updateCheckpoint(state,targetPhase)` :68-73 — phase/completedPhases/timestampを同期→sha256再計算
- `refreshCheckpointTraceability(state)` :75-80 — AC/RTMをCheckpointに同期
- `applyAddAC` :82-87, `applyAddRTM` :89-93 — 追加+requirementCount更新+Checkpoint同期
- `applyUpdateACStatus` :95-100, `applyUpdateRTMStatus` :113-120 — ステータス更新+Checkpoint同期
- `appendProgressLog(state,completedPhase,nextPhase)` :103-111 — `{docsDir}/claude-progress.txt`に追記(ANT-4)

---

## 6. Reflector-Curator-ACE 3-Layer Learning Pipeline

データフロー: DoD失敗 → Reflector(stash) → リトライ成功 → Reflector(promote) → タスク完了 → Curator(prune/dedup) → ACE(cross-task promote)

**Reflector** (`src/tools/reflector.ts:1-153`, `src/tools/reflector-types.ts:1-70`):
- `stashFailure(taskId,phase,errorMessage,retryCount)` :55-75 — 失敗パターンをstashedFailuresに格納(上限20件)。既存lessonのharmfulCount加算
- `promoteStashedFailure(taskId,phase,retryCount)` :82-110 — リトライ成功時にstashをlessonに昇格。MAX_LESSONS=50超過時はqualityScore最低を削除
- `getLessonsForPhase(phase)` :115-120 — qualityScore降順で上位5件返却
- `formatLessonsForPrompt(phase)` :126-131 — ACE bullet形式でプロンプト注入文字列を生成
- `qualityScore` :40-43 — `helpful/(helpful+harmful+1)`、初期値0.5
- ReflectorStore v3: `{version:3, nextLessonId, lessons[], stashedFailures[]}`。v2からの自動マイグレーション対応

**Curator** (`src/tools/curator.ts:1-140`, `src/tools/curator-helpers.ts:1-98`):
- `runCuratorCycle(taskId,taskName)` :33-140 — タスク完了時に実行。4ステップ:
  1. Stale剪定: 30日超過+hitCount<=1のlesson削除
  2. Fuzzy dedup: `computePatternSimilarity`>=0.7の重複マージ(prefix overlap)
  3. StashedFailures清掃: 完了タスク分+7日超過分を削除
  4. Trim: MAX_LESSONS_AFTER_CURATION=40超過時にqualityScore最低から削除
- `saveCuratorReport(report)` :74-98 — curator-log.jsonに直近20件保存

**ACE Context** (`src/tools/ace-context.ts:1-103`):
- `extractAndStoreBullets(lessons)` :50-85 — qualityScore>=0.6のlessonをAceBulletに変換→ace-context.json永続化。既存IDは統計更新のみ
- `getTopCrossTaskBullets(n)` :91-103 — qualityScore降順でn件返却(タスク横断知識注入用)

---

## 7. Invariant Management

`src/state/types-invariant.ts:1-23`: Invariant型 = `{id:string, description, status:'open'|'held'|'violated', proofTier?:ProofTier, verifiedAt?, evidence?}`

`src/state/manager-invariant.ts:1-58`:
- `applyAddInvariant(state,invariant)` :10-15 — 重複ID検出時はfalse返却
- `applyUpdateInvariantStatus(state,invId,status,evidence?)` :18-28 — held/violated時にverifiedAtを自動記録
- `applyGetKnownBugs(state)` :31-33 — knownBugs返却
- `applyIncrementRetryCount(state,phase)` :36-39 — retryCount[phase]をインクリメント
- `applyGetRetryCount(state,phase)` :43-45 — retryCount取得(未設定時0)
- `applyResetRetryCount(state,phase)` :48-52 — retryCount[phase]を削除
- `applyRecordArtifactHash(state,fp,hash)` :55-58 — artifactHashes[fp]=hash記録
